/**
 * build-anatomy.mjs
 * ---------------------------------------------------------------------------
 * Converts BodyParts3D (DBCLS, CC BY 4.0) segmented OBJ elements into a single
 * web-ready GLB containing anatomically discrete, individually selectable
 * structures, plus an anatomy.json sidecar carrying derived metadata:
 *   - per-structure centroid / bounding sphere (camera framing, labels)
 *   - derived vessel + chamber centrelines (used by the flow engine)
 *
 * Pipeline: OBJ parse -> per-structure merge with positional weld ->
 * Taubin (λ/μ) smoothing to remove MRI-segmentation stair-stepping ->
 * area-weighted normals -> truncation at specimen boundary -> GLB encode.
 *
 * Run: node tools/build-anatomy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.resolve(ROOT, '../_research');
const OBJ_DIR = path.join(SRC, 'partof_BP3D_4.0_obj_99');
const OUT_DIR = path.join(ROOT, 'public/assets');

/* ------------------------------------------------------------------ *
 * Structure definition
 * ------------------------------------------------------------------ */
// clip: keep only triangles whose centroid falls inside this world-space
// (BodyParts3D mm) box. Used to truncate intrapulmonary vessel trees at the
// specimen boundary instead of dragging whole lung vasculature into frame.
const STRUCTURES = [
  { id: 'ra', label: 'Right atrium', fma: ['FMA7096'], group: 'chambers', smooth: 6, color: '#7d3b3f' },
  { id: 'rv', label: 'Right ventricle', fma: ['FMA7098'], group: 'chambers', smooth: 6, color: '#7a3a3e' },
  { id: 'la', label: 'Left atrium', fma: ['FMA7097'], group: 'chambers', smooth: 6, color: '#8c4145' },
  { id: 'lv', label: 'Left ventricle', fma: ['FMA7101'], group: 'chambers', smooth: 6, color: '#8d4247' },
  { id: 'aorta', cap: true, rad: 0.62, label: 'Aorta', fma: ['FMA3736', 'FMA3768', 'FMA3784'], group: 'vessels', smooth: 5, color: '#b9564f',
    clip: [-64, 74, -168, -28, 1150, 1348] },
  { id: 'pulmonary_trunk', cap: true, rad: 0.34, label: 'Pulmonary trunk', fma: ['FMA8612'], group: 'vessels', smooth: 4, color: '#5c6f9e' },
  { id: 'rpa', cap: true, rad: 0.28, label: 'Right pulmonary artery', fma: ['FMA50872'], group: 'vessels', smooth: 3, color: '#55688f',
    clip: [-84, 46, -172, -40, 1184, 1315] },
  { id: 'lpa', cap: true, rad: 0.28, label: 'Left pulmonary artery', fma: ['FMA50873'], group: 'vessels', smooth: 3, color: '#55688f',
    clip: [-12, 100, -172, -40, 1184, 1315] },
  { id: 'svc', cap: true, rad: 0.26, label: 'Superior vena cava', fma: ['FMA4720'], group: 'vessels', smooth: 3, color: '#4c5f8c' },
  { id: 'ivc', cap: true, rad: 0.32, label: 'Inferior vena cava', fma: ['FMA10951'], group: 'vessels', smooth: 3, color: '#4c5f8c',
    clip: [-56, 40, -160, -62, 1130, 1248] },
  { id: 'pv_rspv', cap: true, rad: 0.22, label: 'Right superior pulmonary vein', fma: ['FMA49914'], group: 'vessels', smooth: 3, color: '#6d5a8c',
    clip: [-62, 82, -172, -42, 1186, 1302] },
  { id: 'pv_ripv', cap: true, rad: 0.22, label: 'Right inferior pulmonary vein', fma: ['FMA49911'], group: 'vessels', smooth: 3, color: '#6d5a8c',
    clip: [-62, 82, -172, -42, 1186, 1302] },
  { id: 'pv_lspv', cap: true, rad: 0.22, label: 'Left superior pulmonary vein', fma: ['FMA49916'], group: 'vessels', smooth: 3, color: '#6d5a8c',
    clip: [-62, 82, -172, -42, 1186, 1302] },
  { id: 'pv_lipv', cap: true, rad: 0.22, label: 'Left inferior pulmonary vein', fma: ['FMA49913'], group: 'vessels', smooth: 3, color: '#6d5a8c',
    clip: [-62, 82, -172, -42, 1186, 1302] },
  { id: 'tv', label: 'Tricuspid valve', fma: ['FMA7234'], group: 'valves', smooth: 2, color: '#c8a37a' },
  { id: 'mv', label: 'Mitral valve', fma: ['FMA7235'], group: 'valves', smooth: 2, color: '#c8a37a' },
  { id: 'av', label: 'Aortic valve', fma: ['FMA7236'], group: 'valves', smooth: 2, color: '#c8a37a' },
  { id: 'pvv', label: 'Pulmonary valve', fma: ['FMA7246'], group: 'valves', smooth: 2, color: '#c8a37a' },
  { id: 'cav_ra', label: 'Right atrial cavity', fma: ['FMA11359'], group: 'cavities', smooth: 4, color: '#25415c', solid: true },
  { id: 'cav_rv', label: 'Right ventricular cavity', fma: ['FMA9291'], group: 'cavities', smooth: 4, color: '#25415c', solid: true },
  { id: 'cav_la', label: 'Left atrial cavity', fma: ['FMA9465'], group: 'cavities', smooth: 4, color: '#3a2b52', solid: true },
  { id: 'cav_lv', label: 'Left ventricular cavity', fma: ['FMA9466'], group: 'cavities', smooth: 4, color: '#3a2b52', solid: true },
  // ---- coronary arteries, one mesh per named branch -------------------
  { id: 'lmca', label: 'Left main coronary artery', fma: ['FMA50040', 'FMA3855'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#c05a48' },
  { id: 'lad', label: 'Anterior interventricular artery', fma: ['FMA3862', 'FMA74912', 'FMA3868', 'FMA3872', 'FMA3874', 'FMA3876'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#c65f4a' },
  { id: 'diagonal', label: 'Diagonal branch', fma: ['FMA3860'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#bf5b46' },
  { id: 'lcx', label: 'Circumflex artery', fma: ['FMA3895'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#c65f4a' },
  { id: 'rca', label: 'Right coronary artery', fma: ['FMA50039', 'FMA3802', 'FMA3815'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#c05a48' },
  { id: 'rca_marginal', label: 'Right marginal artery', fma: ['FMA3818'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#bf5b46' },
  { id: 'pda', label: 'Posterior interventricular artery', fma: ['FMA3840'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#c05a48' },
  { id: 'posterolateral', label: 'Posterior ventricular branch', fma: ['FMA3837'],  group: 'coronary', surfaceBound: true, smooth: 2, color: '#bf5b46' },
  // ---- cardiac veins ------------------------------------------------
  { id: 'great_cardiac_vein', label: 'Great cardiac vein', fma: ['FMA4707'],  group: 'veins', surfaceBound: true, smooth: 2, color: '#59618f' },
  { id: 'middle_cardiac_vein', label: 'Middle cardiac vein', fma: ['FMA4713'],  group: 'veins', surfaceBound: true, smooth: 2, color: '#59618f' },
  { id: 'small_cardiac_vein', label: 'Small cardiac vein', fma: ['FMA4714'],  group: 'veins', surfaceBound: true, smooth: 2, color: '#59618f' },
  { id: 'coronary_sinus', label: 'Coronary sinus', fma: ['FMA4706'],  group: 'veins', surfaceBound: true, smooth: 2, color: '#6b6ea8' },
  // ---- internal: papillary apparatus --------------------------------
  { id: 'pm_rv_ant', label: 'Anterior papillary muscle (right)', fma: ['FMA7260'], group: 'internal', smooth: 2, color: '#8a3b3f' },
  { id: 'pm_rv_post', label: 'Posterior papillary muscle (right)', fma: ['FMA7261'], group: 'internal', smooth: 2, color: '#8a3b3f' },
  { id: 'pm_rv_septal', label: 'Septal papillary muscle (right)', fma: ['FMA7262'], group: 'internal', smooth: 2, color: '#8a3b3f' },
  { id: 'pm_lv', label: 'Papillary muscles (left)', fma: ['FMA9352', 'FMA7264', 'FMA7265'], group: 'internal', smooth: 2, color: '#91474b' },
  // ---- arch branches -------------------------------------------------
];

/* ------------------------------------------------------------------ *
 * OBJ parsing
 * ------------------------------------------------------------------ */
function parseObj(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const pos = [];
  const idx = [];
  const lines = txt.split('\n');
  let vcount = 0;
  const remap = new Int32Array(1 << 20).fill(-1);
  const pushV = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const c = line.charCodeAt(0);
    if (c === 118 /* v */ && line.charCodeAt(1) === 32) {
      const p = line.split(/\s+/);
      pushV(+p[1], +p[2], +p[3]);
      vcount++;
    } else if (c === 102 /* f */ && line.charCodeAt(1) === 32) {
      const p = line.trim().split(/\s+/);
      const vs = [];
      for (let i = 1; i < p.length; i++) {
        const raw = p[i].split('/')[0];
        let vi = parseInt(raw, 10);
        if (vi < 0) vi = vcount + vi; else vi -= 1;
        vs.push(vi);
      }
      for (let i = 2; i < vs.length; i++) idx.push(vs[0], vs[i - 1], vs[i]);
    }
  }
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
}

/* ------------------------------------------------------------------ *
 * Merge + weld
 *   BodyParts3D elements are segmentation fragments. Welding by quantised
 *   position restores a continuous surface across fragment borders so that
 *   smoothing and normals behave as one manifold.
 * ------------------------------------------------------------------ */
function mergeFiles(files, weldTol = 0.02) {
  const positions = [];
  const indices = [];
  const map = new Map();
  const q = 1 / weldTol;
  for (const f of files) {
    const g = parseObj(f);
    const local = new Int32Array(g.pos.length / 3);
    for (let i = 0; i < g.pos.length / 3; i++) {
      const x = g.pos[i * 3], y = g.pos[i * 3 + 1], z = g.pos[i * 3 + 2];
      const key = `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
      let id = map.get(key);
      if (id === undefined) {
        id = positions.length / 3;
        positions.push(x, y, z);
        map.set(key, id);
      }
      local[i] = id;
    }
    for (let i = 0; i < g.idx.length; i++) indices.push(local[g.idx[i]]);
  }
  return { positions: Float64Array.from(positions), indices: Uint32Array.from(indices) };
}


/* Erode the ragged rim left by a clipping plane before capping it. Two rings
   are enough to remove the long oblique triangles that otherwise read as hairs. */
function erodeBoundary(positions, indices, passes = 2) {
  let idx = Array.from(indices);
  for (let pass = 0; pass < passes; pass++) {
    const edges = new Map();
    const ek = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    for (let t = 0; t < idx.length; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      for (let i = 0; i < 3; i++) {
        const k = ek(tri[i], tri[(i + 1) % 3]);
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    }
    const boundary = new Set();
    for (let t = 0; t < idx.length; t += 3) {
      const tri = [idx[t], idx[t + 1], idx[t + 2]];
      for (let i = 0; i < 3; i++) {
        if (edges.get(ek(tri[i], tri[(i + 1) % 3])) === 1) { boundary.add(tri[i]); boundary.add(tri[(i + 1) % 3]); }
      }
    }
    if (!boundary.size) break;
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      if (boundary.has(idx[t]) || boundary.has(idx[t + 1]) || boundary.has(idx[t + 2])) continue;
      keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    idx = keep;
  }
  return Uint32Array.from(idx);
}

function hubClip(positions, indices, hub, R) {
  const out = [];
  for (let t = 0; t < indices.length; t += 3) {
    let keep = true;
    for (let k = 0; k < 3; k++) {
      const i = indices[t + k];
      const d = Math.hypot(positions[i*3] - hub[0], positions[i*3+1] - hub[1], positions[i*3+2] - hub[2]);
      if (d > R) { keep = false; break; }
    }
    if (keep) out.push(indices[t], indices[t+1], indices[t+2]);
  }
  return Uint32Array.from(out);
}

/* One-directional cut: follow the vessel centreline from its far end and keep
   only the length nearest the heart. The section is perpendicular to the axis,
   which is what a specimen actually looks like. */
function pathFromFar(positions, indices) {
  const n = positions.length / 3;
  let far = 0, fd = -1;
  for (let i = 0; i < n; i++) {
    const d = positions[i*3]**2 + positions[i*3+1]**2 + positions[i*3+2]**2;
    if (d > fd) { fd = d; far = i; }
  }
  const line = geodesicPath(positions, indices, [positions[far*3], positions[far*3+1], positions[far*3+2]], 56).line;
  const cum = [0];
  for (let i = 1; i < line.length; i++) {
    cum.push(cum[i-1] + Math.hypot(line[i][0]-line[i-1][0], line[i][1]-line[i-1][1], line[i][2]-line[i-1][2]));
  }
  return { line, cum, total: cum[cum.length - 1] };
}

function axisTailClip(positions, indices, path, keepLen) {
  const { line, cum, total } = path;
  if (!line.length) return indices;
  const thresh = Math.max(0, total - keepLen);
  const n = positions.length / 3;
  const sAt = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < line.length; k++) {
      const d = (positions[i*3]-line[k][0])**2 + (positions[i*3+1]-line[k][1])**2 + (positions[i*3+2]-line[k][2])**2;
      if (d < bd) { bd = d; best = k; }
    }
    sAt[i] = cum[best];
  }
  const out = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t+1], c = indices[t+2];
    if (sAt[a] >= thresh && sAt[b] >= thresh && sAt[c] >= thresh) out.push(a, b, c);
  }
  return Uint32Array.from(out);
}

/* Cut faces. Vessel trees are truncated at the specimen border; a fan cap turns
   the open ring into a flat anatomical section instead of a hollow stump. */
function capBoundaries(positions, indices) {
  const edges = new Map();
  const ek = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]];
    for (let i = 0; i < 3; i++) {
      const a = tri[i], b = tri[(i + 1) % 3];
      const key = ek(a, b);
      const rec = edges.get(key);
      if (rec) rec.n++;
      else edges.set(key, { a, b, n: 1 });
    }
  }
  const nextMap = new Map();
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    if (!nextMap.has(e.a)) nextMap.set(e.a, []);
    nextMap.get(e.a).push(e.b);
  }
  if (!nextMap.size) return { positions, indices };

  const pos = Array.from(positions);
  const out = Array.from(indices);
  const visited = new Set();

  for (const [start] of nextMap) {
    if (visited.has(start)) continue;
    const loop = [];
    let cur = start;
    let guard = 0;
    while (cur !== undefined && !visited.has(cur) && guard++ < 5000) {
      visited.add(cur);
      loop.push(cur);
      const cand = nextMap.get(cur);
      cur = cand && cand.length ? cand.shift() : undefined;
    }
    if (loop.length < 4 || loop.length > 400) continue;
    // only cap rings that are compact and roughly planar: a merged loop would
    // produce a fan across the whole vessel
    let cx = 0, cy = 0, cz = 0;
    for (const i of loop) { cx += pos[i * 3]; cy += pos[i * 3 + 1]; cz += pos[i * 3 + 2]; }
    cx /= loop.length; cy /= loop.length; cz /= loop.length;
    let maxD = 0;
    for (const i of loop) maxD = Math.max(maxD, Math.hypot(pos[i * 3] - cx, pos[i * 3 + 1] - cy, pos[i * 3 + 2] - cz));
    if (maxD > 0.2) continue;
    // planarity: all ring vertices within 25% of the radius from the best plane
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      nx += (pos[a*3+1]-pos[b*3+1])*(pos[a*3+2]+pos[b*3+2]);
      ny += (pos[a*3+2]-pos[b*3+2])*(pos[a*3+3-3]+pos[b*3]);
      nz += (pos[a*3]-pos[b*3])*(pos[a*3+1]+pos[b*3+1]);
    }
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx/=nl; ny/=nl; nz/=nl;
    let flat = 0;
    for (const i of loop) flat = Math.max(flat, Math.abs((pos[i*3]-cx)*nx + (pos[i*3+1]-cy)*ny + (pos[i*3+2]-cz)*nz));
    if (flat > maxD * 0.35) continue;
    const c = pos.length / 3;
    pos.push(cx, cy, cz);
    for (let i = 0; i < loop.length; i++) out.push(loop[i], loop[(i + 1) % loop.length], c);
  }
  return { positions: Float64Array.from(pos), indices: Uint32Array.from(out) };
}

function sphereClip(positions, indices, R) {
  if (!R) return indices;
  const out = [];
  for (let t = 0; t < indices.length; t += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const i = indices[t + k];
      cx += positions[i * 3]; cy += positions[i * 3 + 1]; cz += positions[i * 3 + 2];
    }
    if (Math.hypot(cx / 3, cy / 3, cz / 3) <= R) out.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return Uint32Array.from(out);
}

/* Remove the needle triangles that 1% decimation leaves behind: they survive
   smoothing and read as hairs at a cut edge. */
function pruneNeedles(positions, indices, passes = 3) {
  let idx = Array.from(indices);
  for (let pass = 0; pass < passes; pass++) {
    const valence = new Uint32Array(positions.length / 3);
    for (let i = 0; i < idx.length; i++) valence[idx[i]]++;
    const keep = [];
    let removed = 0;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ab = Math.hypot(positions[a*3]-positions[b*3], positions[a*3+1]-positions[b*3+1], positions[a*3+2]-positions[b*3+2]);
      const bc = Math.hypot(positions[b*3]-positions[c*3], positions[b*3+1]-positions[c*3+1], positions[b*3+2]-positions[c*3+2]);
      const ca = Math.hypot(positions[c*3]-positions[a*3], positions[c*3+1]-positions[a*3+1], positions[c*3+2]-positions[a*3+2]);
      const shortest = Math.min(ab, bc, ca), longest = Math.max(ab, bc, ca);
      const spike = valence[a] <= 2 || valence[b] <= 2 || valence[c] <= 2;
      const needle = shortest < 1e-4 || (longest > 0.012 && shortest / longest < 0.04);
      // shape quality: 4*sqrt(3)*area / sum(edge^2); equilateral = 1
      const ux = positions[b*3]-positions[a*3], uy = positions[b*3+1]-positions[a*3+1], uz = positions[b*3+2]-positions[a*3+2];
      const vx = positions[c*3]-positions[a*3], vy = positions[c*3+1]-positions[a*3+1], vz = positions[c*3+2]-positions[a*3+2];
      const area = 0.5 * Math.hypot(uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx);
      const q = (4 * Math.sqrt(3) * area) / (ab*ab + bc*bc + ca*ca + 1e-12);
      const sliver = q < 0.035 && longest > 0.004;
      if (spike || needle || sliver) { removed++; continue; }
      keep.push(a, b, c);
    }
    idx = keep;
    if (!removed) break;
  }
  return Uint32Array.from(idx);
}

/* ------------------------------------------------------------------ *
 * Taubin smoothing (λ positive / μ negative pass pair)
 *   Removes the faceted, staircase artefacts of voxel-derived segmentation
 *   without the volume loss that plain Laplacian smoothing produces.
 *   Boundary vertices are damped so open edges (vessel ostia) do not crawl.
 * ------------------------------------------------------------------ */
function taubin(positions, indices, iterations, lambda = 0.5, mu = -0.53) {
  const n = positions.length / 3;
  if (!iterations) return positions;
  const nbr = Array.from({ length: n }, () => []);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    nbr[a].push(b, c); nbr[b].push(a, c); nbr[c].push(a, b);
  }
  // dedupe
  const adj = nbr.map((l) => Array.from(new Set(l)));
  const edgeCount = new Map();
  const ek = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    for (const [u, v] of [[a, b], [b, c], [c, a]]) edgeCount.set(ek(u, v), (edgeCount.get(ek(u, v)) || 0) + 1);
  }
  // Freeze every vertex that is not strictly interior (all incident edges
  // shared by exactly two triangles). Boundary rims are where the segmentation
  // meets a neighbouring part, and moving them produces spikes.
  const boundary = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = nbr[i];
    for (const j of l) {
      if ((edgeCount.get(ek(i, j)) || 0) !== 2) { boundary[i] = 1; break; }
    }
  }
  let cur = Float64Array.from(positions);
  const next = new Float64Array(cur.length);
  const pass = (factor) => {
    for (let i = 0; i < n; i++) {
      const l = adj[i];
      if (l.length === 0) { next[i * 3] = cur[i * 3]; next[i * 3 + 1] = cur[i * 3 + 1]; next[i * 3 + 2] = cur[i * 3 + 2]; continue; }
      let sx = 0, sy = 0, sz = 0;
      for (const j of l) { sx += cur[j * 3]; sy += cur[j * 3 + 1]; sz += cur[j * 3 + 2]; }
      const inv = 1 / l.length;
      const w = boundary[i] ? 0 : factor;
      next[i * 3] = cur[i * 3] + w * (sx * inv - cur[i * 3]);
      next[i * 3 + 1] = cur[i * 3 + 1] + w * (sy * inv - cur[i * 3 + 1]);
      next[i * 3 + 2] = cur[i * 3 + 2] + w * (sz * inv - cur[i * 3 + 2]);
    }
    cur.set(next);
  };
  for (let it = 0; it < iterations; it++) { pass(lambda); pass(mu); }
  return cur;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function clipTris(positions, indices, box) {
  if (!box) return indices;
  const [x0, x1, y0, y1, z0, z1] = box;
  const out = [];
  for (let t = 0; t < indices.length; t += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 3; k++) {
      const i = indices[t + k];
      cx += positions[i * 3]; cy += positions[i * 3 + 1]; cz += positions[i * 3 + 2];
    }
    cx /= 3; cy /= 3; cz /= 3;
    if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 && cz >= z0 && cz <= z1) out.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return Uint32Array.from(out);
}

function compact(positions, indices) {
  const used = new Int32Array(positions.length / 3).fill(-1);
  const np = [];
  const ni = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const o = indices[i];
    if (used[o] === -1) {
      used[o] = np.length / 3;
      np.push(positions[o * 3], positions[o * 3 + 1], positions[o * 3 + 2]);
    }
    ni[i] = used[o];
  }
  return { positions: Float64Array.from(np), indices: ni };
}

function computeNormals(positions, indices) {
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = positions[b] - positions[a], ay = positions[b + 1] - positions[a + 1], az = positions[b + 2] - positions[a + 2];
    const bx = positions[c] - positions[a], by = positions[c + 1] - positions[a + 1], bz = positions[c + 2] - positions[a + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; // area-weighted
    for (const o of [a, b, c]) { normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
  }
  return normals;
}

/* ------------------------------------------------------------------ *
 * Centreline derivation
 *   Slice the geometry along its principal axis and take the centroid of each
 *   slice. The result follows the actual lumen centre rather than a hand-drawn
 *   guess, which is what the flow engine animates along.
 * ------------------------------------------------------------------ */
function pcaAxis(positions) {
  const n = positions.length / 3;
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < n; i++) { mx += positions[i * 3]; my += positions[i * 3 + 1]; mz += positions[i * 3 + 2]; }
  mx /= n; my /= n; mz /= n;
  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < n; i++) {
    const dx = positions[i * 3] - mx, dy = positions[i * 3 + 1] - my, dz = positions[i * 3 + 2] - mz;
    xx += dx * dx; xy += dx * dy; xz += dx * dz; yy += dy * dy; yz += dy * dz; zz += dz * dz;
  }
  // power iteration on the covariance matrix
  let vx = 0.3, vy = 0.5, vz = 1.0;
  for (let it = 0; it < 64; it++) {
    const nx = xx * vx + xy * vy + xz * vz;
    const ny = xy * vx + yy * vy + yz * vz;
    const nz = xz * vx + yz * vy + zz * vz;
    const l = Math.hypot(nx, ny, nz) || 1;
    vx = nx / l; vy = ny / l; vz = nz / l;
  }
  return { center: [mx, my, mz], axis: [vx, vy, vz] };
}

function centerline(positions, slices = 12) {
  const { center, axis } = pcaAxis(positions);
  const n = positions.length / 3;
  let tmin = Infinity, tmax = -Infinity;
  const proj = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = (positions[i * 3] - center[0]) * axis[0] + (positions[i * 3 + 1] - center[1]) * axis[1] + (positions[i * 3 + 2] - center[2]) * axis[2];
    proj[i] = t; tmin = Math.min(tmin, t); tmax = Math.max(tmax, t);
  }
  const bins = Array.from({ length: slices }, () => ({ x: 0, y: 0, z: 0, c: 0 }));
  const span = tmax - tmin || 1;
  for (let i = 0; i < n; i++) {
    let b = Math.floor(((proj[i] - tmin) / span) * slices);
    b = Math.min(slices - 1, Math.max(0, b));
    bins[b].x += positions[i * 3]; bins[b].y += positions[i * 3 + 1]; bins[b].z += positions[i * 3 + 2]; bins[b].c++;
  }
  return bins.filter((b) => b.c > 0).map((b) => [b.x / b.c, b.y / b.c, b.z / b.c]);
}


/* ------------------------------------------------------------------ *
 * Geodesic centreline
 *   Slicing along a principal axis cannot follow a vessel that doubles back
 *   on itself (the aortic arch). Instead: solve the distance field from one
 *   end of the vessel, then average the vertices inside each equal-distance
 *   band. The result is the true lumen centre, ordered along the flow.
 * ------------------------------------------------------------------ */
function geodesicPath(positions, indices, startPoint, bands = 52) {
  const n = positions.length / 3;
  const adj = Array.from({ length: n }, () => []);
  const seen = new Set();
  const push = (a, b) => {
    const k = a < b ? a * 4194304 + b : b * 4194304 + a;
    if (seen.has(k)) return;
    seen.add(k);
    const w = Math.hypot(positions[a*3]-positions[b*3], positions[a*3+1]-positions[b*3+1], positions[a*3+2]-positions[b*3+2]);
    adj[a].push(b, w); adj[b].push(a, w);
  };
  for (let i = 0; i < indices.length; i += 3) {
    push(indices[i], indices[i+1]); push(indices[i+1], indices[i+2]); push(indices[i+2], indices[i]);
  }
  let start = 0, bd = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(positions[i*3]-startPoint[0], positions[i*3+1]-startPoint[1], positions[i*3+2]-startPoint[2]);
    if (d < bd) { bd = d; start = i; }
  }
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  dist[start] = 0;
  const heap = [[0, start]];
  const pushH = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const p = (i-1)>>1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const popH = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i*2+1, r = l+1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  while (heap.length) {
    const [d, v] = popH();
    if (d > dist[v]) continue;
    for (let i = 0; i < adj[v].length; i += 2) {
      const u = adj[v][i], nd = d + adj[v][i+1];
      if (nd < dist[u]) { dist[u] = nd; prev[u] = v; pushH(nd, u); }
    }
  }
  // Centreline = the geodesic chain to the farthest reachable vertex, then
  // smoothed toward the tube axis. Band centroids were tried first: on a tube
  // the equal-distance set is a helix, and the centroid jumps between the two
  // limbs of the aortic arch, which produced 5-unit-long "centrelines".
  let far = start, fx = -1;
  for (let i = 0; i < n; i++) if (isFinite(dist[i]) && dist[i] > fx) { fx = dist[i]; far = i; }
  const chain = [];
  for (let v = far; v !== -1; v = prev[v]) {
    chain.push([positions[v*3], positions[v*3+1], positions[v*3+2]]);
    if (v === start) break;
  }
  chain.reverse();
  let sm = chain;
  for (let it = 0; it < 10 && sm.length > 4; it++) {
    const next = sm.map((p, i) => {
      if (i === 0 || i === sm.length - 1) return p;
      return [
        0.34 * p[0] + 0.33 * sm[i-1][0] + 0.33 * sm[i+1][0],
        0.34 * p[1] + 0.33 * sm[i-1][1] + 0.33 * sm[i+1][1],
        0.34 * p[2] + 0.33 * sm[i-1][2] + 0.33 * sm[i+1][2],
      ];
    });
    sm = next;
  }
  // resample at a fixed spacing
  const line = [];
  let acc = 0;
  const step = 0.012;
  for (let i = 1; i < sm.length; i++) {
    const d = Math.hypot(sm[i][0]-sm[i-1][0], sm[i][1]-sm[i-1][1], sm[i][2]-sm[i-1][2]);
    acc += d;
    if (acc >= step || i === sm.length - 1) { line.push(sm[i]); acc = 0; }
  }
  return { line, dist };
}

/* A vessel can arrive as more than one disconnected surface patch (the aortic
   arch and the descending aorta often are). Walk the reachable component, then
   continue from the nearest vertex of the next component, so the flow path is
   continuous even where the segmentation is not. */
function fullPath(positions, indices, startPoint, bands = 52) {
  let { line, dist } = geodesicPath(positions, indices, startPoint, bands);
  const n = positions.length / 3;
  for (let hop = 0; hop < 3; hop++) {
    const tail = line[line.length - 1];
    let best = -1, bd = Infinity;
    for (let i = 0; i < n; i++) {
      if (isFinite(dist[i])) continue;
      const d = Math.hypot(positions[i*3]-tail[0], positions[i*3+1]-tail[1], positions[i*3+2]-tail[2]);
      if (d < bd) { bd = d; best = i; }
    }
    if (best < 0 || bd > 0.06) break;
    const seed = [positions[best*3], positions[best*3+1], positions[best*3+2]];
    const next = geodesicPath(positions, indices, seed, Math.max(10, Math.round(bands / 2)));
    if (next.line.length < 3) break;
    const reach = next.line[next.line.length - 1];
    const gain = Math.hypot(reach[0]-tail[0], reach[1]-tail[1], reach[2]-tail[2]);
    if (gain < 0.05) break;
    for (const p of next.line.slice(1)) line.push(p);
    for (let i = 0; i < n; i++) if (isFinite(next.dist[i])) dist[i] = 1;
  }
  return line;
}

/* ------------------------------------------------------------------ *
 * Minimal GLB writer (POSITION + NORMAL + indices, one primitive per structure)
 * Built directly rather than through three's exporter so the archive has no
 * build-time dependency on a browser environment.
 * ------------------------------------------------------------------ */
function align4(n) { return (n + 3) & ~3; }

function writeGlb(structures, outFile) {
  const json = {
    asset: { version: '2.0', generator: 'heart-stimulation anatomy pipeline' },
    scene: 0,
    scenes: [{ name: 'heart', nodes: [] }],
    nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [],
  };
  const chunks = [];
  let offset = 0;
  const addBufferView = (data, target) => {
    const pad = align4(offset) - offset;
    if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
    const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    chunks.push(buf);
    const bv = { buffer: 0, byteOffset: offset, byteLength: buf.length };
    if (target) bv.target = target;
    json.bufferViews.push(bv);
    offset += buf.length;
    return json.bufferViews.length - 1;
  };

  for (const s of structures) {
    const n = s.positions.length / 3;
    // bounds
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
      const v = s.positions[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
    }
    const pos = Float32Array.from(s.positions);
    const useShort = n < 65536;
    const idx = useShort ? Uint16Array.from(s.indices) : Uint32Array.from(s.indices);
    const posBV = addBufferView(pos, 34962);
    const idxBV = addBufferView(idx, 34963);
    json.accessors.push({ bufferView: posBV, componentType: 5126, count: n, type: 'VEC3', min: mn, max: mx });
    const posAcc = json.accessors.length - 1;
    const extra = {};
    for (const [name, data] of Object.entries(s.attrs || {})) {
      const bv = addBufferView(Float32Array.from(data), 34962);
      json.accessors.push({ bufferView: bv, componentType: 5126, count: data.length, type: 'SCALAR' });
      extra[name] = json.accessors.length - 1;
    }
    json.accessors.push({ bufferView: idxBV, componentType: useShort ? 5123 : 5125, count: idx.length, type: 'SCALAR' });
    const idxAcc = json.accessors.length - 1;
    const mat = s.material;
    json.materials.push({
      name: s.id,
      pbrMetallicRoughness: {
        baseColorFactor: mat.color,
        metallicFactor: mat.metallic ?? 0.0,
        roughnessFactor: mat.roughness ?? 0.62,
      },
      doubleSided: !!s.solid,
    });
    json.meshes.push({
      name: s.id,
      primitives: [{ attributes: { POSITION: posAcc, ...extra }, indices: idxAcc, material: json.materials.length - 1 }],
    });
    json.nodes.push({ name: s.id, mesh: json.meshes.length - 1, extras: { group: s.group } });
    json.scenes[0].nodes.push(json.nodes.length - 1);
  }

  const bin = Buffer.concat(chunks);
  json.buffers.push({ byteLength: bin.length });
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = align4(jsonBuf.length) - jsonBuf.length;
  jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const jHead = Buffer.alloc(8); jHead.writeUInt32LE(jsonBuf.length, 0); jHead.writeUInt32LE(0x4e4f534a, 4);
  const bHead = Buffer.alloc(8); bHead.writeUInt32LE(bin.length, 0); bHead.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(outFile, Buffer.concat([header, jHead, jsonBuf, bHead, bin]));
  return 12 + 8 + jsonBuf.length + 8 + bin.length;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */
const map = new Map();
for (const line of fs.readFileSync(path.join(SRC, 'partof_element_parts.txt'), 'utf8').split('\n')) {
  const p = line.split('\t');
  if (p.length === 3) {
    if (!map.has(p[0])) map.set(p[0], []);
    map.get(p[0]).push(p[2]);
  }
}

// Global transform: BodyParts3D mm (x=patient left, y=posterior-negative-ish,
// z=superior) -> three.js (Y up, Z anterior). Heart chamber centroid at origin,
// heart height normalised to 1.0.
const toThree = (x, y, z) => [x - CX, z - CZ, -(y - CY)];
let CX = 0, CY = 0, CZ = 0, SCALE = 1;

const built = [];
const finalByRef = {};
const meta = { structures: [], scale: 1, units: 'normalised (heart height = 1.0)', source: 'BodyParts3D 4.0' };

// First pass: raw merge to establish the reference frame from the four chambers.
const rawChambers = ['FMA9457', 'FMA7098', 'FMA9531', 'FMA7101'].flatMap((f) => map.get(f) || []);
const frameGeom = mergeFiles(rawChambers.map((id) => path.join(OBJ_DIR, `${id}.obj`)), 0.05);
{
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < frameGeom.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = frameGeom.positions[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  CX = (mn[0] + mx[0]) / 2; CY = (mn[1] + mx[1]) / 2; CZ = (mn[2] + mx[2]) / 2;
  SCALE = 1 / (mx[2] - mn[2]);
  meta.referenceBox = { min: mn, max: mx };
  console.log('reference frame', { CX, CY, CZ, SCALE, height_mm: mx[2] - mn[2] });
}

const final = [];
for (const s of STRUCTURES) {
  const ids = [...new Set(s.fma.flatMap((f) => map.get(f) || []))];
  if (!ids.length) { console.warn('missing', s.id); continue; }
  const files = ids.map((id) => path.join(OBJ_DIR, `${id}.obj`)).filter((f) => fs.existsSync(f));
  let geom = mergeFiles(files, 0.02);
  geom.indices = clipTris(geom.positions, geom.indices, s.clip);
  geom = compact(geom.positions, geom.indices);
  const smoothed = taubin(geom.positions, geom.indices, s.smooth ?? 3);
  // transform to viewer space
  let positions = new Float64Array(smoothed.length);
  for (let i = 0; i < smoothed.length; i += 3) {
    const [x, y, z] = toThree(smoothed[i], smoothed[i + 1], smoothed[i + 2]);
    positions[i] = x * SCALE; positions[i + 1] = y * SCALE; positions[i + 2] = z * SCALE;
  }
  let indices = pruneNeedles(positions, geom.indices, 5);
  if (s.rad) {
    // hub = the point of the vessel nearest the heart; everything beyond the
    // radius is the part that would continue into the lung, neck or abdomen
    let hub = [0, 0, 0], hd = Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const d = positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2;
      if (d < hd) { hd = d; hub = [positions[i], positions[i + 1], positions[i + 2]]; }
    }
    indices = hubClip(positions, indices, hub, s.rad);
    indices = erodeBoundary(positions, indices, 1);
    indices = pruneNeedles(positions, indices, 1);
  }
  if (s.cap) {
    const capped = capBoundaries(positions, indices);
    positions = capped.positions; indices = capped.indices;
  }
  {
    const c = compact(positions, indices);
    positions = c.positions; indices = c.indices;
  }
  const normals = computeNormals(positions, indices);
  const toN = new Float32Array(normals.length);
  for (let i = 0; i < normals.length; i += 3) {
    toN[i] = normals[i]; toN[i + 1] = normals[i + 2]; toN[i + 2] = -normals[i + 1];
  }
  const hex = s.color.replace('#', '');
  const color = [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, 1];
  const entry = { ...s, positions, normals: toN, indices, material: { color } };
  built.push(entry);
  finalByRef[s.id] = { positions, indices };
  final.push({ id: s.id, positions, indices });
  const st = meta.structures.length;
  meta.structures[st] = { id: s.id, label: s.label, group: s.group, triangles: indices.length / 3, vertices: positions.length / 3 };
  console.log(`${s.id.padEnd(16)} tris=${String(geom.indices.length / 3).padStart(6)} verts=${String(positions.length / 3).padStart(6)}`);
}

// Derived circulation paths, solved on the final (clipped, capped) geometry so
// the flow can never leave the anatomy it is supposed to travel through.
const round4 = (a) => a.map((v) => Math.round(v * 1e4) / 1e4);
const byId = Object.fromEntries(final.map((r) => [r.id, r]));
const centerCache = new Map();
const centerOf = (id) => {
  if (centerCache.has(id)) return centerCache.get(id);
  const r = byId[id];
  if (!r) return null;
  let x = 0, y = 0, z = 0;
  const n = r.positions.length / 3;
  for (let i = 0; i < r.positions.length; i += 3) { x += r.positions[i]; y += r.positions[i + 1]; z += r.positions[i + 2]; }
  const c = [x / n, y / n, z / n];
  centerCache.set(id, c);
  return c;
};

function endpointFor(id) {
  const r = byId[id];
  const pts = [];
  for (let i = 0; i < r.positions.length; i += 3) pts.push([r.positions[i], r.positions[i + 1], r.positions[i + 2]]);
  if (id === 'svc' || id === 'ivc') {
    let ext = pts[0];
    for (const v of pts) if (id === 'svc' ? v[1] > ext[1] : v[1] < ext[1]) ext = v;
    return ext;
  }
  if (id === 'aorta') return centerOf('av');
  if (id === 'pulmonary_trunk') return centerOf('pvv');
  if (id === 'rpa' || id === 'lpa') return centerOf('pulmonary_trunk');
  const ref = centerOf('cav_la');
  let far = pts[0], fd = -1;
  for (const v of pts) {
    const d = Math.hypot(v[0] - ref[0], v[1] - ref[1], v[2] - ref[2]);
    if (d > fd) { fd = d; far = v; }
  }
  return far;
}

const paths = {};
for (const id of ['svc', 'ivc', 'aorta', 'pulmonary_trunk', 'rpa', 'lpa', 'pv_rspv', 'pv_ripv', 'pv_lspv', 'pv_lipv']) {
  const r = byId[id];
  if (!r) { console.warn('no geometry for path', id); continue; }
  if (!r.indices || !r.indices.length) { console.warn('empty geometry for path', id, r.positions.length); paths[id] = []; continue; }
  const line = fullPath(r.positions, r.indices, endpointFor(id), 52);
  paths[id] = line.map(round4);
}
meta.paths = paths;

// Per-structure centroid + radius in viewer space (framing & labels).
for (const m of meta.structures) {
  const r = byId[m.id];
  const n = r.positions.length / 3;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < r.positions.length; i += 3) { cx += r.positions[i]; cy += r.positions[i + 1]; cz += r.positions[i + 2]; }
  cx /= n; cy /= n; cz /= n;
  let rad = 0, maxR = 0;
  for (let i = 0; i < r.positions.length; i += 3) {
    const dx = r.positions[i] - cx, dy = r.positions[i + 1] - cy, dz = r.positions[i + 2] - cz;
    rad = Math.max(rad, Math.hypot(dx, dy, dz));
    maxR = Math.max(maxR, Math.hypot(r.positions[i], r.positions[i + 1], r.positions[i + 2]));
  }
  m.maxR = +maxR.toFixed(4);
  m.center = [+cx.toFixed(4), +cy.toFixed(4), +cz.toFixed(4)];
  m.radius = +rad.toFixed(4);
}

// ------------------------------------------------------------------
// Sulci. The atrioventricular and interventricular grooves are where the
// coronary arteries and the great cardiac vein physically run. Rather than
// painting lines, measure each chamber vertex against the real vessel geometry
// and store a smooth mask that the shader uses both to recess the surface and
// to tint the epicardial fat that fills the groove.
// ------------------------------------------------------------------
{
  const witnesses = ['rca', 'lcx', 'lad', 'pda', 'great_cardiac_vein', 'coronary_sinus'];
  const pts = [];
  for (const id of witnesses) {
    const r = final.find((x) => x.id === id);
    if (!r) continue;
    for (let i = 0; i < r.positions.length; i += 3) pts.push(r.positions[i], r.positions[i + 1], r.positions[i + 2]);
  }
  const cell = 0.02;
  const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  const grid = new Map();
  for (let i = 0; i < pts.length; i += 3) {
    const k = key(pts[i], pts[i + 1], pts[i + 2]);
    let a = grid.get(k);
    if (!a) { a = []; grid.set(k, a); }
    a.push(pts[i], pts[i + 1], pts[i + 2]);
  }
  const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  for (const st of built) {
    const isChamber = ['ra', 'rv', 'la', 'lv'].includes(st.id);
    const arr = new Float32Array(st.positions.length / 3);
    if (isChamber) {
      for (let i = 0; i < arr.length; i++) {
        const x = st.positions[i * 3], y = st.positions[i * 3 + 1], z = st.positions[i * 3 + 2];
        let best = Infinity;
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
          const a = grid.get(key(x + dx * cell, y + dy * cell, z + dz * cell));
          if (!a) continue;
          for (let k = 0; k < a.length; k += 3) {
            const d = (a[k] - x) ** 2 + (a[k + 1] - y) ** 2 + (a[k + 2] - z) ** 2;
            if (d < best) best = d;
          }
        }
        if (!isFinite(best)) { arr[i] = 0; continue; }
        const d = Math.sqrt(best);
        arr[i] = 1 - smooth((d - 0.006) / (0.030 - 0.006));
      }
    }
    st.attrs = { aGroove: arr };
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const bytes = writeGlb(built, path.join(OUT_DIR, 'anatomy.glb'));
meta.bytes = bytes;
fs.writeFileSync(path.join(OUT_DIR, 'anatomy.json'), JSON.stringify(meta, null, 1));
console.log('wrote', path.join(OUT_DIR, 'anatomy.glb'), (bytes / 1e6).toFixed(2), 'MB');
