/**
 * Derived electrocardiogram.
 *
 * The QRS is not drawn: it is the projection of the depolarisation dipole
 * computed from the activation field, sampled at 500 Hz. P and T are generated
 * analytically so that their timing follows the same beat descriptors the
 * muscle follows.
 *
 * This is a teaching instrument, not an ECG machine: no lead placement,
 * no thorax model, no noise model, no calibration in millivolts.
 */

const RATE = 500;
const WINDOW = 5.6;

export class Ecg {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.buf = new Float32Array(Math.ceil(WINDOW * RATE));
    this.lastT = null;
    this.series = { narrow: null, wide: null };
    this.gain = 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
  }

  resize() {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(rect.width * this.dpr));
    c.height = Math.max(1, Math.round(rect.height * this.dpr));
  }

  setSeries(narrow, wide) {
    this.series.narrow = narrow;
    this.series.wide = wide;
  }

  reset() {
    this.buf.fill(0);
    this.lastT = null;
  }

  seriesFor(beat) {
    const s = beat.morph === 'wide' ? this.series.wide : this.series.narrow;
    return s;
  }

  /** Sum of all waves contributing at absolute time t. */
  sampleAt(t) {
    const eng = this.engine;
    const b = eng.beatAt(t);
    if (!b) return 0;
    let v = 0;
    const r = eng.rhythm;

    // QRS from the activation dipole
    if (t >= b.qrs) {
      const u = t - b.qrs;
      const series = this.seriesFor(b);
      if (series && u < series.duration) {
        const i = Math.floor(u * series.sampleRate);
        v += (series.samples[i] ?? 0) * 1.0;
      }
    }

    // P wave (conducted beats)
    if (b.p && b.pr > 0) {
      const d = t - (b.qrs - b.pr);
      v += 0.15 * Math.exp(-(d * d) / (2 * 0.026 * 0.026));
    }

    // T wave: concordant with the QRS, repolarisation is a slower event
    {
      const series = this.seriesFor(b);
      const amp = series ? 0.30 * Math.sign(series.amplitude || 1) : 0.3;
      const d = t - (b.qrs + b.qt - 0.145);
      v += amp * Math.exp(-(d * d) / (2 * 0.052 * 0.052));
    }

    // Atrial activity that is not a conducted P wave
    if (r.id === 'flutter') {
      const rate = (r.atrialRate || 300) / 60;
      const ph = ((t * rate) % 1 + 1) % 1;
      const saw = 1 - 2 * ph;
      v += 0.125 * (saw - saw * saw * saw * 0.4);
    } else if (r.id === 'af') {
      v += 0.035 * (
        Math.sin(t * 2 * Math.PI * 5.6 + Math.sin(t * 9.1) * 2.4) +
        Math.sin(t * 2 * Math.PI * 7.3 + 1.7) * 0.8 +
        Math.sin(t * 2 * Math.PI * 9.4 + 3.1) * 0.5
      );
    } else if (r.dissociated && r.atrialRate) {
      const atrialRR = 60 / r.atrialRate;
      const d = ((t + 0.32) % atrialRR + atrialRR) % atrialRR;
      v += 0.15 * Math.exp(-((d - 0.06) ** 2) / (2 * 0.026 * 0.026));
    }

    // baseline wander + sensor noise, deliberately small
    v += Math.sin(t * 0.9) * 0.006 + Math.sin(t * 13.7) * 0.0025;
    return v;
  }

  update() {
    const t = this.engine.now;
    if (this.lastT === null || t < this.lastT - 0.001 || t > this.lastT + 1.2) {
      // scrub or first frame: refill the whole window so the trace is whole
      const start = t - WINDOW;
      for (let i = 0; i < this.buf.length; i++) {
        this.buf[i] = this.sampleAt(start + i / RATE);
      }
      this.lastT = t;
      return;
    }
    const n = Math.floor((t - this.lastT) * RATE);
    if (n <= 0) return;
    if (n >= this.buf.length) {
      for (let i = 0; i < this.buf.length; i++) this.buf[i] = this.sampleAt(t - WINDOW + i / RATE);
      this.lastT = t;
      return;
    }
    this.buf.copyWithin(0, n);
    const len = this.buf.length;
    for (let i = 0; i < n; i++) this.buf[len - n + i] = this.sampleAt(this.lastT + (i + 1) / RATE);
    this.lastT += n / RATE;
  }

  draw() {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const pad = 0;
    ctx.clearRect(0, 0, W, H);

    // --- grid: 0.2 s and 0.5 mV, quiet ---
    const secPx = W / WINDOW;
    ctx.lineWidth = Math.max(1, this.dpr * 0.5);
    ctx.strokeStyle = 'rgba(236,231,223,0.045)';
    ctx.beginPath();
    for (let s = 0; s < WINDOW * 5; s++) {
      const x = W - s * secPx * 0.2;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    const rowPx = H / 4;
    for (let y = H; y > 0; y -= rowPx) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(236,231,223,0.09)';
    ctx.beginPath();
    for (let s = 0; s < WINDOW; s++) {
      const x = W - s * secPx;
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    ctx.stroke();

    // --- trace ---
    const mid = H * 0.56;
    const amp = H * 0.30;
    const pts = this.buf.length;
    const drawTrace = (color, width, alpha) => {
      ctx.beginPath();
      for (let i = 0; i < pts; i++) {
        const x = (i / (pts - 1)) * W + pad;
        const y = mid - this.buf[i] * amp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width * this.dpr;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    drawTrace('rgba(233,192,126,0.22)', 3.2, 1);
    drawTrace('rgba(240,203,145,0.96)', 1.35, 1);

    // --- leading edge ---
    const lastV = this.buf[this.buf.length - 1];
    const y = mid - lastV * amp;
    ctx.fillStyle = 'rgba(247,224,186,0.95)';
    ctx.beginPath(); ctx.arc(W - 1.5 * this.dpr, y, 2.1 * this.dpr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(233,192,126,0.18)';
    ctx.lineWidth = 1 * this.dpr;
    ctx.beginPath(); ctx.moveTo(W - 1, 0); ctx.lineTo(W - 1, H); ctx.stroke();
  }
}
