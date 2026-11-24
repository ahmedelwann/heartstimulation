import * as THREE from 'three';

/**
 * Circulation.
 *
 * Particles are not scattered around the heart. Each one is a coordinate on a
 * single closed polyline whose vertices were derived from the segmented
 * anatomy (geodesic centreline for vessels, valve-plane splices for chambers).
 * Velocity along that line is modulated by the valve state of the segment it is
 * crossing, so blood accumulates behind a closed tricuspid valve and accelerates
 * through an open aortic valve.
 *
 * LIMITATION, stated in the UI: lumina are reconstructed from the specimen's
 * cavities, not measured from contrast imaging. The flow is a visualisation of
 * sequence and direction, not a computational fluid dynamics solution.
 */

const VENOUS = new THREE.Color('#5b78a8');
const ARTERIAL = new THREE.Color('#bb5b4e');
const LUNG = new THREE.Color('#8a7fa8');

export class Flow {
  constructor(stage, anatomy) {
    this.stage = stage;
    this.anatomy = anatomy;
    this.group = new THREE.Group();
    this.group.name = 'circulation';
    stage.scene.add(this.group);
    this.time = 0;
    this.state = null;
    this.energy = 0;
    this.journey = null;
  }

  build(meta, quality = 'high') {
    const P = (id) => (meta.paths[id] || []).map((p) => new THREE.Vector3(...p));
    const C = (id) => {
      const s = meta.structures.find((x) => x.id === id);
      return s ? new THREE.Vector3(...s.center) : new THREE.Vector3();
    };
    const last = (arr) => arr[arr.length - 1];
    const first = (arr) => arr[0];

    const svc = P('svc'), ivc = P('ivc'), aorta = P('aorta'), pt = P('pulmonary_trunk');
    const lpa = P('lpa'), rpa = P('rpa'), pvL = P('pv_lspv'), pvR = P('pv_rspv');

    const tv = C('tv'), mv = C('mv'), av = C('av'), pvv = C('pvv');
    const ra = C('cav_ra'), rv = C('cav_rv'), la = C('cav_la'), lv = C('cav_lv');
    const apex = lv.clone().add(new THREE.Vector3(-0.04, -0.16, 0.03));

    const legs = [];
    const add = (name, pts, gate, sat, off = false) => {
      if (pts.length >= 2) legs.push({ name, pts, gate, sat, off });
    };

    add('Superior vena cava', svc, 'free', 0);
    add('Right atrium', [last(svc), ra, tv], 'tv', 0);
    add('Tricuspid valve', [tv, rv.clone().add(new THREE.Vector3(-0.02, -0.05, 0.02))], 'tv', 0);
    add('Right ventricle → outflow', [rv.clone().add(new THREE.Vector3(-0.02, -0.05, 0.02)), rv.clone().add(new THREE.Vector3(0.0, 0.06, 0.04)), pvv], 'pv', 0);
    add('Pulmonary trunk', pt, 'pv', 0);
    add('Pulmonary artery', lpa, 'pv', 0);
    add('Pulmonary circulation', [last(lpa), last(lpa).clone().lerp(first(pvL), 0.35).add(new THREE.Vector3(0.28, 0.10, -0.16)), first(pvL).clone().lerp(last(lpa), 0.22).add(new THREE.Vector3(0.06, 0.06, -0.06))], 'free', 1, true);
    add('Pulmonary veins', pvL, 'free', 1);
    add('Left atrium', [last(pvL), la, mv], 'mv', 1);
    add('Mitral valve → left ventricle', [mv, lv.clone().add(new THREE.Vector3(0.02, 0.04, 0.0)), apex], 'mv', 1);
    add('Left ventricular outflow', [apex, av], 'av', 1);
    add('Aorta', aorta, 'av', 1);
    add('Systemic circulation', [last(aorta), last(aorta).clone().lerp(first(svc), 0.38).add(new THREE.Vector3(-0.30, 0.02, 0.10)), first(svc).clone().lerp(last(aorta), 0.25).add(new THREE.Vector3(-0.10, 0.05, 0.02))], 'free', 0, true);

    // rasterise every leg onto a common arc-length parameter
    const pts = [];
    const gates = [];
    const sats = [];
    const offs = [];
    const stations = [];
    let legStart = 0;
    for (const leg of legs) {
      const curve = new THREE.CatmullRomCurve3(leg.pts, false, 'catmullrom', 0.4);
      const seg = Math.max(8, Math.round(curve.getLength() / 0.012));
      const arr = curve.getSpacedPoints(seg);
      for (let i = 0; i < arr.length; i++) {
        pts.push(arr[i]);
        gates.push(leg.gate);
        sats.push(leg.sat);
        offs.push(leg.off);
      }
      stations.push({ name: leg.name, from: legStart, to: pts.length - 1, off: leg.off, sat: leg.sat });
      legStart = pts.length - 1;
    }

    // cumulative length, plus a second cumulative measure that only counts the
    // segments inside the specimen: particles are seeded against that measure so
    // they are not wasted in the invisible pulmonary / systemic detours
    const cum = new Float32Array(pts.length);
    const visCum = new Float32Array(pts.length);
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].distanceTo(pts[i - 1]);
      cum[i] = cum[i - 1] + d;
      visCum[i] = visCum[i - 1] + (offs[i] ? 0 : d);
    }
    this.total = cum[cum.length - 1];
    this.visTotal = visCum[visCum.length - 1];
    this.visCum = visCum;
    this.pts = pts;
    this.cum = cum;
    this.gates = gates;
    this.sats = sats;
    this.offs = offs;
    this.stations = stations;

    // dense resample for smooth motion (linear interpolation is enough at 12 mm)
    const count = quality === 'low' ? 700 : quality === 'medium' ? 1300 : 1800;
    this.count = count;
    const seg = count;
    this.positions = new Float32Array(seg * 3);
    this.colors = new Float32Array(seg * 3);
    this.s = new Float32Array(count);
    this.trail = new Float32Array(count);
    // radial offset inside the lumen: without it every particle collapses onto
    // one centreline and reads as a wire instead of a moving volume of blood
    this.radial = new Float32Array(count * 3);
    const seedAt = (v) => {
      // map a position on the visible measure back to an arc length
      let lo = 0, hi = this.visCum.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (this.visCum[mid] <= v) lo = mid; else hi = mid;
      }
      return this.cum[lo];
    };
    for (let i = 0; i < count; i++) {
      this.s[i] = seedAt(Math.random() * this.visTotal);
      this.trail[i] = 0.010 + Math.random() * 0.020;
      const th = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * 0.016;
      this.radial[i * 3] = Math.cos(th) * rr;
      this.radial[i * 3 + 1] = Math.sin(th) * rr * 0.7;
      this.radial[i * 3 + 2] = Math.sin(th * 1.7) * rr * 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      size: 0.042,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      map: makeDotTexture(),
      alphaTest: 0.02,
    });
    this.lines = new THREE.Points(geo, mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 4;
    this.group.add(this.lines);

    // journey marker
    const mk = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.95 }),
    );
    mk.visible = false;
    this.group.add(mk);
    this.marker = mk;
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.016, 0.021, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    );
    mk.add(halo);
    this.halo = halo;

    this.updateColors();
    return this;
  }

  /** sample position + gate at arc length s */
  at(s, out = new THREE.Vector3()) {
    const cum = this.cum;
    const total = this.total;
    let x = ((s % total) + total) % total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= x) lo = mid; else hi = mid;
    }
    const t = (x - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]);
    out.copy(this.pts[lo]).lerp(this.pts[hi], t);
    return { point: out, i: lo + t, gate: this.gates[lo], off: this.offs[lo], sat: this.sats[lo], station: this.stationAt(x) };
  }

  stationAt(s) {
    const st = this.stations;
    for (let i = 0; i < st.length; i++) if (s >= this.cum[st[i].from] && s <= this.cum[st[i].to]) return st[i];
    return st[0];
  }

  updateColors() {
    const counts = this.count;
    for (let i = 0; i < counts; i++) {
      const s = this.s[i];
      const info = this.at(s, this._tmp || (this._tmp = new THREE.Vector3()));
      const c = new THREE.Color();
      if (info.sat === 1) c.copy(ARTERIAL); else c.copy(VENOUS);
      if (info.off && info.sat === 1) c.lerp(LUNG, 0.5);
      const flicker = 0.55 + 0.45 * Math.sin(i * 12.9898);
      const a = (info.off ? 0.0 : 1.7) * flicker;
      this.colors[i * 3] = c.r * a;
      this.colors[i * 3 + 1] = c.g * a;
      this.colors[i * 3 + 2] = c.b * a;
    }
    this.lines.geometry.attributes.color.needsUpdate = true;
  }

  gateSpeed(gate, st) {
    if (!st) return 1;
    switch (gate) {
      case 'tv': return st.tvOpen ? 0.55 + 0.75 * this.fill : 0.015;
      case 'mv': return st.mvOpen ? 0.55 + 0.75 * this.fill : 0.015;
      case 'pv': return st.pvOpen ? 0.5 + 1.15 * this.eject : 0.012;
      case 'av': return st.avOpen ? 0.5 + 1.35 * this.eject : 0.012;
      default: return 1;
    }
  }

  update(dt, state) {
    this.state = state;
    if (!state) return;
    // normalised ejection / filling envelopes from the engine
    const u = state.u;
    this.eject = state.phaseKey === 'ejection'
      ? Math.sin(Math.min(1, (u - state.ivc) / state.ejec) * Math.PI)
      : 0;
    const fill = state.phaseKey === 'filling' || state.phaseKey === 'diastasis' || state.phaseKey === 'atrial'
      ? 0.5 + 0.5 * Math.sin(Math.min(1, (u - state.qt) / Math.max(0.1, state.rr - state.qt)) * Math.PI)
      : 0.1;
    this.fill = fill;

    const base = 0.26;
    const pos = this.positions;
    const trail = this.trail;
    let colDirty = false;
    for (let i = 0; i < this.count; i++) {
      const s = this.s[i];
      const info = this.at(s);
      const v = base * this.gateSpeed(info.gate, state) * (info.off ? 3.2 : 1);
      this.s[i] = s + v * dt;
      const p = this.at(this.s[i]).point;
      const ox = this.radial[i * 3], oy = this.radial[i * 3 + 1], oz = this.radial[i * 3 + 2];
      pos[i * 3] = p.x + ox; pos[i * 3 + 1] = p.y + oy; pos[i * 3 + 2] = p.z + oz;
      if ((i + Math.floor(this.time * 8)) % 24 === 0) colDirty = true;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    if (colDirty) this.updateColors();

    if (this.journey) {
      const j = this.journey;
      j.s += dt * 0.26 * this.gateSpeed(this.at(j.s).gate, state) * (this.at(j.s).off ? 3.2 : 1);
      const info = this.at(j.s);
      this.marker.position.copy(info.point);
      this.marker.visible = true;
      this.marker.lookAt(this.stage.camera.position);
      j.station = info.station;
      j.info = info;
    }
    this.time += dt;
  }

  setJourney(on) {
    this.journey = on ? { s: 0.02, station: this.stations[0] } : null;
    if (!on) { this.marker.visible = false; }
    return this.journey;
  }

  setVisible(v) { this.group.visible = v; }

  setQuality(q) {
    this.lines.material.opacity = q === 'low' ? 0.7 : 0.85;
  }
}

/** soft round sprite so the particles read as corpuscles, not squares */
function makeDotTexture() {
  const s = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
