# Anatomy audit

Every entry was checked against the running build, not against the source code.
Status vocabulary:

- **VERIFIED** — separate geometry, correct position in the reference body, visually inspected in the application.
- **IMPLEMENTED** — present as geometry but not individually selectable, or not fully inspected.
- **SIMPLIFIED** — represented with a documented approximation.
- **MISSING** — not in the source dataset. Not faked, not labelled as if present.
- **N/A** — deliberately outside the scope, with a reason.

Source: BodyParts3D 4.0 (DBCLS, CC BY 4.0), a single adult male reference body.
All structures below come from that one registration, so their relative positions
are anatomically consistent by construction — they are not separately sourced
models pasted together.

Total: **38 individually selectable structures.**

---

## 1. External surfaces and orientation

| Structure | Status | Note |
| --- | --- | --- |
| Apex of the heart | VERIFIED | Formed by the left ventricle; anterior, inferior, left. |
| Base of the heart | VERIFIED | Atrioventricular plane with the great vessels emerging. |
| Anterior / sternocostal surface | VERIFIED | Right ventricle dominant, as it should be. |
| Inferior / diaphragmatic surface | VERIFIED | LV and RV inferior walls, posterior IV groove. |
| Posterior surface | VERIFIED | Left atrium and the crux. |
| Right and left pulmonary surfaces | VERIFIED | Concave atrial/ventricular aspects. |
| Anatomical orientation | VERIFIED | +X = patient left, +Y = superior, +Z = anterior. Camera defaults to an anterior view; the LV appears on the viewer's right. |

## 2. Grooves and sulci

| Structure | Status | Note |
| --- | --- | --- |
| Coronary (atrioventricular) sulcus | SIMPLIFIED | Real surface topography, not a painted line. Each chamber vertex is tested against the geometry of the RCA, LCx, great cardiac vein and coronary sinus; the wall is recessed up to 10 mm on a 24 mm smoothstep falloff and tinted as epicardial fat. |
| Anterior interventricular sulcus | SIMPLIFIED | Same method, driven by the LAD mesh. |
| Posterior interventricular sulcus | SIMPLIFIED | Same method, driven by the PDA mesh. |
| Depth and trajectory | SIMPLIFIED | Depth is uniform along the groove rather than varying with myocardial thickness. The trajectory is exactly that of the real vessels, so the vessels sit *in* the groove. |

## 3. Atria, auricles, ventricles

| Structure | Status | Note |
| --- | --- | --- |
| Right atrium | VERIFIED | Separate mesh. |
| Left atrium | VERIFIED | Separate mesh. |
| Right auricle | IMPLEMENTED | Part of the right atrial mesh, not separately selectable. |
| Left auricle | IMPLEMENTED | Part of the left atrial mesh, not separately selectable. |
| Interatrial relationship | VERIFIED | Correct posterior/superior position of the LA relative to the RA. |
| Right ventricle | VERIFIED | Crescentic, thinner-walled, wrapping the LV. Not a copy of the LV. |
| Left ventricle | VERIFIED | Thickest wall, forms the apex. |
| Interventricular septum | SIMPLIFIED | The septum *is* the shared wall between the two ventricular shells; it is real geometry but not a separate mesh, so it cannot be isolated on its own. |
| Relative wall thickness | VERIFIED | Comes from the segmented data, not from a modelling choice. |

## 4. Coronary arteries

| Structure | Status | Note |
| --- | --- | --- |
| Left main coronary artery | VERIFIED | FMA50040 + FMA3855. |
| LAD (anterior interventricular) | VERIFIED | FMA3862, with the conus branch and three septal perforator groups merged. |
| Diagonal branch | VERIFIED | FMA3860. Separate mesh. |
| Circumflex artery | VERIFIED | FMA3895. Separate mesh. |
| Right coronary artery | VERIFIED | FMA50039 + trunk FMA3802 + first RV branch. |
| Right marginal (acute marginal) | VERIFIED | FMA3818. |
| Posterior descending (PDA) | VERIFIED | FMA3840. |
| Posterior ventricular branches | VERIFIED | FMA3837. |
| SA nodal branch | MISSING | Not a separate concept in the dataset; it is contained inside the proximal RCA mesh and cannot be isolated. |
| AV nodal branch | MISSING | As above. |
| Coronary ostia | VERIFIED | The vessels are from the same reference body, so their origins sit at the sinuses without placement by hand. |
| Diameter taper and branching | VERIFIED | Segmented geometry, not swept tubes. |
| Distal intramyocardial segments | SIMPLIFIED | Triangles not within 12.6 mm of the epicardium are trimmed, so vessels do not dangle past the apex. |
| Dominance variants | N/A | The specimen has one dominance pattern; alternatives are not modelled. |

## 5. Cardiac veins

| Structure | Status | Note |
| --- | --- | --- |
| Coronary sinus | VERIFIED | With its ostium at the RA. |
| Great cardiac vein | VERIFIED | Anterior IV groove, continuing into the sinus. |
| Middle cardiac vein | VERIFIED | Posterior IV groove. |
| Small cardiac vein | VERIFIED | Right AV groove. |
| Anterior cardiac veins | MISSING | Not segmented in the dataset. |
| Venous tributaries | IMPLEMENTED | Present inside the named vein meshes; not separately selectable. |

## 6. Internal anatomy

| Structure | Status | Note |
| --- | --- | --- |
| Four chamber cavities | VERIFIED | Separate endocardial surfaces; they contract with their wall. |
| Trabeculae carneae | IMPLEMENTED | Present as real surface relief on the cavity meshes; not individually named or selectable. |
| Papillary muscles, right (anterior, posterior, septal) | VERIFIED | Three separate meshes (FMA7260–7262). |
| Papillary muscles, left | VERIFIED | FMA9352 + FMA7264. |
| Chordae tendineae | IMPLEMENTED | Contained within the valve meshes, not separable. |
| Moderator band | MISSING | Not segmented in the dataset. |
| Crista terminalis | MISSING | Not segmented. |
| Pectinate muscles | MISSING | Not segmented as structures. |
| Fossa ovalis | MISSING | Not segmented. |
| Eustachian / Thebesian valves | MISSING | Not segmented. |
| Aortic vestibule, infundibulum | IMPLEMENTED | Present in the cavity geometry as smooth regions; not separately selectable. |
| Fibrous skeleton | VERIFIED | Separate mesh (FMA9496), with the valve annuli it forms. |

## 7. Valves

| Structure | Status | Note |
| --- | --- | --- |
| Tricuspid valve | VERIFIED | Separate mesh including annulus and chordae (17.6 k triangles). |
| Mitral valve | VERIFIED | Separate mesh with chordae (12.6 k triangles). |
| Aortic valve | VERIFIED | Separate mesh. |
| Pulmonary valve | VERIFIED | Separate mesh. |
| Leaflet opening motion | SIMPLIFIED | Leaflets do not hinge. Valve state is expressed by the flow gate (blood accumulates behind a closed valve) and by the phase readout, not by deforming the leaflets. Doing otherwise without per-leaflet weights would be a fabricated rig. |
| Commissures | IMPLEMENTED | Present in the geometry, not separately selectable. |

## 8. Great vessels

| Structure | Status | Note |
| --- | --- | --- |
| Ascending aorta, arch | VERIFIED | With a short proximal descending segment. |
| Aortic root and sinuses | IMPLEMENTED | Present as the root geometry; sinuses are not separate. |
| Pulmonary trunk | VERIFIED | |
| Right and left pulmonary artery | VERIFIED | Truncated at the hilar border and capped. |
| SVC, IVC | VERIFIED | Both enter the RA. |
| Four pulmonary veins | VERIFIED | All enter the LA. |
| Brachiocephalic trunk, left common carotid, left subclavian | MISSING | The dataset exposes these only as whole-tree concepts that include the entire head and arm vasculature. Including them would have meant shipping a mislabelled tree, so they are omitted. |
| Vessel cutoffs | VERIFIED | Deliberate and capped; the section is visible, which is how a specimen looks. |

## 9. Labelling

38 structures carry a record: name, Latin name, FMA identifier, one-sentence
definition and 2–4 disclosure sections with group-specific headings (Position /
Structure / Function / Clinical for chambers; Course / Territory / Clinical for
arteries; Course / Drainage / Clinical for veins; and so on). Fourteen labels are
projected in the label field; all 38 are reachable from the index.

---

## What this model is not

- It is one reference body, not a population. Calibre, branching pattern and
  chamber proportions belong to that specimen.
- Surfaces are organ boundaries, not contrast-filled lumina.
- Anything marked MISSING is absent rather than approximated. If a structure is
  not listed as VERIFIED, do not assume it is there because its name appears in
  the interface.
