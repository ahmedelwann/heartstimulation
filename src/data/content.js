/**
 * Anatomical content.
 * Copy is written for a reader who already knows the heart and for one who does
 * not: one precise sentence first, then the detail behind a disclosure.
 * Terminology follows Terminologia Anatomica; clinical notes follow standard
 * cardiology teaching (Gray's Anatomy 42e; Guyton & Hall 14e; Braunwald 12e).
 * Nothing here is patient-specific or diagnostic.
 */

export const GROUPS = {
  chambers: { label: 'Chambers', head: ['Position', 'Structure', 'Function', 'Clinical'] },
  vessels: { label: 'Great vessels', head: ['Course', 'Wall and pressure', 'Clinical'] },
  valves: { label: 'Valves', head: ['Apparatus', 'Closure', 'Clinical'] },
  cavities: { label: 'Cavities', head: ['Surface', 'Volume', 'Relations'] },
  coronary: { label: 'Coronary circulation', head: ['Territory', 'Clinical'] },
  conduction: { label: 'Fibrous skeleton', head: ['Function', 'Clinical'] },
};

export const STRUCTURES = {
  ra: {
    name: 'Right atrium', latin: 'Atrium dextrum', group: 'chambers', fma: 'FMA7096',
    lede: 'The thin-walled receiving chamber for the entire systemic venous return, and the site of the heart’s own pacemaker.',
    sections: [
      ['Position', 'Right lateral and slightly anterior, forming the right heart border. It receives the superior vena cava superiorly, the inferior vena cava inferiorly, and the coronary sinus posteromedially.'],
      ['Structure', 'Wall thickness 2–3 mm. The **crista terminalis** separates the smooth sinus venarum from the trabeculated **pectinate muscles** of the appendage. The **fossa ovalis** marks the fetal septum primum. The **sinoatrial node** sits at the SVC–atrial junction in the sulcus terminalis, a subepicardial structure roughly 15 × 5 × 3 mm.'],
      ['Function', 'Reservoir during ventricular systole, conduit in early diastole, and a weak pump in late diastole. Its contraction completes ventricular filling and is worth roughly 15–20% of stroke volume at rest.'],
      ['Clinical', 'The cavotricuspid isthmus is the target of typical flutter ablation. The appendage is the usual site for an atrial pacing lead, and a common site of thrombus in atrial fibrillation. Central venous pressure is read here.'],
    ],
  },
  rv: {
    name: 'Right ventricle', latin: 'Ventriculus dexter', group: 'chambers', fma: 'FMA7098',
    lede: 'A crescentic, low-pressure pump wrapped around the left ventricle, built to move the same stroke volume against a sixth of the resistance.',
    sections: [
      ['Position', 'Immediately behind the sternum, anterior and to the right of the left ventricle. Its anterior surface forms most of the sternocostal projection of the heart.'],
      ['Structure', 'Wall 3–5 mm. The inflow portion is heavily trabeculated, with the **moderator band** crossing the cavity to the anterior papillary muscle. The smooth **infundibulum** (conus arteriosus) leads to the pulmonary valve, separated from the inflow by the supraventricular crest.'],
      ['Function', 'Contraction proceeds from apex to outflow, so the chamber shortens like a bellows rather than a sphere. Peak pressure is ~25 mmHg; ejection begins as soon as it exceeds pulmonary artery pressure, well before aortic ejection.'],
      ['Clinical', 'Infarction is usually a complication of right coronary occlusion and presents with hypotension, raised JVP and clear lungs. Dilation from pressure or volume overload displaces the septum and impairs left ventricular filling.'],
    ],
  },
  la: {
    name: 'Left atrium', latin: 'Atrium sinistrum', group: 'chambers', fma: 'FMA7097',
    lede: 'The most posterior chamber, a thin-walled reservoir for oxygenated blood returning from the lungs.',
    sections: [
      ['Position', 'Posterior and superior, immediately in front of the oesophagus and descending aorta. Enlargement is best seen on a lateral radiograph as posterior displacement of the barium-filled oesophagus.'],
      ['Structure', 'Wall ~3 mm, thicker than the right atrium. Four pulmonary veins enter its posterior wall without valves. The appendage is narrow, hooked and trabeculated; the body is smooth.'],
      ['Function', 'Three roles in one cycle: **reservoir** while the mitral valve is closed, **conduit** during early diastolic filling, and **pump** in late diastole. The atrium also senses volume: wall stretch drives ANP and BNP release.'],
      ['Clinical', 'Pulmonary vein ostia are the dominant trigger sites for atrial fibrillation, which is why they are isolated. Left atrial size and pressure are central to estimating filling pressures, and stasis in the appendage is the main source of cardioembolic stroke.'],
    ],
  },
  lv: {
    name: 'Left ventricle', latin: 'Ventriculus sinister', group: 'chambers', fma: 'FMA7101',
    lede: 'The thickest chamber of the heart: a conical pressure generator that forms the apex and produces the systemic circulation.',
    sections: [
      ['Position', 'Left and posterior, with its apex directed anteriorly, inferiorly and to the left. The apex is formed entirely by the left ventricle and is the point of maximal impulse.'],
      ['Structure', 'Wall 8–12 mm at diastole, up to 15 mm at the base. Two papillary muscles (anterolateral and posteromedial) anchor the mitral apparatus by chordae tendineae. Trabeculae carneae line the inflow; the outflow tract, the **aortic vestibule**, is smooth.'],
      ['Function', 'Shortens longitudinally and twists, storing elastic energy in systole and releasing it as suction in early diastole. Ejection fraction 55–70%; peak pressure ~120 mmHg.'],
      ['Clinical', 'Territory of infarction predicts mechanical consequence: LAD occlusion threatens the anterior wall and apex, circumflex the lateral wall, right coronary the inferior wall. Concentric hypertrophy reduces cavity size and compliance before it reduces ejection fraction.'],
    ],
  },
  aorta: {
    name: 'Aorta', latin: 'Aorta', group: 'vessels', fma: 'FMA3736 · FMA3768 · FMA3784',
    lede: 'The elastic conduit that converts the intermittent output of the left ventricle into continuous systemic flow.',
    sections: [
      ['Course', 'Ascending aorta leaves the left ventricular outflow tract within the pericardial sac, gives off the coronary arteries from the sinuses of Valsalva, then arches posteriorly and to the left. The arch gives the brachiocephalic trunk, left common carotid and left subclavian arteries before continuing as the descending thoracic aorta.'],
      ['Wall and pressure', 'Elastin-rich media; the **Windkessel** effect stores ~50% of each stroke volume in systole and returns it in diastole, sustaining coronary perfusion. Pressure 120/80 mmHg, mean ~93 mmHg.'],
      ['Clinical', 'Cystic medial degeneration predisposes to aneurysm and to dissection, which is classified as Stanford A (involving the ascending aorta) or B. Coarctation produces upper-limb hypertension with diminished femoral pulses.'],
    ],
  },
  pulmonary_trunk: {
    name: 'Pulmonary trunk', latin: 'Truncus pulmonalis', group: 'vessels', fma: 'FMA8612',
    lede: 'The outflow vessel of the right ventricle, carrying mixed venous blood to both lungs at a fraction of aortic pressure.',
    sections: [
      ['Course', 'Arises from the infundibulum, passes superiorly and to the left, and bifurcates into the right and left pulmonary arteries beneath the aortic arch. It is intrapericardial and lies anterior to the ascending aorta.'],
      ['Wall and pressure', 'Thin-walled and highly distensible, with far less elastin than the aorta. Pressure 25/10 mmHg, mean ≤ 20 mmHg; resistance is roughly one tenth of the systemic circulation.'],
      ['Clinical', 'A saddle embolus lodges at the bifurcation. Chronic pressure overload produces dilatation and, eventually, right ventricular failure — the mechanism of cor pulmonale.'],
    ],
  },
  rpa: {
    name: 'Right pulmonary artery', latin: 'Arteria pulmonalis dextra', group: 'vessels', fma: 'FMA50872',
    lede: 'Longer and wider than its left counterpart, it runs behind the ascending aorta and superior vena cava to reach the right hilum.',
    sections: [
      ['Course', 'Passes horizontally to the right, posterior to the ascending aorta and SVC, anterior to the right main bronchus. Branches follow the bronchial tree, dividing with it.'],
      ['Wall and pressure', 'Same low-pressure profile as the trunk. Hypoxic pulmonary vasoconstriction redistributes flow away from poorly ventilated segments.'],
      ['Clinical', 'Selective obstruction of a lobar branch produces a ventilation–perfusion mismatch with preserved total blood flow — the physiology behind dead-space ventilation in pulmonary embolism.'],
    ],
  },
  lpa: {
    name: 'Left pulmonary artery', latin: 'Arteria pulmonalis sinistra', group: 'vessels', fma: 'FMA50873',
    lede: 'Shorter and more horizontal, crossing anterior to the descending aorta to enter the left hilum.',
    sections: [
      ['Course', 'Runs to the left, anterior to the left main bronchus and descending aorta, suspended by the ligamentum arteriosum between it and the aortic arch.'],
      ['Wall and pressure', 'As the trunk. The left lung receives slightly less flow because of its smaller volume, but the difference is small at rest.'],
      ['Clinical', 'The ligamentum arteriosum is the remnant of the ductus arteriosus; persistence gives a patent ductus with left-to-right shunt and continuous murmur.'],
    ],
  },
  svc: {
    name: 'Superior vena cava', latin: 'Vena cava superior', group: 'vessels', fma: 'FMA4720',
    lede: 'A valve-less conduit for venous return from the head, neck, upper limbs and thorax.',
    sections: [
      ['Course', 'Formed by union of the brachiocephalic veins behind the right first costal cartilage, descends vertically on the right of the ascending aorta and enters the right atrium at the SVC–atrial junction — the landmark of the sinoatrial node.'],
      ['Wall and pressure', 'Thin, distensible, 20 mm in diameter. Pressure 2–8 mmHg; the waveform (a, c, v waves) reflects right atrial events.'],
      ['Clinical', 'The standard route for central venous access. Obstruction — usually malignant — produces SVC syndrome: facial swelling, distended thoracic veins, and a widened mediastinum.'],
    ],
  },
  ivc: {
    name: 'Inferior vena cava', latin: 'Vena cava inferior', group: 'vessels', fma: 'FMA10951',
    lede: 'The largest vein in the body, returning blood from everything below the diaphragm.',
    sections: [
      ['Course', 'Ascends on the right of the vertebral column, receives the hepatic veins, pierces the diaphragm at T8 with the right phrenic nerve, and enters the right atrium posteroinferiorly.'],
      ['Wall and pressure', 'Thin-walled, 25–30 mm, with no valves except the rudimentary Eustachian valve at its atrial orifice. Pressure 2–8 mmHg.'],
      ['Clinical', 'Respiratory variation of IVC diameter is used at the bedside as a crude estimate of right atrial pressure. Filters are placed here when anticoagulation is contraindicated.'],
    ],
  },
  pv_rspv: {
    name: 'Right superior pulmonary vein', latin: 'Vena pulmonalis dextra superior', group: 'vessels', fma: 'FMA49914',
    lede: 'One of four valveless veins draining oxygenated blood from the right upper and middle lobes into the left atrium.',
    sections: [
      ['Course', 'Runs medially from the right hilum, anterior to the right pulmonary artery, and enters the posterior wall of the left atrium.'],
      ['Wall and pressure', 'Thin, with a muscular sleeve that extends 1–2 cm into the atrial wall — the substrate for atrial fibrillation triggers.'],
      ['Clinical', 'Encircling ablation of the vein–atrial junctions is the cornerstone of pulmonary vein isolation. Stenosis is a known complication and causes exertional dyspnoea.'],
    ],
  },
  pv_ripv: {
    name: 'Right inferior pulmonary vein', latin: 'Vena pulmonalis dextra inferior', group: 'vessels', fma: 'FMA49911',
    lede: 'Drains the right lower lobe into the inferior aspect of the left atrial posterior wall.',
    sections: [
      ['Course', 'Ascends medially from the right hilum and enters the left atrium below the superior vein.'],
      ['Wall and pressure', 'As the other pulmonary veins; left atrial pressure is transmitted directly, so the vein dilates with rising atrial pressure.'],
      ['Clinical', 'Often the vein with the largest ostium and a frequent site of arrhythmogenic sleeves; its proximity to the oesophagus matters during ablation.'],
    ],
  },
  pv_lspv: {
    name: 'Left superior pulmonary vein', latin: 'Vena pulmonalis sinistra superior', group: 'vessels', fma: 'FMA49916',
    lede: 'Drains the left upper lobe; its ostium lies close to the left atrial appendage.',
    sections: [
      ['Course', 'Runs medially from the left hilum, anterior to the left main bronchus, and enters the left atrium.'],
      ['Wall and pressure', 'Thin, with the same muscular sleeve as the other veins.'],
      ['Clinical', 'The ridge between this vein and the appendage — the left lateral ridge — is thin and adjacent to the circumflex artery, a hazard in ablation.'],
    ],
  },
  pv_lipv: {
    name: 'Left inferior pulmonary vein', latin: 'Vena pulmonalis sinistra inferior', group: 'vessels', fma: 'FMA49913',
    lede: 'Drains the left lower lobe into the posteroinferior left atrium.',
    sections: [
      ['Course', 'Ascends from the left hilum and enters the left atrium below the superior vein, close to the oesophagus.'],
      ['Wall and pressure', 'Thin-walled and directly exposed to left atrial pressure.'],
      ['Clinical', 'Its close relation to the oesophagus is the anatomical reason for oesophageal temperature monitoring during posterior wall ablation.'],
    ],
  },
  tv: {
    name: 'Tricuspid valve', latin: 'Valva tricuspidalis', group: 'valves', fma: 'FMA7234',
    lede: 'The largest of the four valves, guarding the right atrioventricular junction with three leaflets.',
    sections: [
      ['Apparatus', 'Anterior, posterior and septal leaflets attach to the tricuspid annulus; chordae tendineae from three papillary muscles (anterior, posterior, septal) prevent prolapse. Orifice 4–6 cm².'],
      ['Closure', 'Closes at the onset of ventricular systole, contributing the first heart sound (S1) together with the mitral valve. Closure depends on papillary muscle contraction and on right ventricular geometry, not on leaflet stiffness.'],
      ['Clinical', 'Functional regurgitation is common with right ventricular dilatation and pulmonary hypertension. The septal leaflet’s position on the septum is the anatomical basis for differentiating tricuspid from mitral regurgitation on echo.'],
    ],
  },
  mv: {
    name: 'Mitral valve', latin: 'Valva mitralis', group: 'valves', fma: 'FMA7235',
    lede: 'A two-leaflet valve whose asymmetry — a large anterior leaflet, a short posterior one — defines the left ventricular inflow and outflow boundary.',
    sections: [
      ['Apparatus', 'Anterior and posterior leaflets, a D-shaped annulus, chordae tendineae and two papillary muscles. The anterior leaflet separates inflow from the aortic outflow tract; its aortomitral continuity is the fibrous curtain. Orifice 4–6 cm².'],
      ['Closure', 'Closes at S1. The leaflets coapt along a line, not a point; annular contraction and ventricular pressure hold them shut while the papillary muscles shorten.'],
      ['Clinical', 'Prolapse, rheumatic stenosis, and functional regurgitation from annular dilatation are the three common mechanisms. Systolic anterior motion in hypertrophic cardiomyopathy produces a dynamic outflow gradient.'],
    ],
  },
  av: {
    name: 'Aortic valve', latin: 'Valva aortae', group: 'valves', fma: 'FMA7236',
    lede: 'Three cusps suspended in the aortic root, each backed by a sinus that gives rise to a coronary artery.',
    sections: [
      ['Apparatus', 'Right, left and posterior (non-coronary) cusps; the sinuses of Valsalva above them house the coronary ostia. Orifice 3–4 cm².'],
      ['Closure', 'Closes at end-ejection, producing the second heart sound (S2). Closure is driven by the reverse pressure gradient and by vortices in the sinuses that push the cusps toward the centre.'],
      ['Clinical', 'A bicuspid valve affects 1–2% of the population and predisposes to stenosis and aortopathy. Severe stenosis produces the classic triad of angina, syncope and dyspnoea; valve area below 1 cm² is severe.'],
    ],
  },
  pvv: {
    name: 'Pulmonary valve', latin: 'Valva trunci pulmonalis', group: 'valves', fma: 'FMA7246',
    lede: 'The lowest-pressure valve in the heart, closing at the end of right ventricular ejection.',
    sections: [
      ['Apparatus', 'Three cusps — left anterior, right anterior and posterior — within a thin annulus at the base of the pulmonary trunk. Orifice ~3 cm².'],
      ['Closure', 'Closes at S2, slightly after the aortic valve because right ventricular pressure falls more slowly. The delay is the physiological splitting of the second sound during inspiration.'],
      ['Clinical', 'Stenosis is usually congenital or carcinoid. Regurgitation is well tolerated for decades because of the low-pressure circuit, and is a common residual lesion after repair of tetralogy of Fallot.'],
    ],
  },
  cav_ra: {
    name: 'Right atrial cavity', latin: 'Cavitas atrii dextri', group: 'cavities', fma: 'FMA11359',
    lede: 'The modelled endocardial surface of the right atrium: the space blood actually occupies.',
    sections: [
      ['Surface', 'Smooth posteriorly (sinus venarum), ridged anteriorly by pectinate muscles, with the fossa ovalis as a shallow depression on the septal wall and the appendage as a blind pouch.'],
      ['Volume', '~60–100 mL, varying with respiration and posture. The atrium is a volume sensor as much as a chamber.'],
      ['Relations', 'Opens to the SVC, IVC, coronary sinus and, through the tricuspid valve, to the right ventricle. Its septum carries the triangle of Koch, bounded by the coronary sinus, the tendon of Todaro and the tricuspid annulus.'],
    ],
  },
  cav_rv: {
    name: 'Right ventricular cavity', latin: 'Cavitas ventriculi dextri', group: 'cavities', fma: 'FMA9291',
    lede: 'A crescentic space in cross-section, heavily trabeculated at the inflow and smooth at the outflow.',
    sections: [
      ['Surface', 'Trabeculae carneae with the moderator band spanning the cavity; the infundibulum is smooth and conical, directing flow to the pulmonary valve.'],
      ['Volume', 'End-diastolic ~120–150 mL, end-systolic ~50–70 mL. The right ventricle ejects the same stroke volume as the left with a much thinner wall.'],
      ['Relations', 'Shares the interventricular septum with the left ventricle; septal flattening in systole signals right ventricular pressure overload.'],
    ],
  },
  cav_la: {
    name: 'Left atrial cavity', latin: 'Cavitas atrii sinistri', group: 'cavities', fma: 'FMA9465',
    lede: 'A smooth, thin-walled reservoir receiving the four pulmonary veins.',
    sections: [
      ['Surface', 'Smooth body with four pulmonary vein ostia posteriorly; the appendage is the only trabeculated part, separated by a narrow neck.'],
      ['Volume', '~60–100 mL, indexed to body surface area in clinical practice; >34 mL/m² indicates enlargement.'],
      ['Relations', 'Anterior: aortic root. Posterior: oesophagus and descending aorta. Inferior: mitral annulus. Superior: pulmonary artery bifurcation, which is why the left atrium is the most posterior chamber.'],
    ],
  },
  cav_lv: {
    name: 'Left ventricular cavity', latin: 'Cavitas ventriculi sinistri', group: 'cavities', fma: 'FMA9466',
    lede: 'The conical cavity whose change in volume defines stroke volume and ejection fraction.',
    sections: [
      ['Surface', 'Fine trabeculae at the apex and inflow; the outflow tract is smooth. The anterior mitral leaflet forms the boundary between inflow and outflow.'],
      ['Volume', 'End-diastolic ~110–130 mL; end-systolic ~40–60 mL. Ejection fraction 55–70%.'],
      ['Relations', 'Encircled by the thickest myocardium; the septum is shared with the right ventricle and is perfused by both LAD and septal branches.'],
    ],
  },
  lca: {
    name: 'Left coronary artery', latin: 'Arteria coronaria sinistra', group: 'coronary', fma: 'FMA50040 · FMA3862 · FMA3895',
    lede: 'A short left main trunk that divides into the anterior interventricular and circumflex arteries, supplying most of the left ventricle.',
    sections: [
      ['Territory', 'The anterior interventricular (LAD) branch supplies the anterior septum and apex; the circumflex supplies the lateral and posterior left ventricle. Together they perfuse roughly two thirds of left ventricular mass.'],
      ['Clinical', 'Proximal LAD occlusion is the most lethal single-vessel event because it removes the apex and anterior septum at once. Coronary flow is predominantly diastolic, so tachycardia and diastolic hypertension both change supply.'],
    ],
  },
  rca: {
    name: 'Right coronary artery', latin: 'Arteria coronaria dextra', group: 'coronary', fma: 'FMA50039',
    lede: 'A long artery running in the right atrioventricular groove, supplying the right ventricle and, in most hearts, the inferior wall.',
    sections: [
      ['Territory', 'Right ventricular free wall, inferior left ventricle in right-dominant circulation (about 85% of hearts), and — via its branches — the sinoatrial node in ~60% and the atrioventricular node in ~90%.'],
      ['Clinical', 'Proximal occlusion causes inferior infarction with bradycardia and hypotension out of proportion to the infarct size, because it takes the nodal arteries with it.'],
    ],
  },
  coronary_sinus: {
    name: 'Coronary sinus', latin: 'Sinus coronarius', group: 'coronary', fma: 'FMA4706',
    lede: 'The confluence of the cardiac veins, opening into the right atrium just above the tricuspid annulus.',
    sections: [
      ['Territory', 'Drains the great cardiac vein, the middle cardiac vein and the small cardiac vein — most of the venous return of the left ventricle.'],
      ['Clinical', 'Its ostium is the anatomical anchor for the triangle of Koch and the target for retrograde cardioplegia and for left ventricular pacing leads in cardiac resynchronisation.'],
    ],
  },
  fibrous_skeleton: {
    name: 'Fibrous skeleton', latin: 'Skeleton fibrosum cordis', group: 'conduction', fma: 'FMA9496',
    lede: 'A ring of dense collagen between the atria and ventricles — the reason the heart beats in sequence rather than all at once.',
    sections: [
      ['Function', 'Forms the four valve annuli, anchors the leaflets and myocardium, and acts as an **electrical insulator** between atria and ventricles. The only normal route across it is the bundle of His, which pierces it at the central fibrous body.'],
      ['Clinical', 'This insulation is what creates the physiological AV delay: the atria can finish emptying before the ventricles contract, and the ventricles can fill before the next atrial beat. Accessory pathways that cross the annulus bypass it and cause pre-excitation.'],
    ],
  },
};

export const ORDER = [
  'ra', 'rv', 'la', 'lv', 'aorta', 'pulmonary_trunk', 'rpa', 'lpa', 'svc', 'ivc',
  'pv_rspv', 'pv_ripv', 'pv_lspv', 'pv_lipv', 'tv', 'mv', 'av', 'pvv',
  'cav_ra', 'cav_rv', 'cav_la', 'cav_lv', 'lca', 'rca', 'coronary_sinus', 'fibrous_skeleton',
];

/* ------------------------------------------------------------------ *
 * Rhythm states.
 * Narrow complex = activation through the His–Purkinje system, which the
 * model represents as simultaneous endocardial breakthrough sites.
 * Wide complex  = activation spreading cell-to-cell from a myocardial focus,
 * which the model solves as a geodesic front at 0.7 m/s.
 * ------------------------------------------------------------------ */
export const RHYTHMS = [
  {
    id: 'sinus', name: 'Sinus rhythm', short: 'Sinus', tag: 'Normal',
    hr: 62, copy: {
      mechanism: 'The sinoatrial node depolarises first, the atria follow, and the impulse crosses the fibrous skeleton only at the atrioventricular node. Conduction then reaches both ventricles within ~90 ms through the Purkinje network.',
      visible: 'A P wave precedes every QRS. The atria contract before the ventricles; the ventricles eject after the AV delay set by the node.',
      clinical: 'The reference state. Heart rate 60–100, regular, PR 120–200 ms, QRS < 120 ms.',
    },
  },
  {
    id: 'tachy', name: 'Sinus tachycardia', short: 'Tachycardia', tag: 'Rate',
    hr: 132, copy: {
      mechanism: 'Sympathetic drive raises the slope of the sinoatrial node’s spontaneous depolarisation; the node fires faster and the whole cycle shortens.',
      visible: 'Diastole shortens far more than systole. Filling time falls, the atrial kick becomes more important, and the QT interval shortens.',
      clinical: 'A physiological response to demand, not a rhythm diagnosis. Persistence at rest needs a cause: fever, anaemia, thyrotoxicosis, hypovolaemia, sepsis.',
    },
  },
  {
    id: 'brady', name: 'Sinus bradycardia', short: 'Bradycardia', tag: 'Rate',
    hr: 41, copy: {
      mechanism: 'Reduced sympathetic and increased vagal tone slow the pacemaker. Every part of the cycle lengthens, but diastole lengthens most.',
      visible: 'Long diastolic pauses with normal P–QRS order. Stroke volume rises through increased filling; cardiac output falls only if the rate drops far enough.',
      clinical: 'Normal in trained athletes and during sleep. Pathological when symptomatic, or when caused by drugs, ischaemia or hypothyroidism.',
    },
  },
  {
    id: 'af', name: 'Atrial fibrillation', short: 'AF', tag: 'Arrhythmia',
    hr: 96, irregular: true, noP: true, atrialMotion: 'fibrillatory',
    copy: {
      mechanism: 'Multiple re-entrant wavelets circulate through the atria at 400–600 per minute. The AV node conducts whatever arrives, irregularly, and never in a fixed pattern.',
      visible: 'No P waves; an irregularly irregular ventricular response. The atria stop contributing a coordinated kick, so ventricular filling depends on passive inflow.',
      clinical: 'Stroke volume falls by 15–20% at rest and far more with rapid rates. Stasis in the left atrial appendage is the main source of cardioembolic stroke.',
    },
  },
  {
    id: 'flutter', name: 'Atrial flutter', short: 'Flutter', tag: 'Arrhythmia',
    hr: 148, atrialRate: 296, noP: true, sawtooth: true, avRatio: 2, atrialMotion: 'flutter',
    copy: {
      mechanism: 'A single macro-re-entrant circuit rotates around the tricuspid annulus at ~300 per minute. The AV node blocks every second impulse, so the ventricles receive half.',
      visible: 'Continuous sawtooth atrial activity with a regular ventricular response at half the atrial rate. The flutter waves continue through the whole cycle — the atria never relax.',
      clinical: 'Typical flutter is curable by ablating the cavotricuspid isthmus. Untreated, 2:1 conduction gives a ventricular rate near 150 and can cause tachycardia-mediated cardiomyopathy.',
    },
  },
  {
    id: 'avb1', name: 'First-degree AV block', short: '1° AV block', tag: 'Conduction',
    hr: 58, pr: 320,
    copy: {
      mechanism: 'Conduction through the AV node is slowed but never fails. Every atrial impulse eventually reaches the ventricles.',
      visible: 'A constant, prolonged PR interval with every P wave followed by a QRS. The delay happens in the node, before the His bundle.',
      clinical: 'Usually benign and often incidental. It becomes relevant when it progresses, or when it is caused by drugs that slow nodal conduction.',
    },
  },
  {
    id: 'avb2', name: 'Second-degree AV block, Mobitz I', short: 'Wenckebach', tag: 'Conduction',
    hr: 56, pr: 190, wenckebach: true,
    copy: {
      mechanism: 'Each successive impulse fatigues the AV node a little more, so the PR interval lengthens beat by beat until one impulse is dropped entirely. The node then recovers and the pattern repeats.',
      visible: 'Grouped beating: progressively longer PR, then a non-conducted P wave, then a pause shorter than twice the previous RR.',
      clinical: 'Often nodal and benign, but symptomatic cases or progression to higher-grade block require pacing. The level of block — node versus His — determines the risk.',
    },
  },
  {
    id: 'avb3', name: 'Third-degree AV block', short: 'Complete block', tag: 'Conduction',
    hr: 36, dissociated: true, atrialRate: 78,
    copy: {
      mechanism: 'No atrial impulse crosses the AV junction. Atria and ventricles are driven by independent pacemakers: the sinus node above, an escape focus below.',
      visible: 'P waves and QRS complexes march to different clocks. The escape rhythm is slow and regular, and the ventricles fill for as long as diastole allows.',
      clinical: 'A medical emergency when symptomatic: syncope, hypotension, pulmonary oedema. The escape rhythm’s width predicts how stable the patient will be.',
    },
  },
  {
    id: 'pvc', name: 'Premature ventricular complex', short: 'PVC', tag: 'Ectopy',
    hr: 62, ectopicEvery: 3, focus: 'rv', qrsOverride: 150,
    copy: {
      mechanism: 'A ventricular myocyte depolarises ahead of the next sinus impulse. Because the impulse starts in muscle, it crawls cell to cell instead of using the Purkinje network.',
      visible: 'An early, wide, bizarre QRS with no preceding P wave, followed by a compensatory pause. The activation front is visible as a slow wave crossing the ventricles from the focus.',
      clinical: 'Occasional PVCs are normal. Frequent, multifocal or exercise-induced PVCs, or a reduced ejection fraction, warrant evaluation.',
    },
  },
  {
    id: 'vt', name: 'Ventricular tachycardia', short: 'VT', tag: 'Arrhythmia',
    hr: 168, wide: true, focus: 'lv', noP: true, dissociated: true, atrialRate: 80, qrsOverride: 160,
    copy: {
      mechanism: 'A re-entrant circuit within the ventricular myocardium drives the ventricles at 140–200 per minute, bypassing the normal conduction system entirely.',
      visible: 'Wide, regular complexes with no relationship to atrial activity. Systole dominates the cycle; filling time collapses; the model shows ejection failing to keep up with demand.',
      clinical: 'Sustained VT with haemodynamic compromise is treated as cardiac arrest. This state is included to show the mechanism, not to simulate a clinical event.',
    },
  },
];
