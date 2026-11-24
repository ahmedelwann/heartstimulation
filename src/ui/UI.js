import * as THREE from 'three';
import { STRUCTURES, GROUPS, ORDER, RHYTHMS } from '../data/content.js';

const CHAPTERS = [
  { id: 'situ', num: 'I', name: 'In situ' },
  { id: 'structura', num: 'II', name: 'Structura' },
  { id: 'cyclus', num: 'III', name: 'Cyclus' },
  { id: 'rhythmus', num: 'IV', name: 'Rhythmus' },
  { id: 'stimulatio', num: 'V', name: 'Stimulatio' },
  { id: 'iter', num: 'VI', name: 'Iter' },
];

const LABEL_IDS = ['ra', 'rv', 'la', 'lv', 'aorta', 'pulmonary_trunk', 'svc', 'ivc', 'tv', 'mv', 'av', 'lca', 'rca', 'pv_lspv'];

const md = (s) => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

export class UI {
  constructor(app) {
    this.app = app;
    this.$ = (id) => document.getElementById(id);
    this.el = {
      spine: this.$('spine-list'),
      panel: this.$('panel'),
      rail: this.$('rail'),
      track: this.$('rail-track'),
      head: this.$('rail-head'),
      phase: this.$('cycle-phase'),
      ecg: this.$('ecg'),
      tools: this.$('tools'),
      labels: this.$('label-field'),
      toast: this.$('toast'),
      hr: this.$('hr-val'),
      vHr: this.$('v-hr'),
      vQrs: this.$('v-qrs'),
      vQt: this.$('v-qt'),
      vSv: this.$('v-sv'),
      axisG: this.$('axis-g'),
      axisVal: this.$('axis-val'),
      stim: null,
      drawer: null,
      imprint: this.$('imprint'),
    };
    this.mode = 'situ';
    this.labelsOn = false;
    this.railSig = '';
    this.lastAxis = null;
    this.hoverTag = null;
    this.buildSpine();
    this.buildAxis();
    this.buildRail();
    this.wireBand();
    this.buildHoverTag();
  }

  /* ---------------- identity / chapters ---------------- */
  buildSpine() {
    this.el.spine.innerHTML = CHAPTERS.map(
      (c) => `<li><button class="chap" data-mode="${c.id}"><span class="num">${c.num}</span><span class="name">${c.name}</span><span class="tick"></span></button></li>`,
    ).join('');
    this.el.spine.querySelectorAll('.chap').forEach((b) => {
      b.addEventListener('click', () => this.app.setMode(b.dataset.mode));
    });
    this.setMode('situ', true);
  }

  setMode(mode, silent = false) {
    this.mode = mode;
    this.el.spine.querySelectorAll('.chap').forEach((b) => {
      b.setAttribute('aria-current', String(b.dataset.mode === mode));
    });
    this.labelsOn = mode === 'structura' ? true : this.labelsOn;
    this.renderTools();
    if (!silent) this.app.onMode(mode);
  }

  /* ---------------- tools per mode ---------------- */
  renderTools() {
    const t = this.el.tools;
    const quick = `
      <div class="only-mobile" style="gap:14px;justify-content:flex-end;border-top:1px solid var(--hair-2);padding-top:6px;">
        <button class="txt-btn" id="q-ghost" aria-pressed="${this.app.anatomy.ghost}">Ghost</button>
        <button class="txt-btn" id="q-labels" aria-pressed="${this.labelsOn}">Labels</button>
        <button class="txt-btn" id="q-sound" aria-pressed="${this.app.sound}">Sound</button>
        <button class="txt-btn" id="q-imprint">Imprint</button>
      </div>`;
    t.innerHTML = quick;
    if (this.mode === 'structura') {
      t.innerHTML += `
        <div class="tool-group"><span class="tool-label">Index</span>
        <button class="tool-btn" id="t-index" aria-pressed="false">All structures</button></div>
        <div class="tool-note">Choose a structure on the specimen, or from the index.</div>`;
      t.querySelector('#t-index').addEventListener('click', (e) => {
        const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
        e.currentTarget.setAttribute('aria-pressed', String(on));
        this.toggleDrawer(on);
      });
    } else if (this.mode === 'cyclus') {
      t.innerHTML += `
        <div class="tool-group"><span class="tool-label">Reveal</span>
          <button class="tool-btn" id="t-ghost" aria-pressed="${this.app.anatomy.ghost}">Muscle</button>
          <button class="tool-btn" id="t-cav" aria-pressed="false">Cavities</button>
          <button class="tool-btn" id="t-flow" aria-pressed="${this.app.flowOn}">Flow</button>
        </div>
        <div class="tool-note">Scrub the cycle below to hold any instant of systole or diastole.</div>`;
      t.querySelector('#t-ghost').addEventListener('click', (e) => {
        const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
        e.currentTarget.setAttribute('aria-pressed', String(on));
        this.app.setGhost(on);
      });
      t.querySelector('#t-cav').addEventListener('click', (e) => {
        const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
        e.currentTarget.setAttribute('aria-pressed', String(on));
        this.app.setCavities(on);
      });
      t.querySelector('#t-flow').addEventListener('click', (e) => {
        const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
        e.currentTarget.setAttribute('aria-pressed', String(on));
        this.app.setFlow(on);
      });
    } else if (this.mode === 'rhythmus') {
      const list = RHYTHMS.map(
        (r) => `<button class="tool-btn r-btn" data-r="${r.id}" aria-pressed="${this.app.engine.rhythm.id === r.id}">${r.name}</button>`,
      ).join('');
      t.innerHTML += `<div class="tool-group"><span class="tool-label">Rhythm</span></div><div class="tool-row r-row">${list}</div>`;
      t.querySelectorAll('.r-btn').forEach((b) => b.addEventListener('click', () => {
        this.app.setRhythm(b.dataset.r);
        t.querySelectorAll('.r-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }));
    } else if (this.mode === 'stimulatio') {
      t.innerHTML += `
        <div class="tool-group"><span class="tool-label">Pacing</span>
          <button class="tool-btn" id="t-clear" aria-pressed="false">Restore sinus</button></div>
        <div class="tool-note" id="t-hint">Click any point of ventricular myocardium to place the electrode.</div>`;
      t.querySelector('#t-clear').addEventListener('click', () => this.app.clearPacing());
    } else if (this.mode === 'iter') {
      t.innerHTML += `
        <div class="tool-group"><span class="tool-label">Erythrocyte</span>
          <button class="tool-btn" id="t-exit" aria-pressed="false">Release</button></div>
        <div class="tool-note">One cell, one circuit. The camera travels inside the blood pool.</div>`;
      t.querySelector('#t-exit').addEventListener('click', () => this.app.stopJourney());
    }
    t.querySelector('#q-ghost')?.addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      this.app.setGhost(on);
    });
    t.querySelector('#q-labels')?.addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      this.labelsOn = on;
    });
    t.querySelector('#q-sound')?.addEventListener('click', (e) => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', String(on));
      this.app.setSound(on);
    });
    t.querySelector('#q-imprint')?.addEventListener('click', () => this.openImprint());
  }

  /* ---------------- structure index ---------------- */
  toggleDrawer(on) {
    if (!this.el.drawer) {
      const d = document.createElement('div');
      d.id = 'index-drawer';
      const groups = {};
      ORDER.forEach((id) => {
        const s = STRUCTURES[id];
        if (!s) return;
        (groups[s.group] ||= []).push(id);
      });
      d.innerHTML = Object.entries(groups).map(([g, ids]) => `
        <div class="ix-group">${GROUPS[g]?.label || g}</div>
        ${ids.map((id) => `<button class="ix-item" data-id="${id}">${STRUCTURES[id].name}</button>`).join('')}
      `).join('');
      document.getElementById('app').appendChild(d);
      d.querySelectorAll('.ix-item').forEach((b) => b.addEventListener('click', () => {
        this.app.selectStructure(b.dataset.id, { focus: true });
      }));
      this.el.drawer = d;
    }
    this.el.drawer.classList.toggle('on', on);
  }

  /* ---------------- panel ---------------- */
  closePanel() {
    const p = this.el.panel;
    p.classList.remove('open');
    setTimeout(() => { if (!p.classList.contains('open')) p.hidden = true; }, 460);
  }

  openStructure(id) {
    const s = STRUCTURES[id];
    if (!s) return;
    const g = GROUPS[s.group];
    const heads = g?.head || ['Note'];
    const sections = s.sections.map(([h, body], i) => `
      <div class="p-sec ${i === 0 ? 'open' : ''}">
        <button>${h}<span class="pm">+</span></button>
        <div class="body"><div><p>${md(body)}</p></div></div>
      </div>`).join('');
    const isChamber = ['lv', 'rv', 'la', 'ra'].includes(id);
    const isMyo = ['lv', 'rv'].includes(id);
    this.setPanel(`
      <button class="p-close" data-act="close">Close</button>
      <div class="p-group">${g?.label || ''}</div>
      <h2 class="p-name">${s.name}</h2>
      <div class="p-latin">${s.latin}</div>
      <div class="p-id"><span class="chip">${s.fma}</span><span>segmented from BodyParts3D</span></div>
      <p class="p-lede">${md(s.lede)}</p>
      <div class="p-actions">
        <button data-act="isolate">Isolate</button>
        ${isChamber ? '<button data-act="cavity">Enter cavity</button>' : ''}
        ${isMyo ? '<button data-act="pace">Pace here</button>' : ''}
        <button data-act="reset">Whole heart</button>
      </div>
      ${sections}
      <div class="p-meta">
        ${heads.length ? '' : ''}
        Surface geometry: BodyParts3D (DBCLS), CC BY 4.0.<br />
        Educational description, not clinical guidance.
      </div>
    `);
    this.el.panel.querySelectorAll('.p-sec > button').forEach((b) => {
      b.addEventListener('click', () => b.parentElement.classList.toggle('open'));
    });
    this.el.panel.querySelector('[data-act="close"]').addEventListener('click', () => this.app.clearSelection());
    this.el.panel.querySelector('[data-act="isolate"]').addEventListener('click', () => this.app.isolate(id));
    this.el.panel.querySelector('[data-act="reset"]').addEventListener('click', () => this.app.resetView());
    this.el.panel.querySelector('[data-act="cavity"]')?.addEventListener('click', () => this.app.enterCavity(id));
    this.el.panel.querySelector('[data-act="pace"]')?.addEventListener('click', () => this.app.paceAtStructure(id));
    this.showPanel();
  }

  openRhythm(id) {
    const r = RHYTHMS.find((x) => x.id === id);
    if (!r) return;
    this.setPanel(`
      <button class="p-close" data-act="close">Close</button>
      <div class="p-group">Rhythm state · ${r.tag}</div>
      <h2 class="p-name">${r.name}</h2>
      <div class="p-latin">${r.hr} min⁻¹ ${r.irregular ? '· irregular' : '· regular'}</div>
      <p class="p-lede">${md(r.copy.mechanism)}</p>
      <div class="p-sec open"><button>What you are seeing<span class="pm">+</span></button>
        <div class="body"><div><p>${md(r.copy.visible)}</p></div></div></div>
      <div class="p-sec"><button>Why it matters<span class="pm">+</span></button>
        <div class="body"><div><p>${md(r.copy.clinical)}</p></div></div></div>
      <div class="p-meta">Timing is modelled from cycle descriptors; the ECG is derived from the
      activation field. It is not a recording.</div>
    `);
    this.el.panel.querySelectorAll('.p-sec > button').forEach((b) => {
      b.addEventListener('click', () => b.parentElement.classList.toggle('open'));
    });
    this.el.panel.querySelector('[data-act="close"]').addEventListener('click', () => this.closePanel());
    this.showPanel();
  }

  setPanel(html) {
    this.el.panel.innerHTML = html;
    this.el.panel.hidden = false;
    this.el.panel.scrollTop = 0;
  }

  showPanel() {
    const p = this.el.panel;
    p.hidden = false;
    requestAnimationFrame(() => p.classList.add('open'));
  }

  /* ---------------- band ---------------- */
  buildRail() {
    this.el.rail.addEventListener('pointerdown', (e) => {
      this.el.rail.setPointerCapture(e.pointerId);
      this.scrubbing = true;
      this.app.beginScrub();
      this.scrubTo(e);
    });
    this.el.rail.addEventListener('pointermove', (e) => { if (this.scrubbing) this.scrubTo(e); });
    const end = (e) => {
      if (!this.scrubbing) return;
      this.scrubbing = false;
      this.app.endScrub();
    };
    this.el.rail.addEventListener('pointerup', end);
    this.el.rail.addEventListener('pointercancel', end);
    this.el.rail.addEventListener('keydown', (e) => {
      const st = this.app.engine.stateAt();
      if (!st) return;
      const step = e.shiftKey ? 0.1 : 0.02;
      if (e.key === 'ArrowRight') { this.app.scrubAbsolute(Math.min(0.999, st.progress + step)); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { this.app.scrubAbsolute(Math.max(0, st.progress - step)); e.preventDefault(); }
    });
  }

  scrubTo(e) {
    const r = this.el.rail.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    this.app.scrubAbsolute(f);
  }

  buildAxis() {
    const g = this.el.axisG;
    const cx = 50, cy = 50, r = 34;
    const angles = [
      { a: 0, t: 'I' }, { a: 60, t: 'II' }, { a: 120, t: 'III' }, { a: 90, t: 'aVF' },
    ];
    let html = '<circle class="ax-ring" cx="50" cy="50" r="34"/>';
    for (const { a, t } of angles) {
      const rad = (a * Math.PI) / 180;
      const x = cx + Math.cos(rad) * r, y = cy + Math.sin(rad) * r;
      const x2 = cx - Math.cos(rad) * r * 0.28, y2 = cy - Math.sin(rad) * r * 0.28;
      html += `<line class="ax-line" x1="${x2}" y1="${y2}" x2="${x}" y2="${y}"/>`;
      html += `<text class="ax-text" x="${cx + Math.cos(rad) * (r + 7)}" y="${cy + Math.sin(rad) * (r + 7) + 2.5}" text-anchor="middle">${t}</text>`;
    }
    html += '<line class="ax-arrow" id="ax-arrow" x1="50" y1="50" x2="50" y2="16" opacity="0"/>';
    html += '<circle cx="50" cy="50" r="1.6" fill="rgba(233,192,126,.8)"/>';
    g.innerHTML = html;
    this.arrow = this.$('ax-arrow');
  }

  buildRailSegments() {
    const st = this.app.engine.stateAt();
    if (!st) return;
    const segs = this.app.engine.railSegments();
    const sig = this.app.engine.rhythm.id + ':' + Math.round(st.rr * 1000) + ':' + Math.round(st.qt * 1000) + ':' + (st.beat.p ? 1 : 0);
    if (sig === this.railSig) return;
    this.railSig = sig;
    const track = this.el.track;
    track.innerHTML = segs.map((s) => {
      const left = s.from * 100, width = Math.max(0.4, (s.to - s.from) * 100);
      return `<span class="seg ${s.wide ? 'wide' : ''}" data-k="${s.key}" style="left:${left}%;width:${width}%"></span>
              <span class="seg-label" data-k="${s.key}" style="left:${left + width / 2}%">${s.label}</span>`;
    }).join('');
  }

  buildHoverTag() {
    const d = document.createElement('div');
    d.id = 'hover-tag';
    document.getElementById('app').appendChild(d);
    this.hoverTag = d;
  }

  wireBand() {
    this.$('hr-up').addEventListener('click', () => this.app.nudgeHR(6));
    this.$('hr-down').addEventListener('click', () => this.app.nudgeHR(-6));
    const tg = this.$('toggle-thing');
    tg.addEventListener('click', () => {
      const on = tg.getAttribute('aria-pressed') !== 'true';
      tg.setAttribute('aria-pressed', String(on));
      this.app.setGhost(on);
    });
    const tl = this.$('toggle-labels');
    tl.addEventListener('click', () => {
      const on = tl.getAttribute('aria-pressed') !== 'true';
      tl.setAttribute('aria-pressed', String(on));
      this.labelsOn = on;
    });
    const ts = this.$('toggle-sound');
    ts.addEventListener('click', () => {
      const on = ts.getAttribute('aria-pressed') !== 'true';
      ts.setAttribute('aria-pressed', String(on));
      this.app.setSound(on);
    });
  }

  /* ---------------- labels ---------------- */
  ensureLabels() {
    if (this._labels) return;
    this._labels = {};
    for (const id of LABEL_IDS) {
      const s = STRUCTURES[id];
      if (!s) continue;
      const el = document.createElement('div');
      el.className = 'lbl';
      el.innerHTML = `<span class="ln"></span><span class="lb-t">${s.name}</span>`;
      this.el.labels.appendChild(el);
      this._labels[id] = el;
    }
  }

  updateLabels() {
    this.ensureLabels();
    const { camera } = this.app.stage;
    const show = this.labelsOn || this.mode === 'structura';
    const v = new THREE.Vector3();
    const w = this.el.labels.clientWidth, h = this.el.labels.clientHeight;
    for (const [id, el] of Object.entries(this._labels)) {
      const st = this.app.anatomy.get(id);
      if (!st || !st.visible || !show) { el.style.opacity = '0'; continue; }
      v.copy(st.labelAnchor).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { el.style.opacity = '0'; continue; }
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      const dim = this.app.anatomy.selected && this.app.anatomy.selected !== id && this.app.anatomy.isolate;
      el.style.opacity = dim ? '0.16' : '0.9';
      el.classList.toggle('sel', this.app.anatomy.selected === id);
      el.classList.toggle('hot', this.app.anatomy.hovered === id);
    }
  }

  /* ---------------- per-frame ---------------- */
  update() {
    const eng = this.app.engine;
    const st = eng.stateAt();
    if (!st) return;
    this.el.head.style.left = `${st.progress * 100}%`;
    this.el.phase.textContent = st.phase;
    this.el.rail.setAttribute('aria-valuenow', Math.round(st.progress * 100));
    this.buildRailSegments();
    const segs = this.el.track.querySelectorAll('.seg-label');
    segs.forEach((s) => s.classList.toggle('on', s.dataset.k === st.phaseKey || (st.phaseKey === 'ejection' && s.dataset.k === 'ejection')));

    if (this.app.actSummary) {
      const q = this.app.actSummary;
      this.el.vQrs.textContent = q.qrs > 0 ? Math.round(q.qrs * 1000) : '—';
    }
    this.el.vHr.textContent = Math.round(st.hr);
    this.el.vQt.textContent = Math.round(st.qt * 1000);
    this.el.vSv.textContent = Math.round(st.sv);
    this.el.hr.textContent = Math.round(eng.targetHR);

    // axis dial: bright during the QRS, resting between beats
    const series = this.app.currentSeries;
    if (series) {
      const angle = series.axis;
      const rad = (angle * Math.PI) / 180;
      const x = 50 + Math.cos(rad) * 34, y = 50 - Math.sin(rad) * 34;
      this.arrow.setAttribute('x2', x.toFixed(1));
      this.arrow.setAttribute('y2', y.toFixed(1));
      const inQRS = st.u >= 0 && st.u < st.qt * 0.34;
      this.arrow.setAttribute('opacity', inQRS ? '0.95' : '0.25');
      this.el.axisVal.textContent = `${Math.round(angle)}°`;
    }

    if (this.app.stimReadout) {
      const s = this.app.stimReadout;
      this.el.stim.innerHTML = `
        <div class="sr-block"><span class="sr-v">${Math.round(s.spread * 1000)}<small>ms</small></span><span class="sr-l">activation spread</span></div>
        <div class="sr-block"><span class="sr-v">${Math.round(s.qrs * 1000)}<small>ms</small></span><span class="sr-l">QRS · derived</span></div>
        <div class="sr-block"><span class="sr-v">${Math.round(s.axis)}<small>°</small></span><span class="sr-l">frontal axis</span></div>`;
    }
    this.updateLabels();
  }

  showStimReadout(on) {
    if (!this.el.stim) {
      const d = document.createElement('div');
      d.id = 'stim-readout';
      document.getElementById('app').appendChild(d);
      this.el.stim = d;
    }
    this.el.stim.classList.toggle('on', on);
  }

  toast(msg, ms = 2600) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  showHover(x, y, label) {
    const t = this.hoverTag;
    if (!label) { t.classList.remove('on'); return; }
    t.textContent = label;
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
    t.classList.add('on');
  }

  /* ---------------- imprint ---------------- */
  openImprint() {
    const el = this.el.imprint;
    el.hidden = false;
    el.innerHTML = `
      <div class="imp-inner">
        <button class="imp-close" id="imp-close">Close</button>
        <h2>Imprint</h2>
        <p class="imp-meta">Ahmed R. Elwan — Heart Stimulation · interactive anatomical specimen · 2026</p>

        <h3>What this is</h3>
        <p>A browser-based specimen of the human heart built from segmented clinical anatomy, with a cardiac
        cycle engine, an activation field solved on the mesh, a derived electrocardiogram and a
        valve-gated circulation. It is an educational instrument. It is not a medical device, it does not
        diagnose, and it must not be used for clinical decisions.</p>

        <h3>Anatomy</h3>
        <p>Surface geometry is derived from <b>BodyParts3D 4.0</b> (Database Center for Life Science, Japan),
        licensed CC BY 4.0. Individual structures were merged and welded from the source elements, smoothed
        with a Taubin filter to remove segmentation stair-stepping, truncated at the specimen boundary and
        capped. Chamber walls, valve apparatus, coronary arteries and great vessels are genuinely separate,
        selectable structures — not painted regions of one mesh.</p>
        <p>The source is a single adult male reference body reconstructed from cadaver cryosection data.
        It contains no patient anatomy, no lumen contrast, and no coronary venous detail beyond the
        coronary sinus. Vessel calibre is that of the reference body.</p>

        <h3>Scientific model</h3>
        <p>Activation is solved as a geodesic front on each mesh (a discrete eikonal equation, |∇T| = 1/v),
        with v = 0.7 m/s for ectopic myocardial conduction and an effective velocity calibrated to a
        normal QRS for conducted beats. The QRS is then obtained by summing a current dipole over every
        depolarising vertex and projecting it onto the frontal lead axis. P and T waves, valve timing,
        volumes and pressures are modelled from the same beat descriptors.</p>
        <p>What is <b>not</b> modelled: fibre orientation, transmural propagation, repolarisation
        gradients, the His–Purkinje geometry, the thorax as a volume conductor, baroreflex control, or
        fluid dynamics. Flow particles follow reconstructed centrelines — a visualisation of sequence and
        direction, not a CFD solution. The ECG is derived, not recorded, and is not calibrated in
        millivolts.</p>

        <h3>Interaction</h3>
        <p><b>Structura</b> — select any structure; the camera frames it and the panel opens.
        <b>Cyclus</b> — scrub the cycle; every system holds the same instant.
        <b>Rhythmus</b> — change the rhythm state; timing, motion, flow and ECG follow.
        <b>Stimulatio</b> — place a pacing electrode anywhere on ventricular myocardium; the activation
        field is re-solved from that point and the ECG complex widens as conduction slows.
        <b>Iter</b> — follow one erythrocyte through the circuit.</p>

        <h3>Typography</h3>
        <p>Newsreader, Instrument Sans and IBM Plex Mono, all under the SIL Open Font License, self-hosted.</p>

        <h3>Software</h3>
        <p>Three.js (MIT), Vite (MIT). No tracking, no analytics, no network calls after load.</p>

        <h3>References</h3>
        <ul>
          <li>Standring S. <i>Gray's Anatomy</i>, 42nd ed. Elsevier, 2020.</li>
          <li>Hall J.E. <i>Guyton and Hall Textbook of Medical Physiology</i>, 14th ed. Elsevier, 2020.</li>
          <li>Libby P. et al. <i>Braunwald's Heart Disease</i>, 12th ed. Elsevier, 2022.</li>
          <li>Mitsuhashi N. et al. BodyParts3D: 3D structure database for anatomical concepts.
          <i>Nucleic Acids Research</i> 37(suppl_1):D782–D785, 2009.</li>
          <li>Murgatroyd F. et al. <i>Handbook of Cardiac Electrophysiology</i>, 2nd ed. REMEDICA, 2002.</li>
        </ul>
        <p class="imp-meta">Geometry: BodyParts3D © Database Center for Life Science, CC BY 4.0 —
        modified (merged, smoothed, truncated, re-meshed for the web).</p>
      </div>`;
    document.getElementById('imp-close').addEventListener('click', () => { el.hidden = true; });
  }
}
