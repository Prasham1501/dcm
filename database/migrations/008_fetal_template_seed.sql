-- =====================================================
-- 008 — Seed report_templates with fetal medicine templates.
-- The `template_content` column has CHECK(json_valid(...)), so the body
-- HTML is wrapped in a single-key JSON object: {"body": "<html>"}.
-- All inserts use ON DUPLICATE KEY UPDATE for idempotency.
-- =====================================================

INSERT INTO report_templates (template_key, template_name, template_category, template_content, placeholders_supported, exam_type, is_active)
VALUES
(
  'fetal_early_pregnancy', 'Early Pregnancy', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Indication:</b> Early pregnancy assessment.</p>
<p><b>Findings:</b> A single live intrauterine gestation is seen. Crown–rump length is {{crl}}, corresponding to a gestational age of {{ga}} (EDD {{edd}}).</p>
<p>Cardiac activity is present and the fetal heart rate is {{fhr}}.</p>
<p>No adnexal or uterine abnormality identified.</p>
<p><b>Impression:</b> Live intrauterine pregnancy at {{ga}}.</p>'
  ),
  1, 'FTS', 1
),
(
  'fetal_first_trimester', '1st Trimester (FTS / NT Scan)', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Patient:</b> {{patient_name}} ({{patient_id}}) — {{patient_age}}</p>
<p><b>Examination:</b> First-trimester combined screening at {{ga}} (LMP {{lmp}}, EDD {{edd}}).</p>

<p><b>Biometry:</b></p>
<ul><li>CRL: {{crl}}</li><li>BPD (from CRL): {{bpd_crl}}</li><li>HC (from CRL): {{hc_crl}}</li><li>FL (from CRL): {{fl_crl}}</li></ul>

<p><b>Markers:</b></p>
<ul><li>Nuchal Translucency: {{nt}}</li><li>Intracranial Translucency: {{it}}</li><li>Nasal Bone: {{nb}}</li></ul>

<p><b>Risk assessment:</b></p>
<ul><li>Trisomy 21: {{aneuploidy_t21}}</li><li>Trisomy 18: {{aneuploidy_t18}}</li><li>Trisomy 13: {{aneuploidy_t13}}</li><li>Preterm preeclampsia: {{pe_preterm_risk}}</li></ul>

<p><b>Impression:</b> {{findings_list}}</p>'
  ),
  1, 'FTS', 1
),
(
  'fetal_second_trimester', '2nd Trimester (Anomaly Scan)', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Examination:</b> Second-trimester targeted anomaly scan at {{ga}} (LMP {{lmp}}, EDD {{edd}}).</p>

<p><b>Biometry:</b></p>
<ul><li>BPD: {{bpd}}</li><li>HC: {{hc}}</li><li>AC: {{ac}}</li><li>FL: {{fl}}</li><li>HL: {{hl}}</li><li>EFW: {{efw}}</li></ul>

<p><b>Amniotic fluid:</b> {{afi}} &nbsp;&nbsp; <b>FHR:</b> {{fhr}}</p>

<p><b>Structural assessment:</b> See attached checklist.</p>

<p><b>Findings:</b> {{findings_list}}</p>
<p><b>Suggested syndromes:</b> {{syndromes_list}}</p>

<p><b>Impression:</b></p>'
  ),
  1, 'SECOND_TRIMESTER', 1
),
(
  'fetal_second_trimester_twins', '2nd Trimester — Twins', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Examination:</b> Second-trimester scan of twin pregnancy at {{ga}}.</p>

<p><b>Twin A:</b></p>
<ul><li>BPD: {{bpd}} &nbsp; HC: {{hc}} &nbsp; AC: {{ac}} &nbsp; FL: {{fl}} &nbsp; EFW: {{efw}}</li><li>FHR: {{fhr}}</li></ul>

<p><b>Twin B:</b> (record biometry separately)</p>

<p><b>Chorionicity:</b> [DCDA / MCDA / MCMA]</p>
<p><b>Inter-twin discordance:</b> [%]</p>

<p><b>Impression:</b></p>'
  ),
  1, 'SECOND_TRIMESTER', 1
),
(
  'fetal_third_trimester', '3rd Trimester (Growth Scan)', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Examination:</b> Third-trimester growth scan at {{ga}}.</p>

<p><b>Biometry:</b></p>
<ul><li>BPD: {{bpd}}</li><li>HC: {{hc}}</li><li>AC: {{ac}}</li><li>FL: {{fl}}</li><li>EFW: {{efw}}</li></ul>

<p><b>Amniotic fluid:</b> {{afi}}</p>
<p><b>FHR:</b> {{fhr}}</p>
<p><b>Placental site / grade:</b> [Anterior / Posterior — Grade I-III]</p>
<p><b>Dopplers:</b> [UA PI / MCA PI / CPR]</p>

<p><b>Impression:</b> Appropriate-for-gestational-age fetus at {{ga}}.</p>'
  ),
  1, 'THIRD_TRIMESTER', 1
),
(
  'fetal_echo', 'Fetal Echocardiography', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Examination:</b> Targeted fetal echocardiography at {{ga}}.</p>

<p><b>Cardiac position / situs:</b> [Levocardia, situs solitus]</p>
<p><b>Four-chamber view:</b> Normal / Abnormal</p>
<p><b>Outflow tracts:</b> LV — Normal / Abnormal; RV — Normal / Abnormal</p>
<p><b>3-vessel & trachea:</b> Normal / Abnormal</p>
<p><b>Rate / rhythm:</b> {{fhr}}, regular</p>

<p><b>Findings:</b> {{findings_list}}</p>

<p><b>Impression:</b> Structurally normal fetal heart at {{ga}}.</p>'
  ),
  1, 'FETAL_ECHO', 1
),
(
  'fetal_growth_restriction', 'Fetal Growth Restriction (FGR)', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Examination:</b> Growth surveillance scan at {{ga}} for suspected FGR.</p>

<p><b>Biometry:</b></p>
<ul><li>BPD: {{bpd}}</li><li>HC: {{hc}}</li><li>AC: {{ac}}</li><li>FL: {{fl}}</li><li>EFW: {{efw}}</li></ul>

<p><b>Amniotic fluid:</b> {{afi}}</p>

<p><b>Dopplers:</b></p>
<ul><li>Umbilical artery PI: [value]</li><li>MCA PI: [value]</li><li>CPR: [value]</li><li>Ductus venosus: [normal / abnormal]</li></ul>

<p><b>Impression:</b> [Early / Late-onset FGR with / without redistribution.]</p>
<p><b>Recommendations:</b> {{investigations_basic}}</p>'
  ),
  1, 'THIRD_TRIMESTER', 1
),
(
  'fetal_redistribution_cpr', 'Redistribution with CPR', 'Ultrasound',
  JSON_OBJECT('body',
    '<p><b>Examination:</b> Fetal Doppler assessment at {{ga}} for cerebroplacental redistribution.</p>

<p><b>Umbilical artery:</b> PI [value], PSV [value]</p>
<p><b>Middle cerebral artery:</b> PI [value], PSV [value]</p>
<p><b>CPR (MCA-PI / UA-PI):</b> [value]</p>
<p><b>Ductus venosus:</b> a-wave [normal / reduced / reversed]</p>
<p><b>Amniotic fluid:</b> {{afi}}</p>
<p><b>Biophysical profile:</b> [/10]</p>

<p><b>Impression:</b> [CPR within / below 5th centile; evidence of cerebral redistribution.]</p>
<p><b>Recommendations:</b> Repeat Doppler in [interval].</p>'
  ),
  1, 'THIRD_TRIMESTER', 1
)
ON DUPLICATE KEY UPDATE
  template_name           = VALUES(template_name),
  template_content        = VALUES(template_content),
  exam_type               = VALUES(exam_type),
  placeholders_supported  = 1,
  is_active               = 1;
