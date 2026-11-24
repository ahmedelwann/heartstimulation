import { RHYTHMS } from '../data/content.js';

/**
 * HeartEngine
 * ---------------------------------------------------------------------------
 * A single clock that every other system reads from.
 *
 * The engine schedules ventricular and atrial depolarisations, derives the
 * mechanical phases of each beat from their timing, and exposes valve states,
 * volumes and pressures. The 3D deformation, the flow gates, the ECG and the
 * on-screen numbers are all functions of this one state — there is no second
 * animation timeline to drift out of sync.
 *
 * WHAT IS MODELLED: cycle timing, AV sequencing, rate-dependent filling,
 * irregular RR intervals, conduction block patterns, ectopic activation,
 * valve open/closed state, LV volume and stroke volume.
 * WHAT IS NOT: pressure–volume loops solved from elastance, myocardial
 * mechanics, baroreflex or autonomic control. Pressures are illustrative.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class HeartEngine {
  constructor() {
    this.rhythm = RHYTHMS[0];
    this.targetHR = 62;
    this.hr = 62;
    this.now = 0;
    this.paused = false;
    this.speed = 1;
    this.beats = [];
    this.atrialBeats = [];
    this.genUntil = 0;
    this.ectopicCount = 0;
    this.wenckN = 0;
    this.rngSeed = 20260214;
    this.pacing = null;              // {site, qrsMs} when pacing
    this.activationQRS = 0.088;      // seconds, from the activation field
    this.onBeat = null;
    this.lastBeatFired = -1;
  }

  rand() {
    // deterministic LCG: the same rhythm replays identically
    this.rngSeed = (this.rngSeed * 1664525 + 1013904223) % 4294967296;
    return this.rngSeed / 4294967296;
  }

  setRhythm(id) {
    const r = RHYTHMS.find((x) => x.id === id) || RHYTHMS[0];
    this.rhythm = r;
    this.targetHR = r.hr;
    this.hr = r.hr;
    this.reset();
  }

  setHR(hr) {
    this.targetHR = clamp(hr, 30, 200);
    if (this.rhythm.id !== 'pvc' && this.rhythm.id !== 'vt') this.rhythm = { ...this.rhythm, hr: this.targetHR };
    this.reset(true);
  }

  reset(keepTime = false) {
    const t = keepTime ? this.now : this.now;
    this.beats = [];
    this.atrialBeats = [];
    this.genUntil = t - 0.5;
    this.wenckN = 0;
    this.ectopicCount = 0;
    this.lastBeatFired = -1;
    this.schedule(t + 4);
  }

  setPacing(site, qrsSeconds) {
    this.pacing = site ? { site, qrs: qrsSeconds } : null;
  }

  get rrTarget() { return 60 / Math.max(20, this.hr); }

  schedule(until) {
    const r = this.rhythm;
    while (this.genUntil < until) {
      const prev = this.beats[this.beats.length - 1];
      const base = prev ? prev.qrs + prev.rr : this.genUntil;
      let rr = this.rrTarget;
      let pr = (r.pr ?? 160) / 1000;
      let p = true;
      let morph = 'narrow';
      let dropped = false;

      if (r.id === 'af') {
        rr = 0.52 + this.rand() * 0.72;
        p = false;
      } else if (r.id === 'flutter') {
        rr = (60 / this.hr);
        p = false;
        pr = 0;
      } else if (r.id === 'avb3' || r.id === 'vt') {
        rr = 60 / (r.id === 'vt' ? this.targetHR : this.hr);
        p = false;
        pr = 0;
      } else if (r.wenckebach) {
        const seq = [0.19, 0.29, 0.40, null];
        const prv = seq[this.wenckN % 4];
        this.wenckN++;
        if (prv === null) { dropped = true; pr = 0; p = true; }
        else pr = prv;
        rr = 1.02;
      } else if (r.ectopicEvery) {
        this.ectopicCount++;
        if (this.ectopicCount % r.ectopicEvery === 0) {
          morph = 'wide';
          rr = 0.52;
          p = false;
          pr = 0;
        } else {
          rr = this.rrTarget * (1 + (this.rand() - 0.5) * 0.035);
        }
      } else if (r.id === 'vt') {
        morph = 'wide';
      } else {
        // sinus arrhythmia: ±2.5%, phase-locked to breathing
        rr = this.rrTarget * (1 + Math.sin((base / 4.2) * Math.PI * 2) * 0.025);
      }

      if (this.pacing && r.id !== 'vt') {
        morph = 'wide';
        p = false;
        pr = 0;
      }

      const qt = clamp(0.40 * Math.sqrt(rr), 0.20, 0.46);
      const qrsDur = morph === 'wide'
        ? clamp(this.activationQRS || 0.15, 0.11, 0.22)
        : clamp(this.activationQRS || 0.088, 0.055, 0.11);

      const beat = {
        qrs: base + (dropped ? rr : 0),
        rr, pr, p, qt, qrsDur, morph,
        atrialOnset: base + (dropped ? rr : 0) - pr,
        dropped,
        index: this.beats.length,
      };
      // A dropped beat produces no QRS: the next scheduled time is base + rr
      // and we simply don't emit a ventricular complex for it.
      if (dropped) {
        this.atrialBeats.push({ p: base - pr, rr });
      }
      this.beats.push(beat);
      this.genUntil = base + rr + 0.0001;
      if (this.beats.length > 64) this.beats.splice(0, 24);
      if (this.genUntil > until + 6) break;
    }
  }

  update(dt) {
    if (!this.paused) this.now += dt * this.speed;
    // rate smoothing: the number moves before the rhythm does
    if (Math.abs(this.hr - this.targetHR) > 0.05) {
      this.hr += (this.targetHR - this.hr) * Math.min(1, dt * 1.4);
    }
    this.schedule(this.now + 3);
    const b = this.beatAt(this.now);
    if (b && b.index !== this.lastBeatFired) {
      this.lastBeatFired = b.index;
      this.onBeat?.(b);
    }
  }

  beatAt(t) {
    let lo = 0, hi = this.beats.length - 1, ans = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.beats[mid].qrs <= t) { ans = this.beats[mid]; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  beatAfter(t) {
    for (const b of this.beats) if (b.qrs > t) return b;
    return null;
  }

  /** Full mechanical state at engine time t. */
  stateAt(t = this.now) {
    const b = this.beatAt(t);
    const next = this.beatAfter(t);
    if (!b) return null;
    const u = t - b.qrs;
    const ejec = Math.min(0.30, b.qt * 0.62);
    const ivc = 0.045;
    const qt = b.qt;

    let phase = 'Diastole';
    let phaseKey = 'diastole';
    if (u < ivc) { phase = 'Isovolumetric contraction'; phaseKey = 'ivc'; }
    else if (u < ivc + ejec) { phase = u < ivc + ejec * 0.45 ? 'Rapid ejection' : 'Reduced ejection'; phaseKey = 'ejection'; }
    else if (u < qt) { phase = 'Isovolumetric relaxation'; phaseKey = 'ivr'; }
    else if (b.p && u > b.rr - b.pr && u < b.rr) { phase = 'Atrial systole'; phaseKey = 'atrial'; }
    else if (u < qt + 0.11) { phase = 'Rapid filling'; phaseKey = 'filling'; }
    else { phase = 'Diastasis'; phaseKey = 'diastasis'; }

    // valve state
    const mvOpen = u > qt || u < -0.001;
    const avOpen = u > ivc && u < ivc + ejec;
    const tvOpen = mvOpen;
    const pvOpen = avOpen;

    // volumes (illustrative, rate-dependent)
    const fillFactor = clamp((b.rr - 0.26) / 0.56, 0.42, 1.06);
    const edv = 112 * fillFactor + (b.p ? 9 : 0);
    const eff = 0.6 * (1 - 0.12 * (1 - fillFactor)) * (b.morph === 'wide' ? 0.86 : 1);
    const esv = edv * (1 - eff);
    let vol = edv;
    if (u >= ivc && u < ivc + ejec) {
      const k = (u - ivc) / ejec;
      vol = edv - (edv - esv) * (0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, k)));
    } else if (u >= ivc + ejec) {
      vol = esv;
      if (u > qt) {
        const f = clamp((u - qt) / Math.max(0.06, b.rr - b.pr - qt), 0, 1);
        vol = esv + (edv - esv) * Math.pow(f, 0.55);
      }
    }
    const sv = edv - esv;
    const hrNow = 60 / b.rr;

    return {
      beat: b, next, u, phase, phaseKey,
      tvOpen, mvOpen, pvOpen, avOpen,
      ejec, ivc, qt,
      edv, esv, sv, lvVol: vol, ef: eff,
      hr: hrNow,
      co: (sv * hrNow) / 1000,
      sbp: Math.round(88 + sv * 0.44),
      dbp: Math.round(62 + (sv - 60) * 0.10),
      raPressure: Math.round(3 + (60 / b.rr) * 0.4),
      paPressure: 25,
      progress: clamp(u / b.rr, 0, 1),
      rr: b.rr,
    };
  }

  /** Phase segments for the cycle rail, as fractions of the current RR. */
  railSegments() {
    const st = this.stateAt();
    if (!st) return [];
    const rr = st.rr, b = st.beat;
    const ejecEnd = st.ivc + st.ejec;
    const segs = [
      { key: 'atrial', label: 'Atrial systole', from: b.p ? 1 - b.pr : 0.86, to: 1, wide: true },
      { key: 'ivc', label: 'IVC', from: 0, to: st.ivc / rr },
      { key: 'ejection', label: 'Ejection', from: st.ivc / rr, to: ejecEnd / rr, wide: true },
      { key: 'ivr', label: 'IVR', from: ejecEnd / rr, to: st.qt / rr },
      { key: 'filling', label: 'Filling', from: st.qt / rr, to: Math.min(0.99, (st.qt + 0.12) / rr), wide: true },
      { key: 'diastasis', label: 'Diastasis', from: Math.min(0.99, (st.qt + 0.12) / rr), to: b.p ? 1 - b.pr : 0.995 },
    ];
    return segs.filter((s) => s.to - s.from > 0.004);
  }

  /** Map a rail fraction to engine time (current beat). */
  timeAtFraction(f) {
    const b = this.beatAt(this.now);
    if (!b) return this.now;
    return b.qrs + clamp(f, 0, 0.999) * b.rr;
  }

  scrub(f) {
    const b = this.beatAt(this.now);
    if (!b) return;
    // stay inside the current beat: the ECG buffer is rebuilt on every scrub,
    // so moving backwards within a beat is safe and expected
    this.now = b.qrs + clamp(f, 0, 0.999) * b.rr;
    this.lastBeatFired = b.index;
  }
}
