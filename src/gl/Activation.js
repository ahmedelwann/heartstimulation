import * as THREE from 'three';

/**
 * ActivationField
 * ---------------------------------------------------------------------------
 * The bridge between anatomy and physiology.
 *
 * Every myocardial vertex carries an activation time. Those times are solved
 * once per rhythm change — never per frame — by running a Dijkstra front over
 * the mesh graph, which is the discrete form of an eikonal equation:
 *
 *      |∇T| = 1 / v
 *
 * The same times then drive
 *   • the contraction deformation in the tissue shader,
 *   • the visible depolarisation front,
 *   • the QRS complex, through a dipole summation over the depolarising surface.
 *
 * Because all three read the same field, they cannot disagree with each other.
 *
 * MODEL BOUNDARY. This is a surface model of activation. It does not solve the
 * bidomain equations, it has no fibre orientation, and it treats the wall as a
 * single surface with a transmural correction term. Ectopic wavefronts are
 * therefore geometrically real but only approximately physiological; the
 * narrow-complex case uses an effective conduction velocity calibrated to
 * reproduce a normal QRS duration. See README §Scientific model.
 */

class Graph {
  constructor(geometry) {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const n = pos.count;
    this.n = n;
    this.pos = pos.array;
    const edgeSet = new Set();
    const adj = Array.from({ length: n }, () => []);
    const push = (a, b) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      const dx = this.pos[a * 3] - this.pos[b * 3];
      const dy = this.pos[a * 3 + 1] - this.pos[b * 3 + 1];
      const dz = this.pos[a * 3 + 2] - this.pos[b * 3 + 2];
      const w = Math.hypot(dx, dy, dz);
      adj[a].push(b, w);
      adj[b].push(a, w);
    };
    if (index) {
      const idx = index.array;
      for (let i = 0; i < idx.length; i += 3) {
        push(idx[i], idx[i + 1]);
        push(idx[i + 1], idx[i + 2]);
        push(idx[i + 2], idx[i]);
      }
    } else {
      for (let i = 0; i < n; i += 3) { push(i, i + 1); push(i + 1, i + 2); push(i + 2, i); }
    }
    this.adj = adj.map((a) => Float32Array.from(a));
  }

  /** Multi-source Dijkstra. Returns Float32Array of seconds. */
  solve(seeds, velocity) {
    const n = this.n;
    const dist = new Float32Array(n).fill(Infinity);
    const heap = [];
    const push = (d, v) => {
      heap.push(d, v);
      let i = heap.length / 2 - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p * 2] <= heap[i * 2]) break;
        const td = heap[p * 2], tv = heap[p * 2 + 1];
        heap[p * 2] = heap[i * 2]; heap[p * 2 + 1] = heap[i * 2 + 1];
        heap[i * 2] = td; heap[i * 2 + 1] = tv;
        i = p;
      }
    };
    const pop = () => {
      const d = heap[0], v = heap[1];
      const lv = heap.pop(), ld = heap.pop();
      if (heap.length) {
        heap[0] = ld; heap[1] = lv;
        let i = 0;
        const size = heap.length / 2;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let s = i;
          if (l < size && heap[l * 2] < heap[s * 2]) s = l;
          if (r < size && heap[r * 2] < heap[s * 2]) s = r;
          if (s === i) break;
          const td = heap[s * 2], tv = heap[s * 2 + 1];
          heap[s * 2] = heap[i * 2]; heap[s * 2 + 1] = heap[i * 2 + 1];
          heap[i * 2] = td; heap[i * 2 + 1] = tv;
          i = s;
        }
      }
      return [d, v];
    };
    for (const s of seeds) { dist[s] = 0; push(0, s); }
    while (heap.length) {
      const [d, v] = pop();
      if (d > dist[v]) continue;
      const adj = this.adj[v];
      if (!adj) continue;
      for (let i = 0; i < adj.length; i += 2) {
        const u = adj[i];
        const nd = d + adj[i + 1] / velocity;
        if (nd < dist[u]) { dist[u] = nd; push(nd, u); }
      }
    }
    let mx = 0;
    for (let i = 0; i < n; i++) { if (!isFinite(dist[i])) dist[i] = 0; if (dist[i] > mx) mx = dist[i]; }
    this.maxT = mx;
    return dist;
  }

  nearest(point) {
    let best = 0, bd = Infinity;
    const p = this.pos;
    for (let i = 0; i < this.n; i++) {
      const dx = p[i * 3] - point.x, dy = p[i * 3 + 1] - point.y, dz = p[i * 3 + 2] - point.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
}

const CAVITY_OF = { lv: 'cav_lv', rv: 'cav_rv', la: 'cav_la', ra: 'cav_ra' };

// The specimen is normalised to 1 unit = the height of the heart (105 mm).
// Conduction velocities are quoted in m/s, so they must be scaled into units.
const UNIT_M = 0.105;
const V = (mps) => mps / UNIT_M;

export class ActivationField {
  constructor(anatomy) {
    this.anatomy = anatomy;
    this.graphs = new Map();
    for (const id of ['lv', 'rv', 'la', 'ra', 'cav_lv', 'cav_rv', 'cav_la', 'cav_ra']) {
      const s = anatomy.get(id);
      if (s) this.graphs.set(id, new Graph(s.mesh.geometry));
    }
    this.mode = 'sinus';
    this.maps = null;
    this.summary = null;
  }

  get(id) { return this.graphs.get(id); }

  /**
   * Normal conduction: SA node -> atria; AV node -> His-Purkinje -> ventricles.
   *
   * The ventricular field is built from three defensible terms:
   *  1. a geodesic front from a set of endocardial breakthrough sites, standing
   *     in for the Purkinje insertions (their number is chosen by farthest-point
   *     sampling, not by hand);
   *  2. a transmural delay, because the endocardium depolarises before the
   *     epicardium through the thickness of the wall;
   *  3. a mean activation direction, because a surface geodesic alone has no
   *     knowledge of the fibre architecture that makes the lateral LV wall the
   *     last territory to depolarise. That term is what puts the normal axis in
   *     the inferior-left quadrant instead of at 0 degrees.
   *
   * Terms 2 and 3 are parametric and are labelled as such in the UI. Term 1 is
   * solved from the actual mesh, which is why an ectopic focus produces a real
   * geometric wavefront with no parametric help.
   */
  sinus(saPoint, avPoint) {
    const maps = {};
    const ra = this.graphs.get('ra');
    const la = this.graphs.get('la');
    const lv = this.graphs.get('lv');
    const rv = this.graphs.get('rv');
    const t0 = performance.now();

    // ---- atria -------------------------------------------------------
    const raT = ra.solve([ra.nearest(saPoint)], V(4.2));
    const laT = la.solve([la.nearest(new THREE.Vector3(saPoint.x - 0.02, saPoint.y, saPoint.z - 0.04))], V(4.2));
    for (let i = 0; i < laT.length; i++) laT[i] += 0.020;   // Bachmann bundle delay

    // ---- ventricles --------------------------------------------------
    const all = { minX: Infinity, maxX: -Infinity, maxY: -Infinity, minY: Infinity };
    for (const g of [lv, rv]) {
      for (let i = 0; i < g.n; i++) {
        all.minX = Math.min(all.minX, g.pos[i * 3]);
        all.maxX = Math.max(all.maxX, g.pos[i * 3]);
        all.minY = Math.min(all.minY, g.pos[i * 3 + 1]);
        all.maxY = Math.max(all.maxY, g.pos[i * 3 + 1]);
      }
    }
    const centroid = new THREE.Vector3();
    let nc = 0;
    for (const g of [lv, rv]) {
      for (let i = 0; i < g.n; i++) { centroid.x += g.pos[i * 3]; centroid.y += g.pos[i * 3 + 1]; centroid.z += g.pos[i * 3 + 2]; nc++; }
    }
    centroid.multiplyScalar(1 / nc);

    // mean activation direction: inferior-left, the normal mean QRS vector
    const dir = new THREE.Vector3(0.74, -0.68, 0).normalize();
    let half = 0;
    for (const g of [lv, rv]) {
      for (let i = 0; i < g.n; i++) {
        const px = g.pos[i * 3] - centroid.x, py = g.pos[i * 3 + 1] - centroid.y;
        half = Math.max(half, Math.abs(px * dir.x + py * dir.y));
      }
    }
    half = Math.max(half, 1e-4);

    const build = (id, graph, rvOffset) => {
      const endo = this.anatomy.get(id).mesh.geometry.attributes.aEndo.array;
      const seeds = [];
      for (let i = 0; i < graph.n; i++) if (endo[i] > 0.5) seeds.push(i);
      const pool = seeds.length > 40 ? seeds : Array.from({ length: graph.n }, (_, i) => i);
      // farthest-point sampling around the AV node: K breakthrough sites
      const K = id === 'lv' ? 8 : 5;
      const chosen = [];
      let first = pool[0], fd = Infinity;
      for (const i of pool) {
        const d = (graph.pos[i * 3] - avPoint.x) ** 2 + (graph.pos[i * 3 + 1] - avPoint.y) ** 2 + (graph.pos[i * 3 + 2] - avPoint.z) ** 2;
        if (d < fd) { fd = d; first = i; }
      }
      chosen.push(first);
      const minD = new Float32Array(graph.n).fill(Infinity);
      while (chosen.length < K) {
        const last = chosen[chosen.length - 1];
        for (const i of pool) {
          const d = (graph.pos[i * 3] - graph.pos[last * 3]) ** 2 + (graph.pos[i * 3 + 1] - graph.pos[last * 3 + 1]) ** 2 + (graph.pos[i * 3 + 2] - graph.pos[last * 3 + 2]) ** 2;
          if (d < minD[i]) minD[i] = d;
        }
        let best = -1, bd = -1;
        for (const i of pool) if (minD[i] > bd) { bd = minD[i]; best = i; }
        if (best < 0) break;
        chosen.push(best);
      }
      const geo = graph.solve(chosen, V(3.0));
      let gmax = 0;
      for (let i = 0; i < graph.n; i++) gmax = Math.max(gmax, geo[i]);
      gmax = gmax || 1;
      const t = new Float32Array(graph.n);
      for (let i = 0; i < graph.n; i++) {
        const proj = ((graph.pos[i * 3] - centroid.x) * dir.x + (graph.pos[i * 3 + 1] - centroid.y) * dir.y) / half;
        const k = Math.min(1, Math.max(0, (proj + 1) * 0.5));
        // the wavefront direction term carries the sequence; the geodesic adds
        // local delay around trabeculae and the outflow tract (10 ms scale)
        t[i] = 0.046 * k + 0.010 * (geo[i] / gmax)
             + 0.014 * (endo[i] > 0.5 ? 0 : 1) + rvOffset;
      }
      return t;
    };

    const lvT = build('lv', lv, 0);
    const rvT = build('rv', rv, 0.012);

    maps.ra = raT;
    maps.la = laT;
    maps.lv = lvT;
    maps.rv = rvT;

    for (const [ch, cav] of Object.entries(CAVITY_OF)) {
      const g = this.graphs.get(cav);
      if (!g) continue;
      const base = maps[ch];
      if (!base) { maps[cav] = new Float32Array(g.n); continue; }
      // cavities share the chamber clock: sample by nearest surface vertex
      const src = this.graphs.get(ch);
      const out = new Float32Array(g.n);
      for (let i = 0; i < g.n; i++) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < src.n; j += 3) {
          const d = (src.pos[j * 3] - g.pos[i * 3]) ** 2 + (src.pos[j * 3 + 1] - g.pos[i * 3 + 1]) ** 2 + (src.pos[j * 3 + 2] - g.pos[i * 3 + 2]) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
        out[i] = base[best];
      }
      maps[cav] = out;
    }

    this.mode = 'sinus';
    this.maps = maps;
    this.summary = this.summarize(maps, performance.now() - t0);
    return maps;
  }

  /**
   * Ectopic / paced activation from a myocardial focus.
   *
   * A paced impulse spreads cell-to-cell in three dimensions, not along the
   * epicardial surface, so this uses Euclidean distance from the focus rather
   * than a surface geodesic. Using the geodesic here inflated the path length
   * by the shell topology and produced complexes that were either too narrow or
   * absurdly wide depending on where the focus landed.
   *
   * Activated mass relaxes outward from the electrode; the late territory is
   * therefore the wall opposite the focus, which is why the axis rotates away
   * from the pacing site instead of staying at the calibrated normal.
   */
  ectopic(meshId, vertexIndex) {
    const src = this.graphs.get(meshId);
    const otherId = meshId === 'lv' ? 'rv' : 'lv';
    const dst = this.graphs.get(otherId);
    const p = src.pos;
    const focus = new THREE.Vector3(p[vertexIndex * 3], p[vertexIndex * 3 + 1], p[vertexIndex * 3 + 2]);
    const t0 = performance.now();
    const VEL = V(0.55);          // effective working-myocardial conduction
    const TRANS = 0.030;          // trans-septal breakthrough delay
    const maps = {};

    const spread = (graph, delay) => {
      const out = new Float32Array(graph.n);
      let mx = 0;
      for (let i = 0; i < graph.n; i++) {
        const dx = graph.pos[i * 3] - focus.x;
        const dy = graph.pos[i * 3 + 1] - focus.y;
        const dz = graph.pos[i * 3 + 2] - focus.z;
        const t = Math.hypot(dx, dy, dz) / VEL + delay;
        out[i] = t;
        if (t > mx) mx = t;
      }
      return { out, mx };
    };

    const a = spread(src, 0);
    const b = spread(dst, TRANS);
    maps[meshId] = a.out;
    maps[otherId] = b.out;

    for (const [ch, cav] of Object.entries(CAVITY_OF)) {
      const g = this.graphs.get(cav);
      if (!g) continue;
      const delay = ch === meshId ? 0 : ch === otherId ? TRANS : 0;
      maps[cav] = spread(g, delay).out;
    }

    this.mode = 'ectopic';
    this.maps = maps;
    this.focus = focus;
    this.summary = this.summarize(maps, performance.now() - t0);
    return maps;
  }

  summarize(maps, solveMs) {
    let atriaMax = 0, ventMax = 0;
    for (const id of ['ra', 'la']) if (maps[id]) for (const v of maps[id]) atriaMax = Math.max(atriaMax, v);
    for (const id of ['lv', 'rv']) if (maps[id]) for (const v of maps[id]) ventMax = Math.max(ventMax, v);
    return { atriaMax, ventMax, qrs: ventMax, solveMs, mode: this.mode };
  }

  /**
   * QRS complex from an equivalent-dipole model.
   *
   * Each vertex is a current source released when the wavefront reaches it.
   * Summing point dipoles over a closed shell cancels — that was the original
   * error here: the wavefront directions integrate to ~zero on a closed surface,
   * so the projection was numerical noise and the axis was arbitrary.
   *
   * The defensible simplification is the equivalent dipole of the depolarised
   * mass: at any instant the source is the vector from the centroid of the
   * already-depolarised myocardium to the centroid of the still-resting
   * myocardium. Its direction follows the wavefront, its magnitude grows and
   * decays with the depolarised fraction, and it reverses when the late
   * territory (right ventricle, base) depolarises — which is what produces an
   * rS rather than a monophasic hump.
   *
   * This is a teaching model: one moving dipole, no thorax, no lead vectors in
   * three dimensions, no repolarisation gradient. It is not an ECG simulator.
   */
  qrsSeries(leadAngleDeg, dt = 0.002) {
    const maps = this.maps;
    if (!maps) return null;

    // 1. bin the depolarisation by activation time
    const bins = new Map();
    let totalN = 0;
    let px = 0, py = 0, pz = 0;
    for (const id of ['lv', 'rv']) {
      const s = this.anatomy.get(id);
      const g = this.graphs.get(id);
      if (!s || !g || !maps[id]) continue;
      const pos = g.pos;
      const times = maps[id];
      for (let i = 0; i < g.n; i++) {
        const t = times[i];
        if (!isFinite(t)) continue;
        const b = Math.round(t / dt);
        let acc = bins.get(b);
        if (!acc) { acc = [0, 0, 0, 0]; bins.set(b, acc); }
        acc[0] += pos[i * 3]; acc[1] += pos[i * 3 + 1]; acc[2] += pos[i * 3 + 2]; acc[3] += 1;
        px += pos[i * 3]; py += pos[i * 3 + 1]; pz += pos[i * 3 + 2];
        totalN++;
      }
    }
    if (!totalN) return null;

    // 2. cumulative sums over bins (time-ordered)
    const keys = [...bins.keys()].sort((x, y) => x - y);
    const cum = [];
    let cx = 0, cy = 0, cz = 0, cn = 0;
    for (const k of keys) {
      const b = bins.get(k);
      cx += b[0]; cy += b[1]; cz += b[2]; cn += b[3];
      cum.push({ t: k * dt, x: cx, y: cy, z: cz, n: cn });
    }

    // 3. sample the moving dipole
    const tmax = keys[keys.length - 1] * dt;
    const nSamp = Math.ceil(tmax / dt) + 10;
    const dx = new Float32Array(nSamp), dy = new Float32Array(nSamp), dz = new Float32Array(nSamp);
    let j = -1;
    for (let k = 0; k < nSamp; k++) {
      const t = k * dt;
      while (j + 1 < cum.length && cum[j + 1].t <= t) j++;
      const dep = j >= 0 ? cum[j] : { x: 0, y: 0, z: 0, n: 0 };
      const restN = totalN - dep.n;
      if (dep.n === 0 || restN === 0) { dx[k] = 0; dy[k] = 0; dz[k] = 0; continue; }
      const rx = (px - dep.x) / restN, ry = (py - dep.y) / restN, rz = (pz - dep.z) / restN;
      const ax = dep.x / dep.n, ay = dep.y / dep.n, az = dep.z / dep.n;
      dx[k] = rx - ax; dy[k] = ry - ay; dz[k] = rz - az;
    }

    // 4. project onto the frontal lead axis (x = patient left, y = superior)
    const lead = (leadAngleDeg * Math.PI) / 180;
    const lx = Math.cos(lead), ly = -Math.sin(lead);
    const raw = new Float32Array(nSamp);
    for (let k = 0; k < nSamp; k++) raw[k] = dx[k] * lx + dy[k] * ly;

    // 5. normalise for display, keep the sign
    let peak = 0;
    for (let k = 0; k < nSamp; k++) if (Math.abs(raw[k]) > Math.abs(peak)) peak = raw[k];
    const gain = peak !== 0 ? 1 / Math.abs(peak) : 0;
    const samples = new Float32Array(nSamp);
    for (let k = 0; k < nSamp; k++) samples[k] = raw[k] * gain;

    // 6. frontal axis from the net QRS area (standard: area, not peak)
    let areaX = 0, areaY = 0;
    for (let k = 0; k < nSamp; k++) { areaX += dx[k]; areaY += dy[k]; }
    const axis = (Math.atan2(-areaY, areaX) * 180) / Math.PI;

    return { samples, sampleRate: 1 / dt, duration: nSamp * dt, axis, amplitude: peak };
  }
}

export function normalizeAxis(deg) {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}
