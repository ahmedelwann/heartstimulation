import * as THREE from 'three';

/**
 * Tissue material.
 *
 * One shader, three jobs:
 *  1. render the specimen with a wrapped-diffuse / thin-subsurface model that
 *     reads as wet muscle rather than plastic;
 *  2. deform it from a per-vertex activation time, so contraction is driven by
 *     the same activation map that produces the ECG — not by a sine wave;
 *  3. carry the interface states (hover, selection, focus, ghost, reveal) in the
 *     same material so the anatomy never needs a second copy of itself.
 */

const vert = /* glsl */ `
  attribute float aAct;
  attribute float aEndo;

  uniform float uVT;       // seconds since ventricular activation onset
  uniform float uAT;       // seconds since atrial activation onset
  uniform float uAmpV;     // ventricular inward amplitude
  uniform float uAmpA;     // atrial inward amplitude
  uniform int   uRegion;   // 0 atrium, 1 ventricle, 2 vessel, 3 valve, 4 conduction
  uniform float uBaseY;
  uniform float uSpanY;
  uniform float uTwist;

  varying vec3 vN;
  varying vec3 vW;
  varying float vAct;
  varying float vDt;
  varying float vEndo;

  // Mechanical twitch: tension rises over ~60 ms, peaks near end-systole and
  // relaxes over ~300 ms. The earlier 13 ms rise peaked almost immediately
  // after depolarisation, which put peak contraction in early systole.
  float twitch(float t) {
    if (t < 0.0) return 0.0;
    float rise = 1.0 - exp(-t / 0.055);
    float fall = exp(-max(t - 0.115, 0.0) / 0.115);
    return rise * fall;
  }

  void main() {
    vec3 p = position;
    vec3 n = normal;
    float tAct = (uRegion == 1) ? (uVT - aAct) : (uAT - aAct);
    float tw = twitch(tAct);
    float amp = (uRegion == 1) ? uAmpV : uAmpA;

    // Wall thickening: the endocardial surface travels further inward than the
    // epicardial surface, so the wall thickens instead of the organ shrinking.
    float inner = mix(0.45, 1.0, aEndo);
    float d = -amp * tw * inner;

    // Longitudinal shortening: apex travels toward the AV plane.
    float h = clamp((p.y - (uBaseY - uSpanY)) / max(uSpanY, 0.001), 0.0, 1.0);
    if (uRegion == 1) {
      p.y += (uBaseY - p.y) * 0.135 * tw;
      // subtle systolic twist about the long axis
      float a = uTwist * tw * (1.0 - h);
      float ca = cos(a), sa = sin(a);
      p.xz = mat2(ca, -sa, sa, ca) * p.xz;
    } else if (uRegion == 0) {
      p.y += (uBaseY - p.y) * 0.030 * tw;
    }

    p += n * d;
    vDt = tAct;
    vAct = aAct;
    vEndo = aEndo;
    vN = normalize(normalMatrix * n);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const frag = /* glsl */ `
  precision highp float;

  uniform vec3  uBase;
  uniform vec3  uDeep;
  uniform vec3  uActCol;
  uniform float uRough;
  uniform float uSpec;
  uniform float uSelect;
  uniform float uHover;
  uniform float uFocus;     // 1 = not the selected structure
  uniform float uGhost;     // 0 solid, 1 fully dithered
  uniform float uRevealY;   // intro scan front (world Y)
  uniform float uDissolveR; // specimen boundary (0 disables)
  uniform float uFade;      // per-structure opacity for isolate mode
  uniform int   uRegion;
  uniform float uVT;
  uniform float uAT;
  uniform vec3  uKeyDir;
  uniform vec3  uRimDir;
  uniform float uHead;      // endocardial head-lamp, journey mode only
  uniform float uAlpha;     // global opacity (x-ray mode)

  varying vec3 vN;
  varying vec3 vW;
  varying float vAct;
  varying float vDt;
  varying float vEndo;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    // ---- intro scan: the specimen resolves from apex to base -------------
    if (vW.y > uRevealY) {
      float d = bayer4(gl_FragCoord.xy);
      if (vW.y < uRevealY + 0.05 && d > 0.35) discard;
      else discard;
    }

    // ---- specimen boundary: vessel stumps dissolve, never cut ------------
    float r = length(vW);
    if (uDissolveR > 0.0) {
      float edge = smoothstep(uDissolveR * 0.82, uDissolveR, r);
      if (bayer4(gl_FragCoord.xy) < edge) discard;
    }

    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    if (dot(N, V) < 0.0) N = -N;              // double-sided specimen

    // ---- micro surface: fibrous striation + slow mottling ----------------
    float n1 = vnoise(vW * 26.0);
    float n2 = vnoise(vW * 78.0);
    float fibre = sin(dot(vW, vec3(61.0, 21.0, 47.0)) + n1 * 5.0);
    vec3 T = normalize(cross(N, vec3(0.0, 1.0, 0.0)) + vec3(0.001));
    N = normalize(N + T * fibre * 0.035 + vec3(0.0, n2 - 0.5, 0.0) * 0.05);

    float grain = 0.93 + 0.14 * n1 + 0.06 * n2;
    vec3 albedo = mix(uBase, uDeep, clamp(n1 * 1.15 - 0.1, 0.0, 1.0) * 0.55) * grain;
    if (vEndo > 0.5) albedo = mix(albedo, uDeep * 1.25, 0.34);   // endocardium

    // ---- light -----------------------------------------------------------
    vec3 L1 = normalize(uKeyDir);
    vec3 L2 = normalize(uRimDir);
    vec3 L3 = normalize(vec3(0.15, -0.95, 0.25));

    float d1 = clamp((dot(N, L1) + 0.35) / 1.35, 0.0, 1.0);
    float d2 = clamp((dot(N, L2) + 0.25) / 1.25, 0.0, 1.0);
    float d3 = clamp(dot(N, L3), 0.0, 1.0);

    vec3 col = albedo * (0.10 + 0.92 * d1);
    col += albedo * vec3(0.32, 0.40, 0.52) * 0.36 * d2;
    col += albedo * vec3(0.42, 0.11, 0.10) * 0.30 * d3;

    // thin-tissue transmission: warm glow where light exits the far side
    float trans = pow(clamp(dot(-N, L1), 0.0, 1.0), 2.2);
    col += vec3(0.36, 0.055, 0.045) * trans * (uRegion == 2 ? 0.35 : 0.9);

    // specular
    vec3 H = normalize(L1 + V);
    float spec = pow(max(dot(N, H), 0.0), mix(18.0, 90.0, 1.0 - uRough)) * uSpec;
    col += vec3(1.0, 0.94, 0.88) * spec * 0.34;

    // fresnel edge
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.4);
    col += vec3(0.38, 0.44, 0.55) * fres * 0.22;

    // head lamp for travel inside the blood pool
    if (uHead > 0.0) {
      float hl = pow(clamp(dot(N, V), 0.0, 1.0), 1.6);
      col += albedo * vec3(1.0, 0.93, 0.86) * hl * uHead * 1.35;
    }

    // ---- depolarisation front -------------------------------------------
    if (uRegion == 0 || uRegion == 1) {
      float dt = (uRegion == 1) ? (uVT - vAct) : (uAT - vAct);
      float band = smoothstep(0.0, 0.004, dt) * (1.0 - smoothstep(0.006, 0.016, dt));
      col += uActCol * band * 0.13;
      float rep = smoothstep(0.255, 0.30, dt) * (1.0 - smoothstep(0.33, 0.44, dt));
      col += vec3(0.16, 0.26, 0.36) * rep * 0.10;
    }

    // ---- interface states -------------------------------------------------
    col += vec3(0.95, 0.80, 0.60) * uSelect * (0.11 + fres * 0.55);
    col += vec3(0.80, 0.86, 0.95) * uHover * (0.05 + fres * 0.20);

    col = mix(col, vec3(0.028, 0.031, 0.036) + col * 0.16, uFocus * 0.82);

    if (uGhost > 0.001) {
      // x-ray: edge-weighted emission so the silhouette still reads when the
      // muscle is only 15% opaque
      col = mix(col, vec3(0.62, 0.36, 0.34) * (0.25 + fres * 1.6), 0.55);
      col += vec3(0.5, 0.24, 0.22) * fres * 0.55;
    }

    if (uFade < 0.999) {
      float d = bayer4(gl_FragCoord.xy);
      if (d > uFade) discard;
    }

    gl_FragColor = vec4(col, uAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const KEY = new THREE.Vector3(0.52, 0.74, 0.62).normalize();
const RIM = new THREE.Vector3(-0.72, 0.28, -0.58).normalize();

export function makeTissueMaterial(opts) {
  const m = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    uniforms: {
      uBase: { value: new THREE.Color(opts.base) },
      uDeep: { value: new THREE.Color(opts.deep) },
      uActCol: { value: new THREE.Color(opts.act ?? '#f0c07a') },
      uRough: { value: opts.rough ?? 0.55 },
      uSpec: { value: opts.spec ?? 0.5 },
      uSelect: { value: 0 },
      uHover: { value: 0 },
      uFocus: { value: 0 },
      uGhost: { value: 0 },
      uRevealY: { value: 99 },
      uDissolveR: { value: opts.dissolveR ?? 0 },
      uFade: { value: 1 },
      uRegion: { value: opts.region ?? 1 },
      uVT: { value: 0 },
      uAT: { value: 0 },
      uAmpV: { value: opts.ampV ?? 0.016 },
      uAmpA: { value: opts.ampA ?? 0.008 },
      uBaseY: { value: opts.baseY ?? 0.3 },
      uSpanY: { value: opts.spanY ?? 0.6 },
      uTwist: { value: opts.twist ?? 0.05 },
      uKeyDir: { value: KEY },
      uRimDir: { value: RIM },
      uHead: { value: 0 },
      uAlpha: { value: 1 },
    },
  });
  m.extensions = { derivatives: false };
  return m;
}

export const TISSUE_PALETTE = {
  chambers: { base: '#6a2a2c', deep: '#3a1013', act: '#f2c483', region: 1, rough: 0.68, spec: 0.34 },
  atria: { base: '#67302f', deep: '#381216', act: '#f2c483', region: 0, rough: 0.68, spec: 0.3 },
  vessels: { base: '#3f4859', deep: '#1d232f', act: '#9fb4d8', region: 2, rough: 0.55, spec: 0.45 },
  valves: { base: '#b6a488', deep: '#6d6150', act: '#f2d9a8', region: 3, rough: 0.38, spec: 0.85 },
  cavities: { base: '#4a1d22', deep: '#21080c', act: '#f2c483', region: 1, rough: 0.7, spec: 0.3 },
  coronary: { base: '#8d3a33', deep: '#4a1614', act: '#f0b070', region: 1, rough: 0.45, spec: 0.6 },
  shell: { base: '#6a2a2c', deep: '#3a1013', act: '#f2c483', region: 4, rough: 0.6, spec: 0.5 },
  conduction: { base: '#a89b7d', deep: '#5f5847', act: '#f2d9a8', region: 4, rough: 0.5, spec: 0.5 },
};
