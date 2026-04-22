/**
 * USG Report Findings Templates — structured presets for each scan type.
 *
 * Each template category contains organ/system groups, each with
 * a list of toggleable findings (normal + abnormal variants).
 * Designed to replicate the click-to-insert workflow of Astraia/ViewPoint.
 */

import type { TemplateKey } from './types';

export interface FindingOption {
  /** Short label shown in the UI button */
  label: string;
  /** Full sentence inserted into the report */
  text: string;
  /** Whether this is the default/normal finding for this group */
  isNormal?: boolean;
}

export interface FindingGroup {
  /** Group name (organ/structure) */
  name: string;
  /** Available finding options — first option is typically the normal finding */
  options: FindingOption[];
}

export interface FindingsTemplate {
  key: TemplateKey;
  label: string;
  groups: FindingGroup[];
  /** Auto-impression rules keyed by finding text patterns */
  impressionNotes?: string[];
}

// ─── Obstetric Template ─────────────────────────────────────

const obstetricTemplate: FindingsTemplate = {
  key: 'obstetric',
  label: 'Obstetric',
  groups: [
    {
      name: 'Fetal Number',
      options: [
        { label: 'Singleton', text: 'Single live intrauterine pregnancy.', isNormal: true },
        { label: 'Twins (DCDA)', text: 'Twin intrauterine pregnancy — dichorionic diamniotic (DCDA).' },
        { label: 'Twins (MCDA)', text: 'Twin intrauterine pregnancy — monochorionic diamniotic (MCDA).' },
        { label: 'Twins (MCMA)', text: 'Twin intrauterine pregnancy — monochorionic monoamniotic (MCMA).' },
        { label: 'Triplets', text: 'Triplet intrauterine pregnancy.' },
        { label: 'Missed abortion', text: 'Intrauterine gestational sac with no fetal cardiac activity — missed abortion.' },
        { label: 'Blighted ovum', text: 'Empty gestational sac with no yolk sac or fetal pole — anembryonic pregnancy (blighted ovum).' },
        { label: 'Ectopic suspected', text: 'No intrauterine gestational sac seen. Adnexal mass/free fluid noted. Ectopic pregnancy suspected.' },
        { label: 'Molar pregnancy', text: 'Uterus shows "snowstorm" appearance with no identifiable fetal parts — suggestive of molar pregnancy.' },
      ],
    },
    {
      name: 'Fetal Lie & Presentation',
      options: [
        { label: 'Cephalic', text: 'Fetus is in cephalic presentation with vertex as the presenting part.', isNormal: true },
        { label: 'Breech (frank)', text: 'Fetus is in frank breech presentation (hips flexed, knees extended).' },
        { label: 'Breech (complete)', text: 'Fetus is in complete breech presentation (hips and knees flexed).' },
        { label: 'Breech (footling)', text: 'Fetus is in footling breech presentation (one or both feet presenting).' },
        { label: 'Transverse', text: 'Fetus is in transverse lie.' },
        { label: 'Oblique', text: 'Fetus is in oblique lie.' },
        { label: 'Unstable lie', text: 'Fetal lie is unstable/variable.' },
      ],
    },
    {
      name: 'Fetal Heart',
      options: [
        { label: 'Normal', text: 'Fetal cardiac activity is present and regular.', isNormal: true },
        { label: 'Bradycardia', text: 'Fetal cardiac activity is present with bradycardia (FHR < 110 bpm).' },
        { label: 'Tachycardia', text: 'Fetal cardiac activity is present with tachycardia (FHR > 160 bpm).' },
        { label: 'Irregular', text: 'Fetal cardiac activity is present but irregular rhythm noted.' },
        { label: 'Absent', text: 'No fetal cardiac activity detected.' },
      ],
    },
    {
      name: 'Fetal Movements',
      options: [
        { label: 'Present', text: 'Fetal movements are present.', isNormal: true },
        { label: 'Active', text: 'Fetal movements are active and vigorous.' },
        { label: 'Reduced', text: 'Fetal movements appear reduced.' },
        { label: 'Absent', text: 'No fetal movements observed during the examination.' },
      ],
    },
    {
      name: 'Fetal Tone',
      options: [
        { label: 'Normal', text: 'Fetal tone is normal with active flexion-extension movements of limbs.', isNormal: true },
        { label: 'Reduced', text: 'Fetal tone appears reduced.' },
      ],
    },
    {
      name: 'Placenta',
      options: [
        { label: 'Anterior', text: 'Placenta is anterior, upper segment, grade II maturity. Clear of internal os.', isNormal: true },
        { label: 'Posterior', text: 'Placenta is posterior, upper segment, grade II maturity. Clear of internal os.', isNormal: true },
        { label: 'Fundal', text: 'Placenta is fundal, grade II maturity. Clear of internal os.', isNormal: true },
        { label: 'Lateral (R)', text: 'Placenta is right lateral, upper segment. Clear of internal os.', isNormal: true },
        { label: 'Lateral (L)', text: 'Placenta is left lateral, upper segment. Clear of internal os.', isNormal: true },
        { label: 'Low-lying', text: 'Placenta is low-lying, reaching within 2 cm of the internal os.' },
        { label: 'Marginal previa', text: 'Placenta reaches the margin of the internal os (marginal placenta previa).' },
        { label: 'Partial previa', text: 'Placenta partially covers the internal os (partial placenta previa).' },
        { label: 'Complete previa', text: 'Placenta completely covers the internal os (complete placenta previa).' },
        { label: 'Grade 0', text: 'Placental maturity: Grade 0 (homogeneous, early pregnancy).' },
        { label: 'Grade I', text: 'Placental maturity: Grade I (subtle indentations).' },
        { label: 'Grade III', text: 'Placental maturity: Grade III (mature with calcifications).' },
        { label: 'Retroplacental haematoma', text: 'Hypoechoic/hyperechoic collection noted behind the placenta, suggestive of retroplacental haematoma/abruption.' },
        { label: 'Placental lakes', text: 'Multiple anechoic areas (placental lakes) noted within the placental substance.' },
        { label: 'Abnormal invasion', text: 'Placenta shows loss of retroplacental clear zone with possible myometrial invasion — placenta accreta spectrum suspected.' },
        { label: 'Succenturiate lobe', text: 'Accessory/succenturiate lobe of placenta noted.' },
      ],
    },
    {
      name: 'Amniotic Fluid',
      options: [
        { label: 'Adequate', text: 'Amniotic fluid volume appears adequate.', isNormal: true },
        { label: 'Reduced (mild)', text: 'Amniotic fluid volume appears mildly reduced.' },
        { label: 'Oligohydramnios', text: 'Amniotic fluid volume is significantly reduced (oligohydramnios).' },
        { label: 'Anhydramnios', text: 'Virtually no amniotic fluid visualised (anhydramnios).' },
        { label: 'Mild polyhydramnios', text: 'Amniotic fluid volume appears mildly increased.' },
        { label: 'Polyhydramnios', text: 'Amniotic fluid volume is significantly increased (polyhydramnios).' },
        { label: 'Meconium', text: 'Amniotic fluid shows particulate matter, possibly meconium-stained.' },
      ],
    },
    {
      name: 'Cervix',
      options: [
        { label: 'Normal', text: 'Cervix appears normal in length (>2.5 cm). Internal os is closed.', isNormal: true },
        { label: 'Short (2-2.5 cm)', text: 'Cervical length is mildly shortened (2.0-2.5 cm). No funneling.' },
        { label: 'Short (<2 cm)', text: 'Cervical length is significantly shortened (<2 cm). Risk of preterm delivery.' },
        { label: 'Funneling', text: 'Cervical length is shortened with funneling of the internal os.' },
        { label: 'Dilated', text: 'Cervix appears dilated with bulging membranes.' },
        { label: 'Cerclage in situ', text: 'Cervical cerclage suture noted in situ.' },
      ],
    },
    {
      name: 'Umbilical Cord',
      options: [
        { label: 'Normal', text: 'Umbilical cord shows three vessels (two arteries, one vein).', isNormal: true },
        { label: 'Two-vessel', text: 'Single umbilical artery noted (two-vessel cord).' },
        { label: 'Nuchal cord (single)', text: 'Umbilical cord seen looping once around the fetal neck (single nuchal cord).' },
        { label: 'Nuchal cord (multiple)', text: 'Umbilical cord seen looping multiple times around the fetal neck.' },
        { label: 'Body loop', text: 'Umbilical cord loop noted around the fetal body.' },
        { label: 'Cord prolapse', text: 'Umbilical cord noted below the presenting part.' },
        { label: 'Marginal insertion', text: 'Cord insertion at the placental margin (marginal cord insertion).' },
        { label: 'Velamentous insertion', text: 'Velamentous cord insertion noted (cord inserting into membranes rather than placenta).' },
      ],
    },
    {
      name: 'Fetal Brain',
      options: [
        { label: 'Normal', text: 'Fetal brain appears normal. Falx midline. Cavum septum pellucidum visualised. Ventricles are normal. Cerebellum and cisterna magna are normal.', isNormal: true },
        { label: 'Ventriculomegaly', text: 'Lateral ventricle measures >10 mm (ventriculomegaly). Refer for detailed neurosonogram.' },
        { label: 'Absent CSP', text: 'Cavum septum pellucidum not visualised. Further evaluation needed.' },
        { label: 'Dandy-Walker', text: 'Enlarged cisterna magna with cerebellar vermis defect — Dandy-Walker malformation suspected.' },
        { label: 'Choroid plexus cyst', text: 'Choroid plexus cyst(s) noted. Usually a benign finding; correlate with other markers.' },
        { label: 'Anencephaly', text: 'Absence of fetal cranial vault above the orbits — anencephaly.' },
        { label: 'Encephalocele', text: 'Bony defect with herniation of intracranial contents — encephalocele.' },
      ],
    },
    {
      name: 'Fetal Spine',
      options: [
        { label: 'Normal', text: 'Fetal spine appears intact with normal alignment and overlying soft tissues.', isNormal: true },
        { label: 'Limited view', text: 'Fetal spine partially visualised due to fetal position.' },
        { label: 'Spina bifida', text: 'Open neural tube defect (spina bifida) suspected in the lumbosacral region.' },
        { label: 'Sacrococcygeal mass', text: 'Mass noted in the sacrococcygeal region — sacrococcygeal teratoma suspected.' },
      ],
    },
    {
      name: 'Fetal Face',
      options: [
        { label: 'Normal', text: 'Fetal face and lip appear normal where visualised.', isNormal: true },
        { label: 'Cleft lip', text: 'Defect noted in the upper lip — cleft lip suspected.' },
        { label: 'Cleft palate', text: 'Cleft lip and palate suspected.' },
        { label: 'Micrognathia', text: 'Small mandible noted (micrognathia).' },
        { label: 'Flat profile', text: 'Flat facial profile noted.' },
        { label: 'Not visualised', text: 'Fetal face not adequately visualised due to fetal position.' },
      ],
    },
    {
      name: 'Fetal Heart (structural)',
      options: [
        { label: 'Normal 4-chamber', text: 'Fetal heart shows normal four-chamber view with normal axis.', isNormal: true },
        { label: 'Abnormal axis', text: 'Cardiac axis appears abnormal.' },
        { label: 'VSD suspected', text: 'Ventricular septal defect suspected.' },
        { label: 'Echogenic focus', text: 'Echogenic intracardiac focus (EIF) noted. Usually a benign finding; correlate with other markers.' },
        { label: 'Pericardial effusion', text: 'Fetal pericardial effusion noted.' },
        { label: 'Complex CHD', text: 'Complex congenital heart disease suspected. Fetal echocardiography recommended.' },
        { label: 'Not visualised', text: 'Four-chamber view not adequately visualised.' },
      ],
    },
    {
      name: 'Fetal Thorax / Lungs',
      options: [
        { label: 'Normal', text: 'Fetal lungs appear normal and homogeneous.', isNormal: true },
        { label: 'Pleural effusion', text: 'Fetal pleural effusion noted.' },
        { label: 'CCAM/CPAM', text: 'Cystic/echogenic lesion in the fetal lung — CPAM (congenital pulmonary airway malformation) suspected.' },
        { label: 'CDH', text: 'Abdominal organs noted in the thorax — congenital diaphragmatic hernia suspected.' },
      ],
    },
    {
      name: 'Fetal Abdomen',
      options: [
        { label: 'Normal', text: 'Fetal abdomen appears normal. Stomach bubble and urinary bladder visualised.', isNormal: true },
        { label: 'Absent stomach', text: 'Stomach bubble not visualised. May indicate oesophageal atresia or swallowing disorder.' },
        { label: 'Dilated bowel', text: 'Dilated fetal bowel loops noted — possible bowel obstruction.' },
        { label: 'Echogenic bowel', text: 'Echogenic fetal bowel noted. Correlate with clinical context (may be normal variant, cystic fibrosis, infection, or trisomy).' },
        { label: 'Omphalocele', text: 'Abdominal wall defect at the umbilicus with herniation of abdominal contents into a membrane-covered sac — omphalocele.' },
        { label: 'Gastroschisis', text: 'Right-sided abdominal wall defect with free-floating bowel loops — gastroschisis.' },
        { label: 'Ascites', text: 'Fetal ascites noted.' },
      ],
    },
    {
      name: 'Fetal Kidneys',
      options: [
        { label: 'Normal', text: 'Both fetal kidneys are visualised and appear normal.', isNormal: true },
        { label: 'Pyelectasis', text: 'Mild renal pelvis dilatation (pyelectasis) noted. Follow-up recommended.' },
        { label: 'Hydronephrosis', text: 'Fetal hydronephrosis noted (renal pelvis dilatation with calyceal dilatation).' },
        { label: 'Multicystic dysplastic', text: 'Multiple non-communicating cysts replacing renal parenchyma — multicystic dysplastic kidney.' },
        { label: 'Echogenic kidneys', text: 'Both fetal kidneys appear echogenic. Consider infantile polycystic kidney disease.' },
        { label: 'Absent kidney', text: 'One fetal kidney not visualised — renal agenesis suspected.' },
        { label: 'Bilateral agenesis', text: 'Both fetal kidneys not visualised — bilateral renal agenesis suspected.' },
        { label: 'Distended bladder', text: 'Fetal urinary bladder appears distended — possible posterior urethral valves.' },
      ],
    },
    {
      name: 'Fetal Limbs',
      options: [
        { label: 'Normal', text: 'All four fetal limbs are visualised with normal morphology.', isNormal: true },
        { label: 'Limited view', text: 'Fetal limbs partially visualised due to position.' },
        { label: 'Short limbs', text: 'Fetal limbs appear short for gestational age. Skeletal dysplasia to be considered.' },
        { label: 'Clubfoot', text: 'Fetal foot appears in fixed equinovarus position — clubfoot (talipes) suspected.' },
        { label: 'Missing limb', text: 'Absent/short fetal limb segment noted.' },
        { label: 'Polydactyly', text: 'Extra digit(s) noted (polydactyly).' },
        { label: 'Clenched hands', text: 'Persistent clenched fists noted — may be associated with chromosomal abnormality.' },
      ],
    },
    {
      name: 'Fetal Sex',
      options: [
        { label: 'Not disclosed', text: 'Fetal sex determination not performed as per PCPNDT Act.', isNormal: true },
      ],
    },
    {
      name: 'Fetal Hydrops',
      options: [
        { label: 'None', text: 'No evidence of fetal hydrops.', isNormal: true },
        { label: 'Hydrops', text: 'Features of fetal hydrops: skin oedema, ascites, pleural/pericardial effusion. Urgent evaluation recommended.' },
        { label: 'Skin oedema', text: 'Fetal skin oedema (>5 mm) noted.' },
      ],
    },
    {
      name: 'Fetal Growth',
      options: [
        { label: 'AGA', text: 'Fetal biometry is consistent with dates. Growth appears appropriate for gestational age (AGA).', isNormal: true },
        { label: 'SGA (<10th)', text: 'Fetal biometry is below 10th percentile for gestational age. Small for gestational age (SGA).' },
        { label: 'IUGR suspected', text: 'Fetal biometry is below expected. Findings suggest intrauterine growth restriction (IUGR). Serial monitoring recommended.' },
        { label: 'LGA (>90th)', text: 'Fetal biometry is above 90th percentile for gestational age. Large for gestational age (LGA).' },
        { label: 'Macrosomia', text: 'Estimated fetal weight suggests macrosomia (>4000g). Consider delivery planning.' },
        { label: 'Asymmetric IUGR', text: 'Head-sparing pattern with disproportionately small abdominal circumference — asymmetric IUGR.' },
        { label: 'Symmetric IUGR', text: 'Proportionally small biometry — symmetric IUGR. Consider early-onset cause.' },
      ],
    },
    {
      name: 'Soft Markers',
      options: [
        { label: 'None', text: 'No soft markers for chromosomal anomaly identified.', isNormal: true },
        { label: 'Echogenic bowel', text: 'Echogenic bowel noted — soft marker. Correlate with clinical context.' },
        { label: 'EIF', text: 'Echogenic intracardiac focus noted — usually benign, isolated finding.' },
        { label: 'CPC', text: 'Choroid plexus cyst noted — usually benign, isolated finding.' },
        { label: 'Pyelectasis', text: 'Mild renal pelvis dilatation noted — soft marker if isolated.' },
        { label: 'Short humerus/femur', text: 'Shortened humerus/femur noted — correlate with other markers.' },
        { label: 'Nuchal fold thickening', text: 'Nuchal fold thickness >6 mm in second trimester — increased risk for Down syndrome.' },
        { label: 'Absent nasal bone', text: 'Nasal bone not visualised — may be associated with trisomy 21.' },
        { label: 'Sandal gap', text: 'Wide gap between first and second toes (sandal gap deformity) noted.' },
        { label: 'Single palmar crease', text: 'Single transverse palmar crease (simian crease) noted.' },
      ],
    },
    {
      name: 'NT / First Trimester',
      options: [
        { label: 'Normal NT', text: 'Nuchal translucency measures within normal limits (<3 mm).', isNormal: true },
        { label: 'Increased NT', text: 'Nuchal translucency is increased (≥3 mm). Genetic counselling recommended.' },
        { label: 'Cystic hygroma', text: 'Large septated cystic hygroma noted.' },
        { label: 'Normal nasal bone', text: 'Nasal bone is present.', isNormal: true },
        { label: 'Absent nasal bone', text: 'Nasal bone not visualised.' },
        { label: 'Normal ductus venosus', text: 'Ductus venosus shows normal A-wave.', isNormal: true },
        { label: 'Reversed A-wave', text: 'Ductus venosus shows reversed A-wave.' },
        { label: 'Yolk sac normal', text: 'Yolk sac is present and normal in size.', isNormal: true },
        { label: 'Large yolk sac', text: 'Yolk sac appears enlarged (>6 mm).' },
        { label: 'Subchorionic haematoma', text: 'Subchorionic haematoma noted adjacent to the gestational sac.' },
      ],
    },
  ],
};

// ─── Abdominal Template ─────────────────────────────────────

const abdominalTemplate: FindingsTemplate = {
  key: 'abdominal',
  label: 'Abdominal',
  groups: [
    {
      name: 'Liver',
      options: [
        { label: 'Normal', text: 'Liver is normal in size and echotexture. No focal lesion seen. Hepatic veins and portal vein appear normal.', isNormal: true },
        { label: 'Hepatomegaly', text: 'Liver is enlarged with normal echotexture. No focal lesion identified.' },
        { label: 'Fatty (Grade I)', text: 'Liver shows mildly increased echogenicity suggestive of Grade I fatty infiltration. Diaphragm and intrahepatic vessels are clearly visualised.' },
        { label: 'Fatty (Grade II)', text: 'Liver shows moderately increased echogenicity suggestive of Grade II fatty infiltration. Intrahepatic vessels appear slightly obscured.' },
        { label: 'Fatty (Grade III)', text: 'Liver shows markedly increased echogenicity suggestive of Grade III fatty infiltration. Intrahepatic vessels and diaphragm are poorly visualised.' },
        { label: 'Cirrhotic', text: 'Liver appears coarse and nodular in echotexture, suggestive of cirrhosis. Surface irregularity noted.' },
        { label: 'Hepatitis', text: 'Liver appears diffusely hypoechoic with "starry sky" appearance. Suggestive of acute hepatitis. Gallbladder wall oedema may be noted.' },
        { label: 'Hemangioma', text: 'Well-defined hyperechoic focal lesion noted in the liver, likely hepatic hemangioma.' },
        { label: 'Simple cyst', text: 'Simple anechoic cyst with posterior acoustic enhancement noted in the liver.' },
        { label: 'Abscess', text: 'Ill-defined hypoechoic/complex lesion noted in the liver — liver abscess suspected.' },
        { label: 'SOL / Mass', text: 'Focal solid lesion noted in the liver. Further characterisation with CECT/MRI recommended.' },
        { label: 'Multiple metastases', text: 'Multiple focal lesions of varying echogenicity noted in the liver — likely metastatic disease.' },
        { label: 'Calcification', text: 'Focal calcification(s) noted in the liver with posterior acoustic shadowing.' },
        { label: 'Portal hypertension', text: 'Portal vein is dilated (>13 mm). Findings suggestive of portal hypertension.' },
      ],
    },
    {
      name: 'Gallbladder',
      options: [
        { label: 'Normal', text: 'Gallbladder is well-distended with thin wall. No calculus or polyp seen.', isNormal: true },
        { label: 'Single calculus', text: 'Gallbladder shows a single echogenic focus with posterior acoustic shadowing, suggestive of cholelithiasis.' },
        { label: 'Multiple calculi', text: 'Gallbladder contains multiple echogenic foci with posterior acoustic shadowing, suggestive of cholelithiasis.' },
        { label: 'Sludge', text: 'Gallbladder shows low-level echoes suggestive of sludge.' },
        { label: 'Acute cholecystitis', text: 'Gallbladder is distended with wall thickening (>3 mm), pericholecystic fluid, and positive sonographic Murphy sign — acute cholecystitis.' },
        { label: 'Chronic cholecystitis', text: 'Gallbladder wall is thickened with contracted lumen containing calculi — chronic cholecystitis.' },
        { label: 'Wall thickening', text: 'Gallbladder wall is thickened (>3 mm). Clinical correlation advised.' },
        { label: 'Polyp (single)', text: 'Single non-shadowing echogenic focus attached to gallbladder wall, suggestive of polyp. Size ___ mm.' },
        { label: 'Polyps (multiple)', text: 'Multiple non-shadowing echogenic foci attached to gallbladder wall, suggestive of polypoid lesions.' },
        { label: 'Empyema', text: 'Gallbladder is distended with internal echoes and thickened wall — empyema of gallbladder suspected.' },
        { label: 'Porcelain GB', text: 'Gallbladder wall shows curvilinear calcification (porcelain gallbladder).' },
        { label: 'Post-cholecystectomy', text: 'Gallbladder is surgically absent (post-cholecystectomy status).' },
        { label: 'Contracted', text: 'Gallbladder is contracted/poorly distended. Patient may not be fasting.' },
      ],
    },
    {
      name: 'CBD / Biliary',
      options: [
        { label: 'Normal', text: 'Common bile duct is not dilated (< 6 mm). Intrahepatic biliary radicles are not dilated.', isNormal: true },
        { label: 'Dilated CBD', text: 'Common bile duct is dilated (>6 mm). No cause identified on ultrasound.' },
        { label: 'CBD calculus', text: 'Echogenic focus with shadow noted in the CBD — choledocholithiasis.' },
        { label: 'IHBRD', text: 'Intrahepatic biliary radicles are dilated. Cause to be evaluated with MRCP.' },
        { label: 'Dilated CBD + IHBRD', text: 'Common bile duct is dilated with dilated intrahepatic biliary radicles — obstructive biliary pathology suspected.' },
        { label: 'Post-cholecystectomy dilated', text: 'Common bile duct is mildly dilated (may be normal post-cholecystectomy, up to 10 mm).' },
        { label: 'Choledochal cyst', text: 'Cystic dilatation of the common bile duct — choledochal cyst suspected.' },
      ],
    },
    {
      name: 'Pancreas',
      options: [
        { label: 'Normal', text: 'Pancreas is normal in size and echotexture where visualised.', isNormal: true },
        { label: 'Not visualised', text: 'Pancreas is obscured by bowel gas and not adequately visualised.' },
        { label: 'Acute pancreatitis', text: 'Pancreas appears bulky and hypoechoic with peripancreatic fluid — acute pancreatitis.' },
        { label: 'Chronic pancreatitis', text: 'Pancreas appears atrophic with calcifications and dilated pancreatic duct — chronic pancreatitis.' },
        { label: 'Pancreatic calcification', text: 'Calcifications noted in the pancreas.' },
        { label: 'Dilated PD', text: 'Main pancreatic duct appears dilated (>3 mm).' },
        { label: 'Pseudocyst', text: 'Well-defined anechoic collection noted adjacent to the pancreas — pancreatic pseudocyst.' },
        { label: 'Mass / SOL', text: 'Focal hypoechoic mass noted in the head/body/tail of pancreas. CECT recommended for characterisation.' },
        { label: 'Fatty pancreas', text: 'Pancreas shows increased echogenicity suggestive of fatty infiltration.' },
      ],
    },
    {
      name: 'Spleen',
      options: [
        { label: 'Normal', text: 'Spleen is normal in size and echotexture. No focal lesion seen.', isNormal: true },
        { label: 'Mild splenomegaly', text: 'Spleen is mildly enlarged (13-15 cm). No focal lesion identified.' },
        { label: 'Splenomegaly', text: 'Spleen is significantly enlarged (>15 cm). No focal lesion identified.' },
        { label: 'Focal lesion', text: 'Focal lesion noted in the spleen. Further evaluation recommended.' },
        { label: 'Splenic cyst', text: 'Simple cyst noted in the spleen.' },
        { label: 'Calcification', text: 'Focal calcification(s) noted in the spleen.' },
        { label: 'Accessory spleen', text: 'Accessory splenunculus noted near the splenic hilum.' },
        { label: 'Splenectomy', text: 'Spleen is surgically absent (post-splenectomy).' },
      ],
    },
    {
      name: 'Right Kidney',
      options: [
        { label: 'Normal', text: 'Right kidney is normal in size, shape, and echotexture. No calculus, hydronephrosis, or focal lesion. Corticomedullary differentiation is maintained.', isNormal: true },
        { label: 'Calculus (single)', text: 'Right kidney shows a single echogenic focus with posterior acoustic shadowing, suggestive of renal calculus.' },
        { label: 'Calculi (multiple)', text: 'Right kidney shows multiple echogenic foci with posterior acoustic shadowing, suggestive of multiple renal calculi.' },
        { label: 'Staghorn calculus', text: 'Right kidney shows a large echogenic calculus occupying the renal pelvis (staghorn calculus).' },
        { label: 'Hydronephrosis (mild)', text: 'Right kidney shows mild dilatation of the pelvicalyceal system (Grade I hydronephrosis).' },
        { label: 'Hydronephrosis (moderate)', text: 'Right kidney shows moderate dilatation of the pelvicalyceal system (Grade II hydronephrosis) with parenchymal thinning.' },
        { label: 'Hydronephrosis (severe)', text: 'Right kidney shows severe dilatation of the pelvicalyceal system (Grade III/IV hydronephrosis) with significant parenchymal thinning.' },
        { label: 'Calculus + HDN', text: 'Right kidney shows renal calculus with upstream hydronephrosis — obstructive uropathy.' },
        { label: 'Simple cyst', text: 'Simple cortical cyst noted in the right kidney.' },
        { label: 'Complex cyst', text: 'Complex cyst noted in the right kidney. Bosniak classification and further evaluation recommended.' },
        { label: 'Renal mass', text: 'Solid mass noted in the right kidney. CECT recommended for characterisation.' },
        { label: 'Medical renal disease', text: 'Right kidney shows increased echogenicity with poor corticomedullary differentiation — medical renal disease/CKD.' },
        { label: 'Small/contracted', text: 'Right kidney is small in size with increased echogenicity — chronic kidney disease.' },
        { label: 'Absent', text: 'Right kidney is not visualised in the renal fossa — absent/ectopic kidney.' },
        { label: 'Ectopic (pelvic)', text: 'Right kidney is in ectopic pelvic position.' },
        { label: 'Duplex system', text: 'Right kidney shows duplex collecting system.' },
        { label: 'Perinephric collection', text: 'Perinephric fluid collection noted around the right kidney.' },
        { label: 'Renal parenchymal disease', text: 'Right kidney shows raised cortical echogenicity — Grade I/II renal parenchymal disease.' },
      ],
    },
    {
      name: 'Left Kidney',
      options: [
        { label: 'Normal', text: 'Left kidney is normal in size, shape, and echotexture. No calculus, hydronephrosis, or focal lesion. Corticomedullary differentiation is maintained.', isNormal: true },
        { label: 'Calculus (single)', text: 'Left kidney shows a single echogenic focus with posterior acoustic shadowing, suggestive of renal calculus.' },
        { label: 'Calculi (multiple)', text: 'Left kidney shows multiple echogenic foci with posterior acoustic shadowing, suggestive of multiple renal calculi.' },
        { label: 'Staghorn calculus', text: 'Left kidney shows a large echogenic calculus occupying the renal pelvis (staghorn calculus).' },
        { label: 'Hydronephrosis (mild)', text: 'Left kidney shows mild dilatation of the pelvicalyceal system (Grade I hydronephrosis).' },
        { label: 'Hydronephrosis (moderate)', text: 'Left kidney shows moderate dilatation of the pelvicalyceal system (Grade II hydronephrosis) with parenchymal thinning.' },
        { label: 'Hydronephrosis (severe)', text: 'Left kidney shows severe dilatation of the pelvicalyceal system (Grade III/IV hydronephrosis) with significant parenchymal thinning.' },
        { label: 'Calculus + HDN', text: 'Left kidney shows renal calculus with upstream hydronephrosis — obstructive uropathy.' },
        { label: 'Simple cyst', text: 'Simple cortical cyst noted in the left kidney.' },
        { label: 'Complex cyst', text: 'Complex cyst noted in the left kidney. Bosniak classification and further evaluation recommended.' },
        { label: 'Renal mass', text: 'Solid mass noted in the left kidney. CECT recommended for characterisation.' },
        { label: 'Medical renal disease', text: 'Left kidney shows increased echogenicity with poor corticomedullary differentiation — medical renal disease/CKD.' },
        { label: 'Small/contracted', text: 'Left kidney is small in size with increased echogenicity — chronic kidney disease.' },
        { label: 'Absent', text: 'Left kidney is not visualised in the renal fossa — absent/ectopic kidney.' },
        { label: 'Ectopic (pelvic)', text: 'Left kidney is in ectopic pelvic position.' },
        { label: 'Duplex system', text: 'Left kidney shows duplex collecting system.' },
        { label: 'Perinephric collection', text: 'Perinephric fluid collection noted around the left kidney.' },
        { label: 'Renal parenchymal disease', text: 'Left kidney shows raised cortical echogenicity — Grade I/II renal parenchymal disease.' },
      ],
    },
    {
      name: 'Ureters',
      options: [
        { label: 'Normal', text: 'Ureters are not dilated.', isNormal: true },
        { label: 'Right hydroureter', text: 'Right ureter is dilated (hydroureter). Distal cause to be evaluated.' },
        { label: 'Left hydroureter', text: 'Left ureter is dilated (hydroureter). Distal cause to be evaluated.' },
        { label: 'Bilateral hydroureter', text: 'Bilateral hydroureter noted.' },
        { label: 'VUJ calculus (R)', text: 'Echogenic focus noted at the right vesicoureteric junction — VUJ calculus.' },
        { label: 'VUJ calculus (L)', text: 'Echogenic focus noted at the left vesicoureteric junction — VUJ calculus.' },
        { label: 'Ureteric calculus (R)', text: 'Echogenic focus with shadow noted in the right ureter — ureteric calculus.' },
        { label: 'Ureteric calculus (L)', text: 'Echogenic focus with shadow noted in the left ureter — ureteric calculus.' },
      ],
    },
    {
      name: 'Urinary Bladder',
      options: [
        { label: 'Normal', text: 'Urinary bladder is well-distended with smooth wall. No calculus or mass seen.', isNormal: true },
        { label: 'Thickened wall', text: 'Urinary bladder wall appears diffusely thickened, suggestive of cystitis/trabeculation.' },
        { label: 'Trabeculated', text: 'Urinary bladder wall is trabeculated — suggestive of chronic outlet obstruction.' },
        { label: 'Calculus', text: 'Echogenic focus with posterior shadow seen in the bladder lumen, suggestive of vesical calculus.' },
        { label: 'Mass / Growth', text: 'Irregular solid mass noted arising from the bladder wall. Cystoscopy and biopsy recommended.' },
        { label: 'Diverticulum', text: 'Bladder diverticulum noted.' },
        { label: 'Foley catheter', text: 'Foley catheter balloon noted in the bladder.' },
        { label: 'Residual urine', text: 'Post-void residual urine is increased.' },
        { label: 'Poorly distended', text: 'Urinary bladder is poorly distended. Adequate assessment not possible. Repeat scan with full bladder advised.' },
      ],
    },
    {
      name: 'Prostate (male)',
      options: [
        { label: 'Normal', text: 'Prostate gland is normal in size and echotexture. No focal lesion seen.', isNormal: true },
        { label: 'BPH (mild)', text: 'Prostate gland is mildly enlarged (25-40 gm) — benign prostatic hyperplasia.' },
        { label: 'BPH (moderate)', text: 'Prostate gland is moderately enlarged (40-60 gm) — benign prostatic hyperplasia.' },
        { label: 'BPH (severe)', text: 'Prostate gland is significantly enlarged (>60 gm) — benign prostatic hyperplasia.' },
        { label: 'Median lobe', text: 'Median lobe of prostate is prominent, projecting into the bladder base.' },
        { label: 'Calcification', text: 'Prostatic calcification(s) noted.' },
        { label: 'Prostatic cyst', text: 'Small cyst noted in the prostate gland.' },
      ],
    },
    {
      name: 'Aorta / IVC',
      options: [
        { label: 'Normal', text: 'Aorta and IVC appear normal in calibre.', isNormal: true },
        { label: 'AAA (<5 cm)', text: 'Abdominal aorta is dilated (3-5 cm) — small abdominal aortic aneurysm. Surveillance recommended.' },
        { label: 'AAA (>5 cm)', text: 'Abdominal aorta is dilated (>5 cm) — large abdominal aortic aneurysm. Surgical consultation recommended.' },
        { label: 'Aortic thrombus', text: 'Mural thrombus noted within the aorta.' },
        { label: 'Atherosclerotic', text: 'Aorta shows atherosclerotic calcification.' },
        { label: 'IVC dilated', text: 'IVC appears dilated with reduced respiratory variation — suggestive of raised right atrial pressure.' },
        { label: 'IVC thrombus', text: 'Echogenic material noted within the IVC — IVC thrombus suspected.' },
      ],
    },
    {
      name: 'Bowel / Appendix',
      options: [
        { label: 'Normal', text: 'Visualised bowel loops appear normal. No free fluid.', isNormal: true },
        { label: 'Dilated loops', text: 'Dilated bowel loops noted with increased peristalsis — possible intestinal obstruction.' },
        { label: 'Paralytic ileus', text: 'Dilated bowel loops with reduced/absent peristalsis — paralytic ileus.' },
        { label: 'Appendicitis', text: 'Non-compressible tubular structure in the RIF with diameter >6 mm and periappendiceal inflammation — acute appendicitis.' },
        { label: 'Appendicular lump', text: 'Ill-defined mass with mixed echogenicity noted in the RIF — appendicular lump/abscess.' },
        { label: 'Intussusception', text: 'Target/doughnut sign noted in the bowel — intussusception suspected.' },
        { label: 'Mesenteric LN', text: 'Enlarged mesenteric lymph nodes noted — mesenteric lymphadenitis.' },
        { label: 'Bowel wall thickening', text: 'Bowel wall thickening noted. Clinical correlation advised.' },
      ],
    },
    {
      name: 'Retroperitoneum',
      options: [
        { label: 'Normal', text: 'No retroperitoneal lymphadenopathy or mass lesion identified.', isNormal: true },
        { label: 'Lymphadenopathy', text: 'Enlarged retroperitoneal lymph nodes noted. Further evaluation with CECT recommended.' },
        { label: 'Retroperitoneal mass', text: 'Mass noted in the retroperitoneum. CECT/MRI recommended.' },
        { label: 'Retroperitoneal collection', text: 'Fluid collection noted in the retroperitoneum.' },
        { label: 'Psoas abscess', text: 'Collection noted in the psoas muscle — psoas abscess suspected.' },
      ],
    },
    {
      name: 'Adrenal Glands',
      options: [
        { label: 'Normal', text: 'Both adrenal glands appear normal where visualised.', isNormal: true },
        { label: 'Right adrenal mass', text: 'Mass noted in the right adrenal gland. Further evaluation recommended.' },
        { label: 'Left adrenal mass', text: 'Mass noted in the left adrenal gland. Further evaluation recommended.' },
        { label: 'Adrenal calcification', text: 'Calcification noted in the adrenal gland.' },
      ],
    },
    {
      name: 'Free Fluid',
      options: [
        { label: 'None', text: 'No free fluid seen in the peritoneal cavity.', isNormal: true },
        { label: 'Trace', text: 'Trace free fluid noted in the pelvis.' },
        { label: 'Mild ascites', text: 'Mild free fluid noted in the pelvis/Morrison\'s pouch.' },
        { label: 'Moderate ascites', text: 'Moderate ascites noted in the peritoneal cavity.' },
        { label: 'Gross ascites', text: 'Gross ascites with fluid in all quadrants and interloop fluid.' },
        { label: 'Loculated', text: 'Loculated fluid collection noted. Consider guided aspiration.' },
        { label: 'Echogenic fluid', text: 'Echogenic/complex free fluid noted — may indicate haemorrhage, infection, or malignancy.' },
      ],
    },
    {
      name: 'Abdominal Wall',
      options: [
        { label: 'Normal', text: 'Anterior abdominal wall appears normal.', isNormal: true },
        { label: 'Umbilical hernia', text: 'Defect noted in the linea alba with herniation of omental fat/bowel — umbilical hernia.' },
        { label: 'Incisional hernia', text: 'Abdominal wall defect at previous surgical scar site — incisional hernia.' },
        { label: 'Inguinal hernia (R)', text: 'Right inguinal hernia noted.' },
        { label: 'Inguinal hernia (L)', text: 'Left inguinal hernia noted.' },
        { label: 'Abdominal wall collection', text: 'Collection noted in the abdominal wall — seroma/haematoma.' },
        { label: 'Rectus diastasis', text: 'Divarication of recti noted.' },
      ],
    },
  ],
};

// ─── Pelvic Template ────────────────────────────────────────

const pelvicTemplate: FindingsTemplate = {
  key: 'pelvic',
  label: 'Pelvic',
  groups: [
    {
      name: 'Uterus',
      options: [
        { label: 'Normal (AV)', text: 'Uterus is anteverted, normal in size and echotexture. Endometrium is normal in thickness. No focal myometrial lesion seen.', isNormal: true },
        { label: 'Normal (RV)', text: 'Uterus is retroverted, normal in size and echotexture. Endometrium is normal in thickness.', isNormal: true },
        { label: 'Bulky', text: 'Uterus is bulky. Endometrium appears normal. No focal lesion seen.' },
        { label: 'Fibroid (single)', text: 'Well-defined hypoechoic lesion noted in the myometrium, suggestive of fibroid (leiomyoma). Size ___ mm.' },
        { label: 'Fibroid (multiple)', text: 'Multiple well-defined hypoechoic lesions noted in the myometrium, suggestive of multiple fibroids (uterine leiomyomas).' },
        { label: 'Fibroid (submucosal)', text: 'Submucosal fibroid noted, distorting the endometrial cavity.' },
        { label: 'Fibroid (subserosal)', text: 'Subserosal fibroid noted projecting from the uterine surface.' },
        { label: 'Fibroid (pedunculated)', text: 'Pedunculated fibroid noted.' },
        { label: 'Fibroid (calcified)', text: 'Calcified fibroid noted with posterior acoustic shadowing.' },
        { label: 'Fibroid (degenerating)', text: 'Fibroid with heterogeneous echogenicity and cystic areas — degenerative changes.' },
        { label: 'Adenomyosis', text: 'Uterus is bulky and globular with heterogeneous myometrial echotexture. Subendometrial cysts/thickening noted — adenomyosis.' },
        { label: 'Thickened endometrium', text: 'Endometrial thickness is increased. Correlation with clinical history and hormonal status advised.' },
        { label: 'Thin endometrium', text: 'Endometrium is thin and atrophic.' },
        { label: 'Endometrial polyp', text: 'Focal echogenic lesion noted in the endometrial cavity — endometrial polyp suspected.' },
        { label: 'Fluid in cavity', text: 'Fluid collection noted within the endometrial cavity.' },
        { label: 'IUD in situ', text: 'Intrauterine contraceptive device (IUD) noted in situ in the endometrial cavity.' },
        { label: 'IUD displaced', text: 'IUD appears displaced from the endometrial cavity.' },
        { label: 'Post-hysterectomy', text: 'Uterus is surgically absent (post-hysterectomy). Vaginal cuff appears normal.' },
        { label: 'Nabothian cyst', text: 'Nabothian cyst(s) noted in the cervix — benign.' },
        { label: 'Cervical mass', text: 'Mass lesion noted in the cervix. Further evaluation needed.' },
        { label: 'Endometrial mass', text: 'Mass lesion noted in the endometrial cavity. Suspicious for endometrial pathology. Biopsy recommended.' },
        { label: 'Hematometra', text: 'Uterine cavity is distended with echogenic fluid — hematometra/pyometra.' },
      ],
    },
    {
      name: 'Right Ovary',
      options: [
        { label: 'Normal', text: 'Right ovary is normal in size with normal follicular pattern.', isNormal: true },
        { label: 'Simple cyst', text: 'Right ovary shows a simple anechoic cyst.' },
        { label: 'Functional cyst', text: 'Right ovary shows a thin-walled cyst — likely functional (follicular/corpus luteum) cyst. Follow-up post-menses advised.' },
        { label: 'Haemorrhagic cyst', text: 'Right ovary shows a cyst with internal echoes/reticular pattern — likely haemorrhagic cyst.' },
        { label: 'Complex cyst', text: 'Right ovary shows a complex cyst with internal echoes/septations/solid component.' },
        { label: 'Dermoid', text: 'Right ovary shows a cyst with echogenic component (fat/calcification/hair) — mature cystic teratoma (dermoid) suspected.' },
        { label: 'Endometrioma', text: 'Right ovary shows a cyst with homogeneous low-level internal echoes (ground glass appearance) — endometrioma (chocolate cyst) suspected.' },
        { label: 'PCOS pattern', text: 'Right ovary is enlarged with multiple peripheral follicles (≥12 follicles, 2-9 mm) — polycystic morphology.' },
        { label: 'Dominant follicle', text: 'Right ovary shows a dominant follicle measuring ___ mm.' },
        { label: 'Corpus luteum', text: 'Right ovary shows a corpus luteum with peripheral vascularity (ring of fire).' },
        { label: 'Torsion', text: 'Right ovary appears enlarged and oedematous with reduced/absent blood flow — ovarian torsion suspected.' },
        { label: 'Solid mass', text: 'Right ovary shows a solid mass. Malignancy cannot be excluded. Further evaluation recommended.' },
        { label: 'Not visualised', text: 'Right ovary is not separately visualised.' },
        { label: 'Atrophic', text: 'Right ovary appears small/atrophic — postmenopausal changes.' },
      ],
    },
    {
      name: 'Left Ovary',
      options: [
        { label: 'Normal', text: 'Left ovary is normal in size with normal follicular pattern.', isNormal: true },
        { label: 'Simple cyst', text: 'Left ovary shows a simple anechoic cyst.' },
        { label: 'Functional cyst', text: 'Left ovary shows a thin-walled cyst — likely functional (follicular/corpus luteum) cyst. Follow-up post-menses advised.' },
        { label: 'Haemorrhagic cyst', text: 'Left ovary shows a cyst with internal echoes/reticular pattern — likely haemorrhagic cyst.' },
        { label: 'Complex cyst', text: 'Left ovary shows a complex cyst with internal echoes/septations/solid component.' },
        { label: 'Dermoid', text: 'Left ovary shows a cyst with echogenic component (fat/calcification/hair) — mature cystic teratoma (dermoid) suspected.' },
        { label: 'Endometrioma', text: 'Left ovary shows a cyst with homogeneous low-level internal echoes (ground glass appearance) — endometrioma (chocolate cyst) suspected.' },
        { label: 'PCOS pattern', text: 'Left ovary is enlarged with multiple peripheral follicles (≥12 follicles, 2-9 mm) — polycystic morphology.' },
        { label: 'Dominant follicle', text: 'Left ovary shows a dominant follicle measuring ___ mm.' },
        { label: 'Corpus luteum', text: 'Left ovary shows a corpus luteum with peripheral vascularity (ring of fire).' },
        { label: 'Torsion', text: 'Left ovary appears enlarged and oedematous with reduced/absent blood flow — ovarian torsion suspected.' },
        { label: 'Solid mass', text: 'Left ovary shows a solid mass. Malignancy cannot be excluded. Further evaluation recommended.' },
        { label: 'Not visualised', text: 'Left ovary is not separately visualised.' },
        { label: 'Atrophic', text: 'Left ovary appears small/atrophic — postmenopausal changes.' },
      ],
    },
    {
      name: 'Adnexa',
      options: [
        { label: 'Normal', text: 'Both adnexal regions appear normal. No mass or free fluid.', isNormal: true },
        { label: 'Right adnexal mass', text: 'Mass noted in the right adnexal region. Origin to be determined — ovarian vs tubal vs paraovarian.' },
        { label: 'Left adnexal mass', text: 'Mass noted in the left adnexal region. Origin to be determined — ovarian vs tubal vs paraovarian.' },
        { label: 'Hydrosalpinx (R)', text: 'Tubular fluid-filled structure noted in the right adnexa — hydrosalpinx.' },
        { label: 'Hydrosalpinx (L)', text: 'Tubular fluid-filled structure noted in the left adnexa — hydrosalpinx.' },
        { label: 'Ectopic (R)', text: 'Complex mass/ring-of-fire sign in the right adnexa — ectopic pregnancy suspected.' },
        { label: 'Ectopic (L)', text: 'Complex mass/ring-of-fire sign in the left adnexa — ectopic pregnancy suspected.' },
        { label: 'Paraovarian cyst (R)', text: 'Paraovarian cyst noted on the right side, separate from the ovary.' },
        { label: 'Paraovarian cyst (L)', text: 'Paraovarian cyst noted on the left side, separate from the ovary.' },
        { label: 'TOA (R)', text: 'Complex mass with internal echoes in the right adnexa — tubo-ovarian abscess suspected.' },
        { label: 'TOA (L)', text: 'Complex mass with internal echoes in the left adnexa — tubo-ovarian abscess suspected.' },
      ],
    },
    {
      name: 'Pouch of Douglas',
      options: [
        { label: 'No fluid', text: 'No free fluid in the pouch of Douglas.', isNormal: true },
        { label: 'Minimal fluid', text: 'Minimal free fluid noted in the pouch of Douglas — may be physiological.' },
        { label: 'Moderate fluid', text: 'Moderate free fluid noted in the pouch of Douglas.' },
        { label: 'Echogenic fluid', text: 'Echogenic free fluid noted in the pouch of Douglas — haemoperitoneum suspected.' },
        { label: 'Collection', text: 'Loculated collection noted in the pouch of Douglas — abscess/haematocele.' },
      ],
    },
    {
      name: 'Cervix',
      options: [
        { label: 'Normal', text: 'Cervix appears normal.', isNormal: true },
        { label: 'Nabothian cysts', text: 'Nabothian cyst(s) noted in the cervix — benign.' },
        { label: 'Cervical mass', text: 'Mass/thickening noted in the cervix. Further evaluation recommended.' },
        { label: 'Cervical polyp', text: 'Polypoid lesion in the endocervical canal — cervical polyp.' },
        { label: 'Cervical stenosis', text: 'Cervical canal appears stenosed with fluid collection above.' },
      ],
    },
    {
      name: 'Follicular Study',
      options: [
        { label: 'No dominant follicle', text: 'No dominant follicle seen in either ovary.', isNormal: true },
        { label: 'Dominant follicle (R)', text: 'Dominant follicle measuring ___ mm in the right ovary.' },
        { label: 'Dominant follicle (L)', text: 'Dominant follicle measuring ___ mm in the left ovary.' },
        { label: 'Pre-ovulatory', text: 'Pre-ovulatory follicle noted measuring ___ mm. Ovulation expected within 24-36 hours.' },
        { label: 'Post-ovulatory', text: 'Collapsed follicle/corpus luteum noted. Free fluid in POD — suggestive of recent ovulation.' },
        { label: 'Hemorrhagic follicle', text: 'Follicle with internal echoes noted — haemorrhagic follicle.' },
        { label: 'Endometrium (proliferative)', text: 'Endometrium appears trilaminar (proliferative phase). Thickness ___ mm.' },
        { label: 'Endometrium (secretory)', text: 'Endometrium appears echogenic (secretory phase). Thickness ___ mm.' },
        { label: 'Multiple follicles', text: 'Multiple developing follicles noted — correlate with stimulation protocol.' },
        { label: 'OHSS features', text: 'Enlarged ovaries with multiple cysts and free fluid — ovarian hyperstimulation syndrome (OHSS) features.' },
      ],
    },
    {
      name: 'Prostate (male)',
      options: [
        { label: 'Normal', text: 'Prostate gland is normal in size and echotexture.', isNormal: true },
        { label: 'Enlarged (BPH)', text: 'Prostate gland is enlarged (BPH). No focal lesion seen.' },
        { label: 'Median lobe', text: 'Prominent median lobe projecting into the bladder base.' },
        { label: 'Calcification', text: 'Prostatic calcification(s) noted.' },
        { label: 'Hypoechoic lesion', text: 'Focal hypoechoic lesion in the peripheral zone — suspicious. TRUS/MRI and biopsy recommended.' },
        { label: 'Prostatic abscess', text: 'Hypoechoic/complex collection in the prostate — prostatic abscess.' },
        { label: 'Seminal vesicle normal', text: 'Seminal vesicles appear normal.', isNormal: true },
        { label: 'Seminal vesicle dilated', text: 'Seminal vesicle(s) appear dilated.' },
      ],
    },
  ],
};

// ─── Vascular Template ──────────────────────────────────────

const vascularTemplate: FindingsTemplate = {
  key: 'vascular',
  label: 'Vascular Doppler',
  groups: [
    {
      name: 'Carotid Arteries',
      options: [
        { label: 'Normal', text: 'Bilateral common carotid, internal carotid, and external carotid arteries show normal flow pattern with no evidence of stenosis or plaque.', isNormal: true },
        { label: 'IMT increased', text: 'Intima-media thickness is increased bilaterally — early atherosclerotic changes.' },
        { label: 'Mild plaque (R)', text: 'Mild intimal thickening/plaque noted in the right ICA/CCA without significant stenosis (<50%).' },
        { label: 'Mild plaque (L)', text: 'Mild intimal thickening/plaque noted in the left ICA/CCA without significant stenosis (<50%).' },
        { label: 'Mild plaque (bilateral)', text: 'Bilateral mild intimal thickening/plaques without significant stenosis (<50%).' },
        { label: 'Moderate stenosis (R)', text: 'Moderate stenosis (50-69%) noted in the right ICA with elevated PSV.' },
        { label: 'Moderate stenosis (L)', text: 'Moderate stenosis (50-69%) noted in the left ICA with elevated PSV.' },
        { label: 'Severe stenosis (R)', text: 'Severe stenosis (≥70%) noted in the right ICA with markedly elevated PSV.' },
        { label: 'Severe stenosis (L)', text: 'Severe stenosis (≥70%) noted in the left ICA with markedly elevated PSV.' },
        { label: 'Near-occlusion (R)', text: 'Near-total occlusion of the right ICA — trickle flow noted.' },
        { label: 'Near-occlusion (L)', text: 'Near-total occlusion of the left ICA — trickle flow noted.' },
        { label: 'Complete occlusion (R)', text: 'Complete occlusion of the right ICA — no flow detected.' },
        { label: 'Complete occlusion (L)', text: 'Complete occlusion of the left ICA — no flow detected.' },
        { label: 'Calcified plaque', text: 'Calcified plaque noted with acoustic shadowing.' },
        { label: 'Soft plaque', text: 'Soft/echolucent plaque noted — potentially unstable.' },
        { label: 'Ulcerated plaque', text: 'Ulcerated plaque noted — increased risk of embolism.' },
        { label: 'Vertebral normal', text: 'Both vertebral arteries show normal antegrade flow.', isNormal: true },
        { label: 'Vertebral reversed', text: 'Reversed flow in the vertebral artery — subclavian steal phenomenon.' },
        { label: 'Vertebral hypoplastic', text: 'Vertebral artery appears hypoplastic with reduced calibre and flow velocity.' },
        { label: 'CCA dissection', text: 'Findings suggestive of carotid artery dissection — intimal flap/mural haematoma.' },
        { label: 'Carotid body tumour', text: 'Hypervascular mass at the carotid bifurcation splaying ICA and ECA — carotid body tumour suspected.' },
      ],
    },
    {
      name: 'Lower Limb Arteries',
      options: [
        { label: 'Normal', text: 'Bilateral lower limb arterial system shows normal triphasic waveform with no evidence of stenosis or occlusion.', isNormal: true },
        { label: 'Biphasic flow', text: 'Biphasic waveform noted — may indicate mild proximal disease.' },
        { label: 'Monophasic flow', text: 'Monophasic flow pattern noted, suggestive of proximal/distal arterial disease.' },
        { label: 'Stenosis (R)', text: 'Focal area of stenosis noted in the right lower limb arterial system with elevated peak systolic velocity.' },
        { label: 'Stenosis (L)', text: 'Focal area of stenosis noted in the left lower limb arterial system with elevated peak systolic velocity.' },
        { label: 'Occlusion (R)', text: 'No flow detected in a segment of the right lower limb arterial system, suggestive of arterial occlusion.' },
        { label: 'Occlusion (L)', text: 'No flow detected in a segment of the left lower limb arterial system, suggestive of arterial occlusion.' },
        { label: 'Aneurysm (popliteal)', text: 'Popliteal artery aneurysm noted.' },
        { label: 'Aneurysm (femoral)', text: 'Femoral artery aneurysm noted.' },
        { label: 'Pseudoaneurysm', text: 'Pseudoaneurysm with "yin-yang" flow pattern noted.' },
        { label: 'Post-bypass graft', text: 'Bypass graft is patent with normal flow velocities.' },
        { label: 'Graft stenosis', text: 'Focal stenosis noted in the bypass graft with elevated PSV.' },
        { label: 'Post-stent', text: 'Stent is in situ with patent lumen and normal flow.' },
        { label: 'Reduced ABI', text: 'Reduced ankle-brachial index (ABI < 0.9) — peripheral arterial disease.' },
      ],
    },
    {
      name: 'Upper Limb Arteries',
      options: [
        { label: 'Normal', text: 'Upper limb arterial system shows normal triphasic waveform with no stenosis or occlusion.', isNormal: true },
        { label: 'Subclavian stenosis', text: 'Subclavian artery stenosis noted. Check for subclavian steal syndrome.' },
        { label: 'Axillary/brachial stenosis', text: 'Stenosis noted in the axillary/brachial artery.' },
        { label: 'Radial/ulnar occlusion', text: 'Occlusion noted in the radial/ulnar artery.' },
        { label: 'Thoracic outlet', text: 'Flow changes with arm positioning — thoracic outlet syndrome suspected.' },
      ],
    },
    {
      name: 'Lower Limb Veins (DVT)',
      options: [
        { label: 'Normal', text: 'Bilateral lower limb deep venous system is fully compressible with normal flow pattern. No evidence of deep vein thrombosis.', isNormal: true },
        { label: 'Acute DVT (R)', text: 'Right lower limb: Non-compressible vein with fresh echogenic intraluminal thrombus — acute DVT.' },
        { label: 'Acute DVT (L)', text: 'Left lower limb: Non-compressible vein with fresh echogenic intraluminal thrombus — acute DVT.' },
        { label: 'Acute DVT (bilateral)', text: 'Bilateral acute DVT with non-compressible veins and intraluminal thrombus.' },
        { label: 'Chronic DVT (R)', text: 'Right lower limb: Echogenic thrombus with partial recanalisation — chronic DVT.' },
        { label: 'Chronic DVT (L)', text: 'Left lower limb: Echogenic thrombus with partial recanalisation — chronic DVT.' },
        { label: 'Iliac DVT', text: 'Thrombus extending into the iliac veins noted.' },
        { label: 'IVC thrombus extension', text: 'Thrombus extending from the lower limb veins into the IVC.' },
        { label: 'Free-floating thrombus', text: 'Free-floating thrombus tail noted — increased risk of pulmonary embolism.' },
        { label: 'SVT (GSV)', text: 'Superficial venous thrombosis in the great saphenous vein.' },
        { label: 'SVT (SSV)', text: 'Superficial venous thrombosis in the small saphenous vein.' },
        { label: 'Post-thrombotic', text: 'Post-thrombotic changes with recanalised veins and incompetent valves.' },
        { label: 'Baker cyst', text: 'Popliteal (Baker) cyst noted behind the knee. No DVT.' },
        { label: 'Calf vein thrombosis', text: 'Isolated calf vein (peroneal/posterior tibial/muscular vein) thrombosis noted.' },
      ],
    },
    {
      name: 'Upper Limb Veins',
      options: [
        { label: 'Normal', text: 'Upper limb deep veins are compressible with normal flow. No thrombosis.', isNormal: true },
        { label: 'Subclavian DVT', text: 'Subclavian vein thrombosis noted.' },
        { label: 'Axillary DVT', text: 'Axillary vein thrombosis noted.' },
        { label: 'IJV thrombosis', text: 'Internal jugular vein thrombosis noted.' },
        { label: 'Catheter-related', text: 'Thrombus noted around central venous catheter line.' },
        { label: 'SVC obstruction', text: 'Absence of phasic flow in upper limb veins — possible SVC obstruction.' },
      ],
    },
    {
      name: 'Varicose Veins',
      options: [
        { label: 'No varicosities', text: 'No varicose veins or venous reflux noted.', isNormal: true },
        { label: 'GSV incompetent (R)', text: 'Right great saphenous vein shows reflux >0.5 seconds — saphenofemoral junction incompetence.' },
        { label: 'GSV incompetent (L)', text: 'Left great saphenous vein shows reflux >0.5 seconds — saphenofemoral junction incompetence.' },
        { label: 'SSV incompetent (R)', text: 'Right small saphenous vein shows reflux — saphenopopliteal junction incompetence.' },
        { label: 'SSV incompetent (L)', text: 'Left small saphenous vein shows reflux — saphenopopliteal junction incompetence.' },
        { label: 'Perforator incompetence', text: 'Incompetent perforator vein(s) noted.' },
        { label: 'Deep vein reflux', text: 'Deep venous reflux noted — consider chronic venous insufficiency.' },
        { label: 'Recurrent varicosities', text: 'Recurrent varicose veins noted post-procedure.' },
      ],
    },
    {
      name: 'Renal Arteries',
      options: [
        { label: 'Normal', text: 'Bilateral renal arteries show normal RI (0.5–0.7) with no evidence of renal artery stenosis.', isNormal: true },
        { label: 'Elevated RI (R)', text: 'Elevated right renal artery resistive index (>0.7), suggestive of intrinsic renal disease.' },
        { label: 'Elevated RI (L)', text: 'Elevated left renal artery resistive index (>0.7), suggestive of intrinsic renal disease.' },
        { label: 'Elevated RI (bilateral)', text: 'Bilateral elevated renal artery resistive index (>0.7) — intrinsic renal disease.' },
        { label: 'RAS (R)', text: 'Right renal artery shows elevated PSV (>180 cm/s) with turbulent flow — renal artery stenosis suspected.' },
        { label: 'RAS (L)', text: 'Left renal artery shows elevated PSV (>180 cm/s) with turbulent flow — renal artery stenosis suspected.' },
        { label: 'Tardus parvus', text: 'Tardus parvus waveform in the intrarenal arteries — suggestive of proximal renal artery stenosis.' },
        { label: 'Renal vein thrombosis', text: 'Renal vein thrombosis noted.' },
        { label: 'Accessory renal artery', text: 'Accessory renal artery noted.' },
      ],
    },
    {
      name: 'Portal Venous System',
      options: [
        { label: 'Normal', text: 'Portal vein is patent with normal hepatopetal flow.', isNormal: true },
        { label: 'Portal vein thrombosis', text: 'Thrombus noted in the portal vein — portal vein thrombosis.' },
        { label: 'Hepatofugal flow', text: 'Reversed (hepatofugal) flow in the portal vein — portal hypertension.' },
        { label: 'Portal vein dilated', text: 'Portal vein is dilated (>13 mm) — suggestive of portal hypertension.' },
        { label: 'Cavernous transformation', text: 'Multiple collateral channels at porta hepatis (cavernous transformation of portal vein).' },
        { label: 'Splenic vein thrombosis', text: 'Splenic vein thrombosis noted.' },
        { label: 'SMV thrombosis', text: 'Superior mesenteric vein thrombosis noted.' },
        { label: 'Portosystemic collaterals', text: 'Portosystemic collateral vessels noted — splenorenal/paraumbilical shunt.' },
      ],
    },
    {
      name: 'Hepatic Veins',
      options: [
        { label: 'Normal', text: 'Hepatic veins show normal triphasic waveform. Patent and draining into IVC.', isNormal: true },
        { label: 'Budd-Chiari', text: 'Absent/reduced flow in hepatic veins with compensatory collaterals — Budd-Chiari syndrome suspected.' },
        { label: 'Monophasic flow', text: 'Hepatic veins show monophasic/flattened waveform — may indicate hepatic congestion or cirrhosis.' },
        { label: 'HV thrombosis', text: 'Hepatic vein thrombosis noted.' },
        { label: 'TIPS evaluation', text: 'TIPS shunt is in situ with normal flow velocities and direction.' },
      ],
    },
    {
      name: 'Mesenteric Arteries',
      options: [
        { label: 'Normal', text: 'Superior mesenteric artery and coeliac axis show normal flow velocities.', isNormal: true },
        { label: 'SMA stenosis', text: 'Elevated PSV in the superior mesenteric artery — SMA stenosis suspected.' },
        { label: 'Coeliac stenosis', text: 'Elevated PSV in the coeliac axis — coeliac artery stenosis/median arcuate ligament syndrome.' },
        { label: 'Postprandial evaluation', text: 'Post-meal SMA flow shows appropriate hyperaemia.', isNormal: true },
        { label: 'Reduced postprandial', text: 'Reduced postprandial SMA hyperaemia — chronic mesenteric ischaemia suspected.' },
      ],
    },
    {
      name: 'AV Fistula (Dialysis)',
      options: [
        { label: 'Normal mature', text: 'AV fistula is mature with good flow volume (>600 ml/min) and no stenosis.', isNormal: true },
        { label: 'Immature', text: 'AV fistula is immature with low flow volume. Allow further maturation.' },
        { label: 'Anastomotic stenosis', text: 'Stenosis noted at the arterial anastomosis with elevated PSV.' },
        { label: 'Venous outflow stenosis', text: 'Stenosis noted in the venous outflow limb.' },
        { label: 'Thrombosed', text: 'AV fistula is thrombosed — no flow detected.' },
        { label: 'Aneurysmal dilatation', text: 'Aneurysmal dilatation of the AV fistula noted.' },
        { label: 'Steal syndrome', text: 'Reversed flow in the radial artery distal to fistula — steal syndrome.' },
        { label: 'Pseudoaneurysm', text: 'Pseudoaneurysm at a previous cannulation site.' },
        { label: 'AV graft patent', text: 'AV graft is patent with adequate flow.', isNormal: true },
      ],
    },
    {
      name: 'Uterine Arteries (OB)',
      options: [
        { label: 'Normal', text: 'Bilateral uterine artery Doppler shows normal low-resistance flow with diastolic notch absent.', isNormal: true },
        { label: 'Notching (R)', text: 'Early diastolic notching noted in the right uterine artery waveform.' },
        { label: 'Notching (L)', text: 'Early diastolic notching noted in the left uterine artery waveform.' },
        { label: 'Notching (bilateral)', text: 'Bilateral uterine artery diastolic notching — increased risk of pre-eclampsia/IUGR.' },
        { label: 'Elevated PI', text: 'Elevated pulsatility index in uterine arteries. Clinical correlation advised.' },
        { label: 'Elevated PI >95th', text: 'Uterine artery PI above 95th percentile for gestational age — abnormal.' },
      ],
    },
    {
      name: 'Umbilical Artery (OB)',
      options: [
        { label: 'Normal', text: 'Umbilical artery Doppler shows normal forward diastolic flow with normal S/D ratio and PI for gestational age.', isNormal: true },
        { label: 'Elevated S/D', text: 'Umbilical artery shows elevated S/D ratio, suggestive of increased placental resistance.' },
        { label: 'Elevated PI', text: 'Umbilical artery PI is elevated above 95th percentile for gestational age.' },
        { label: 'Absent EDV', text: 'Absent end-diastolic velocity in umbilical artery. Urgent clinical correlation required.' },
        { label: 'Reversed EDV', text: 'Reversed end-diastolic velocity in umbilical artery. Critical finding requiring immediate intervention.' },
      ],
    },
    {
      name: 'MCA (OB)',
      options: [
        { label: 'Normal', text: 'Middle cerebral artery shows normal PSV and PI for gestational age.', isNormal: true },
        { label: 'Elevated PSV', text: 'MCA PSV is elevated, suggestive of fetal anemia. Correlation with MoM values advised.' },
        { label: 'Low PI', text: 'MCA PI is reduced — fetal cerebral vasodilatation.' },
        { label: 'Brain-sparing', text: 'MCA PI is reduced with CPR <1 (abnormal cerebro-placental ratio) — brain-sparing effect.' },
        { label: 'Normal CPR', text: 'Cerebro-placental ratio (CPR) is normal.', isNormal: true },
        { label: 'Abnormal CPR', text: 'Cerebro-placental ratio (CPR) is abnormal (<1.08). Close monitoring recommended.' },
      ],
    },
    {
      name: 'Ductus Venosus (OB)',
      options: [
        { label: 'Normal', text: 'Ductus venosus shows normal A-wave with forward flow.', isNormal: true },
        { label: 'Absent A-wave', text: 'Absent A-wave in the ductus venosus.' },
        { label: 'Reversed A-wave', text: 'Reversed A-wave in the ductus venosus — concerning for fetal compromise/cardiac dysfunction.' },
        { label: 'Elevated PI', text: 'Ductus venosus PI is elevated above normal for gestational age.' },
      ],
    },
    {
      name: 'Penile Doppler',
      options: [
        { label: 'Normal', text: 'Bilateral cavernosal arteries show normal flow at baseline.', isNormal: true },
        { label: 'Arteriogenic ED', text: 'Reduced peak systolic velocity (<25 cm/s) post-injection — arteriogenic erectile dysfunction.' },
        { label: 'Venogenic ED', text: 'Elevated end-diastolic velocity (>5 cm/s) post-injection — venogenic erectile dysfunction (venous leak).' },
        { label: 'Normal post-injection', text: 'Normal PSV (>35 cm/s) and normal EDV post-injection — normal arteriogenic and venogenic function.', isNormal: true },
        { label: 'Mixed ED', text: 'Features of both arteriogenic and venogenic erectile dysfunction.' },
      ],
    },
  ],
};

// ─── Small Parts Template ───────────────────────────────────

const smallPartsTemplate: FindingsTemplate = {
  key: 'smallParts',
  label: 'Small Parts',
  groups: [
    {
      name: 'Thyroid',
      options: [
        { label: 'Normal', text: 'Both lobes of thyroid are normal in size and echotexture. Isthmus is normal. No focal nodule seen.', isNormal: true },
        { label: 'Diffuse enlargement', text: 'Thyroid gland is diffusely enlarged with heterogeneous echotexture, suggestive of thyroiditis/goitre.' },
        { label: 'Hashimoto', text: 'Thyroid shows diffuse heterogeneous hypoechogenicity with coarsened echotexture — Hashimoto thyroiditis.' },
        { label: 'De Quervain', text: 'Focal/diffuse hypoechoic area in the thyroid with reduced vascularity — subacute (De Quervain) thyroiditis.' },
        { label: 'Graves', text: 'Diffusely enlarged thyroid with markedly increased vascularity (thyroid inferno) — Graves disease.' },
        { label: 'Nodule (R) TIRADS 2', text: 'Benign-appearing nodule (TIRADS 2) in the right lobe of thyroid. Spongiform/purely cystic. No follow-up required.' },
        { label: 'Nodule (R) TIRADS 3', text: 'Mildly suspicious nodule (TIRADS 3) in the right lobe. Solid, isoechoic, smooth margins. Follow-up or FNA if >2.5 cm.' },
        { label: 'Nodule (R) TIRADS 4', text: 'Moderately suspicious nodule (TIRADS 4) in the right lobe. Solid hypoechoic. FNA recommended if >1.5 cm.' },
        { label: 'Nodule (R) TIRADS 5', text: 'Highly suspicious nodule (TIRADS 5) in the right lobe. Solid, hypoechoic, irregular margins/microcalcifications/taller-than-wide. FNA recommended if >1 cm.' },
        { label: 'Nodule (L) TIRADS 2', text: 'Benign-appearing nodule (TIRADS 2) in the left lobe of thyroid.' },
        { label: 'Nodule (L) TIRADS 3', text: 'Mildly suspicious nodule (TIRADS 3) in the left lobe.' },
        { label: 'Nodule (L) TIRADS 4', text: 'Moderately suspicious nodule (TIRADS 4) in the left lobe. FNA recommended if >1.5 cm.' },
        { label: 'Nodule (L) TIRADS 5', text: 'Highly suspicious nodule (TIRADS 5) in the left lobe. FNA recommended if >1 cm.' },
        { label: 'Multinodular', text: 'Multiple nodules seen in both lobes, suggestive of multinodular goitre.' },
        { label: 'Calcified nodule', text: 'Calcified thyroid nodule with coarse calcification.' },
        { label: 'Microcalcifications', text: 'Thyroid nodule with microcalcifications — suspicious feature.' },
        { label: 'Cystic nodule', text: 'Predominantly cystic thyroid nodule — likely benign colloid cyst.' },
        { label: 'Retrosternal extension', text: 'Thyroid enlargement with retrosternal extension.' },
        { label: 'Post-thyroidectomy (R)', text: 'Post right hemithyroidectomy. Left lobe appears normal.' },
        { label: 'Post-thyroidectomy (L)', text: 'Post left hemithyroidectomy. Right lobe appears normal.' },
        { label: 'Post total thyroidectomy', text: 'Status post total thyroidectomy. Thyroid bed appears normal. No recurrence.' },
        { label: 'Cervical LN normal', text: 'No suspicious cervical lymphadenopathy.', isNormal: true },
        { label: 'Cervical LN suspicious', text: 'Suspicious cervical lymph node(s) — round, loss of hilum, microcalcifications. FNA recommended.' },
        { label: 'Cervical LN reactive', text: 'Reactive cervical lymph node(s) with preserved fatty hilum.' },
        { label: 'Parathyroid adenoma', text: 'Hypoechoic nodule posterior to the thyroid lobe — parathyroid adenoma suspected.' },
      ],
    },
    {
      name: 'Breast (Right)',
      options: [
        { label: 'Normal', text: 'Right breast parenchyma shows normal fibrofatty echotexture. No focal solid or cystic lesion seen. Right axillary region is normal.', isNormal: true },
        { label: 'Simple cyst', text: 'Simple anechoic cyst noted in the right breast (BIRADS 2).' },
        { label: 'Complicated cyst', text: 'Cyst with internal echoes noted in the right breast (BIRADS 3). Follow-up in 6 months.' },
        { label: 'Fibroadenoma', text: 'Well-defined, oval, hypoechoic solid lesion with smooth margins in the right breast — likely fibroadenoma (BIRADS 3).' },
        { label: 'Multiple fibroadenomas', text: 'Multiple well-defined oval hypoechoic lesions in the right breast — multiple fibroadenomas.' },
        { label: 'Suspicious (BIRADS 4)', text: 'Irregular hypoechoic lesion with indistinct/angular margins in the right breast (BIRADS 4). Biopsy recommended.' },
        { label: 'Highly suspicious (BIRADS 5)', text: 'Spiculated hypoechoic mass with posterior acoustic shadowing in the right breast (BIRADS 5). Strongly suspicious for malignancy.' },
        { label: 'Fibrocystic changes', text: 'Right breast shows fibrocystic changes with multiple small cysts and nodularities (BIRADS 2).' },
        { label: 'Duct ectasia', text: 'Dilated ducts noted in the right breast — duct ectasia.' },
        { label: 'Fat necrosis', text: 'Complex lesion with calcification in the right breast at previous biopsy/surgery site — fat necrosis.' },
        { label: 'Galactocele', text: 'Cystic lesion with milk-like content in the right breast — galactocele (lactating patient).' },
        { label: 'Abscess', text: 'Complex fluid collection with surrounding inflammation in the right breast — breast abscess.' },
        { label: 'Axillary LN (R)', text: 'Right axillary lymphadenopathy noted — further evaluation required.' },
        { label: 'Phyllodes', text: 'Large, lobulated, heterogeneous solid mass in the right breast — phyllodes tumour to be considered.' },
        { label: 'Intramammary LN', text: 'Intramammary lymph node noted in the right breast — usually benign.' },
        { label: 'Post-mastectomy (R)', text: 'Right mastectomy site — no evidence of recurrence.' },
        { label: 'Implant intact (R)', text: 'Right breast implant appears intact.', isNormal: true },
        { label: 'Implant rupture (R)', text: 'Features suggestive of right breast implant rupture.' },
        { label: 'Gynaecomastia (R)', text: 'Right breast shows retroareolar disc of tissue — gynaecomastia.' },
      ],
    },
    {
      name: 'Breast (Left)',
      options: [
        { label: 'Normal', text: 'Left breast parenchyma shows normal fibrofatty echotexture. No focal solid or cystic lesion seen. Left axillary region is normal.', isNormal: true },
        { label: 'Simple cyst', text: 'Simple anechoic cyst noted in the left breast (BIRADS 2).' },
        { label: 'Complicated cyst', text: 'Cyst with internal echoes noted in the left breast (BIRADS 3). Follow-up in 6 months.' },
        { label: 'Fibroadenoma', text: 'Well-defined, oval, hypoechoic solid lesion with smooth margins in the left breast — likely fibroadenoma (BIRADS 3).' },
        { label: 'Multiple fibroadenomas', text: 'Multiple well-defined oval hypoechoic lesions in the left breast — multiple fibroadenomas.' },
        { label: 'Suspicious (BIRADS 4)', text: 'Irregular hypoechoic lesion with indistinct/angular margins in the left breast (BIRADS 4). Biopsy recommended.' },
        { label: 'Highly suspicious (BIRADS 5)', text: 'Spiculated hypoechoic mass with posterior acoustic shadowing in the left breast (BIRADS 5). Strongly suspicious for malignancy.' },
        { label: 'Fibrocystic changes', text: 'Left breast shows fibrocystic changes with multiple small cysts and nodularities (BIRADS 2).' },
        { label: 'Duct ectasia', text: 'Dilated ducts noted in the left breast — duct ectasia.' },
        { label: 'Fat necrosis', text: 'Complex lesion with calcification in the left breast at previous biopsy/surgery site — fat necrosis.' },
        { label: 'Galactocele', text: 'Cystic lesion with milk-like content in the left breast — galactocele (lactating patient).' },
        { label: 'Abscess', text: 'Complex fluid collection with surrounding inflammation in the left breast — breast abscess.' },
        { label: 'Axillary LN (L)', text: 'Left axillary lymphadenopathy noted — further evaluation required.' },
        { label: 'Phyllodes', text: 'Large, lobulated, heterogeneous solid mass in the left breast — phyllodes tumour to be considered.' },
        { label: 'Intramammary LN', text: 'Intramammary lymph node noted in the left breast — usually benign.' },
        { label: 'Post-mastectomy (L)', text: 'Left mastectomy site — no evidence of recurrence.' },
        { label: 'Implant intact (L)', text: 'Left breast implant appears intact.', isNormal: true },
        { label: 'Implant rupture (L)', text: 'Features suggestive of left breast implant rupture.' },
        { label: 'Gynaecomastia (L)', text: 'Left breast shows retroareolar disc of tissue — gynaecomastia.' },
      ],
    },
    {
      name: 'Scrotum / Testes',
      options: [
        { label: 'Normal', text: 'Both testes are normal in size and echotexture. Bilateral epididymis appear normal. No hydrocele or varicocele.', isNormal: true },
        { label: 'Hydrocele (R)', text: 'Anechoic fluid collection noted around the right testis — hydrocele.' },
        { label: 'Hydrocele (L)', text: 'Anechoic fluid collection noted around the left testis — hydrocele.' },
        { label: 'Hydrocele (bilateral)', text: 'Bilateral hydroceles noted.' },
        { label: 'Varicocele (R)', text: 'Dilated veins (>3 mm) noted in the right pampiniform plexus with reflux on Valsalva — varicocele (Grade I/II/III).' },
        { label: 'Varicocele (L)', text: 'Dilated veins (>3 mm) noted in the left pampiniform plexus with reflux on Valsalva — varicocele (Grade I/II/III).' },
        { label: 'Epididymitis (R)', text: 'Right epididymis is enlarged and hyperaemic — epididymitis.' },
        { label: 'Epididymitis (L)', text: 'Left epididymis is enlarged and hyperaemic — epididymitis.' },
        { label: 'Orchitis (R)', text: 'Right testis appears enlarged with heterogeneous echotexture and increased vascularity — orchitis.' },
        { label: 'Orchitis (L)', text: 'Left testis appears enlarged with heterogeneous echotexture and increased vascularity — orchitis.' },
        { label: 'Epididymo-orchitis', text: 'Enlarged epididymis with reactive changes in the ipsilateral testis — epididymo-orchitis.' },
        { label: 'Testicular mass (R)', text: 'Focal hypoechoic mass noted in the right testis. Testicular tumour to be excluded. Tumour markers and urology referral recommended.' },
        { label: 'Testicular mass (L)', text: 'Focal hypoechoic mass noted in the left testis. Testicular tumour to be excluded. Tumour markers and urology referral recommended.' },
        { label: 'Testicular microlithiasis', text: 'Multiple punctate echogenic foci (microlithiasis) in the testis. Annual surveillance recommended.' },
        { label: 'Epididymal cyst (R)', text: 'Anechoic cyst noted in the head of right epididymis — epididymal cyst/spermatocele.' },
        { label: 'Epididymal cyst (L)', text: 'Anechoic cyst noted in the head of left epididymis — epididymal cyst/spermatocele.' },
        { label: 'Torsion suspected', text: 'Absent/reduced blood flow to the testis — testicular torsion suspected. Urgent surgical consultation.' },
        { label: 'Undescended (R)', text: 'Right testis not visualised in the scrotum — undescended testis. Check inguinal canal.' },
        { label: 'Undescended (L)', text: 'Left testis not visualised in the scrotum — undescended testis. Check inguinal canal.' },
        { label: 'Scrotal wall thickening', text: 'Scrotal wall thickening with oedema — inflammatory changes.' },
        { label: 'Inguinal hernia (R)', text: 'Inguinal hernia noted on the right side with bowel/omentum extending into the scrotum.' },
        { label: 'Inguinal hernia (L)', text: 'Inguinal hernia noted on the left side with bowel/omentum extending into the scrotum.' },
        { label: 'Testicular atrophy', text: 'Testis appears small/atrophic.' },
        { label: 'Fournier gangrene', text: 'Scrotal wall thickening with gas (dirty shadowing) — Fournier gangrene. Surgical emergency.' },
      ],
    },
    {
      name: 'Lymph Nodes',
      options: [
        { label: 'Normal', text: 'No significant lymphadenopathy noted in the region of interest.', isNormal: true },
        { label: 'Reactive', text: 'Mildly enlarged lymph nodes with preserved fatty hilum — reactive lymphadenopathy.' },
        { label: 'Suspicious', text: 'Enlarged, rounded lymph nodes with loss of fatty hilum and cortical thickening. Further evaluation recommended.' },
        { label: 'Matted', text: 'Matted lymph nodes noted — consider TB, lymphoma, or metastatic disease.' },
        { label: 'Necrotic', text: 'Lymph nodes with central necrosis — consider TB or metastatic disease.' },
        { label: 'Calcified', text: 'Calcified lymph nodes — likely old granulomatous disease.' },
        { label: 'Supraclavicular', text: 'Supraclavicular lymphadenopathy noted — consider malignancy workup.' },
      ],
    },
    {
      name: 'Salivary Glands',
      options: [
        { label: 'Normal', text: 'Bilateral parotid and submandibular glands appear normal.', isNormal: true },
        { label: 'Parotid enlarged', text: 'Parotid gland is diffusely enlarged — sialadenitis/parotitis.' },
        { label: 'Parotid mass', text: 'Focal lesion in the parotid gland — pleomorphic adenoma/Warthin tumour to be considered.' },
        { label: 'Submandibular enlarged', text: 'Submandibular gland is enlarged and hypoechoic — sialadenitis.' },
        { label: 'Submandibular calculus', text: 'Echogenic focus with shadow in the submandibular duct/gland — sialolithiasis.' },
        { label: 'Sjögren syndrome', text: 'Bilateral parotid glands show multiple hypoechoic foci (honeycomb pattern) — Sjögren syndrome.' },
        { label: 'Ranula', text: 'Cystic lesion in the floor of mouth — ranula.' },
      ],
    },
    {
      name: 'Musculoskeletal / Soft Tissue',
      options: [
        { label: 'Normal', text: 'No soft tissue abnormality detected in the region of interest.', isNormal: true },
        { label: 'Lipoma', text: 'Well-defined, compressible, echogenic soft tissue lesion — likely lipoma.' },
        { label: 'Sebaceous cyst', text: 'Well-defined subcutaneous cyst with internal echoes — sebaceous/epidermal cyst.' },
        { label: 'Abscess', text: 'Complex fluid collection with surrounding inflammation — soft tissue abscess.' },
        { label: 'Haematoma', text: 'Echogenic/complex collection in the soft tissue — haematoma.' },
        { label: 'Foreign body', text: 'Linear echogenic structure with surrounding inflammation — foreign body.' },
        { label: 'Ganglion cyst', text: 'Anechoic cyst near a joint/tendon — ganglion cyst.' },
        { label: 'Muscle tear', text: 'Disruption of normal muscle fibres with haematoma — muscle tear (partial/complete).' },
        { label: 'Tendon tear', text: 'Tendon discontinuity/thickening — tendon tear (partial/complete).' },
        { label: 'Tendinopathy', text: 'Tendon is thickened and hypoechoic with increased vascularity — tendinopathy.' },
        { label: 'Bursitis', text: 'Distended bursa with fluid/thickened synovium — bursitis.' },
        { label: 'Joint effusion', text: 'Joint effusion noted.' },
        { label: 'Plantar fasciitis', text: 'Plantar fascia is thickened (>4 mm) and hypoechoic — plantar fasciitis.' },
        { label: 'Morton neuroma', text: 'Hypoechoic mass in the intermetatarsal space — Morton neuroma.' },
        { label: 'Carpal tunnel', text: 'Median nerve at the carpal tunnel is enlarged (CSA >10 mm²) — carpal tunnel syndrome.' },
        { label: 'De Quervain', text: 'Thickened first extensor compartment tendons with fluid — De Quervain tenosynovitis.' },
        { label: 'Trigger finger', text: 'Thickened A1 pulley with restricted tendon gliding — trigger finger.' },
        { label: 'Solid mass', text: 'Solid soft tissue mass noted. Further characterisation with MRI recommended.' },
        { label: 'Necrotising fasciitis', text: 'Subcutaneous thickening with fluid tracking along fascial planes and possible gas — necrotising fasciitis suspected. Surgical emergency.' },
      ],
    },
    {
      name: 'Hernia Assessment',
      options: [
        { label: 'No hernia', text: 'No hernia demonstrated on ultrasound at rest or on Valsalva.', isNormal: true },
        { label: 'Inguinal hernia (R)', text: 'Right inguinal hernia containing omental fat/bowel. Reducible on examination.' },
        { label: 'Inguinal hernia (L)', text: 'Left inguinal hernia containing omental fat/bowel. Reducible on examination.' },
        { label: 'Inguinal hernia (bilateral)', text: 'Bilateral inguinal hernias noted.' },
        { label: 'Femoral hernia', text: 'Femoral hernia noted medial to the femoral vein.' },
        { label: 'Umbilical hernia', text: 'Umbilical hernia containing omental fat/bowel through the linea alba defect.' },
        { label: 'Incisional hernia', text: 'Incisional hernia through the previous surgical scar.' },
        { label: 'Epigastric hernia', text: 'Epigastric hernia in the linea alba above the umbilicus.' },
        { label: 'Spigelian hernia', text: 'Spigelian hernia noted.' },
        { label: 'Obturator hernia', text: 'Obturator hernia suspected.' },
        { label: 'Irreducible', text: 'Hernia appears irreducible/incarcerated. Surgical consultation recommended.' },
        { label: 'Strangulated', text: 'Features suggestive of strangulated hernia — absent blood flow, fluid. Urgent surgery needed.' },
      ],
    },
    {
      name: 'Neonatal Head',
      options: [
        { label: 'Normal', text: 'Neonatal brain appears normal. No haemorrhage, hydrocephalus, or structural abnormality.', isNormal: true },
        { label: 'Grade I IVH', text: 'Grade I intraventricular haemorrhage — subependymal germinal matrix haemorrhage.' },
        { label: 'Grade II IVH', text: 'Grade II intraventricular haemorrhage — blood in ventricles without dilatation.' },
        { label: 'Grade III IVH', text: 'Grade III intraventricular haemorrhage — ventricular dilatation with blood.' },
        { label: 'Grade IV IVH', text: 'Grade IV — parenchymal haemorrhagic infarction.' },
        { label: 'Ventriculomegaly', text: 'Ventricular dilatation noted — hydrocephalus.' },
        { label: 'PVL', text: 'Periventricular leukomalacia (PVL) — periventricular echogenicity/cysts.' },
        { label: 'Subdural collection', text: 'Subdural fluid collection noted.' },
        { label: 'Agenesis CC', text: 'Corpus callosum appears absent — agenesis of corpus callosum.' },
      ],
    },
    {
      name: 'Neonatal Spine',
      options: [
        { label: 'Normal', text: 'Neonatal spinal cord appears normal. Conus medullaris at normal level (L1-L2). No spinal dysraphism.', isNormal: true },
        { label: 'Low conus', text: 'Conus medullaris is low-lying (below L2-L3) — tethered cord suspected.' },
        { label: 'Spinal dysraphism', text: 'Spinal dysraphism noted.' },
        { label: 'Sacral dimple', text: 'Skin dimple over the sacrum. Underlying spinal cord appears normal.' },
        { label: 'Filum terminale thickened', text: 'Filum terminale appears thickened (>2 mm).' },
      ],
    },
    {
      name: 'Neonatal Hip',
      options: [
        { label: 'Normal (bilateral)', text: 'Both hip joints are normal. Alpha angle >60° bilaterally (Graf Type I).', isNormal: true },
        { label: 'Immature (R)', text: 'Right hip is immature (alpha 50-59°, Graf Type IIa). Follow-up recommended.' },
        { label: 'Immature (L)', text: 'Left hip is immature (alpha 50-59°, Graf Type IIa). Follow-up recommended.' },
        { label: 'DDH mild (R)', text: 'Right hip dysplasia (alpha <50°, Graf Type IIc/D). Orthopaedic referral recommended.' },
        { label: 'DDH mild (L)', text: 'Left hip dysplasia (alpha <50°, Graf Type IIc/D). Orthopaedic referral recommended.' },
        { label: 'DDH severe (R)', text: 'Right hip severely dysplastic/dislocated (Graf Type III/IV). Urgent orthopaedic referral.' },
        { label: 'DDH severe (L)', text: 'Left hip severely dysplastic/dislocated (Graf Type III/IV). Urgent orthopaedic referral.' },
      ],
    },
    {
      name: 'Pylorus (Paediatric)',
      options: [
        { label: 'Normal', text: 'Pyloric muscle thickness and channel length are within normal limits. No hypertrophic pyloric stenosis.', isNormal: true },
        { label: 'HPS', text: 'Pyloric muscle thickness >3 mm and channel length >15 mm — hypertrophic pyloric stenosis.' },
        { label: 'Pylorospasm', text: 'Pylorus shows intermittent spasm but normal muscle thickness — pylorospasm. Not HPS.' },
      ],
    },
  ],
};

// ─── Cardiac Template ───────────────────────────────────────

const cardiacTemplate: FindingsTemplate = {
  key: 'cardiac',
  label: 'Cardiac',
  groups: [
    {
      name: 'LV Function',
      options: [
        { label: 'Normal', text: 'Left ventricular systolic function is normal. Ejection fraction is within normal range (55-70%).', isNormal: true },
        { label: 'Hyperdynamic', text: 'Left ventricular systolic function is hyperdynamic (EF >70%).' },
        { label: 'Mild dysfunction', text: 'Mildly reduced left ventricular systolic function (EF 45-54%).' },
        { label: 'Moderate dysfunction', text: 'Moderately reduced left ventricular systolic function (EF 30-44%).' },
        { label: 'Severe dysfunction', text: 'Severely reduced left ventricular systolic function (EF < 30%).' },
      ],
    },
    {
      name: 'LV Wall / Hypertrophy',
      options: [
        { label: 'Normal wall thickness', text: 'Left ventricular wall thickness and IVS are within normal limits.', isNormal: true },
        { label: 'Concentric LVH', text: 'Concentric left ventricular hypertrophy noted (IVS and posterior wall >11 mm).' },
        { label: 'Asymmetric septal hypertrophy', text: 'Asymmetric septal hypertrophy — HOCM to be considered.' },
        { label: 'Eccentric LVH', text: 'Eccentric left ventricular hypertrophy with LV dilatation — volume overload.' },
        { label: 'LV non-compaction', text: 'Prominent LV trabeculations with deep recesses — LV non-compaction suspected.' },
      ],
    },
    {
      name: 'Regional Wall Motion',
      options: [
        { label: 'Normal', text: 'No regional wall motion abnormalities. All segments contracting normally.', isNormal: true },
        { label: 'Anterior hypokinesis', text: 'Hypokinesis of the anterior wall (LAD territory).' },
        { label: 'Inferior hypokinesis', text: 'Hypokinesis of the inferior wall (RCA territory).' },
        { label: 'Lateral hypokinesis', text: 'Hypokinesis of the lateral wall (LCx territory).' },
        { label: 'Septal hypokinesis', text: 'Hypokinesis of the interventricular septum.' },
        { label: 'Apical hypokinesis', text: 'Hypokinesis of the apical segments.' },
        { label: 'Global hypokinesis', text: 'Global hypokinesis of the left ventricle — dilated cardiomyopathy.' },
        { label: 'Akinesis', text: 'Akinesis of the ___ wall — suggestive of myocardial infarction in the corresponding territory.' },
        { label: 'Dyskinesis', text: 'Dyskinesis/paradoxical motion of the ___ wall.' },
        { label: 'LV aneurysm', text: 'Thinning and dyskinesis of the apical/anterior wall — LV aneurysm.' },
        { label: 'LV thrombus', text: 'Echogenic mass in the LV apex — LV thrombus. Anticoagulation indicated.' },
        { label: 'Apical ballooning', text: 'Apical ballooning with basal hyperkinesis — Takotsubo cardiomyopathy.' },
      ],
    },
    {
      name: 'Diastolic Function',
      options: [
        { label: 'Normal', text: 'Diastolic function is normal. E/A ratio is within normal limits.', isNormal: true },
        { label: 'Grade I (impaired relaxation)', text: 'Grade I diastolic dysfunction — impaired relaxation pattern (E/A <1).' },
        { label: 'Grade II (pseudonormal)', text: 'Grade II diastolic dysfunction — pseudonormal filling pattern.' },
        { label: 'Grade III (restrictive)', text: 'Grade III diastolic dysfunction — restrictive filling pattern (E/A >2).' },
        { label: 'Indeterminate', text: 'Diastolic function is indeterminate. Clinical correlation needed.' },
        { label: 'Elevated E/e\'', text: 'Elevated E/e\' ratio (>14) — suggestive of elevated LV filling pressures.' },
      ],
    },
    {
      name: 'Valves',
      options: [
        { label: 'Normal', text: 'All four cardiac valves appear structurally and functionally normal. No significant regurgitation or stenosis.', isNormal: true },
        { label: 'MR (trivial)', text: 'Trivial/physiological mitral regurgitation.', isNormal: true },
        { label: 'MR (mild)', text: 'Mild mitral regurgitation.' },
        { label: 'MR (moderate)', text: 'Moderate mitral regurgitation.' },
        { label: 'MR (severe)', text: 'Severe mitral regurgitation.' },
        { label: 'MVP', text: 'Mitral valve prolapse noted.' },
        { label: 'MS (mild)', text: 'Mild mitral stenosis (MVA 1.5-2.0 cm²).' },
        { label: 'MS (moderate)', text: 'Moderate mitral stenosis (MVA 1.0-1.5 cm²).' },
        { label: 'MS (severe)', text: 'Severe mitral stenosis (MVA <1.0 cm²).' },
        { label: 'Rheumatic MV', text: 'Mitral valve shows rheumatic changes — thickened leaflets, restricted motion, commissural fusion.' },
        { label: 'AR (mild)', text: 'Mild aortic regurgitation.' },
        { label: 'AR (moderate)', text: 'Moderate aortic regurgitation.' },
        { label: 'AR (severe)', text: 'Severe aortic regurgitation.' },
        { label: 'AS (mild)', text: 'Mild aortic stenosis (peak gradient <40 mmHg, AVA >1.5 cm²).' },
        { label: 'AS (moderate)', text: 'Moderate aortic stenosis (peak gradient 40-64 mmHg, AVA 1.0-1.5 cm²).' },
        { label: 'AS (severe)', text: 'Severe aortic stenosis (peak gradient ≥64 mmHg, AVA <1.0 cm²).' },
        { label: 'Bicuspid AV', text: 'Bicuspid aortic valve noted.' },
        { label: 'AV calcification', text: 'Aortic valve sclerosis/calcification without significant stenosis.' },
        { label: 'TR (trivial)', text: 'Trivial/physiological tricuspid regurgitation.', isNormal: true },
        { label: 'TR (mild)', text: 'Mild tricuspid regurgitation.' },
        { label: 'TR (moderate)', text: 'Moderate tricuspid regurgitation.' },
        { label: 'TR (severe)', text: 'Severe tricuspid regurgitation.' },
        { label: 'PR (mild)', text: 'Mild pulmonary regurgitation.' },
        { label: 'PS', text: 'Pulmonary valve stenosis noted.' },
        { label: 'Prosthetic MV', text: 'Prosthetic mitral valve in situ with normal function.' },
        { label: 'Prosthetic AV', text: 'Prosthetic aortic valve in situ with normal function.' },
        { label: 'Prosthetic dysfunction', text: 'Prosthetic valve dysfunction suspected — elevated gradients/paravalvular leak.' },
        { label: 'Vegetation', text: 'Vegetation noted on the ___ valve — infective endocarditis. Blood cultures recommended.' },
        { label: 'Valve abscess', text: 'Paravalvular abscess suspected.' },
      ],
    },
    {
      name: 'Chamber Sizes',
      options: [
        { label: 'Normal', text: 'All cardiac chambers are normal in size.', isNormal: true },
        { label: 'LA dilated (mild)', text: 'Left atrium is mildly dilated.' },
        { label: 'LA dilated (moderate)', text: 'Left atrium is moderately dilated.' },
        { label: 'LA dilated (severe)', text: 'Left atrium is severely dilated.' },
        { label: 'RA dilated', text: 'Right atrium is dilated.' },
        { label: 'LV dilated', text: 'Left ventricle is dilated.' },
        { label: 'RV dilated', text: 'Right ventricle is dilated.' },
        { label: 'Biatrial dilatation', text: 'Biatrial dilatation noted.' },
        { label: 'Four-chamber dilatation', text: 'All four chambers are dilated — dilated cardiomyopathy.' },
      ],
    },
    {
      name: 'RV Function',
      options: [
        { label: 'Normal', text: 'Right ventricular systolic function is normal. TAPSE is within normal limits.', isNormal: true },
        { label: 'RV dysfunction', text: 'Right ventricular systolic function is reduced (TAPSE < 17 mm).' },
        { label: 'RV hypertrophy', text: 'Right ventricular hypertrophy noted.' },
        { label: 'RV volume overload', text: 'Right ventricle is dilated with paradoxical septal motion — RV volume overload.' },
        { label: 'RV pressure overload', text: 'Right ventricle shows D-shaped septum — RV pressure overload.' },
        { label: 'Acute cor pulmonale', text: 'Dilated RV with McConnell sign — acute cor pulmonale/PE.' },
      ],
    },
    {
      name: 'Pulmonary Artery Pressure',
      options: [
        { label: 'Normal', text: 'Estimated pulmonary artery systolic pressure is normal (<35 mmHg).', isNormal: true },
        { label: 'Mild PAH', text: 'Mildly elevated estimated pulmonary artery systolic pressure (36-50 mmHg).' },
        { label: 'Moderate PAH', text: 'Moderately elevated estimated pulmonary artery systolic pressure (51-70 mmHg).' },
        { label: 'Severe PAH', text: 'Severely elevated estimated pulmonary artery systolic pressure (>70 mmHg).' },
      ],
    },
    {
      name: 'Pericardium',
      options: [
        { label: 'Normal', text: 'No pericardial effusion. Pericardium appears normal.', isNormal: true },
        { label: 'Trivial effusion', text: 'Trivial pericardial effusion — likely physiological.' },
        { label: 'Mild effusion', text: 'Mild pericardial effusion noted without haemodynamic compromise.' },
        { label: 'Moderate effusion', text: 'Moderate pericardial effusion noted.' },
        { label: 'Large effusion', text: 'Large pericardial effusion noted.' },
        { label: 'Tamponade', text: 'Large pericardial effusion with features of cardiac tamponade — RA/RV diastolic collapse. Urgent pericardiocentesis indicated.' },
        { label: 'Constrictive', text: 'Thickened pericardium with features suggestive of constrictive pericarditis.' },
        { label: 'Loculated', text: 'Loculated pericardial effusion noted.' },
      ],
    },
    {
      name: 'Aortic Root / Ascending Aorta',
      options: [
        { label: 'Normal', text: 'Aortic root and ascending aorta are of normal dimension.', isNormal: true },
        { label: 'Dilated root', text: 'Aortic root is dilated.' },
        { label: 'Dilated ascending', text: 'Ascending aorta is dilated.' },
        { label: 'Dissection flap', text: 'Intimal flap in the ascending aorta — aortic dissection suspected. Urgent CT angiography.' },
        { label: 'Sinus of Valsalva aneurysm', text: 'Sinus of Valsalva aneurysm noted.' },
        { label: 'Coarctation', text: 'Findings suggestive of coarctation of aorta.' },
      ],
    },
    {
      name: 'IAS / IVS',
      options: [
        { label: 'Normal', text: 'Interatrial and interventricular septa appear intact.', isNormal: true },
        { label: 'ASD', text: 'Defect noted in the interatrial septum — atrial septal defect with left-to-right shunt.' },
        { label: 'PFO', text: 'Patent foramen ovale suspected. Bubble contrast study recommended for confirmation.' },
        { label: 'VSD', text: 'Defect noted in the interventricular septum with left-to-right shunt.' },
        { label: 'ASA', text: 'Atrial septal aneurysm noted.' },
        { label: 'LA mass/myxoma', text: 'Mass attached to the interatrial septum — left atrial myxoma suspected.' },
      ],
    },
    {
      name: 'Cardiomyopathy',
      options: [
        { label: 'None', text: 'No features of cardiomyopathy.', isNormal: true },
        { label: 'DCM', text: 'Dilated cardiomyopathy — dilated LV with global hypokinesis and reduced EF.' },
        { label: 'HCM', text: 'Hypertrophic cardiomyopathy — asymmetric/concentric hypertrophy with normal/hyperdynamic LV function.' },
        { label: 'HOCM with SAM', text: 'Hypertrophic obstructive cardiomyopathy with systolic anterior motion (SAM) of the mitral valve and LVOT obstruction.' },
        { label: 'RCM', text: 'Features suggestive of restrictive cardiomyopathy — biatrial dilatation with non-dilated ventricles.' },
        { label: 'Peripartum CMP', text: 'New onset LV dysfunction in the peripartum period — peripartum cardiomyopathy.' },
        { label: 'Amyloid', text: 'Features suggestive of cardiac amyloidosis — concentric hypertrophy with granular sparkling, reduced EF, diastolic dysfunction.' },
      ],
    },
  ],
};

// ─── Registry ───────────────────────────────────────────────

export const FINDINGS_TEMPLATES: Record<TemplateKey, FindingsTemplate> = {
  obstetric: obstetricTemplate,
  abdominal: abdominalTemplate,
  pelvic: pelvicTemplate,
  smallParts: smallPartsTemplate,
  cardiac: cardiacTemplate,
  vascular: vascularTemplate,
  generic: {
    key: 'generic',
    label: 'General',
    groups: [],
  },
};

export const TEMPLATE_KEYS: { key: TemplateKey; label: string }[] = [
  { key: 'obstetric', label: 'Obstetric' },
  { key: 'abdominal', label: 'Abdominal' },
  { key: 'pelvic', label: 'Pelvic' },
  { key: 'smallParts', label: 'Small Parts' },
  { key: 'cardiac', label: 'Cardiac' },
  { key: 'vascular', label: 'Vascular' },
];

// ─── Auto-impression generator ──────────────────────────────

/**
 * Generate an impression/conclusion from the selected findings.
 * Analyses the selected texts and produces a summarised impression.
 */
export function generateImpression(
  selectedFindings: string[],
  templateKey: TemplateKey,
  obData?: {
    compositeGA?: string;
    computedEFW?: { value: number; unit: string; percentile?: number | null };
    afiResult?: { value: number; interpretation: string };
  },
): string {
  const lines: string[] = [];
  const allNormal = selectedFindings.every(f =>
    f.includes('normal') || f.includes('Normal') || f.includes('adequate') ||
    f.includes('Adequate') || f.includes('present and regular') ||
    f.includes('No free fluid') || f.includes('well-distended') ||
    f.includes('Fetal movements are present') || f.includes('Active and vigorous') ||
    f.includes('Clear of internal os') || f.includes('three vessels') ||
    f.includes('Single live intrauterine') || f.includes('No soft markers') ||
    f.includes('No evidence of fetal hydrops') || f.includes('not performed as per') ||
    f.includes('fully compressible') || f.includes('No varicose') ||
    f.includes('No hernia demonstrated') || f.includes('No significant lymphadenopathy') ||
    f.includes('All segments contracting') || f.includes('intact') ||
    f.includes('None') || f.includes('Trivial/physiological') ||
    f.includes('is present.') || f.includes('Graf Type I')
  );

  if (templateKey === 'obstetric') {
    // OB-specific impression
    if (obData?.compositeGA) {
      lines.push(`Single live intrauterine pregnancy corresponding to ${obData.compositeGA} gestational age.`);
    }
    if (obData?.computedEFW) {
      const efw = obData.computedEFW;
      let efwLine = `Estimated fetal weight: ${efw.value} ${efw.unit}`;
      if (efw.percentile != null) {
        if (efw.percentile < 10) {
          efwLine += ` (${efw.percentile}th percentile — below normal, consider IUGR evaluation)`;
        } else if (efw.percentile > 90) {
          efwLine += ` (${efw.percentile}th percentile — above normal, consider macrosomia)`;
        } else {
          efwLine += ` (${efw.percentile}th percentile — appropriate for gestational age)`;
        }
      }
      efwLine += '.';
      lines.push(efwLine);
    }
    if (obData?.afiResult) {
      if (obData.afiResult.interpretation !== 'Normal') {
        lines.push(`AFI: ${obData.afiResult.value} cm — ${obData.afiResult.interpretation}. Clinical correlation advised.`);
      }
    }

    // Check for abnormal findings in the selected text
    const obHandled = new Set<number>();
    for (let fi = 0; fi < selectedFindings.length; fi++) {
      const f = selectedFindings[fi];
      let matched = false;
      if (f.includes('breech')) { lines.push('Breech presentation noted.'); matched = true; }
      if (f.includes('transverse lie')) { lines.push('Transverse lie noted.'); matched = true; }
      if (f.includes('oblique lie')) { lines.push('Oblique lie noted.'); matched = true; }
      if (f.includes('previa')) { lines.push('Placenta previa noted. Obstetric management required.'); matched = true; }
      if (f.includes('abruption')) { lines.push('Retroplacental haematoma/abruption suspected.'); matched = true; }
      if (f.includes('accreta')) { lines.push('Placenta accreta spectrum suspected. MRI correlation advised.'); matched = true; }
      if (f.includes('Absent end-diastolic') || f.includes('Reversed end-diastolic')) {
        lines.push('Abnormal umbilical artery Doppler. Urgent obstetric consultation recommended.'); matched = true;
      }
      if (f.includes('oligohydramnios') || f.includes('Significantly reduced')) { lines.push('Reduced amniotic fluid noted.'); matched = true; }
      if (f.includes('anhydramnios')) { lines.push('Anhydramnios noted. Urgent evaluation.'); matched = true; }
      if (f.includes('polyhydramnios') || f.includes('Significantly increased')) { lines.push('Increased amniotic fluid noted.'); matched = true; }
      if (f.includes('brain-sparing')) { lines.push('Evidence of fetal circulatory redistribution (brain-sparing effect).'); matched = true; }
      if (f.includes('Ventriculomegaly')) { lines.push('Fetal ventriculomegaly noted. Neurosonogram recommended.'); matched = true; }
      if (f.includes('spina bifida')) { lines.push('Open neural tube defect suspected.'); matched = true; }
      if (f.includes('Cleft lip') || f.includes('Cleft palate')) { lines.push('Fetal cleft lip/palate suspected.'); matched = true; }
      if (f.includes('Congenital heart disease')) { lines.push('Complex congenital heart disease suspected. Fetal echocardiography recommended.'); matched = true; }
      if (f.includes('diaphragmatic hernia')) { lines.push('Congenital diaphragmatic hernia suspected.'); matched = true; }
      if (f.includes('Omphalocele') || f.includes('Gastroschisis')) { lines.push('Anterior abdominal wall defect noted.'); matched = true; }
      if (f.includes('hydrops')) { lines.push('Fetal hydrops noted. Urgent evaluation.'); matched = true; }
      if (f.includes('funneling') || f.includes('Funneling')) { lines.push('Cervical incompetence/funneling noted.'); matched = true; }
      if (f.includes('Nuchal translucency is increased')) { lines.push('Increased nuchal translucency. Genetic counselling recommended.'); matched = true; }
      if (f.includes('cystic hygroma')) { lines.push('Cystic hygroma noted. Genetic evaluation recommended.'); matched = true; }
      if (f.includes('Subchorionic')) { lines.push('Subchorionic haematoma noted.'); matched = true; }
      if (f.includes('missed abortion')) { lines.push('Missed abortion — no fetal cardiac activity.'); matched = true; }
      if (f.includes('anembryonic') || f.includes('blighted ovum')) { lines.push('Anembryonic pregnancy (blighted ovum).'); matched = true; }
      if (f.includes('Ectopic pregnancy')) { lines.push('Ectopic pregnancy suspected. Urgent clinical correlation.'); matched = true; }
      if (f.includes('molar pregnancy')) { lines.push('Molar pregnancy suspected. Urgent evaluation.'); matched = true; }
      if (f.includes('Skeletal dysplasia')) { lines.push('Short limbs — skeletal dysplasia to be considered.'); matched = true; }
      if (f.includes('clubfoot') || f.includes('talipes')) { lines.push('Clubfoot (talipes) noted.'); matched = true; }
      if (f.includes('multicystic dysplastic')) { lines.push('Multicystic dysplastic kidney noted.'); matched = true; }
      if (f.includes('bilateral renal agenesis')) { lines.push('Bilateral renal agenesis suspected. Lethal anomaly.'); matched = true; }
      // Twin / multiple pregnancy
      if (f.includes('Twin intrauterine')) { lines.push('Twin pregnancy noted.'); matched = true; }
      if (f.includes('Triplet') || f.includes('triplet')) { lines.push('Higher-order multiple pregnancy noted.'); matched = true; }
      // Fetal tone
      if (f.includes('tone appears reduced') || f.includes('tone is reduced')) { lines.push('Reduced fetal tone noted. Clinical correlation advised.'); matched = true; }
      // IUGR / growth restriction
      if (f.includes('IUGR') || f.includes('growth restriction')) { lines.push('Intrauterine growth restriction suspected.'); matched = true; }
      if (matched) obHandled.add(fi);
    }

    // Include any unmatched abnormal findings (custom text, cross-template) verbatim
    for (let fi = 0; fi < selectedFindings.length; fi++) {
      if (obHandled.has(fi)) continue;
      const f = selectedFindings[fi];
      // Skip normal findings
      if (f.includes('normal') || f.includes('Normal') || f.includes('adequate') ||
          f.includes('Adequate') || f.includes('present and regular') ||
          f.includes('No free fluid') || f.includes('well-distended') ||
          f.includes('Fetal movements are present') || f.includes('Active and vigorous') ||
          f.includes('Clear of internal os') || f.includes('three vessels') ||
          f.includes('Single live intrauterine') || f.includes('No soft markers') ||
          f.includes('No evidence of fetal hydrops') || f.includes('not performed as per') ||
          f.includes('fully compressible') || f.includes('No varicose') ||
          f.includes('No hernia demonstrated') || f.includes('No significant lymphadenopathy') ||
          f.includes('All segments contracting') || f.includes('intact') ||
          f.includes('None') || f.includes('Trivial/physiological') ||
          f.includes('is present.') || f.includes('Graf Type I')) continue;
      lines.push(f);
    }

    if (allNormal && lines.length <= 1) {
      lines.push('No obvious fetal anomaly detected on this scan.');
      lines.push('Fetal growth and wellbeing appear satisfactory.');
    }
  } else {
    // Non-OB impression
    if (allNormal) {
      switch (templateKey) {
        case 'abdominal':
          lines.push('Sonographically normal study of the abdomen.');
          break;
        case 'pelvic':
          lines.push('Sonographically normal pelvic study.');
          break;
        case 'vascular':
          lines.push('Normal vascular Doppler study. No significant stenosis or thrombosis identified.');
          break;
        case 'smallParts':
          lines.push('Sonographically normal study.');
          break;
        case 'cardiac':
          lines.push('Normal echocardiographic study.');
          break;
        default:
          lines.push('Sonographically normal study.');
      }
    } else {
      // Extract abnormal findings for impression
      for (const f of selectedFindings) {
        // Skip normal findings
        if (f.includes('normal') || f.includes('Normal') || f.includes('adequate') ||
            f.includes('Adequate') || f.includes('present and regular') ||
            f.includes('No free fluid') || f.includes('well-distended') ||
            f.includes('fully compressible') || f.includes('No varicose') ||
            f.includes('No hernia demonstrated') || f.includes('No significant lymphadenopathy') ||
            f.includes('All segments contracting') || f.includes('intact') ||
            f.includes('None') || f.includes('Trivial/physiological') ||
            f.includes('is present.') || f.includes('Graf Type I')) continue;

        // Try to extract key phrase from "suggestive of ..."
        if (f.includes('suggestive of') || f.includes('Suggestive')) {
          const match = f.match(/suggestive of ([^.]+)/i);
          if (match) {
            lines.push(`${match[1].charAt(0).toUpperCase() + match[1].slice(1)}.`);
            continue;
          }
        }
        // Include any notable finding or custom text
        if (f.includes('Evidence of') || f.includes('Biopsy') ||
            f.includes('correlation') || f.includes('intervention') ||
            f.includes('recommended') || f.includes('management') ||
            f.includes('stenosis') || f.includes('thrombosis') ||
            f.includes('occlusion')) {
          lines.push(f);
        } else {
          // Custom/unrecognised finding — include verbatim
          lines.push(f);
        }
      }
      if (lines.length === 0) {
        lines.push('Findings as described above. Clinical correlation advised.');
      }
    }
  }

  return lines.join('\n');
}
