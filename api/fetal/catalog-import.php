<?php
/**
 * Catalog Import API — bulk-loads findings, syndromes, genes, investigations
 * and their relationship maps from a JSON payload.
 *
 *   POST  body = {
 *     findings:        [{name, system?, description?, details_md?}],
 *     syndromes:       [{name, omim_id?, description?, references_md?}],
 *     genes:           [{symbol, full_name?, hgnc_id?, description?}],
 *     investigations:  [{name, category, description?}],
 *     finding_syndrome:    [{finding, syndrome}],          // names
 *     syndrome_gene:       [{syndrome, gene}],             // names/symbol
 *     finding_investigation:[{finding, investigation}],    // names
 *   }
 *
 * Catalog rows are upserted by their natural-key UNIQUE column
 * (`name` for findings/syndromes/investigations, `symbol` for genes).
 * Maps are INSERT IGNORE so re-runs are idempotent.
 *
 * Returns a per-table count of inserted/updated/skipped rows.
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!validateSession() && !isLocalRequest()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

function respond(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond(['success' => false, 'error' => 'POST only'], 405);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) respond(['success' => false, 'error' => 'Invalid JSON body'], 400);

$db = getDbConnection();
$db->begin_transaction();

try {
    $stats = [
        'findings'              => importFindings($db,       $body['findings']               ?? []),
        'syndromes'             => importSyndromes($db,      $body['syndromes']              ?? []),
        'genes'                 => importGenes($db,          $body['genes']                  ?? []),
        'investigations'        => importInvestigations($db, $body['investigations']         ?? []),
        'finding_syndrome'      => importFindingSyndromeMap($db,      $body['finding_syndrome']       ?? []),
        'syndrome_gene'         => importSyndromeGeneMap($db,         $body['syndrome_gene']          ?? []),
        'finding_investigation' => importFindingInvestigationMap($db, $body['finding_investigation']  ?? []),
    ];

    $db->commit();
    respond(['success' => true, 'stats' => $stats]);

} catch (Throwable $e) {
    $db->rollback();
    respond(['success' => false, 'error' => $e->getMessage()], 500);
}

// ───────────────────────────────────────────────────────────────────────────

function importFindings(mysqli $db, array $rows): array {
    $count = 0;
    $stmt = $db->prepare("
        INSERT INTO findings (name, system, description, details_md)
        VALUES (?,?,?,?)
        ON DUPLICATE KEY UPDATE
          system      = COALESCE(VALUES(system), system),
          description = COALESCE(VALUES(description), description),
          details_md  = COALESCE(VALUES(details_md), details_md)
    ");
    foreach ($rows as $r) {
        $name = trim($r['name'] ?? ''); if ($name === '') continue;
        $sys  = $r['system']      ?? null;
        $desc = $r['description'] ?? null;
        $md   = $r['details_md']  ?? null;
        $stmt->bind_param('ssss', $name, $sys, $desc, $md);
        $stmt->execute();
        $count++;
    }
    return ['received' => count($rows), 'processed' => $count];
}

function importSyndromes(mysqli $db, array $rows): array {
    $count = 0;
    $stmt = $db->prepare("
        INSERT INTO syndromes (name, omim_id, description, references_md)
        VALUES (?,?,?,?)
        ON DUPLICATE KEY UPDATE
          omim_id       = COALESCE(VALUES(omim_id), omim_id),
          description   = COALESCE(VALUES(description), description),
          references_md = COALESCE(VALUES(references_md), references_md)
    ");
    foreach ($rows as $r) {
        $name = trim($r['name'] ?? ''); if ($name === '') continue;
        $omim = $r['omim_id']       ?? null;
        $desc = $r['description']   ?? null;
        $refs = $r['references_md'] ?? null;
        $stmt->bind_param('ssss', $name, $omim, $desc, $refs);
        $stmt->execute();
        $count++;
    }
    return ['received' => count($rows), 'processed' => $count];
}

function importGenes(mysqli $db, array $rows): array {
    $count = 0;
    $stmt = $db->prepare("
        INSERT INTO genes (symbol, full_name, hgnc_id, description)
        VALUES (?,?,?,?)
        ON DUPLICATE KEY UPDATE
          full_name   = COALESCE(VALUES(full_name), full_name),
          hgnc_id     = COALESCE(VALUES(hgnc_id), hgnc_id),
          description = COALESCE(VALUES(description), description)
    ");
    foreach ($rows as $r) {
        $sym = trim($r['symbol'] ?? ''); if ($sym === '') continue;
        $full = $r['full_name']   ?? null;
        $hgnc = $r['hgnc_id']     ?? null;
        $desc = $r['description'] ?? null;
        $stmt->bind_param('ssss', $sym, $full, $hgnc, $desc);
        $stmt->execute();
        $count++;
    }
    return ['received' => count($rows), 'processed' => $count];
}

function importInvestigations(mysqli $db, array $rows): array {
    $count = 0;
    $stmt = $db->prepare("
        INSERT INTO investigations (name, category, description)
        VALUES (?,?,?)
        ON DUPLICATE KEY UPDATE
          category    = VALUES(category),
          description = COALESCE(VALUES(description), description)
    ");
    foreach ($rows as $r) {
        $name = trim($r['name'] ?? ''); if ($name === '') continue;
        $cat  = $r['category'] ?? 'basic';
        if (!in_array($cat, ['basic','specific'], true)) $cat = 'basic';
        $desc = $r['description'] ?? null;
        $stmt->bind_param('sss', $name, $cat, $desc);
        $stmt->execute();
        $count++;
    }
    return ['received' => count($rows), 'processed' => $count];
}

function importFindingSyndromeMap(mysqli $db, array $rows): array {
    $found = 0; $missing = 0;
    $stmt = $db->prepare("
        INSERT IGNORE INTO finding_syndrome_map (finding_id, syndrome_id)
        SELECT f.id, s.id FROM findings f, syndromes s
        WHERE f.name = ? AND s.name = ?
    ");
    foreach ($rows as $r) {
        $f = trim($r['finding']  ?? '');
        $s = trim($r['syndrome'] ?? '');
        if ($f === '' || $s === '') continue;
        $stmt->bind_param('ss', $f, $s);
        $stmt->execute();
        $stmt->affected_rows > 0 ? $found++ : $missing++;
    }
    return ['linked' => $found, 'unlinked' => $missing];
}

function importSyndromeGeneMap(mysqli $db, array $rows): array {
    $found = 0; $missing = 0;
    $stmt = $db->prepare("
        INSERT IGNORE INTO syndrome_gene_map (syndrome_id, gene_id)
        SELECT s.id, g.id FROM syndromes s, genes g
        WHERE s.name = ? AND g.symbol = ?
    ");
    foreach ($rows as $r) {
        $s = trim($r['syndrome'] ?? '');
        $g = trim($r['gene']     ?? '');
        if ($s === '' || $g === '') continue;
        $stmt->bind_param('ss', $s, $g);
        $stmt->execute();
        $stmt->affected_rows > 0 ? $found++ : $missing++;
    }
    return ['linked' => $found, 'unlinked' => $missing];
}

function importFindingInvestigationMap(mysqli $db, array $rows): array {
    $found = 0; $missing = 0;
    $stmt = $db->prepare("
        INSERT IGNORE INTO finding_investigation_map (finding_id, investigation_id)
        SELECT f.id, i.id FROM findings f, investigations i
        WHERE f.name = ? AND i.name = ?
    ");
    foreach ($rows as $r) {
        $f = trim($r['finding']       ?? '');
        $i = trim($r['investigation'] ?? '');
        if ($f === '' || $i === '') continue;
        $stmt->bind_param('ss', $f, $i);
        $stmt->execute();
        $stmt->affected_rows > 0 ? $found++ : $missing++;
    }
    return ['linked' => $found, 'unlinked' => $missing];
}
