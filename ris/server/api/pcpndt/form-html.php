<?php
/**
 * PCPNDT — printable Form F (HTML for browser print / Save-as-PDF).
 * GET ?study_uid=<uid>  -> text/html (full statutory Form F)
 * The printed, physically-signed copy is the legally-required record (Rule 9(7)).
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisPcpndtMapper.php';
require_once __DIR__ . '/../../includes/ris/RisPcpndtRepository.php';

if (!validateSession()) { header('Content-Type: application/json'); sendErrorResponse('Unauthorized', 401); }

$studyUid = trim((string) ($_GET['study_uid'] ?? ''));
$row = $studyUid !== '' ? (new RisPcpndtRepository(getDbConnection()))->getByStudy($studyUid) : null;
if (!$row) { header('Content-Type: application/json'); sendErrorResponse('No Form F saved for this study. Save the form first.', 404); }

$indications = $row['indications'] ? (json_decode($row['indications'], true) ?: []) : [];
$procedures  = $row['procedures'] ? (json_decode($row['procedures'], true) ?: []) : [];
$e = fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES, 'UTF-8');
$field = fn($label, $val) => '<tr><td class="lbl">' . $label . '</td><td class="val">' . $val . '</td></tr>';
$check = fn($on) => $on ? '☑' : '☐';

header('Content-Type: text/html; charset=utf-8');
?><!doctype html>
<html><head><meta charset="utf-8"><title>Form F — <?= $e($row['patient_name']) ?></title>
<style>
  body { font-family: 'Times New Roman', serif; color:#111; margin:22px; font-size:12.5px; line-height:1.35; }
  h1 { text-align:center; font-size:16px; margin:0 0 2px; }
  .sub { text-align:center; font-size:11px; margin:0 0 12px; }
  table { width:100%; border-collapse:collapse; margin-bottom:8px; }
  td { border:1px solid #555; padding:4px 7px; vertical-align:top; }
  td.lbl { width:40%; background:#f3f3f3; font-weight:bold; }
  .sect { font-weight:bold; background:#e7e7e7; padding:4px 7px; border:1px solid #555; margin-top:8px; }
  ul.opts { margin:4px 0; padding-left:4px; list-style:none; }
  ul.opts li { margin:2px 0; }
  .decl { font-size:11.5px; margin-top:10px; border:1px solid #999; padding:7px; }
  .sign { margin-top:26px; display:flex; justify-content:space-between; }
  .sign div { width:45%; border-top:1px solid #333; padding-top:4px; text-align:center; font-size:11.5px; }
  .note { font-size:10px; color:#555; margin-top:16px; }
  @media print { .noprint { display:none; } body { margin:0; } }
</style></head>
<body>
  <button class="noprint" onclick="window.print()" style="float:right">Print</button>
  <h1>FORM F</h1>
  <div class="sub">[See proviso to Section 4(3), rule 9(4) and rule 10(1A)] — Record of Pre-Natal Diagnostic Procedures</div>

  <table><?= $field('Ref. No.', $e($row['ref_no'])) ?><?= $field('Date', $e($row['procedure_date'])) ?></table>

  <div class="sect">1. Genetic Clinic / Ultrasound Clinic / Imaging Centre</div>
  <table>
    <?= $field('Name', $e($row['clinic_name'])) ?>
    <?= $field('Registration No.', $e($row['clinic_registration_no'])) ?>
    <?= $field('Address', $e($row['clinic_address'])) ?>
  </table>

  <div class="sect">2. Particulars of pregnant woman</div>
  <table>
    <?= $field('Name', $e($row['patient_name'])) ?>
    <?= $field('Age (completed years)', $e($row['patient_age'])) ?>
    <?= $field('Husband&#39;s / Father&#39;s name', $e($row['husband_or_father_name'])) ?>
    <?= $field('Full postal address', $e($row['full_address'])) ?>
    <?= $field('Telephone / Mobile', $e($row['phone'])) ?>
    <?= $field('ID proof', trim($e($row['id_proof_type']) . ' ' . $e($row['id_proof_number']))) ?>
    <?= $field('No. of living children (with sex)', trim($e($row['num_living_children']) . ' ' . $e($row['children_details']))) ?>
    <?= $field('Last menstrual period (LMP)', $e($row['lmp_date'])) ?>
    <?= $field('Weeks of pregnancy / Gestational age', $e($row['gestational_age'])) ?>
    <?= $field('Expected date of delivery (EDD)', $e($row['edd'])) ?>
  </table>

  <div class="sect">3. History of genetic / medical disease in the family</div>
  <table>
    <?= $field('Details', $e($row['family_history']) ?: '—') ?>
    <?= $field('Basis of diagnosis', $e($row['basis_of_diagnosis']) ?: '—') ?>
  </table>

  <div class="sect">4. Indication(s) for pre-natal diagnostic procedure</div>
  <ul class="opts">
    <?php foreach (RisPcpndtMapper::INDICATIONS as $opt): ?>
      <li><?= $check(in_array($opt, $indications, true)) ?> <?= $e($opt) ?></li>
    <?php endforeach; ?>
  </ul>

  <div class="sect">5. Procedure(s) carried out</div>
  <table><?= $field('Type', $e($row['procedure_type'])) ?></table>
  <ul class="opts">
    <?php foreach (RisPcpndtMapper::PROCEDURES as $opt): ?>
      <li><?= $check(in_array($opt, $procedures, true)) ?> <?= $e($opt) ?></li>
    <?php endforeach; ?>
  </ul>
  <table>
    <?= $field('Date(s) of procedure', $e($row['procedure_date'])) ?>
    <?= $field('Any complication of procedure', $e($row['complications']) ?: 'None') ?>
    <?= $field('Result of procedure', $e($row['result']) ?: 'See enclosed report') ?>
    <?= $field('Result conveyed to pregnant woman', $e($row['result_conveyed'])) ?>
  </table>

  <div class="sect">6. Referral & person conducting the procedure</div>
  <table>
    <?= $field('Referred by (name)', $e($row['referring_doctor'])) ?>
    <?= $field('Referring doctor address', $e($row['referring_doctor_address']) ?: '—') ?>
    <?= $field('Referring doctor Reg. No.', $e($row['referring_doctor_reg_no']) ?: '—') ?>
    <?= $field('Procedure conducted by', $e($row['performing_doctor'])) ?>
    <?= $field('Qualification', $e($row['performing_doctor_qualification']) ?: '—') ?>
    <?= $field('Registration No.', $e($row['performing_doctor_reg_no']) ?: '—') ?>
  </table>

  <div class="decl">
    <strong>Declaration of pregnant woman</strong><br>
    I, <strong><?= $e($row['patient_name']) ?></strong>, declare that by undergoing ultrasonography / image scanning
    etc., I do not want to know the sex of my foetus.
  </div>
  <div class="decl">
    <strong>Declaration of person conducting ultrasonography / image scanning</strong><br>
    I, <strong><?= $e($row['performing_doctor']) ?></strong>, declare that while conducting ultrasonography /
    image scanning on <strong><?= $e($row['patient_name']) ?></strong>, I have neither detected nor disclosed
    the sex of her foetus to anybody in any manner.
  </div>

  <div class="sign">
    <div>Signature / thumb impression of pregnant woman</div>
    <div>Name, signature &amp; seal of doctor</div>
  </div>
  <div class="note">This printed, signed copy is the record required under PC-PNDT Rule 9(7).</div>
</body></html>
