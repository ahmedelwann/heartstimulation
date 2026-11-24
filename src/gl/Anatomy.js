import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeTissueMaterial, TISSUE_PALETTE } from './tissue.js';

const GROUP_OF = {
  ra: 'atria', rv: 'chambers', la: 'atria', lv: 'chambers',
  aorta: 'vessels', pulmonary_trunk: 'vessels', rpa: 'vessels', lpa: 'vessels',
  svc: 'vessels', ivc: 'vessels',
  pv_rspv: 'vessels', pv_ripv: 'vessels', pv_lspv: 'vessels', pv_lipv: 'vessels',
  tv: 'valves', mv: 'valves', av: 'valves', pvv: 'valves',
  cav_ra: 'cavities', cav_rv: 'cavities', cav_la: 'cavities', cav_lv: 'cavities',
  lca: 'coronary', rca: 'coronary', coronary_sinus: 'coronary',
  fibrous_skeleton: 'conduction',
  epicardium: 'shell',
  lmca: 'coronary', lad: 'coronary', diagonal: 'coronary', lcx: 'coronary',
  rca: 'coronary', rca_marginal: 'coronary', pda: 'coronary', posterolateral: 'coronary',
  great_cardiac_vein: 'veins', middle_cardiac_vein: 'veins', small_cardiac_vein: 'veins',
  pm_rv_ant: 'internal', pm_rv_post: 'internal', pm_rv_septal: 'internal', pm_lv: 'internal',
};

// Chamber-specific contractile amplitude (model units; heart height = 1.0).
const AMP = { lv: 0.048, rv: 0.038, la: 0.013, ra: 0.013, cav_lv: 0.046, cav_rv: 0.036, cav_la: 0.012, cav_ra: 0.012, pm_lv: 0.040, pm_rv_ant: 0.030, pm_rv_post: 0.030, pm_rv_septal: 0.030 };

export class Anatomy {
  constructor(stage) {
    this.stage = stage;
    this.root = new THREE.Group();
    this.root.name = 'specimen';
    stage.scene.add(this.root);
    this.structures = new Map();
    this.pickables = [];
    this.selected = null;
    this.hovered = null;
    this.ghost = false;
    this.isolate = null;
    this.bounds = new THREE.Box3();
  }

  async load(onProgress) {
    const loader = new GLTFLoader();
    const [gltf, meta] = await Promise.all([
      new Promise((res, rej) => loader.load('/assets/anatomy.glb', res, (e) => {
        if (e.total) onProgress?.(e.loaded / e.total);
      }, rej)),
      fetch('/assets/anatomy.json').then((r) => r.json()),
    ]);
    this.meta = meta;
    this.metaById = new Map(meta.structures.map((s) => [s.id, s]));

    const cavityCenters = {};
    for (const s of meta.structures) {
      if (s.id.startsWith('cav_')) cavityCenters[s.id.slice(4)] = new THREE.Vector3(...s.center);
    }

    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const id = obj.name;
      const gm = this.metaById.get(id) || { center: [0, 0, 0], radius: 0.2, maxR: 1 };
      const group = GROUP_OF[id] || 'vessels';
      const geo = obj.geometry;
      geo.computeVertexNormals();

      const pos = geo.attributes.position;
      const n = pos.count;
      const act = new Float32Array(n);
      const endo = new Float32Array(n);

      const c = new THREE.Vector3(...gm.center);
      const cavKey = id.replace(/^cav_/, '');
      const ref = cavityCenters[cavKey] || c;
      const p = new THREE.Vector3();
      const nv = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        p.fromBufferAttribute(pos, i);
        nv.fromBufferAttribute(geo.attributes.normal, i);
        if (id.startsWith('cav_')) { endo[i] = 1; continue; }
        const outward = p.clone().sub(ref);
        if (outward.lengthSq() < 1e-8) { endo[i] = 0; continue; }
        endo[i] = nv.dot(outward.normalize()) < 0 ? 1 : 0;
      }
      geo.setAttribute('aAct', new THREE.BufferAttribute(act, 1));
      geo.setAttribute('aEndo', new THREE.BufferAttribute(endo, 1));

      // vertical span for long-axis shortening
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const isVentricle = id === 'lv' || id === 'rv' || id === 'cav_lv' || id === 'cav_rv';
      const pal = TISSUE_PALETTE[group] || TISSUE_PALETTE.chambers;
      const mat = makeTissueMaterial({
        ...pal,
        region: group === 'vessels' && false ? 2 : pal.region,
        ampV: AMP[id] ?? (isVentricle ? 0.012 : 0),
        ampA: group === 'atria' || id.startsWith('cav_ra') || id.startsWith('cav_la') ? 0.013 : 0,
        baseY: bb.max.y,
        spanY: Math.max(0.02, bb.max.y - bb.min.y),
        twist: id === 'lv' ? 0.055 : id === 'rv' ? 0.03 : 0,
        rough: pal.rough,
        spec: pal.spec,
        dissolveR: 0,
      });
      // atrial vs ventricular clock selection
      const isInternal = group === 'internal';
      mat.uniforms.uRegion.value = group === 'atria' || id.startsWith('cav_ra') || id.startsWith('cav_la') ? 0
        : (isVentricle || isInternal || id.startsWith('cav_') ? 1 : (group === 'valves' ? 3 : 4));

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = id;
      mesh.renderOrder = group === 'cavities' ? 2 : 0;
      mesh.frustumCulled = true;
      this.root.add(mesh);

      const st = {
        id, group, mesh, mat, meta: gm,
        center: c,
        radius: gm.radius,
        visible: true,
        labelAnchor: new THREE.Vector3(),
      };
      this.structures.set(id, st);
      if (group !== 'cavities') this.pickables.push(mesh);
      if (group === 'cavities' || group === 'valves' || group === 'internal' || id === 'fibrous_skeleton' || group === 'veins') this.setVisible(id, false);
    });

    // Structures that ride on the moving ventricular wall (coronaries, cardiac
    // veins, papillary muscles) borrow the activation time of their nearest
    // myocardial vertex, so they travel with the muscle instead of being left
    // behind by systole.
    {
      const riders = {
        lmca: 0.026, lad: 0.024, diagonal: 0.022, lcx: 0.024, rca: 0.026,
        rca_marginal: 0.022, pda: 0.022, posterolateral: 0.022, coronary_sinus: 0.020,
        great_cardiac_vein: 0.020, middle_cardiac_vein: 0.020, small_cardiac_vein: 0.018,
        pm_rv_ant: 0.036, pm_rv_post: 0.034, pm_rv_septal: 0.032, pm_lv: 0.042,
      };
      const cell = 0.03;
      const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
      const grid = new Map();
      for (const id of ['lv', 'rv']) {
        const st = this.structures.get(id);
        if (!st) continue;
        const arr = st.mesh.geometry.attributes.position.array;
        for (let i = 0; i < arr.length / 3; i++) {
          const k = key(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
          let a2 = grid.get(k);
          if (!a2) { a2 = []; grid.set(k, a2); }
          a2.push(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2], id === 'rv' ? 1 : 0, i);
        }
      }
      for (const [id, amp] of Object.entries(riders)) {
        const st = this.structures.get(id);
        if (!st) continue;
        const pos = st.mesh.geometry.attributes.position;
        const src = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          let bd = Infinity, bidx = -1, brv = 0;
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
            const a2 = grid.get(key(x + dx * cell, y + dy * cell, z + dz * cell));
            if (!a2) continue;
            for (let k = 0; k < a2.length; k += 5) {
              const d = (a2[k] - x) ** 2 + (a2[k + 1] - y) ** 2 + (a2[k + 2] - z) ** 2;
              if (d < bd) { bd = d; bidx = a2[k + 4]; brv = a2[k + 3]; }
            }
          }
          src[i] = bidx < 0 ? -1 : bidx + brv * 1e6;
        }
        st.aSrc = src;
        st.mat.uniforms.uRegion.value = 1;
        st.mat.uniforms.uAmpV.value = amp;
        st.mesh.geometry.attributes.aEndo.array.fill(0);
      }
    }

    this.bounds.setFromObject(this.root);
    // The label field should frame the heart, not the vessel stumps.
    this.coreBounds = new THREE.Box3().setFromPoints(
      ['ra', 'rv', 'la', 'lv', 'aorta', 'pulmonary_trunk'].flatMap((id) => {
        const m = this.structures.get(id);
        return m ? [m.center.clone().setY(m.center.y - 0.1), m.center.clone().setY(m.center.y + 0.1)] : [];
      }),
    );

    this.setGhost(false);
    this.updateLabels(0);
    return this;
  }

  get(id) { return this.structures.get(id); }

  setPhase(vt, at) {
    for (const s of this.structures.values()) {
      s.mat.uniforms.uVT.value = vt;
      s.mat.uniforms.uAT.value = at;
    }
  }

  setActivation(map) {
    for (const id of ['lca', 'rca', 'coronary_sinus', 'lmca', 'lad', 'diagonal', 'lcx', 'rca_marginal', 'pda', 'posterolateral']) {
      const st = this.structures.get(id);
      if (!st || !st.aSrc) continue;
      const attr = st.mesh.geometry.attributes.aAct;
      for (let i = 0; i < st.aSrc.length; i++) {
        const v = st.aSrc[i];
        if (v < 0) { attr.array[i] = 0; continue; }
        const isRv = v >= 1e6;
        const arr = map[isRv ? 'rv' : 'lv'];
        attr.array[i] = arr ? (arr[isRv ? v - 1e6 : v] || 0) : 0;
      }
      attr.needsUpdate = true;
    }
    for (const [id, times] of Object.entries(map)) {
      const s = this.structures.get(id);
      if (!s || !times) continue;
      const attr = s.mesh.geometry.attributes.aAct;
      if (attr.count !== times.length) continue;
      attr.array.set(times);
      attr.needsUpdate = true;
    }
  }

  setHeadlamp(k) {
    for (const s of this.structures.values()) s.mat.uniforms.uHead.value = k;
  }

  setReveal(y) {
    for (const s of this.structures.values()) s.mat.uniforms.uRevealY.value = y;
  }

  setGhost(on) {
    this.ghost = on;
    this.applySurfaceState();
  }

  /** Flow can only be seen through the vessel wall, so switching it on makes
   *  the great vessels translucent rather than leaving the particles occluded. */
  setFlowReveal(on) {
    this.flowReveal = on;
    this.applySurfaceState();
  }

  applySurfaceState() {
    for (const s of this.structures.values()) {
      const isMuscle = s.group === 'chambers' || s.group === 'atria';
      const isVessel = s.group === 'vessels' || s.group === 'coronary';
      let g = 0;
      if (this.ghost && isMuscle) g = 0.86;
      else if (this.ghost && isVessel) g = 0.5;
      else if (this.flowReveal && isVessel) g = 0.6;
      s.mat.uniforms.uGhost.value = g;
      const alpha = g > 0.001 ? (isMuscle ? 0.15 : 0.32) : 1;
      s.mat.uniforms.uAlpha.value = alpha;
      const opaque = alpha > 0.99;
      if (s.mat.transparent === opaque) { s.mat.transparent = !opaque; s.mat.needsUpdate = true; }
      s.mat.depthWrite = opaque;
      s.mat.side = THREE.DoubleSide;   // interior viewing needs the far wall
      s.mesh.renderOrder = opaque ? 0 : 6;
      s.mat.uniforms.uFade.value = 1;
    }
    this.applyFocus();
  }

  setVesselVisibility(on) {
    for (const s of this.structures.values()) {
      const isVessel = s.group === 'vessels' || s.group === 'coronary';
      if (isVessel) this.setVisible(s.id, on);
    }
  }

  setInternalVisibility(on) {
    for (const s of this.structures.values()) {
      if (s.group === 'cavities' || s.group === 'valves' || s.group === 'internal' || s.id === 'fibrous_skeleton') {
        this.setVisible(s.id, on);
      }
    }
    // inside the heart the internal apparatus must be fully solid even though
    // the myocardium around it is translucent
    for (const s of this.structures.values()) {
      if (s.group !== 'cavities' && s.group !== 'valves' && s.group !== 'internal' && s.id !== 'fibrous_skeleton') continue;
      s.mat.uniforms.uGhost.value = 0;
      s.mat.uniforms.uAlpha.value = 1;
      s.mat.depthWrite = true;
      s.mesh.renderOrder = 0;
    }
  }

  setCavityVisibility(on) {
    for (const s of this.structures.values()) {
      if (s.group === 'cavities') this.setVisible(s.id, on);
    }
  }

  setVisible(id, on) {
    const s = this.structures.get(id);
    if (!s) return;
    s.visible = on;
    s.mesh.visible = on;
    const i = this.pickables.indexOf(s.mesh);
    if (on && i === -1 && s.group !== 'cavities') this.pickables.push(s.mesh);
    if (!on && i >= 0) this.pickables.splice(i, 1);
  }

  select(id) {
    this.selected = id;
    for (const s of this.structures.values()) s.mat.uniforms.uSelect.value = s.id === id ? 1 : 0;
    this.applyFocus();
  }

  hover(id) {
    if (this.hovered === id) return;
    this.hovered = id;
    for (const s of this.structures.values()) s.mat.uniforms.uHover.value = s.id === id ? 1 : 0;
  }

  applyFocus() {
    const iso = this.isolate;
    for (const s of this.structures.values()) {
      const dim = iso && s.id !== iso && !(iso === 'cav_lv' && s.id === 'lv') ? 1 : 0;
      s.mat.uniforms.uFocus.value = dim;
      if (dim) s.mat.uniforms.uFade.value = 0.34;
      else if (!this.ghost) s.mat.uniforms.uFade.value = 1;
    }
  }

  isolateStructure(id) {
    this.isolate = id;
    if (!id) { this.applyFocus(); return; }
    this.applyFocus();
  }

  /** Anchor points for the floating label field. */
  updateLabels(camera) {
    const camPos = camera?.position;
    for (const s of this.structures.values()) {
      const dir = camPos ? camPos.clone().sub(s.center).normalize() : new THREE.Vector3(0, 0, 1);
      const ext = Math.min(s.radius * 0.55, 0.22);
      s.labelAnchor.copy(s.center).addScaledVector(dir, ext);
    }
  }

  setQuality(q) {
    for (const s of this.structures.values()) {
      s.mesh.castShadow = false;
      s.mat.uniforms.uSpec.value = q === 'low' ? 0.25 : s.mat.uniforms.uSpec.value;
    }
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
  }
}
