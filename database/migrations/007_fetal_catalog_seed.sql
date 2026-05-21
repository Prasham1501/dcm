-- =====================================================
-- 007 — Minimal seed for fetal medicine catalogs.
-- Provides a small starter set so the Findings / Syndromes / Genes /
-- Investigations browsers are usable out-of-the-box. The full catalog
-- is expected to be imported later via /admin/fetal-catalog-import.php.
-- All inserts are idempotent (INSERT IGNORE on the natural key).
-- =====================================================

-- ── Findings (16 starter entries spanning common anomaly scan systems) ──
INSERT IGNORE INTO findings (name, system, description) VALUES
  ('Absent Nasal Bone',          'face',        'Nasal bone not visualised on mid-sagittal section'),
  ('Increased Nuchal Translucency', 'head_neck','NT measurement above 95th centile for CRL'),
  ('Abnormal Skull Shape',       'head_neck',   'Lemon/strawberry/cloverleaf skull configuration'),
  ('Ventriculomegaly',           'head_neck',   'Lateral ventricle atrium ≥ 10 mm'),
  ('Cardiac Axis Abnormal',      'heart',       'Cardiac axis outside 32–58° range'),
  ('Single Umbilical Artery',    'general',     'Two-vessel cord on transverse view'),
  ('Absent Stomach Bubble',      'abdomen',     'Stomach not visualised in left upper quadrant'),
  ('Echogenic Bowel',            'abdomen',     'Bowel echogenicity equal to or greater than bone'),
  ('Renal Pelvis Dilatation',    'abdomen',     'Renal pelvis AP diameter ≥ 7 mm in second trimester'),
  ('Absent Bladder',             'abdomen',     'Fetal urinary bladder not seen on serial scans'),
  ('Talipes',                    'extremities', 'Persistent abnormal foot positioning'),
  ('Clenched Hand',              'extremities', 'Persistent flexed/overlapping fingers'),
  ('Short Femur',                'extremities', 'FL below 5th centile for gestational age'),
  ('Cleft Lip',                  'face',        'Discontinuity of the upper lip'),
  ('Spina Bifida',               'spine',       'Open defect in the vertebral arches'),
  ('Cystic Hygroma',             'head_neck',   'Septated fluid-filled cystic mass on dorsal neck');

-- ── Syndromes (8 high-yield entries) ──
INSERT IGNORE INTO syndromes (name, omim_id, description) VALUES
  ('Trisomy 21 (Down Syndrome)',   '190685', 'Most common autosomal aneuploidy. Associated with NT, NB, cardiac, duodenal anomalies.'),
  ('Trisomy 18 (Edwards Syndrome)','EDW',    'Severe multi-system aneuploidy; clenched hand, cardiac, IUGR.'),
  ('Trisomy 13 (Patau Syndrome)',  '601161', 'Holoprosencephaly, cleft, cardiac, polydactyly.'),
  ('Turner Syndrome (45,X)',       '163950', 'Cystic hygroma, lymphatic anomalies, cardiac.'),
  ('Triploidy',                    '643000', 'Severe IUGR, partial molar placenta.'),
  ('Noonan Syndrome',              '163950', 'RASopathy; NT, cardiac, lymphatic.'),
  ('22q11 Deletion (DiGeorge)',    '188400', 'Conotruncal heart, thymus, palate.'),
  ('Achondroplasia',               '100800', 'Short-limb skeletal dysplasia; FGFR3 mutation.');

-- ── Genes (12 commonly tested) ──
INSERT IGNORE INTO genes (symbol, full_name) VALUES
  ('FGFR3',  'Fibroblast Growth Factor Receptor 3'),
  ('FBN1',   'Fibrillin 1'),
  ('PTPN11', 'Protein Tyrosine Phosphatase Non-Receptor 11'),
  ('SOS1',   'SOS Ras/Rac Guanine Nucleotide Exchange Factor 1'),
  ('RAF1',   'Raf-1 Proto-Oncogene'),
  ('TBX1',   'T-Box Transcription Factor 1'),
  ('NIPBL',  'NIPBL Cohesin Loading Factor'),
  ('CHD7',   'Chromodomain Helicase DNA Binding Protein 7'),
  ('TBX5',   'T-Box Transcription Factor 5'),
  ('JAG1',   'Jagged Canonical Notch Ligand 1'),
  ('COL1A1', 'Collagen Type I Alpha 1 Chain'),
  ('COL2A1', 'Collagen Type II Alpha 1 Chain');

-- ── Investigations (basic + specific buckets) ──
INSERT IGNORE INTO investigations (name, category, description) VALUES
  ('NIPT (cfDNA)',               'basic',    'Cell-free fetal DNA screening for common aneuploidies'),
  ('Maternal Serum Screening',   'basic',    'Combined first-trimester or quadruple test'),
  ('Detailed Anomaly Scan',      'basic',    'Repeat targeted ultrasound at 20–22 weeks'),
  ('Fetal Echocardiography',     'basic',    'Specialist cardiac evaluation at 22–24 weeks'),
  ('MCA Doppler',                'basic',    'Middle cerebral artery Doppler for anaemia/IUGR'),
  ('Amniocentesis (Karyotype)',  'specific', 'Conventional karyotyping on cultured amniocytes'),
  ('Chorionic Villus Sampling',  'specific', 'CVS for early karyotype / molecular testing'),
  ('Microarray (CMA)',           'specific', 'Chromosomal microarray for CNVs'),
  ('FISH (T21/18/13/X/Y)',       'specific', 'Rapid aneuploidy screen by FISH'),
  ('Whole Exome Sequencing',     'specific', 'WES for syndromic phenotypes'),
  ('TORCH Panel',                'specific', 'Serology for congenital infections'),
  ('Karyotype - peripheral blood','specific','Parental karyotype if structural rearrangement suspected');

-- ── Map: which findings suggest which syndromes ──
INSERT IGNORE INTO finding_syndrome_map (finding_id, syndrome_id)
SELECT f.id, s.id FROM findings f, syndromes s
WHERE (f.name, s.name) IN (
  ('Absent Nasal Bone',           'Trisomy 21 (Down Syndrome)'),
  ('Increased Nuchal Translucency','Trisomy 21 (Down Syndrome)'),
  ('Increased Nuchal Translucency','Trisomy 18 (Edwards Syndrome)'),
  ('Increased Nuchal Translucency','Trisomy 13 (Patau Syndrome)'),
  ('Increased Nuchal Translucency','Turner Syndrome (45,X)'),
  ('Increased Nuchal Translucency','Noonan Syndrome'),
  ('Cystic Hygroma',              'Turner Syndrome (45,X)'),
  ('Cystic Hygroma',              'Noonan Syndrome'),
  ('Cystic Hygroma',              'Trisomy 21 (Down Syndrome)'),
  ('Clenched Hand',               'Trisomy 18 (Edwards Syndrome)'),
  ('Short Femur',                 'Trisomy 21 (Down Syndrome)'),
  ('Short Femur',                 'Achondroplasia'),
  ('Echogenic Bowel',             'Trisomy 21 (Down Syndrome)'),
  ('Renal Pelvis Dilatation',     'Trisomy 21 (Down Syndrome)'),
  ('Cardiac Axis Abnormal',       '22q11 Deletion (DiGeorge)'),
  ('Cardiac Axis Abnormal',       'Trisomy 21 (Down Syndrome)'),
  ('Cleft Lip',                   'Trisomy 13 (Patau Syndrome)'),
  ('Absent Bladder',              'Triploidy')
);

-- ── Map: which syndromes are linked to which genes ──
INSERT IGNORE INTO syndrome_gene_map (syndrome_id, gene_id)
SELECT s.id, g.id FROM syndromes s, genes g
WHERE (s.name, g.symbol) IN (
  ('Achondroplasia',           'FGFR3'),
  ('Noonan Syndrome',          'PTPN11'),
  ('Noonan Syndrome',          'SOS1'),
  ('Noonan Syndrome',          'RAF1'),
  ('22q11 Deletion (DiGeorge)','TBX1')
);

-- ── Map: which investigations are appropriate for which findings ──
INSERT IGNORE INTO finding_investigation_map (finding_id, investigation_id)
SELECT f.id, i.id FROM findings f, investigations i
WHERE (f.name, i.name) IN (
  ('Increased Nuchal Translucency','NIPT (cfDNA)'),
  ('Increased Nuchal Translucency','Amniocentesis (Karyotype)'),
  ('Increased Nuchal Translucency','Chorionic Villus Sampling'),
  ('Increased Nuchal Translucency','Microarray (CMA)'),
  ('Absent Nasal Bone',           'NIPT (cfDNA)'),
  ('Cystic Hygroma',              'Microarray (CMA)'),
  ('Cystic Hygroma',              'Amniocentesis (Karyotype)'),
  ('Cardiac Axis Abnormal',       'Fetal Echocardiography'),
  ('Cardiac Axis Abnormal',       'Microarray (CMA)'),
  ('Echogenic Bowel',             'TORCH Panel'),
  ('Echogenic Bowel',             'Amniocentesis (Karyotype)'),
  ('Short Femur',                 'Detailed Anomaly Scan'),
  ('Renal Pelvis Dilatation',     'Detailed Anomaly Scan'),
  ('Spina Bifida',                'Detailed Anomaly Scan'),
  ('Spina Bifida',                'Amniocentesis (Karyotype)')
);
