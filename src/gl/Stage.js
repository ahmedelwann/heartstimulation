import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Stage — renderer, camera, controls, quality tiers.
 * The scene is built around a single specimen at the origin; there is no
 * environment map, no post-processing chain. Light is modelled analytically so
 * the look is identical across GPUs and cheap on integrated hardware.
 */
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.dprCap = Math.min(window.devicePixelRatio || 1, 2);
    this.quality = this.pickQuality();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: new URLSearchParams(location.search).has('capture'),
    });
    this.renderer.setPixelRatio(Math.min(this.dprCap, this.quality === 'high' ? 2 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor(0x08090a, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x08090a, 0.055);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.02, 40);
    this.camera.position.set(1.35, 0.42, 2.15);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.7;
    this.controls.panSpeed = 0.55;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 4.6;
    this.controls.target.set(0, 0, 0);
    this.controls.enablePan = true;
    this.controls.zoomToCursor = false;
    this.controls.screenSpacePanning = true;

    this.clock = new THREE.Clock();
    this.updaters = [];
    this.frameCount = 0;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsN = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 240));

    this.renderer.setAnimationLoop(() => this.tick());
  }

  pickQuality() {
    const mem = navigator.deviceMemory || 8;
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    if (mobile && (small || mem <= 4)) return 'low';
    if (mobile) return 'medium';
    return 'high';
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    // Keep the specimen in frame on tall, narrow viewports.
    this.camera.fov = h > w ? 40 : 32;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  add(updater) { this.updaters.push(updater); }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.frameCount++;
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc > 0.6) { this.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }
    this.controls.update();
    for (const u of this.updaters) u(elapsed, dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** Frame a sphere {center, radius} with a restrained, non-cinematic move. */
  frame(center, radius, opts = {}) {
    const dir = opts.direction
      ? new THREE.Vector3(...opts.direction).normalize()
      : this.camera.position.clone().sub(this.controls.target).normalize();
    const fitH = radius / Math.sin((this.camera.fov * Math.PI) / 360);
    const fitW = radius / Math.sin(((this.camera.fov * this.camera.aspect) * Math.PI) / 360);
    const dist = Math.max(fitH, fitW) * (opts.padding ?? 1.9);
    const target = new THREE.Vector3(...center);
    const pos = target.clone().add(dir.multiplyScalar(Math.min(dist, this.controls.maxDistance * 0.96)));
    this.animateCamera(pos, target, opts.duration ?? 1050);
  }

  animateCamera(position, target, duration = 1000) {
    this.cameraTween?.cancel();
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    const p1 = position.clone();
    const t1 = target.clone();
    const start = performance.now();
    let raf = 0;
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / duration);
      const e = ease(k);
      this.camera.position.lerpVectors(p0, p1, e);
      this.controls.target.lerpVectors(t0, t1, e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    this.cameraTween = { cancel: () => cancelAnimationFrame(raf) };
  }
}
