import * as THREE from 'three';
import { Stage } from './gl/Stage.js';
import { Anatomy } from './gl/Anatomy.js';
import { ActivationField } from './gl/Activation.js';
import { Flow } from './gl/Flow.js';
import { HeartEngine } from './physiology/Engine.js';
import { Ecg } from './physiology/Ecg.js';
import { UI } from './ui/UI.js';
import { STRUCTURES } from './data/content.js';
import './styles/base.css';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

class App {
  constructor() {
    this.stage = new Stage($('gl'));
    this.anatomy = new Anatomy(this.stage);
    this.engine = new HeartEngine();
    this.activation = null;
    this.ecg = null;
    this.flow = null;
    this.ui = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragged = false;
    this.mode = 'situ';
    this.flowOn = false;
    this.sound = false;
    this.stimSite = null;
    this.stimReadout = null;
    this.stimMesh = null;
    this.journey = null;
    this.savedCamera = null;
    this.armed = false;
  }

  async boot() {
    this.setLoad(0.04, 'Preparing specimen');
    await this.anatomy.load((p) => this.setLoad(0.05 + p * 0.62, 'Loading segmented anatomy'));

    this.setLoad(0.7, 'Solving activation fields');
    await raf();
    this.activation = new ActivationField(this.anatomy);

    // Anatomical landmarks for conduction.
    const ra = this.anatomy.get('ra').meta;
    const svcNode = new THREE.Vector3(-0.30, 0.34, -0.02);
    const avNode = new THREE.Vector3(0.02, -0.02, -0.10);

    this.narrowMaps = this.activation.sinus(svcNode, avNode);
    this.narrowSeries = this.activation.qrsSeries(60);
    this.wideMapsRV = this.activation.ectopic('rv', this.nearestVertex('rv', new THREE.Vector3(-0.12, -0.28, 0.12)));
    this.wideSeriesRV = this.activation.qrsSeries(60);
    this.wideMapsLV = this.activation.ectopic('lv', this.nearestVertex('lv', new THREE.Vector3(0.30, -0.22, 0.05)));
    this.wideSeriesLV = this.activation.qrsSeries(60);

    this.setLoad(0.86, 'Building circulation');
    await raf();
    this.flow = new Flow(this.stage, this.anatomy).build(this.anatomy.meta, this.stage.quality);
    this.ecg = new Ecg($('ecg'), this.engine);
    this.ui = new UI(this);

    // imprint link
    const imp = document.createElement('button');
    imp.className = 'txt-btn';
    imp.textContent = 'Imprint';
    imp.style.marginLeft = '4px';
    imp.addEventListener('click', () => this.ui.openImprint());
    document.querySelector('.cycle-toggles').appendChild(imp);

    this.applyActivation('narrow');
    this.engine.activationQRS = this.actSummary.qrs;
    this.engine.onBeat = (b) => {
      if (!this.pacingActive()) {
        if (this.engine.rhythm.id === 'vt') this.applyActivation('wideLV');
        else if (b.morph === 'wide') this.applyActivation('wideRV');
        else this.applyActivation('narrow');
      }
      this.audio?.beat(b, this.engine.stateAt());
    };
    this.engine.beats = [];
    this.engine.reset();

    this.bindInput();
    this.stage.add((t, dt) => this.tick(t, dt));

    this.setLoad(1, 'Specimen ready');
    this.enableEnter();
  }

  nearestVertex(meshId, point) {
    const g = new THREE.Vector3(...this.anatomy.get(meshId).meta.center);
    const geo = this.anatomy.get(meshId).mesh.geometry;
    const pos = geo.attributes.position.array;
    const p = point || g;
    let best = 0, bd = Infinity;
    for (let i = 0; i < pos.length / 3; i++) {
      const dx = pos[i * 3] - p.x, dy = pos[i * 3 + 1] - p.y, dz = pos[i * 3 + 2] - p.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  setLoad(p, label) {
    const bar = document.querySelector('.open-progress span');
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    $('load-pct').textContent = `${Math.round(p * 100)}%`;
    if (label) $('load-status').textContent = label;
  }

  enableEnter() {
    const btn = $('enter');
    btn.disabled = false;
    btn.addEventListener('click', () => this.enter(false));
    $('skip').addEventListener('click', () => this.enter(true));
    this._autoEnter = setTimeout(() => this.enter(false), 2600);
  }

  enter(skip) {
    if (this.entered) return;
    this.entered = true;
    clearTimeout(this._autoEnter);
    if (skip) {
      this.anatomy.setReveal(9);
      $('opening').classList.add('done');
      document.getElementById('app').classList.add('armed');
      this.armed = true;
      return;
    }
    $('opening').classList.add('done');
    document.getElementById('app').classList.add('armed');
    this.armed = true;
    const b = this.anatomy.bounds;
    const from = b.min.y - 0.08, to = b.max.y + 0.12;
    const t0 = performance.now();
    const dur = 2400;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - k, 2.2);
      this.anatomy.setReveal(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
      else this.anatomy.setReveal(99);
    };
    step();
    // belt and braces: if rAF is throttled (background tab, slow GPU) the scan
    // must still finish rather than leaving the specimen half materialised
    setTimeout(() => this.anatomy.setReveal(99), 3200);
    // camera settle
    const core = this.coreFrame();
    this.stage.frame(core, 0.56, { padding: 1.55, duration: 2600, direction: [0.62, 0.03, 0.95] });
  }

  coreFrame() {
    return new THREE.Vector3(0, 0.0, 0);
  }

  /* ------------------------------------------------------------------ *
   * activation plumbing
   * ------------------------------------------------------------------ */
  applyActivation(kind) {
    const map = kind === 'wideRV' ? this.wideMapsRV
      : kind === 'wideLV' ? this.wideMapsLV
      : kind === 'custom' ? this.customMaps : this.narrowMaps;
    const series = kind === 'wideRV' ? this.wideSeriesRV
      : kind === 'wideLV' ? this.wideSeriesLV
      : kind === 'custom' ? this.customSeries : this.narrowSeries;
    this.anatomy.setActivation(map);
    this.currentSeries = series;
    this.ecg?.setSeries(this.narrowSeries, kind === 'custom' ? this.customSeries : kind === 'wideLV' ? this.wideSeriesLV : this.wideSeriesRV);
    this.actSummary = this.activation.summarize(map, 0);
    this.engine.activationQRS = this.actSummary.qrs;
    this.ui && (this.ui.railSig = '');
  }

  /* ------------------------------------------------------------------ *
   * modes
   * ------------------------------------------------------------------ */
  setMode(mode) {
    this.mode = mode;
    this.ui.setMode(mode);
    this.onMode(mode);
  }

  onMode(mode) {
    const core = this.coreFrame();
    if (mode === 'situ') {
      this.clearSelection();
      this.setGhost(false);
      this.setCavities(false);
      this.stage.frame(core, 0.56, { padding: 1.55, duration: 1100, direction: [0.62, 0.03, 0.95] });
    } else if (mode === 'structura') {
      this.setGhost(false);
      this.stage.frame(core, 0.56, { padding: 1.55, duration: 1100, direction: [0.62, 0.03, 0.95] });
      this.ui.toast('Select a structure on the specimen');
    } else if (mode === 'cyclus') {
      this.setGhost(true);
      this.setCavities(true);
      this.stage.frame(core, 0.5, { padding: 1.5, duration: 1200, direction: [0.5, 0.0, 0.95] });
      this.ui.toast('Drag the cycle to hold an instant');
    } else if (mode === 'rhythmus') {
      this.setGhost(false);
      this.ui.openRhythm(this.engine.rhythm.id);
    } else if (mode === 'stimulatio') {
      this.clearSelection();
      this.setGhost(false);
      this.ui.showStimReadout(true);
      this.stage.frame(core, 0.5, { padding: 1.5, duration: 1100, direction: [0.5, 0.0, 0.95] });
      if (!this.stimSite) this.ui.toast('Click ventricular myocardium to place the electrode');
    } else if (mode === 'iter') {
      this.startJourney();
    }
    this.stage.canvas.style.cursor = mode === 'stimulatio' ? 'crosshair' : 'grab';
    this.ui.labelsOn = mode === 'structura';
    const lbl = $('toggle-labels');
    if (lbl) lbl.setAttribute('aria-pressed', String(this.ui.labelsOn));
  }

  setGhost(on) {
    this.anatomy.setGhost(on);
    const t = $('toggle-thing');
    if (t) t.setAttribute('aria-pressed', String(on));
    this.ghost = on;
  }

  setCavities(on) {
    this.anatomy.setCavityVisibility(on);
  }

  setFlow(on) {
    this.flowOn = on;
    this.flow.setVisible(on);
    this.anatomy.setFlowReveal(on);
    // the blood pool is inside the muscle: flow can only be seen once the wall
    // is dithered, so enabling flow also opens the myocardium
    if (on) { this.anatomy.setGhost(true); this.ghost = true; this.ui.toast('Myocardium opened — blood pool visible'); }
    else { this.anatomy.setGhost(false); this.ghost = false; }
    const t = document.getElementById('toggle-thing');
    if (t) t.setAttribute('aria-pressed', String(this.ghost));
  }

  /* ------------------------------------------------------------------ *
   * selection
   * ------------------------------------------------------------------ */
  pick(ev) {
    const r = this.stage.canvas.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.stage.camera);
    const hits = this.raycaster.intersectObjects(this.anatomy.pickables, false);
    return hits[0] || null;
  }

  selectStructure(id, opts = {}) {
    this.anatomy.select(id);
    this.ui.openStructure(id);
    if (opts.focus !== false) this.focusStructure(id);
    if (opts.pace) this.ui.toast('Place the electrode on the myocardium of this chamber');
  }

  focusStructure(id) {
    const s = this.anatomy.get(id);
    if (!s) return;
    const center = s.center.clone();
    const dir = center.clone();
    if (dir.length() < 0.04) dir.copy(this.stage.camera.position).sub(this.stage.controls.target);
    dir.normalize();
    const radius = clamp(s.radius * 0.72, 0.09, 0.3);
    this.stage.frame(center.toArray(), radius, { padding: 2.25, duration: 1050, direction: dir.toArray() });
  }

  clearSelection() {
    this.anatomy.select(null);
    this.anatomy.isolateStructure(null);
    this.ui.closePanel();
    const d = document.getElementById('index-drawer');
    if (d) d.classList.remove('on');
    const ix = document.getElementById('t-index');
    if (ix) ix.setAttribute('aria-pressed', 'false');
  }

  isolate(id) {
    this.anatomy.isolateStructure(id);
    this.focusStructure(id);
    this.anatomy.setVisible(id, true);
  }

  enterCavity(id) {
    const cav = { lv: 'cav_lv', rv: 'cav_rv', la: 'cav_la', ra: 'cav_ra' }[id];
    this.setGhost(true);
    this.setCavities(true);
    this.anatomy.isolateStructure(id);
    const s = this.anatomy.get(cav || id);
    if (s) {
      const dir = s.center.clone();
      if (dir.length() < 0.04) dir.set(0.3, 0, 0.6);
      dir.normalize();
      this.stage.frame(s.center.toArray(), Math.max(0.1, s.radius * 0.6), { padding: 1.7, duration: 1200, direction: dir.toArray() });
    }
    this.anatomy.select(cav || id);
    this.ui.openStructure(id);
    this.ui.toast('Muscle is now dithered — the cavities are modelled surfaces, not painted');
  }

  resetView() {
    this.clearSelection();
    this.setGhost(false);
    this.anatomy.setCavityVisibility(false);
    this.anatomy.isolateStructure(null);
    this.stage.frame([0, 0, 0], 0.56, { padding: 1.55, duration: 1000, direction: [0.62, 0.03, 0.95] });
  }

  /* ------------------------------------------------------------------ *
   * pacing
   * ------------------------------------------------------------------ */
  pacingActive() { return !!this.stimSite; }

  paceAtPoint(hit) {
    const mesh = hit.object;
    if (!['lv', 'rv'].includes(mesh.name)) {
      this.ui.toast('Electrode must sit on ventricular myocardium');
      return;
    }
    const geo = mesh.geometry;
    const pos = geo.attributes.position.array;
    let best = hit.face.a, bd = Infinity;
    const p = hit.point;
    for (const vi of [hit.face.a, hit.face.b, hit.face.c]) {
      const d = (pos[vi * 3] - p.x) ** 2 + (pos[vi * 3 + 1] - p.y) ** 2 + (pos[vi * 3 + 2] - p.z) ** 2;
      if (d < bd) { bd = d; best = vi; }
    }
    this.customMaps = this.activation.ectopic(mesh.name, best);
    this.customSeries = this.activation.qrsSeries(60);
    this.applyActivation('custom');
    this.engine.setPacing({ mesh: mesh.name, vertex: best }, this.actSummary.qrs);
    this.engine.activationQRS = this.actSummary.qrs;
    this.stimSite = { mesh: mesh.name, point: p.clone(), normal: hit.face.normal.clone() };
    this.stimMesh = mesh.name;
    this.placeElectrode(p, hit.face.normal.clone().transformDirection(mesh.matrixWorld));
    this.stimReadout = { spread: this.actSummary.qrs, qrs: this.actSummary.qrs, axis: this.customSeries.axis };
    this.ui.showStimReadout(true);
    this.ui.toast(`${mesh.name.toUpperCase()} stimulation · complex widened`);
    document.getElementById('t-clear')?.setAttribute('aria-pressed', 'false');
  }

  placeElectrode(point, normal) {
    if (!this.electrode) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0035, 0.0035, 0.30, 10),
        new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.9, roughness: 0.35 }),
      );
      shaft.name = 'shaft';
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.0075, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc987 }),
      );
      tip.name = 'tip';
      g.add(shaft, tip);
      this.stage.scene.add(g);
      this.electrode = g;
    }
    const g = this.electrode;
    g.visible = true;
    const dir = normal.clone().normalize();
    const tipPos = point.clone().addScaledVector(dir, 0.002);
    g.position.copy(tipPos);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.getObjectByName('shaft').position.set(0, 0.15, 0);
    g.getObjectByName('tip').position.set(0, 0, 0);
  }

  paceAtStructure(id) {
    if (!['lv', 'rv'].includes(id)) return;
    this.setMode('stimulatio');
    const center = this.anatomy.get(id).center.clone();
    const dir = center.clone().normalize();
    // pick the surface point nearest the camera-facing side of the chamber
    const geo = this.anatomy.get(id).mesh.geometry;
    const pos = geo.attributes.position.array;
    const nrm = geo.attributes.normal.array;
    let best = 0, bs = -Infinity;
    const camDir = this.stage.camera.position.clone().sub(center).normalize();
    for (let i = 0; i < pos.length / 3; i++) {
      const vx = pos[i * 3], vy = pos[i * 3 + 1], vz = pos[i * 3 + 2];
      const facing = (vx - center.x) * camDir.x + (vy - center.y) * camDir.y + (vz - center.z) * camDir.z;
      const out = vx * nrm[i * 3] + vy * nrm[i * 3 + 1] + vz * nrm[i * 3 + 2];
      const score = facing + out * 0.2;
      if (score > bs) { bs = score; best = i; }
    }
    const p = new THREE.Vector3(pos[best * 3], pos[best * 3 + 1], pos[best * 3 + 2]);
    const n = new THREE.Vector3(nrm[best * 3], nrm[best * 3 + 1], nrm[best * 3 + 2]);
    this.paceAtPoint({ object: this.anatomy.get(id).mesh, point: p, face: { a: best, b: best, c: best, normal: n } });
  }

  clearPacing() {
    this.stimSite = null;
    this.stimReadout = null;
    this.engine.setPacing(null);
    if (this.electrode) this.electrode.visible = false;
    this.ui.showStimReadout(false);
    this.applyActivation('narrow');
    this.ui.toast('Sinus rhythm restored');
  }

  /* ------------------------------------------------------------------ *
   * rhythm
   * ------------------------------------------------------------------ */
  setRhythm(id) {
    this.engine.setRhythm(id);
    if (id !== 'pvc' && id !== 'vt') this.clearPacingSilent();
    if (id === 'vt') this.applyActivation('wideLV');
    else if (id === 'pvc') this.applyActivation('narrow');
    else this.applyActivation('narrow');
    this.ui.railSig = '';
    this.ui.openRhythm(id);
    this.ui.renderTools();
  }

  clearPacingSilent() {
    if (!this.stimSite) return;
    this.stimSite = null;
    this.stimReadout = null;
    this.engine.setPacing(null);
    if (this.electrode) this.electrode.visible = false;
    this.ui.showStimReadout(false);
  }

  nudgeHR(d) {
    this.engine.setHR(this.engine.targetHR + d);
    this.ui.railSig = '';
  }

  /* ------------------------------------------------------------------ *
   * journey
   * ------------------------------------------------------------------ */
  startJourney() {
    if (!this.flow) return;
    this.savedCamera = {
      pos: this.stage.camera.position.clone(),
      target: this.stage.controls.target.clone(),
    };
    this.journey = this.flow.setJourney(true);
    this.stage.controls.enabled = false;
    this.stage.camera.near = 0.008;
    this.stage.camera.fov = 58;
    this.stage.camera.updateProjectionMatrix();
    this.setGhost(true);
    this.anatomy.setHeadlamp(0.6);
    this.flow.setVisible(true);
    this.flowOn = false;
    this.ui.toast('Following one erythrocyte');
  }

  stopJourney() {
    if (!this.journey) return;
    this.flow.setJourney(false);
    this.journey = null;
    this.stage.controls.enabled = true;
    this.stage.camera.near = 0.02;
    this.stage.resize();
    this.anatomy.setHeadlamp(0);
    this.setGhost(false);
    if (this.savedCamera) {
      this.stage.animateCamera(this.savedCamera.pos, this.savedCamera.target, 900);
    }
    if (this.mode === 'iter') this.setMode('situ');
  }

  /* ------------------------------------------------------------------ *
   * audio (synthesised, optional)
   * ------------------------------------------------------------------ */
  setSound(on) {
    this.sound = on;
    if (on && !this.audio) this.audio = new HeartAudio();
    if (this.audio) this.audio.setEnabled(on);
  }

  /* ------------------------------------------------------------------ *
   * input
   * ------------------------------------------------------------------ */
  bindInput() {
    const c = this.stage.canvas;
    let downX = 0, downY = 0, downT = 0;
    c.addEventListener('pointerdown', (e) => {
      downX = e.clientX; downY = e.clientY; downT = performance.now();
      this.dragged = false;
      c.style.cursor = 'grabbing';
    });
    c.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 6) this.dragged = true;
      if (e.buttons) return;
      this.hoverAt(e);
    });
    c.addEventListener('pointerup', (e) => {
      c.style.cursor = this.mode === 'stimulatio' ? 'crosshair' : 'grab';
      if (this.dragged || performance.now() - downT > 700) return;
      const hit = this.pick(e);
      if (this.mode === 'stimulatio') {
        if (hit) this.paceAtPoint(hit);
        return;
      }
      if (!hit) { if (this.mode !== 'iter') this.clearSelection(); return; }
      if (this.mode === 'iter') return;
      this.selectStructure(hit.object.name);
    });
    c.addEventListener('pointerleave', () => this.ui.showHover(0, 0, null));

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        if (!this.ui.el.imprint.hidden) { this.ui.el.imprint.hidden = true; return; }
        if (this.mode === 'iter') this.stopJourney(); else this.clearSelection();
      }
      if (e.key === 'r' || e.key === 'R') this.resetView();
      if (e.key === 'g' || e.key === 'G') this.setGhost(!this.anatomy.ghost);
      const modes = ['situ', 'structura', 'cyclus', 'rhythmus', 'stimulatio', 'iter'];
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 6) this.setMode(modes[n - 1]);
    });
  }

  hoverAt(e) {
    if (this.mode === 'iter') return;
    const hit = this.pick(e);
    if (!hit) {
      this.anatomy.hover(null);
      this.ui.showHover(0, 0, null);
      this.reticle(false);
      return;
    }
    if (this.mode === 'stimulatio') {
      const ok = ['lv', 'rv'].includes(hit.object.name);
      this.reticle(true, e.clientX, e.clientY, ok);
      this.ui.showHover(0, 0, null);
      return;
    }
    this.anatomy.hover(hit.object.name);
    const s = STRUCTURES[hit.object.name];
    this.ui.showHover(e.clientX, e.clientY, s ? s.name : hit.object.name);
  }

  reticle(on, x, y, ok = true) {
    const r = $('reticle');
    r.classList.toggle('on', on);
    if (on) {
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      r.style.borderColor = ok ? 'rgba(233,192,126,.8)' : 'rgba(236,231,223,.25)';
    }
  }

  /* ------------------------------------------------------------------ *
   * scrub
   * ------------------------------------------------------------------ */
  beginScrub() {
    this.wasPaused = this.engine.paused;
    this.engine.paused = true;
  }

  endScrub() {
    this.engine.paused = this.wasPaused ?? false;
  }

  scrubAbsolute(f) {
    this.engine.scrub(f);
    this.ecg.reset();
  }

  /* ------------------------------------------------------------------ *
   * frame loop
   * ------------------------------------------------------------------ */
  tick(elapsed, dt) {
    this.engine.update(dt);
    const st = this.engine.stateAt();
    if (!st) return;

    // atrial clock: atrial activation lands just before the next QRS
    const r = this.engine.rhythm;
    let at;
    if (r.atrialMotion === 'fibrillatory') at = (elapsed * 5.6) % 0.16;
    else if (r.atrialMotion === 'flutter') at = (elapsed * 4.8) % 0.19;
    else at = st.u - (st.rr - st.beat.pr);
    this.anatomy.setPhase(st.u, at);

    this.ecg.update();
    this.ecg.draw();

    if (this.flowOn) this.flow.update(dt, st);

    if (this.journey) this.journeyCamera(dt);

    this.ui.update();
    this.updateStimNumbers();
  }

  updateStimNumbers() {
    if (!this.stimReadout) return;
    this.stimReadout.axis = this.currentSeries?.axis ?? 0;
    this.stimReadout.qrs = this.actSummary?.qrs ?? 0;
    this.stimReadout.spread = this.actSummary?.qrs ?? 0;
  }

  journeyCamera(dt) {
    const j = this.journey;
    const p = this.flow.at(j.s).point;
    const ahead = this.flow.at(j.s + 0.035).point;
    const dir = ahead.clone().sub(p).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const desired = p.clone()
      .addScaledVector(dir, -0.055)
      .addScaledVector(side, 0.012)
      .addScaledVector(up, 0.010);
    this.stage.camera.position.lerp(desired, Math.min(1, dt * 9));
    const look = p.clone().addScaledVector(dir, 0.09);
    this.stage.controls.target.lerp(look, Math.min(1, dt * 12));
    this.stage.camera.lookAt(this.stage.controls.target);
  }
}

/* ------------------------------------------------------------------ *
 * Audio: synthesised valve closure. No assets, no autoplay.
 * ------------------------------------------------------------------ */
class HeartAudio {
  constructor() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.enabled = false;
    this.lastPhase = null;
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.28 : 0, this.ctx.currentTime, 0.4);
  }

  thump(freq, gain, when, dur) {
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.05);

    const noise = this.ctx.createBufferSource();
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    noise.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 3.2;
    bp.Q.value = 1.1;
    const ng = this.ctx.createGain();
    ng.gain.value = gain * 0.5;
    noise.connect(bp).connect(ng).connect(this.master);
    noise.start(t);
  }

  beat(b, state) {
    if (!this.enabled) return;
    this.thump(58, 0.5, 0.02, 0.17);          // S1 at AV valve closure
    this.thump(72, 0.32, state ? state.ivc + state.ejec : 0.34, 0.13); // S2
  }
}

const raf = () => new Promise((r) => requestAnimationFrame(() => r()));

const app = new App();
window.__app = app;
window.__grab = () => app.stage.renderer.domElement.toDataURL('image/png');
app.boot().catch((e) => {
  console.error(e);
  $('load-status').textContent = 'Could not load the specimen';
  $('load-pct').textContent = '—';
});
