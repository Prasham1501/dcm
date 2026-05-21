<?php
/**
 * 010_full_catalog_seed.php
 *
 * Populates findings, syndromes, and genes tables with the COMPLETE catalog
 * from the reference dropdown-options document (~416 findings, ~990 syndromes,
 * ~2 739 genes).  Uses INSERT IGNORE so it's safe to re-run.
 *
 * Run:  php database/migrations/010_full_catalog_seed.php
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';

$db = getDbConnection();
if (!$db) { die("DB connection failed\n"); }

// ─── helpers ──────────────────────────────────────────────────────────────────
function esc(mysqli $db, ?string $s): string {
    return $s === null ? 'NULL' : "'" . $db->real_escape_string($s) . "'";
}

function categoriseFinding(string $name): string {
    $n = strtolower($name);
    // Cardiac / Heart
    if (preg_match('/heart|cardiac|ventricle|atri[ua]|aortic|aorta|pulmonary|mitral|tricuspid|ductus|pericardial|endocard|cardiomeg|avsd|vsd|asd|dorv|hlhs|hrhs|tga|tof|coarctation|arrhythmi|bradycardia|tachyarrhythmia|truncus|ebstein|rhabdomyom|pda|svt|pacs|pvcs|heart block|isomerism|scimitar/i', $n)) return 'Cardiac';
    // CNS / Brain
    if (preg_match('/brain|cerebr|ventricul|holopros|encephal|lissenceph|schizenceph|hydranenceph|hydrocephal|dandy|walker|chiari|molar tooth|cortical|arachnoid|porenceph|periventricular|subependymal|calcification.*brain|intracranial|vein of galen|cisterna magna|choroid plexus|cavum sept|corpus callosum|mega cisterna|colpoceph|polymicro|heterotop|rhomben|pontocerebell|brainstem|cerebell|neural tube|anenceph|exencephaly|acrania|spina bifid|myelomening|meningomyel/i', $n)) return 'CNS';
    // Face
    if (preg_match('/cleft|facial|micrognath|retrogn|nose|nasal|orbit|eye|ocular|ophthalm|cataract|glaucoma|ear |ears|mandib|maxill|lip |hypertel|hypotel|cyclop|proboscis|binder|frontal boss|telecanthus|palpebral|macroglossia|epigna|choanal|teratoma.*face|teratoma.*cervic|hemangioma.*fac/i', $n)) return 'Face';
    // Skeletal / Limbs
    if (preg_match('/limb|femur|bone|skeletal|dysplasia|polydactyly|syndactyly|ectrodact|club feet|talipes|achondr|osteogen|thanatoph|phocomel|amelia|rhizome|mesomeli|micromeli|brachyturr|contracture|arthrogryp|clavicul|rib |short rib|narrow chest|hypoplastic thorax|craniosyn|skull ossif|unossified|plagioceph|turri|dolichoceph|brachyceph|rocker.*bottom|overlap|clenched|clinodactyly|camptodac|triphalangeal|radius|radial|oligodactyly|limb reduction/i', $n)) return 'Skeletal';
    // Renal / Urinary
    if (preg_match('/kidney|renal|hydroneph|megacyst|bladder|ureter|ureth|pyelectasis|mcdk|polycystic|dysplastic kidney|horseshoe|pelvic kidney|ectopic kidney|cakut|megaureter|ureterocele|posterior urethral/i', $n)) return 'Renal';
    // GI / Abdominal
    if (preg_match('/bowel|intestin|duodenal|esophageal|gastro|omphalocele|exomphal|abdominal wall|ascites|hepat|liver|gallbladd|meconium|choledoch|pyloric|anal atresia|anorectal|cloacal|hirschsprung|echogenic bowel|stomach|hyperechoic bowel|volvulus|small bowel|protuberant abdom/i', $n)) return 'GI';
    // Thorax / Lung
    if (preg_match('/lung|pulmonary hypoplasia|ccam|cpam|diaphragm|hernia.*diaphragm|cdh|pleural|hydrothorax|bronch|thoracic|mediastin|chaos|congenital lobar|lymphangioma|sequestration|thoracomeg/i', $n)) return 'Thorax';
    // Vascular / Cord
    if (preg_match('/umbilical|cord|single umbilical|sua|pruv|vasa previa|velamentous|varix/i', $n)) return 'Vascular';
    // Hydrops / Fluid
    if (preg_match('/hydrops|cystic hygroma|nuchal|edema|lymph|polyhydramnios|oligohydramnios|non.immune/i', $n)) return 'Fluid';
    // Genital
    if (preg_match('/genital|ambiguous|ovarian|cryptorchid|micropenis|clitoromeg|hypogonad|penoscrotal|hydrometrocolpos|hydrocolpos|vulvar/i', $n)) return 'Genital';
    // Spine
    if (preg_match('/spinal|vertebr|diastematomyelia|sacral|spina bifida occulta/i', $n)) return 'Spine';
    // Growth
    if (preg_match('/iugr|growth restriction|fetal brain spar|macroceph|microceph|overgrowth|small.*abdominal circ/i', $n)) return 'Growth';
    // Placenta/Markers
    if (preg_match('/intracardiac echogenic|single umbilical|echogenic focus|soft marker|nt |nasal bone|it |increased nt/i', $n)) return 'Markers';
    return 'General';
}

function generateFindingDescription(string $name): string {
    $n = strtolower($name);
    $descriptions = [
        'absent nasal bone' => 'Absence of visible nasal bone ossification on ultrasound. A soft marker for chromosomal aneuploidies, particularly Trisomy 21 (Down syndrome). Should be evaluated in the context of other markers and maternal risk factors.',
        'increased nt' => 'Increased nuchal translucency (NT) measurement beyond the 95th percentile for gestational age. Associated with chromosomal abnormalities (T21, T18, T13), cardiac defects, and other structural anomalies. Requires further evaluation with NIPT or invasive testing.',
        'ventriculomegaly' => 'Dilatation of the lateral cerebral ventricles measuring ≥10 mm at the level of the atrium. Mild (10–12 mm) may be isolated and has a generally favorable prognosis, while severe (>15 mm) is frequently associated with additional anomalies. Requires serial monitoring and karyotyping.',
        'anencephaly' => 'Absence of the calvarium and cerebral hemispheres above the level of the orbits. It is the most severe neural tube defect and is uniformly lethal. Diagnosed reliably in the first trimester by absence of the cranial vault.',
        'spina bifida' => 'Open spinal dysraphism with herniation of meninges (meningocele) or meninges with neural tissue (myelomeningocele) through a vertebral defect. Diagnosed by the "lemon sign" (frontal bone scalloping) and "banana sign" (cerebellar compression). Level of the defect determines neurological outcome.',
        'cleft lip' => 'A gap or split in the upper lip that may extend to the nose and palate. Can be unilateral or bilateral, isolated or associated with other anomalies. Isolated cleft lip/palate generally has a good surgical prognosis.',
        'congenital diaphragmatic hernia' => 'Herniation of abdominal contents into the thoracic cavity through a defect in the diaphragm, most commonly left-sided (Bochdalek type). Causes pulmonary hypoplasia and pulmonary hypertension. Prognosis depends on lung-to-head ratio (LHR) and liver herniation status.',
        'tetralogy of fallot' => 'A conotruncal cardiac anomaly consisting of ventricular septal defect, overriding aorta, right ventricular outflow tract obstruction, and right ventricular hypertrophy. Diagnosed prenatally by the overriding aorta and VSD. Surgically correctable with generally good long-term outcomes.',
        'omphalocele' => 'Herniation of abdominal contents (typically bowel and/or liver) through the umbilical ring, covered by a membrane of peritoneum and amnion. Associated with chromosomal anomalies (especially Trisomy 18) when small and containing only bowel. Liver-containing omphaloceles more often associated with Beckwith-Wiedemann syndrome.',
        'gastroschisis' => 'Full-thickness defect of the abdominal wall, typically to the right of a normally inserted umbilical cord, with free-floating herniated bowel without a covering membrane. Usually isolated and not associated with chromosomal anomalies. Prognosis depends on bowel condition (simple vs. complex).',
        'clubfoot' => 'Fixed equinovarus deformity of the foot with medial deviation and plantar flexion. When isolated, usually treatable with serial casting (Ponseti method). Bilateral clubfoot or association with other anomalies warrants karyotyping.',
        'hydrops' => 'Abnormal accumulation of fluid in two or more fetal body compartments (ascites, pleural effusion, pericardial effusion, skin edema). Non-immune hydrops has diverse etiologies including cardiac, chromosomal, infectious, metabolic, and hematologic causes. Requires comprehensive evaluation.',
        'renal agenesis' => 'Absence of one or both kidneys. Bilateral renal agenesis causes severe oligohydramnios, pulmonary hypoplasia, and is lethal (Potter sequence). Unilateral renal agenesis is usually compatible with normal life with the contralateral kidney compensating.',
        'polydactyly' => 'Presence of extra digits on hands or feet, classified as preaxial (thumb/great toe side) or postaxial (little finger/toe side). Isolated postaxial polydactyly is the most common and often autosomal dominant with variable expressivity. Preaxial polydactyly and polydactyly with other anomalies requires further evaluation.',
    ];

    // Check if we have a specific description
    foreach ($descriptions as $key => $desc) {
        if (strpos($n, $key) !== false) return $desc;
    }

    // Generate from the name
    $system = categoriseFinding($name);
    $systemText = [
        'Cardiac'  => 'cardiovascular system',
        'CNS'      => 'central nervous system',
        'Face'     => 'craniofacial structures',
        'Skeletal' => 'musculoskeletal system',
        'Renal'    => 'urinary system',
        'GI'       => 'gastrointestinal system',
        'Thorax'   => 'thorax and lungs',
        'Vascular' => 'fetal vasculature',
        'Fluid'    => 'fetal fluid dynamics',
        'Genital'  => 'genitourinary structures',
        'Spine'    => 'spinal column',
        'Growth'   => 'fetal growth parameters',
        'Markers'  => 'ultrasound screening markers',
        'General'  => 'fetal anatomy',
    ][$system] ?? 'fetal anatomy';

    return "Ultrasound finding involving the $systemText. $name should be evaluated in the context of other structural findings and maternal history. When identified, further assessment may include detailed anatomical survey, fetal echocardiography, chromosomal analysis, and serial growth monitoring as clinically indicated.";
}

function generateSyndromeDescription(string $name): string {
    $n = strtolower($name);
    $descriptions = [
        'trisomy 21' => 'Down syndrome — the most common chromosomal aneuploidy, caused by an extra copy of chromosome 21. Prenatal ultrasound findings include increased NT, absent/hypoplastic nasal bone, shortened femur and humerus, echogenic bowel, pyelectasis, sandal gap, and AVSD. Confirmed by karyotype or FISH. Associated with intellectual disability, cardiac defects (40-50%), and other organ involvement.',
        'trisomy 18' => 'Edwards syndrome — caused by an extra copy of chromosome 18. Characterized by IUGR, clenched hands with overlapping fingers, rocker-bottom feet, choroid plexus cysts, cardiac defects, omphalocele, and strawberry-shaped skull. Median survival is 5-15 days; 90% die within the first year.',
        'trisomy 13' => 'Patau syndrome — caused by an extra copy of chromosome 13. Features include holoprosencephaly, midline facial defects, polydactyly, echogenic kidneys, cardiac defects, and omphalocele. Median survival is 7-10 days.',
        'turner syndrome' => 'Monosomy X (45,X) — affects females. Prenatal features include large cystic hygroma, generalized hydrops, coarctation of the aorta, horseshoe kidney, and short femur. Postnatal features include short stature, ovarian dysgenesis, and webbed neck.',
        'digeorge' => '22q11.2 deletion syndrome (DiGeorge/velocardiofacial) — microdeletion at chromosome 22q11.2. Prenatal features include conotruncal cardiac defects (TOF, interrupted aortic arch, truncus arteriosus), thymic hypoplasia, and polyhydramnios. Postnatal features include hypocalcemia, immune deficiency, palatal anomalies, and learning difficulties.',
        'noonan' => 'Noonan syndrome — autosomal dominant RASopathy caused by mutations in PTPN11, SOS1, RAF1, RIT1, and other genes. Prenatal features include increased NT/cystic hygroma, polyhydramnios, pulmonary stenosis, and mild renal anomalies. Postnatal features include short stature, characteristic facies, cardiac defects, and variable developmental delay.',
        'achondroplasia' => 'Achondroplasia — the most common skeletal dysplasia, caused by gain-of-function mutations in FGFR3. Prenatal features become apparent in the late 2nd to 3rd trimester: rhizomelic shortening (especially femur), frontal bossing, trident hand configuration, and relative macrocephaly. Intelligence is normal.',
        'beckwith-wiedemann' => 'Beckwith-Wiedemann syndrome — overgrowth disorder caused by genetic and epigenetic changes at 11p15.5. Prenatal features include macrosomia, omphalocele, macroglossia, hepatomegaly, polyhydramnios, and placentomegaly. Associated with increased risk of embryonal tumors (Wilms tumor, hepatoblastoma).',
        'smith-lemli-opitz' => 'Smith-Lemli-Opitz syndrome — autosomal recessive disorder of cholesterol biosynthesis caused by mutations in DHCR7. Prenatal features include IUGR, microcephaly, 2-3 toe syndactyly, ambiguous genitalia, polydactyly, cardiac defects, and cleft palate. Confirmed by elevated 7-dehydrocholesterol levels.',
        'meckel-gruber' => 'Meckel-Gruber syndrome — autosomal recessive ciliopathy with the classic triad of occipital encephalocele, bilateral enlarged cystic kidneys, and postaxial polydactyly. Additional features include hepatic fibrosis and oligohydramnios. It is lethal in most cases.',
        'fryns syndrome' => 'Fryns syndrome — autosomal recessive disorder characterized by congenital diaphragmatic hernia, distal digital hypoplasia, coarse facial features, lung hypoplasia, and other anomalies. It is one of the most common multiple malformation syndromes associated with CDH.',
        'wolf' => 'Wolf-Hirschhorn syndrome — caused by deletion of the short arm of chromosome 4 (4p-). Prenatal features include severe IUGR, microcephaly, "Greek warrior helmet" facial profile, hypertelorism, cleft lip/palate, and cardiac defects. Associated with severe intellectual disability and seizures.',
        'cri du chat' => 'Cri du Chat syndrome — caused by deletion of the short arm of chromosome 5 (5p-). Prenatal features include microcephaly, IUGR, and cardiac defects. Postnatal features include high-pitched cry (cat-like), intellectual disability, round face, and hypertelorism.',
        'triploidy' => 'Triploidy — presence of three complete sets of chromosomes (69,XXX or 69,XXY). Features depend on parental origin: diandric (paternal) → partial molar placenta with normal or large-for-dates fetus; digynic (maternal) → asymmetric IUGR with small placenta. Severe anomalies include holoprosencephaly, neural tube defects, syndactyly, and cardiac defects.',
        'klinefelter' => 'Klinefelter syndrome (47,XXY) — the most common sex chromosome aneuploidy in males. Rarely diagnosed prenatally as most affected individuals have normal appearance. May present with borderline increased NT. Postnatal features include tall stature, small testes, gynecomastia, and infertility.',
        'joubert' => 'Joubert syndrome — autosomal recessive ciliopathy characterized by the "molar tooth sign" on MRI (cerebellar vermis hypoplasia with elongated superior cerebellar peduncles). Prenatal features include vermian hypoplasia, enlarged posterior fossa, and renal anomalies. Associated with intellectual disability, ataxia, and abnormal breathing patterns.',
        'charge' => 'CHARGE syndrome — caused by mutations in CHD7. Acronym: Coloboma, Heart defects, Atresia of choanae, Retardation of growth/development, Genital anomalies, Ear anomalies. Prenatal features include semicircular canal aplasia, conotruncal heart defects, cleft lip/palate, and genital anomalies.',
        'vacterl' => 'VACTERL association — non-random co-occurrence of Vertebral anomalies, Anal atresia, Cardiac defects, Tracheoesophageal fistula, Renal anomalies, and Limb defects (especially radial). Diagnosis requires at least 3 components. Usually sporadic with a good prognosis after surgical correction.',
        'cornelia de lange' => 'Cornelia de Lange syndrome — caused by mutations in cohesin genes (NIPBL, SMC1A, SMC3, HDAC8, RAD21). Prenatal features include IUGR, diaphragmatic hernia, limb reduction defects (especially upper limbs), and cardiac anomalies. Postnatal features include characteristic facies, hirsutism, and intellectual disability.',
        'prader-willi' => 'Prader-Willi syndrome — caused by loss of paternally expressed genes at 15q11-q13. Prenatal features include reduced fetal movements and polyhydramnios. Postnatal features include neonatal hypotonia, feeding difficulties followed by obesity, hypogonadism, short stature, and mild-moderate intellectual disability.',
        'angelman' => 'Angelman syndrome — caused by loss of the maternally expressed UBE3A gene at 15q11-q13. Prenatal ultrasound is usually normal. Postnatal features include severe intellectual disability, absence of speech, happy affect with frequent laughter, seizures, and ataxic movements.',
        'apert' => 'Apert syndrome — autosomal dominant craniosynostosis syndrome caused by specific mutations in FGFR2 (Ser252Trp or Pro253Arg). Prenatal features include coronal craniosynostosis, turribrachycephaly, midface hypoplasia, and symmetric syndactyly of hands and feet ("mitten hands"). Most cases are de novo mutations.',
        'holt-oram' => 'Holt-Oram syndrome — autosomal dominant disorder caused by mutations in TBX5. Characterized by upper limb defects (especially thumb anomalies and radial ray defects) combined with congenital heart defects (ASD, VSD). All patients have some degree of upper limb involvement.',
        'treacher collins' => 'Treacher Collins syndrome — autosomal dominant disorder caused by mutations in TCOF1, POLR1C, or POLR1D. Prenatal features include mandibular hypoplasia (micrognathia), malar hypoplasia, downslanting palpebral fissures, and external ear anomalies. Intelligence is usually normal.',
        'marfan' => 'Marfan syndrome — autosomal dominant connective tissue disorder caused by mutations in FBN1 (fibrillin-1). Prenatal features in severe neonatal Marfan include arachnodactyly, cardiac valve regurgitation, and lens subluxation. Most cases present postnatally with tall stature, long limbs, aortic root dilation, and lens dislocation.',
    ];

    foreach ($descriptions as $key => $desc) {
        if (strpos($n, $key) !== false) return $desc;
    }

    // Trisomy generic
    if (preg_match('/trisomy\s+(\d+)/i', $name, $m)) {
        return "Trisomy $m[1] — a chromosomal aneuploidy involving an extra copy of chromosome $m[1]. When identified prenatally, it may present with characteristic structural anomalies depending on the specific chromosome involved. Further evaluation with karyotype analysis and detailed anatomical survey is recommended. Prognosis varies depending on whether the trisomy is full or mosaic.";
    }

    // Deletion / microdeletion
    if (preg_match('/deletion|microdeletion/i', $name)) {
        return "$name — a chromosomal disorder involving loss of genetic material. Prenatal features may include structural anomalies depending on the genes involved in the deleted region. Diagnosis is confirmed by chromosomal microarray (CMA) or FISH. Clinical significance varies based on the size and location of the deletion.";
    }

    // Duplication
    if (preg_match('/duplication/i', $name)) {
        return "$name — a chromosomal disorder involving duplication of genetic material. May present with variable phenotypic features depending on the region duplicated. Diagnosis is confirmed by chromosomal microarray (CMA). Clinical significance depends on the genes involved.";
    }

    // Dysplasia
    if (preg_match('/dysplasia/i', $name)) {
        return "$name — a developmental disorder involving abnormal tissue differentiation or growth. Prenatal diagnosis may be suggested by characteristic ultrasound findings. Genetic testing is recommended for confirmation and recurrence risk counseling. Management depends on the specific type and severity.";
    }

    // Syndrome generic
    return "$name — a clinically recognized syndrome that may present with characteristic prenatal ultrasound findings. When suspected, detailed anatomical survey, fetal echocardiography, and genetic testing (karyotype, microarray, or targeted gene panel) should be considered. Genetic counseling is recommended for recurrence risk assessment and family planning.";
}

// ─── Begin seeding ────────────────────────────────────────────────────────────

echo "Loading parsed JSON lists from docs/ ...\n";

function loadJson(string $path): array {
    $raw = file_get_contents($path);
    // Strip UTF-8 BOM
    if (substr($raw, 0, 3) === "\xEF\xBB\xBF") {
        $raw = substr($raw, 3);
    }
    $result = json_decode($raw, true);
    if ($result === null) {
        die("Failed to parse $path: " . json_last_error_msg() . "\n");
    }
    return $result;
}

$findingsRaw  = loadJson(__DIR__ . '/../../docs/parsed_findings.json');
$syndromesRaw = loadJson(__DIR__ . '/../../docs/parsed_syndromes.json');
$genesRaw     = loadJson(__DIR__ . '/../../docs/parsed_genes.json');

echo "Findings:  " . count($findingsRaw)  . "\n";
echo "Syndromes: " . count($syndromesRaw) . "\n";
echo "Genes:     " . count($genesRaw)     . "\n";

// ─── 1. FINDINGS ──────────────────────────────────────────────────────────────
echo "\nSeeding findings...\n";
$db->query("ALTER TABLE findings ADD COLUMN IF NOT EXISTS details_md TEXT NULL AFTER description");

$batchSize = 50;
$inserted = 0;
$chunks = array_chunk($findingsRaw, $batchSize);
foreach ($chunks as $chunk) {
    $values = [];
    foreach ($chunk as $name) {
        $name = trim($name);
        if ($name === '') continue;
        $system = categoriseFinding($name);
        $desc = generateFindingDescription($name);
        $values[] = "(" . esc($db, $name) . ", " . esc($db, $system) . ", " . esc($db, $desc) . ", " . esc($db, $desc) . ")";
    }
    if ($values) {
        $sql = "INSERT IGNORE INTO findings (name, system, description, details_md) VALUES " . implode(",\n", $values);
        if (!$db->query($sql)) {
            echo "  Error: " . $db->error . "\n";
        } else {
            $inserted += $db->affected_rows;
        }
    }
}
echo "  Inserted $inserted new findings\n";

// ─── 2. SYNDROMES ─────────────────────────────────────────────────────────────
echo "\nSeeding syndromes...\n";
$db->query("ALTER TABLE syndromes ADD COLUMN IF NOT EXISTS references_md TEXT NULL AFTER description");

$inserted = 0;
$chunks = array_chunk($syndromesRaw, $batchSize);
foreach ($chunks as $chunk) {
    $values = [];
    foreach ($chunk as $name) {
        $name = trim($name);
        if ($name === '') continue;
        $desc = generateSyndromeDescription($name);
        $values[] = "(" . esc($db, $name) . ", NULL, " . esc($db, $desc) . ", " . esc($db, $desc) . ")";
    }
    if ($values) {
        $sql = "INSERT IGNORE INTO syndromes (name, omim_id, description, references_md) VALUES " . implode(",\n", $values);
        if (!$db->query($sql)) {
            echo "  Error: " . $db->error . "\n";
        } else {
            $inserted += $db->affected_rows;
        }
    }
}
echo "  Inserted $inserted new syndromes\n";

// ─── 3. GENES ─────────────────────────────────────────────────────────────────
echo "\nSeeding genes...\n";
$db->query("ALTER TABLE genes ADD COLUMN IF NOT EXISTS description TEXT NULL AFTER hgnc_id");

$inserted = 0;
$chunks = array_chunk($genesRaw, $batchSize);
foreach ($chunks as $chunk) {
    $values = [];
    foreach ($chunk as $symbol) {
        $symbol = trim($symbol);
        if ($symbol === '' || strlen($symbol) > 100) continue;
        // Skip entries that look like multi-gene combos (contain +)
        if (strpos($symbol, '+') !== false) continue;
        $desc = "Gene $symbol — associated with fetal structural and/or functional anomalies. When identified through genetic testing, this gene may be relevant to the observed prenatal phenotype. Mutations in $symbol have been reported in association with congenital conditions. Refer to OMIM and GeneReviews for detailed genotype-phenotype correlations.";
        $values[] = "(" . esc($db, $symbol) . ", NULL, NULL, " . esc($db, $desc) . ")";
    }
    if ($values) {
        $sql = "INSERT IGNORE INTO genes (symbol, full_name, hgnc_id, description) VALUES " . implode(",\n", $values);
        if (!$db->query($sql)) {
            echo "  Error: " . $db->error . "\n";
        } else {
            $inserted += $db->affected_rows;
        }
    }
}
echo "  Inserted $inserted new genes\n";

// ─── 4. Build finding↔syndrome mappings ──────────────────────────────────────
echo "\nBuilding finding↔syndrome cross-references...\n";

// Map of finding keywords → syndrome keywords for common associations
$findingSyndromeLinks = [
    'absent nasal bone'          => ['trisomy 21', 'trisomy 18', 'trisomy 13', 'turner'],
    'increased nt'               => ['trisomy 21', 'trisomy 18', 'trisomy 13', 'turner', 'noonan'],
    'ventriculomegaly'           => ['trisomy 21', 'trisomy 13', 'walker-warburg', 'joubert', 'aicardi'],
    'anencephaly'                => ['acrania-exencephaly', 'meckel-gruber'],
    'encephalocele'              => ['meckel-gruber', 'walker-warburg'],
    'holoprosencephaly'          => ['trisomy 13', 'smith-lemli-opitz', 'triploidy'],
    'congenital diaphragmatic hernia' => ['fryns', 'cornelia de lange', 'pallister-killian'],
    'omphalocele'                => ['trisomy 18', 'trisomy 13', 'beckwith-wiedemann', 'triploidy'],
    'gastroschisis'              => [],
    'cleft lip'                  => ['trisomy 13', 'van der woude', 'pierre robin', 'treacher collins'],
    'micrognathia'               => ['trisomy 18', 'pierre robin', 'treacher collins', 'cornelia de lange', 'stickler'],
    'cystic hygroma'             => ['turner', 'trisomy 21', 'trisomy 18', 'noonan'],
    'choroid plexus cyst'        => ['trisomy 18'],
    'polydactyly'                => ['trisomy 13', 'meckel-gruber', 'bardet', 'smith-lemli-opitz', 'short rib', 'pallister-hall', 'greig'],
    'atrioventricular septal defect' => ['trisomy 21', 'heterotaxy', 'ellis-van creveld'],
    'tetralogy of fallot'        => ['22q11', 'digeorge', 'trisomy 21'],
    'single umbilical artery'    => ['trisomy 18', 'vacterl'],
    'echogenic bowel'            => ['trisomy 21', 'cystic fibrosis', 'cmv'],
    'renal agenesis'             => ['potter', 'vacterl', 'fraser'],
    'clubfoot'                   => ['trisomy 18', 'spina bifida', 'arthrogryposis'],
    'cardiac rhabdomyoma'        => ['tuberous sclerosis'],
    'dandy-walker'               => ['trisomy 13', 'trisomy 18', 'joubert', 'walker-warburg', 'aicardi'],
    'congenital heart block'     => ['maternal anti-ro'],
    'bilateral hydronephrosis'   => ['posterior urethral valves', 'megacystis', 'prune belly'],
    'sacrococcygeal teratoma'    => ['currarino'],
    'short limbs'                => ['achondroplasia', 'thanatophoric', 'osteogenesis imperfecta'],
    'absent radius'              => ['tar syndrome', 'holt-oram', 'fanconi', 'vacterl'],
    'intracardiac echogenic focus' => ['trisomy 21'],
    'hydrops'                    => ['turner', 'trisomy 21', 'alpha-thalassemia', 'parvovirus'],
    'corpus callosum'            => ['aicardi', 'acrocallosal', 'mowat wilson', 'coffin-siris'],
    'ambiguous genitalia'        => ['androgen insensitivity', 'cah', 'smith-lemli-opitz'],
    'nuchal edema'               => ['trisomy 21', 'trisomy 18', 'turner'],
    'duodenal atresia'           => ['trisomy 21'],
    'coarctation of the aorta'   => ['turner', 'digeorge'],
    'multicystic dysplastic kidney' => ['autosomal recessive polycystic'],
];

$linkCount = 0;
foreach ($findingSyndromeLinks as $findingKey => $syndromeKeys) {
    // Find the finding ID(s)
    $fStmt = $db->prepare("SELECT id FROM findings WHERE LOWER(name) LIKE ?");
    $flike = '%' . strtolower($findingKey) . '%';
    $fStmt->bind_param('s', $flike);
    $fStmt->execute();
    $findingRows = $fStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    foreach ($findingRows as $fRow) {
        foreach ($syndromeKeys as $sKey) {
            $sStmt = $db->prepare("SELECT id FROM syndromes WHERE LOWER(name) LIKE ?");
            $slike = '%' . strtolower($sKey) . '%';
            $sStmt->bind_param('s', $slike);
            $sStmt->execute();
            $syndromeRows = $sStmt->get_result()->fetch_all(MYSQLI_ASSOC);
            foreach ($syndromeRows as $sRow) {
                $db->query("INSERT IGNORE INTO finding_syndrome_map (finding_id, syndrome_id) VALUES ({$fRow['id']}, {$sRow['id']})");
                if ($db->affected_rows > 0) $linkCount++;
            }
        }
    }
}
echo "  Created $linkCount new finding↔syndrome links\n";

// ─── Done ─────────────────────────────────────────────────────────────────────
$totalF = (int)$db->query("SELECT COUNT(*) c FROM findings")->fetch_assoc()['c'];
$totalS = (int)$db->query("SELECT COUNT(*) c FROM syndromes")->fetch_assoc()['c'];
$totalG = (int)$db->query("SELECT COUNT(*) c FROM genes")->fetch_assoc()['c'];
$totalL = (int)$db->query("SELECT COUNT(*) c FROM finding_syndrome_map")->fetch_assoc()['c'];

echo "\n=== CATALOG TOTALS ===\n";
echo "  Findings:  $totalF\n";
echo "  Syndromes: $totalS\n";
echo "  Genes:     $totalG\n";
echo "  F↔S links: $totalL\n";
echo "\nDone!\n";
