# Ahmed R. Elwan — Heart Stimulation

An interactive anatomical specimen of the human heart, built for the browser.

The specimen is assembled from segmented clinical anatomy, not from a sculpted
asset. It contracts from an activation field solved on its own surface, its
electrocardiogram is derived from that same field, and a pacing electrode can be
placed anywhere on ventricular myocardium to re-solve the activation sequence and
watch the complex widen.

---

## 1. Running it

```bash
npm install
npm run dev        # development server, http://localhost:5173
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
```

Requires Node 18+. No environment variables. No backend. No network calls after
the first load — the anatomy, the fonts and the code are all local.

## 2. Deploying to Vercel

The project is a static Vite build with no server components.

```bash
npx vercel          # or import the repository in the Vercel dashboard
```

`vercel.json` pins the framework, the build command and the output directory, so
no dashboard configuration is needed. The only rewrites are for clean URLs.

**Deployment status: not deployed.** No credentials were available in the build
environment, so the project was verified locally only (see §7).

## 3. What is on screen

| Chapter | What it does |
| --- | --- |
| **I. In situ** | The whole specimen, anterior view. Drag to orbit, scroll or pinch to zoom, right-drag or two-finger drag to pan. |
| **II. Structura** | Every structure is selectable. Hover for a name, click to frame it and open its record. The index groups all 38. |
| **III. Cyclus** | The myocardium opens. Scrub the cycle rail to hold any instant of systole or diastole; every system follows. Toggle cavities and the circulation, and enter a chamber. |
| **IV. Rhythmus** | Ten rhythm states. Timing, contraction, flow gates, ECG and the panel text all change together. |
| **V. Stimulatio** | Click ventricular myocardium to place a pacing electrode. The activation field is re-solved from that point; the complex widens and the axis rotates. |
| **VI. Iter** | Follow one erythrocyte through the circuit. The camera travels inside the blood pool. |

### Interior exploration

Entering a chamber (from the Cyclus tools, a chamber's record, or the interior
bar) moves the camera to the centroid of the modelled cavity and clamps the
orbit distance to that cavity's radius, so the camera cannot tunnel through the
myocardium. The muscle drops to 15% opacity with a low head-lamp, and the valve
apparatus, chordae and papillary muscles are made solid. `←` / `→` move between
the four chambers; `Esc` or *Leave* restores the exterior view and the previous
camera.

Secondary controls: ghost/transparency, labels, sound (synthesised valve
closure, off by default), heart rate, and the imprint (sources, model boundary,
limitations).

## 4. How the anatomy was made

`tools/build-anatomy.mjs` converts the BodyParts3D reference dataset into the web
asset. It is included so the asset can be reproduced, not because the app needs it
at runtime.

```
BodyParts3D 4.0 OBJ elements (per FMA concept)
  → merge + positional weld (restores continuous surfaces across segmentation fragments)
  → Taubin λ/μ smoothing, boundary vertices frozen (removes staircase artefacts without moving cut rims)
  → 1-ring rim erosion and needle/sliver pruning
  → hub-radius truncation of vessel trees + fan caps (a sectioned specimen, not a hollow stump)
  → geodesic centreline extraction (Dijkstra chain, smoothed), used by the flow engine
  → single GLB, one mesh per structure, 26 structures, 2.4 MB
```

Output: `public/assets/anatomy.glb` + `public/assets/anatomy.json` (centres,
radii, vessel centrelines).

**Thirty-eight separately selectable structures**: right and left atrium, right
and left ventricle, four valves, four endocardial cavities, aorta, pulmonary
trunk, right and left pulmonary artery, superior and inferior vena cava, four
pulmonary veins, the left main / LAD / diagonal / circumflex / right / right
marginal / posterior descending / posterior ventricular coronary arteries, the
great, middle and small cardiac veins with the coronary sinus, four groups of
papillary muscles, and the fibrous skeleton.

Surface grooves are real topography, not painted lines: each chamber vertex is
measured against the actual coronary and venous geometry and the wall is recessed
up to 10 mm along the atrioventricular and both interventricular sulci, then
tinted as the epicardial fat that fills them.

`ANATOMY.md` is the audit: what is verified, what is simplified, and what is
missing from the source dataset and therefore absent rather than faked.

## 5. The physiology model

### 5.1 One clock

`src/physiology/Engine.js` schedules every depolarisation and derives the
mechanical phase of each beat from it. Contraction, valve state, flow velocity,
the ECG and the on-screen numbers are all functions of that single state. There
is no second animation timeline that can drift.

### 5.2 Activation field

`src/gl/Activation.js` assigns every myocardial vertex an activation time.

**Conducted beats.** A geodesic front is solved from a set of endocardial
breakthrough sites chosen by farthest-point sampling (a stand-in for the Purkinje
insertions), then modulated by two parametric terms:

- a transmural delay, because endocardium depolarises before epicardium;
- a mean activation direction, because a surface geodesic has no knowledge of the
  fibre architecture that makes the lateral left ventricular wall the last
  territory to depolarise.

Only the first term is solved from the mesh. The other two are parametric, and
they are what place the normal axis in the inferior-left quadrant.

**Ectopic and paced beats.** Euclidean distance from the focus at an effective
working-myocardial conduction velocity, plus a 30 ms trans-septal delay. No
parametric direction term is used here, so the geometry alone decides the axis.
An earlier version used a surface geodesic for this and produced complexes that
were either too narrow or absurdly wide depending on where the focus landed,
because the geodesic runs around the shell rather than through the wall.

### 5.3 Electrocardiogram

`src/physiology/Ecg.js` renders a Lead II trace sampled at 500 Hz.

The QRS is not drawn from a template. It is the projection of an equivalent
dipole: at each instant the source is the vector from the centroid of the
already-depolarised myocardium to the centroid of the still-resting myocardium.
Summing point dipoles over a closed shell cancels — that was the original defect
— so the dipole is computed from the moving centroids instead. Its direction
follows the wavefront, it reverses when the late territory depolarises, and that
reversal is what produces an rS rather than a monophasic hump.

P and T waves are analytic. The frontal axis is taken from the net QRS area, the
standard convention, not from the peak.

### 5.4 Measured output

Values read from the running production build, not estimated.

| State | Activation spread (= the QRS figure shown in the UI) | Frontal axis |
| --- | --- | --- |
| Sinus rhythm | 72 ms | +56° |
| Atrial activation | 85 ms | — |
| Pacing, right ventricle (built-in focus) | 159 ms | −25° |
| Pacing, left ventricle (via the UI path) | 195 ms | −158° |

The drawn Lead II complex is slightly longer than the spread because the dipole
series carries a short tail; the number in the instrument band is the activation
spread, which is the quantity the model can defend.

The narrow complex sits inside the normal range (QRS < 120 ms, axis −30° to +90°).
Both paced states are wide and their axes rotate away from the pacing site, which
is the behaviour the chapter is built to demonstrate. A paced axis in the
north-west quadrant is unusual but not impossible, and it is a direct consequence
of the focus position the UI chose — the point of the interaction is that axis
follows site, not that any particular site reproduces a textbook number.

### 5.5 Conduction velocities

Velocities are quoted in m/s and converted into model units (1 unit = the height
of the specimen = 105 mm). They are *effective* values calibrated on the
segmented surface, which overestimates path length relative to transmural
conduction:

| Tissue | Effective velocity | Target |
| --- | --- | --- |
| Atrial myocardium | 4.2 m/s | 85 ms bi-atrial activation |
| Purkinje (conducted) | 3.0 m/s | contributes ~10 ms of the QRS |
| Working myocardium (ectopic) | 0.55 m/s | 150–200 ms paced QRS |

These are not the textbook 0.5–1 m/s: the calibration compensates for surface
geometry, and it is disclosed rather than hidden.

### 5.6 Mechanical model

The tissue shader displaces each vertex along its normal by a twitch function of
`(cycle time − activation time)`. Tension rises over ~55 ms, peaks near
end-systole and relaxes over ~300 ms. Endocardial vertices travel further inward
than epicardial ones, so the wall thickens instead of the organ shrinking.
Ventricles also shorten along their long axis by up to 13.5% and twist slightly;
atria use a smaller, faster twitch.

Measured in the running build: the left ventricular silhouette shortens from
293 px to 259 px and loses 17% of its projected area between end-diastole and
peak systole, then returns to baseline in diastasis.

### 5.7 Circulation

`src/gl/Flow.js` moves particles along a single closed polyline assembled from
the geodesic vessel centrelines and valve-plane splices. Velocity is modulated by
the valve state of the segment being crossed, so blood accumulates behind a
closed tricuspid valve and accelerates through an open aortic valve. Particles
are seeded against visible arc length so they are not wasted in the off-stage
pulmonary and systemic detours.

### 5.8 Limits of the model — read this before quoting anything

Not modelled, and not claimed:

- fibre orientation, laminar sheet architecture, transmural propagation;
- the His–Purkinje geometry (breakthrough sites are sampled, not traced);
- repolarisation gradients — T is analytic and concordant by construction;
- the thorax as a volume conductor; no lead vectors in three dimensions;
- pressure–volume loops from elastance, baroreflex, autonomic control;
- fluid dynamics. The flow shows sequence and direction, not CFD.

Consequences: pressures and volumes are illustrative and rate-scaled, not solved;
the ECG is *derived*, not recorded, and is not calibrated in millivolts; axis
values are model output, not measurements.

**This is an educational instrument. It is not a medical device, it does not
diagnose, and it must not be used for clinical decisions.**

## 5.9 Rendering budget

Measured in the running build at 1440×900 with all 38 structures loaded:

| Metric | Value |
| --- | --- |
| Draw calls | 23 |
| Triangles submitted | 161,720 |
| Shader programs | 1 |
| Textures | 0 |
| Geometries | 23 |

One program for every tissue mesh is deliberate: the shader carries surface,
deformation and interface state, and per-mesh differences travel as uniforms, so
switching modes or selecting a structure never triggers a recompile.

Work done to remove the lag that was present in the previous build:

- materials are **opaque** unless transparency is actually in use; previously all
  26 meshes were in the transparent queue, paying sorting and blending every
  frame for no visual gain;
- `preserveDrawingBuffer` is off unless `?capture` is in the URL (it forces a
  copy every frame);
- hover raycasting is throttled to ~18 Hz instead of every pointer move;
- no per-frame `innerHTML` rebuilds or `querySelectorAll` in the readout path;
- geometry and materials are created once and never rebuilt on mode changes.

Frame rate is not claimed. The sandbox used for verification renders through
SwiftShader (software), where the measured rate is ~1 fps and says nothing about
hardware. The draw-call and triangle counts above are the hardware-independent
evidence that the scene is cheap.

## 6. Architecture

```
index.html
src/
  main.js                 boot, modes, pointer handling, journey camera, audio
  gl/Stage.js             renderer, camera, quality tiers, camera framing
  gl/Anatomy.js           GLB load, per-structure state, region labels, focus
  gl/tissue.js            the single tissue shader (lighting, deformation, x-ray)
  gl/Activation.js        geodesic / euclidean activation, dipole QRS, axis
  gl/Flow.js              circulation polyline, particle advection, journey marker
  physiology/Engine.js    beat scheduling, phases, valves, volumes
  physiology/Ecg.js       Lead II synthesis and canvas rendering
  ui/UI.js                spine, cycle rail, monitor, panel, labels, imprint
  data/content.js         26 structure records, 10 rhythm records
  styles/base.css         design system
public/
  assets/anatomy.glb      specimen (2.4 MB)
  assets/anatomy.json     centres, radii, vessel centrelines
  fonts/*.woff2           Newsreader, Instrument Sans, IBM Plex Mono (OFL)
tools/build-anatomy.mjs   reproducible asset pipeline
```

No framework, no state library, no post-processing chain. One shader carries
surface, deformation and interface state so the anatomy never needs a duplicate
copy of itself.

## 7. Testing report

Performed against the running application in headless Chromium 131
(SwiftShader), viewport 1440×900 and 390×844.

**Verified**

- Production build succeeds (`vite build`, 691 kB JS / 20 kB CSS).
- Boot, asset load, intro reveal, auto-enter and skip.
- All 38 structures selectable; panel opens with correct name for each.
- Interior mode entered in all four chambers (camera 0.16 units from the cavity
  centroid, orbit clamped), and exit restored fov 32 and min distance 0.35.
- Groove topography visible in the running build along the LAD, RCA, LCx and PDA.
- Isolate, enter-cavity, reset view, whole-heart return.
- 14 projected labels.
- All 6 chapters activate; tools render per chapter.
- All 10 rhythm states produce a live beat with the expected rate.
- Pacing on the left ventricle: electrode visible, QRS 195 ms, axis −158°;
  restore-sinus clears it.
- Iter: journey starts, orbit controls disabled, camera follows; release
  restores controls and camera.
- Sound on/off (WebAudio, user gesture only).
- Ghost, flow, labels, heart-rate ±, cycle scrub (0.1 / 0.5 / 0.9 verified).
- Contraction measured, not assumed: silhouette area falls 17% at peak systole.
- Mobile 390×844: no horizontal overflow (`scrollWidth === clientWidth`), band
  and rail fit, quick controls reachable, specimen framed.
- The production build (`vite preview`, not the dev server) was loaded and
  screenshotted at 1440×900: specimen, chapter spine, Lead II trace, phase rail
  and readouts all render, with no console or page errors.
- No console errors or page errors during the audit run.

**Not verified / known gaps**

- No physical touch device was used. Touch behaviour relies on OrbitControls'
  pointer events, which were exercised with mouse events only.
- Frame rate under SwiftShader is 3–18 fps and is not representative of a GPU.
  Performance on integrated graphics was not measured.
- No real hardware GPU, Safari, or Firefox run.
- The lbl field can overlap when many labels are on at once on narrow screens.
- Transition timing between chapters is smoothed but was not measured frame by
  frame for jank.

## 8. Scientific references

- Standring S. *Gray's Anatomy*, 42nd ed. Elsevier, 2020.
- Hall J.E. *Guyton and Hall Textbook of Medical Physiology*, 14th ed. Elsevier, 2020.
- Libby P. et al. *Braunwald's Heart Disease*, 12th ed. Elsevier, 2022.
- Mitsuhashi N. et al. BodyParts3D: 3D structure database for anatomical
  concepts. *Nucleic Acids Research* 37(suppl_1):D782–D785, 2009.
- Murgatroyd F. et al. *Handbook of Cardiac Electrophysiology*, 2nd ed. REMEDICA, 2002.

Anatomical and clinical copy is written to that standard; it is a summary for
teaching, not a citation of any single passage.

## 9. Attribution

See `ATTRIBUTION.md`. Geometry is BodyParts3D (CC BY 4.0, modified); fonts are
SIL OFL; Three.js and Vite are MIT.
