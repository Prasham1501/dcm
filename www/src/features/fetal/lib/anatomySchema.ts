/**
 * Body system → anatomy checklist for the Structural Assessment tab.
 * Mirrors the ScanOFe checklist structure so reports stay comparable.
 *
 * Each anatomy entry has a stable `key` used as the DB primary key
 * component; relabel `label` freely without breaking saved data.
 */

export type StructuralStatus = 'select' | 'normal' | 'abnormal' | 'not_seen';

export interface AnatomyItem {
  key: string;     // stable DB key
  label: string;   // display label
}

export interface BodySystem {
  key: string;
  label: string;
  items: AnatomyItem[];
}

/** Standard body-part checklist for second-trimester anomaly scans. */
export const BODY_PART_SYSTEMS: BodySystem[] = [
  {
    key: 'general',
    label: 'General',
    items: [
      { key: 'fetal_lie',           label: 'Fetal lie / presentation' },
      { key: 'fetal_movement',      label: 'Fetal movement' },
      { key: 'amniotic_fluid',      label: 'Amniotic fluid volume' },
      { key: 'placenta_location',   label: 'Placenta location' },
      { key: 'placenta_grade',      label: 'Placenta grade' },
      { key: 'cord_insertion',      label: 'Cord insertion' },
      { key: 'cord_vessels',        label: 'Cord vessels (3-vessel)' },
    ],
  },
  {
    key: 'head_neck',
    label: 'Head & Neck',
    items: [
      { key: 'skull_shape',         label: 'Skull shape' },
      { key: 'skull_integrity',     label: 'Skull integrity / mineralisation' },
      { key: 'lateral_ventricles',  label: 'Lateral ventricles' },
      { key: 'choroid_plexus',      label: 'Choroid plexus' },
      { key: 'cavum_septi',         label: 'Cavum septi pellucidi' },
      { key: 'cerebellum',          label: 'Cerebellum' },
      { key: 'cisterna_magna',      label: 'Cisterna magna' },
      { key: 'midline_falx',        label: 'Midline falx' },
      { key: 'nuchal_fold',         label: 'Nuchal fold' },
    ],
  },
  {
    key: 'face',
    label: 'Face',
    items: [
      { key: 'orbits',              label: 'Orbits / inter-orbital distance' },
      { key: 'nasal_bone',          label: 'Nasal bone' },
      { key: 'upper_lip',           label: 'Upper lip / philtrum' },
      { key: 'mandible',            label: 'Mandible' },
      { key: 'profile',             label: 'Mid-sagittal profile' },
    ],
  },
  {
    key: 'thorax',
    label: 'Thorax',
    items: [
      { key: 'lungs',               label: 'Lungs (echogenicity)' },
      { key: 'diaphragm',           label: 'Diaphragm continuity' },
      { key: 'thymus',              label: 'Thymus' },
      { key: 'pleural_effusion',    label: 'Pleural effusion' },
    ],
  },
  {
    key: 'heart',
    label: 'Heart',
    items: [
      { key: 'situs',               label: 'Cardiac situs / axis' },
      { key: 'four_chamber',        label: '4-chamber view' },
      { key: 'lvot',                label: 'LV outflow tract' },
      { key: 'rvot',                label: 'RV outflow tract' },
      { key: 'three_vessel_trachea',label: '3-vessel & trachea view' },
      { key: 'rate_rhythm',         label: 'Rate / rhythm' },
    ],
  },
  {
    key: 'abdomen',
    label: 'Abdomen',
    items: [
      { key: 'stomach',             label: 'Stomach (left, fluid-filled)' },
      { key: 'bowel',               label: 'Bowel echogenicity' },
      { key: 'liver_gallbladder',   label: 'Liver / gallbladder' },
      { key: 'kidneys',             label: 'Kidneys' },
      { key: 'renal_pelvis',        label: 'Renal pelvis' },
      { key: 'bladder',             label: 'Bladder' },
      { key: 'abdominal_wall',      label: 'Abdominal wall (cord insertion)' },
    ],
  },
  {
    key: 'spine',
    label: 'Spine',
    items: [
      { key: 'cervical',            label: 'Cervical spine' },
      { key: 'thoracic',            label: 'Thoracic spine' },
      { key: 'lumbar',              label: 'Lumbar spine' },
      { key: 'sacral',              label: 'Sacral spine' },
      { key: 'overlying_skin',      label: 'Overlying skin' },
    ],
  },
  {
    key: 'extremities',
    label: 'Extremities',
    items: [
      { key: 'upper_limbs',         label: 'Upper limbs (3 segments)' },
      { key: 'hands',               label: 'Hands' },
      { key: 'lower_limbs',         label: 'Lower limbs (3 segments)' },
      { key: 'feet',                label: 'Feet' },
    ],
  },
  {
    key: 'genitalia',
    label: 'Genitalia',
    items: [
      { key: 'external_genitalia',  label: 'External genitalia (when seen)' },
    ],
  },
];

/** Fetal echocardiography checklist (sub-tab). */
export const FETAL_ECHO_SYSTEMS: BodySystem[] = [
  {
    key: 'echo_situs',
    label: 'Situs & Connections',
    items: [
      { key: 'visceral_situs',      label: 'Visceral situs' },
      { key: 'cardiac_position',    label: 'Cardiac position' },
      { key: 'av_connections',      label: 'AV connections' },
      { key: 'va_connections',      label: 'VA connections' },
    ],
  },
  {
    key: 'echo_chambers',
    label: 'Chambers & Valves',
    items: [
      { key: 'left_atrium',         label: 'Left atrium' },
      { key: 'right_atrium',        label: 'Right atrium' },
      { key: 'left_ventricle',      label: 'Left ventricle' },
      { key: 'right_ventricle',     label: 'Right ventricle' },
      { key: 'mitral_valve',        label: 'Mitral valve' },
      { key: 'tricuspid_valve',     label: 'Tricuspid valve' },
      { key: 'aortic_valve',        label: 'Aortic valve' },
      { key: 'pulmonary_valve',     label: 'Pulmonary valve' },
      { key: 'foramen_ovale',       label: 'Foramen ovale flow' },
    ],
  },
  {
    key: 'echo_great_vessels',
    label: 'Great Vessels',
    items: [
      { key: 'aortic_arch',         label: 'Aortic arch' },
      { key: 'ductal_arch',         label: 'Ductal arch' },
      { key: 'pulmonary_arteries',  label: 'Branch pulmonary arteries' },
      { key: 'svc_ivc',             label: 'SVC / IVC drainage' },
    ],
  },
  {
    key: 'echo_function',
    label: 'Function & Rhythm',
    items: [
      { key: 'heart_rate',          label: 'Heart rate' },
      { key: 'rhythm',              label: 'Rhythm' },
      { key: 'systolic_function',   label: 'Systolic function' },
      { key: 'pericardial_effusion',label: 'Pericardial effusion' },
    ],
  },
];

/** Fetal neurosonography checklist (sub-tab). */
export const FETAL_NEURO_SYSTEMS: BodySystem[] = [
  {
    key: 'neuro_axial',
    label: 'Axial planes',
    items: [
      { key: 'transventricular',    label: 'Transventricular plane' },
      { key: 'transthalamic',       label: 'Transthalamic plane' },
      { key: 'transcerebellar',     label: 'Transcerebellar plane' },
    ],
  },
  {
    key: 'neuro_midline',
    label: 'Midline structures',
    items: [
      { key: 'corpus_callosum',     label: 'Corpus callosum' },
      { key: 'cavum_csp',           label: 'Cavum septi pellucidi' },
      { key: 'third_ventricle',     label: 'Third ventricle' },
      { key: 'fourth_ventricle',    label: 'Fourth ventricle' },
      { key: 'aqueduct',            label: 'Cerebral aqueduct' },
    ],
  },
  {
    key: 'neuro_posterior',
    label: 'Posterior fossa',
    items: [
      { key: 'cerebellar_hemisphere',label: 'Cerebellar hemispheres' },
      { key: 'cerebellar_vermis',   label: 'Cerebellar vermis' },
      { key: 'cisterna_magna_neuro',label: 'Cisterna magna' },
      { key: 'tentorium',           label: 'Tentorium' },
    ],
  },
  {
    key: 'neuro_cortex',
    label: 'Cortex & gyration',
    items: [
      { key: 'sylvian_fissure',     label: 'Sylvian fissure' },
      { key: 'parieto_occipital',   label: 'Parieto-occipital sulcus' },
      { key: 'calcarine',           label: 'Calcarine fissure' },
      { key: 'cingulate',           label: 'Cingulate sulcus' },
    ],
  },
];

export type ChecklistKind = 'body_part' | 'echo' | 'neuro';

export const CHECKLISTS: Record<ChecklistKind, BodySystem[]> = {
  body_part: BODY_PART_SYSTEMS,
  echo:      FETAL_ECHO_SYSTEMS,
  neuro:     FETAL_NEURO_SYSTEMS,
};
