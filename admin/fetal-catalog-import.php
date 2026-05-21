<?php
/**
 * Admin UI for bulk-importing the fetal catalogs from JSON.
 *
 * The user pastes JSON (typically extracted from ScanOFe via DevTools or
 * the database dump) and clicks Import. The endpoint at
 * /api/fetal/catalog-import.php does the actual upsert.
 *
 * JSON shape (every key optional):
 *
 *   {
 *     "findings":       [{ "name": "…", "system": "…", "description": "…" }, …],
 *     "syndromes":      [{ "name": "…", "omim_id": "…" }, …],
 *     "genes":          [{ "symbol": "FGFR3", "full_name": "…" }, …],
 *     "investigations": [{ "name": "…", "category": "basic|specific" }, …],
 *
 *     "finding_syndrome":      [{ "finding": "Cleft Lip", "syndrome": "Trisomy 13" }],
 *     "syndrome_gene":         [{ "syndrome": "Noonan Syndrome", "gene": "PTPN11" }],
 *     "finding_investigation": [{ "finding": "Echogenic Bowel", "investigation": "TORCH Panel" }]
 *   }
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';

if (!isAdmin()) {
    http_response_code(403);
    die('Access denied — admin login required.');
}

$db = getDbConnection();

// Quick stats for the dashboard pane
$stats = [];
foreach (['findings', 'syndromes', 'genes', 'investigations'] as $t) {
    $r = $db->query("SELECT COUNT(*) c FROM `$t`")->fetch_assoc();
    $stats[$t] = (int)$r['c'];
}
foreach (['finding_syndrome_map', 'syndrome_gene_map', 'finding_investigation_map'] as $t) {
    $r = $db->query("SELECT COUNT(*) c FROM `$t`")->fetch_assoc();
    $stats[$t] = (int)$r['c'];
}

?><!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fetal Catalog Import — Accurate Admin</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
           margin: 0; padding: 0; background: #f5f7fa; color: #1f2937; }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    .sub { color: #6b7280; font-size: 13px; margin-bottom: 18px; }

    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
    .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    .card .value { font-size: 22px; font-weight: 600; margin-top: 2px; }

    .panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; margin-bottom: 18px; }
    .panel h2 { font-size: 15px; margin: 0 0 4px; }
    .panel p { font-size: 13px; color: #6b7280; margin: 0 0 12px; }

    textarea { width: 100%; min-height: 260px; padding: 10px; font-family: "Fira Code", "Cascadia Code", Consolas, monospace;
               font-size: 12px; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical;
               background: #f9fafb; }
    textarea:focus { outline: 2px solid #3b82f6; outline-offset: -1px; }

    .actions { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
    button { padding: 8px 16px; background: #2563eb; color: #fff; border: 0;
             border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    button:disabled { opacity: 0.5; cursor: wait; }
    button.secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
    button.secondary:hover { background: #e5e7eb; }

    .result { margin-top: 12px; padding: 12px; border-radius: 6px; font-size: 12px;
              font-family: "Fira Code", Consolas, monospace; white-space: pre-wrap; }
    .result.ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .result.err { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; }

    code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 12px; }
    .schema { font-size: 12px; background: #f9fafb; padding: 12px; border-radius: 6px;
              border: 1px dashed #d1d5db; white-space: pre-wrap; color: #374151; max-height: 220px; overflow: auto; }
    a { color: #2563eb; }
  </style>
</head>
<body>
<div class="container">
  <h1>Fetal Medicine Catalog Import</h1>
  <p class="sub">Paste JSON exported from ScanOFe (or any other source) and click Import.
     Re-runs are safe — rows are matched by their natural key and upserted.</p>

  <!-- Current catalog stats -->
  <div class="grid">
    <div class="card"><div class="label">Findings</div>      <div class="value"><?= $stats['findings']      ?></div></div>
    <div class="card"><div class="label">Syndromes</div>     <div class="value"><?= $stats['syndromes']     ?></div></div>
    <div class="card"><div class="label">Genes</div>         <div class="value"><?= $stats['genes']         ?></div></div>
    <div class="card"><div class="label">Investigations</div><div class="value"><?= $stats['investigations']?></div></div>
    <div class="card"><div class="label">Finding↔Syndrome</div>      <div class="value"><?= $stats['finding_syndrome_map']      ?></div></div>
    <div class="card"><div class="label">Syndrome↔Gene</div>         <div class="value"><?= $stats['syndrome_gene_map']         ?></div></div>
    <div class="card"><div class="label">Finding↔Investigation</div> <div class="value"><?= $stats['finding_investigation_map'] ?></div></div>
  </div>

  <div class="panel">
    <h2>Paste JSON below</h2>
    <p>The endpoint accepts any subset of the top-level keys. Use the
       <button type="button" class="secondary" onclick="document.getElementById('sample').classList.toggle('hidden')">Show schema</button>
       for the exact shape.</p>

    <div id="sample" class="hidden" style="margin-bottom: 12px;">
      <div class="schema">{
  "findings":       [ { "name": "Cleft Lip",          "system": "face",        "description": "…" } ],
  "syndromes":      [ { "name": "Trisomy 13 (Patau)", "omim_id": "601161",     "description": "…" } ],
  "genes":          [ { "symbol": "FGFR3",            "full_name": "…",        "hgnc_id": "3690" } ],
  "investigations": [ { "name": "Amniocentesis",      "category": "specific",  "description": "…" } ],

  "finding_syndrome":      [ { "finding": "Cleft Lip",      "syndrome":      "Trisomy 13 (Patau)" } ],
  "syndrome_gene":         [ { "syndrome": "Achondroplasia","gene":          "FGFR3" } ],
  "finding_investigation": [ { "finding": "Cleft Lip",      "investigation": "Amniocentesis" } ]
}</div>
    </div>

    <textarea id="payload" placeholder='{ "findings": [...], "syndromes": [...], ... }'></textarea>

    <div class="actions">
      <button id="importBtn" onclick="runImport()">Import</button>
      <button class="secondary" onclick="document.getElementById('payload').value=''">Clear</button>
      <span style="margin-left:auto; font-size:12px; color:#6b7280;">
        Endpoint: <code>POST /api/fetal/catalog-import.php</code>
      </span>
    </div>

    <div id="result"></div>
  </div>
</div>

<style>.hidden { display: none; }</style>

<script>
async function runImport() {
  const btn   = document.getElementById('importBtn');
  const out   = document.getElementById('result');
  const raw   = document.getElementById('payload').value.trim();
  if (!raw) { renderResult({ success: false, error: 'Paste JSON first.' }); return; }

  let body;
  try { body = JSON.parse(raw); }
  catch (e) { renderResult({ success: false, error: 'Invalid JSON: ' + e.message }); return; }

  btn.disabled = true; btn.textContent = 'Importing…';
  out.innerHTML = '';

  try {
    const r = await fetch('/api/fetal/catalog-import.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const json = await r.json();
    renderResult(json);
    if (json.success) setTimeout(() => location.reload(), 1500);
  } catch (e) {
    renderResult({ success: false, error: e.message });
  } finally {
    btn.disabled = false; btn.textContent = 'Import';
  }
}

function renderResult(json) {
  const out = document.getElementById('result');
  const cls = json.success ? 'ok' : 'err';
  out.innerHTML = `<div class="result ${cls}">${
    json.success ? '✓ Import complete\n\n' + JSON.stringify(json.stats, null, 2)
                 : '✗ ' + (json.error || 'Unknown error')
  }</div>`;
}
</script>
</body>
</html>
