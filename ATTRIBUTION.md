# Attribution and licensing

## Anatomical geometry — BodyParts3D 4.0

Source: BodyParts3D, © The Database Center for Life Science (DBCLS), Japan.
<https://lifesciencedb.jp/bp3d/> · distributed via <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/>
License: **Creative Commons Attribution 4.0 International (CC BY 4.0)**
<https://creativecommons.org/licenses/by/4.0/>

Reference: Mitsuhashi N., Fujieda K., Tamura T., Kawamoto S., Takagi T.,
Okubo K. "BodyParts3D: 3D structure database for anatomical concepts."
*Nucleic Acids Research* 37(suppl_1):D782–D785, 2009.

### What was modified

The dataset was not redistributed as-is. `tools/build-anatomy.mjs` performs, in
order:

1. merging of the per-FMA-concept OBJ elements that make up each structure;
2. positional welding at 0.02 mm to restore continuity across segmentation fragments;
3. Taubin λ/μ smoothing (2–10 iterations per structure) with boundary vertices
   held fixed;
4. rim erosion (1–2 rings) and removal of needle/sliver triangles;
5. hub-radius truncation of the great-vessel trees and their caps;
6. coordinate conversion to a Y-up viewer frame, normalisation so that the
   height of the heart equals 1.0, and re-centring;
7. conversion to a single binary glTF (GLB) with one mesh per structure, no
   textures, no normals (computed at load);
8. derivation of vessel centrelines by Dijkstra geodesic walk, stored in
   `anatomy.json`;
9. per-vertex sulcus mask: each chamber vertex is measured against the vertices
   of the coronary and cardiac-vein meshes, and a smooth 0–1 mask is baked as the
   `aGroove` attribute (used by the shader to recess the wall and tint
   epicardial fat);
10. trimming of coronary/venous triangles that sit more than 12.6 mm from the
    epicardium.

Structures included (38 meshes): right and left atrium, right and left ventricle,
tricuspid, mitral, aortic and pulmonary valves, four endocardial cavities, aorta,
pulmonary trunk, right and left pulmonary artery, superior and inferior vena
cava, four pulmonary veins, left main / anterior interventricular / diagonal /
circumflex / right / right marginal / posterior descending / posterior
ventricular coronary arteries, great / middle / small cardiac veins and the
coronary sinus, four papillary muscle groups (right anterior, right posterior,
right septal, left), and the fibrous skeleton.

### Properties of the source that affect interpretation

- It is a single adult male reference body reconstructed from cadaver
  cryosection data. It contains no patient anatomy.
- Vessel calibre, chamber proportions and coronary branching are those of that
  reference body.
- Surfaces are organ boundaries, not contrast-filled lumina. The chambers are
  therefore modelled as the endocardial surface plus a separate cavity mesh,
  not as a cast of the blood pool.
- Where vessels leave the specimen they are truncated and capped, and the
  section is visible. Ostia into the atria are open, as they are in a real
  specimen with its great vessels removed.

## Typography

All three families are self-hosted, subset to Latin, and redistributed under the
**SIL Open Font License 1.1** (<https://openfontlicense.org>):

- **Newsreader** — Production Type. © 2020 The Newsreader Project Authors.
- **Instrument Sans** — Instrument. © 2022 The Instrument Sans Project Authors.
- **IBM Plex Mono** — IBM. © 2017 IBM Corp.

## Software

- **Three.js** — MIT License. © 2010–2024 three.js authors. <https://threejs.org>
- **Vite** — MIT License. © 2019–present VoidZero Inc. and Vite contributors.

## Project code

© 2026 Ahmed R. Elwan. Released under the MIT License:

```
Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

This MIT grant covers the application code only. The anatomical geometry remains
CC BY 4.0 (DBCLS) and the fonts remain under the SIL OFL; their terms travel with
them.

## Medical disclaimer

Educational visualisation. Not a medical device. Not validated for diagnosis,
treatment planning, training assessment or any clinical decision. The
electrocardiogram is computed from a simplified equivalent-dipole model and is
not a recording; axis and interval values are model output.
