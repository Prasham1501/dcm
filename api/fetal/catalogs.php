<?php
/**
 * Fetal Catalogs API — read-only listing + search for findings, syndromes,
 * genes, and investigations.
 *
 *   GET ?resource=findings|syndromes|genes|investigations
 *       &q=...           search term (matches name/symbol/description)
 *       &system=...      filter findings by body system
 *       &category=...    filter investigations by basic|specific
 *       &limit=...       page size (default 100, max 1000)
 *       &offset=...      pagination offset
 *
 *   GET ?resource=finding&id=...   - single finding incl. linked syndromes/investigations
 *   GET ?resource=syndrome&id=...  - single syndrome incl. linked findings/genes
 *   GET ?resource=gene&id=...      - single gene incl. linked syndromes
 *   GET ?resource=match&finding_ids=1,2,3  - rank syndromes by # of matching findings
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

$db = getDbConnection();
$resource = $_GET['resource'] ?? '';

try {
    switch ($resource) {
        case 'findings':        listFindings($db); break;
        case 'syndromes':       listSyndromes($db); break;
        case 'genes':           listGenes($db); break;
        case 'investigations':  listInvestigations($db); break;
        case 'finding':         getFinding($db); break;
        case 'syndrome':        getSyndrome($db); break;
        case 'gene':            getGene($db); break;
        case 'match':           matchSyndromes($db); break;
        default:
            respond(['success' => false, 'error' => "Unknown resource: '$resource'"], 400);
    }
} catch (Throwable $e) {
    respond(['success' => false, 'error' => $e->getMessage()], 500);
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function pageBounds(): array {
    $limit  = min(1000, max(1, (int)($_GET['limit'] ?? 100)));
    $offset = max(0, (int)($_GET['offset'] ?? 0));
    return [$limit, $offset];
}

function searchTerm(): ?string {
    $q = trim($_GET['q'] ?? '');
    return $q !== '' ? '%' . $q . '%' : null;
}

/** Raw search term without wildcards (for relevance ordering). */
function rawSearchTerm(): ?string {
    $q = trim($_GET['q'] ?? '');
    return $q !== '' ? $q : null;
}

/**
 * Build a relevance ORDER BY for a name column.
 * Priority: 1) exact match, 2) starts with, 3) contains in name, 4) rest.
 * Appends the needed bind params/types to the provided arrays.
 */
function relevanceOrder(string $nameCol, ?string $rawQ, array &$params, string &$types): string {
    if ($rawQ === null) return "ORDER BY $nameCol";
    $startsWith = $rawQ . '%';
    $params[] = $rawQ;       $types .= 's';
    $params[] = $startsWith; $types .= 's';
    return "ORDER BY ($nameCol = ?) DESC, ($nameCol LIKE ?) DESC, $nameCol";
}

// ───────────────────────────────────────────────────────────────────────────
// LIST endpoints
// ───────────────────────────────────────────────────────────────────────────

function listFindings(mysqli $db): void {
    [$limit, $offset] = pageBounds();
    $q       = searchTerm();
    $rawQ    = rawSearchTerm();
    $system  = trim($_GET['system'] ?? '');

    $where = []; $params = []; $types = '';
    if ($q !== null)       { $where[] = '(name LIKE ? OR description LIKE ?)'; $params[] = $q; $params[] = $q; $types .= 'ss'; }
    if ($system !== '')    { $where[] = 'system = ?';                            $params[] = $system; $types .= 's'; }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    // Save WHERE-only params for count query
    $whereTypes = $types;
    $whereParams = $params;

    $orderSql = relevanceOrder('name', $rawQ, $params, $types);
    $sql = "SELECT id, name, system, description FROM findings $whereSql $orderSql LIMIT ? OFFSET ?";
    $types .= 'ii'; $params[] = $limit; $params[] = $offset;

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    // total count (without limit) for pagination UI
    $countSql = "SELECT COUNT(*) c FROM findings $whereSql";
    $cstmt = $db->prepare($countSql);
    if ($whereParams) $cstmt->bind_param($whereTypes, ...$whereParams);
    $cstmt->execute();
    $total = (int)$cstmt->get_result()->fetch_assoc()['c'];

    respond(['success' => true, 'data' => $rows, 'total' => $total]);
}

function listSyndromes(mysqli $db): void {
    [$limit, $offset] = pageBounds();
    $q = searchTerm();
    $rawQ = rawSearchTerm();
    $where = []; $params = []; $types = '';
    if ($q !== null) { $where[] = '(name LIKE ? OR description LIKE ?)'; $params[] = $q; $params[] = $q; $types .= 'ss'; }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $whereTypes = $types;
    $whereParams = $params;

    $orderSql = relevanceOrder('name', $rawQ, $params, $types);
    $sql = "SELECT id, name, omim_id, description FROM syndromes $whereSql $orderSql LIMIT ? OFFSET ?";
    $types .= 'ii'; $params[] = $limit; $params[] = $offset;

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $countSql = "SELECT COUNT(*) c FROM syndromes $whereSql";
    $cstmt = $db->prepare($countSql);
    if ($whereParams) $cstmt->bind_param($whereTypes, ...$whereParams);
    $cstmt->execute();
    $total = (int)$cstmt->get_result()->fetch_assoc()['c'];

    respond(['success' => true, 'data' => $rows, 'total' => $total]);
}

function listGenes(mysqli $db): void {
    [$limit, $offset] = pageBounds();
    $q = searchTerm();
    $rawQ = rawSearchTerm();
    $where = []; $params = []; $types = '';
    if ($q !== null) { $where[] = '(symbol LIKE ? OR full_name LIKE ? OR description LIKE ?)'; $params = [$q, $q, $q]; $types = 'sss'; }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $whereTypes = $types;
    $whereParams = $params;

    $orderSql = relevanceOrder('symbol', $rawQ, $params, $types);
    $sql = "SELECT id, symbol, full_name, hgnc_id, description FROM genes $whereSql $orderSql LIMIT ? OFFSET ?";
    $types .= 'ii'; $params[] = $limit; $params[] = $offset;

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $countSql = "SELECT COUNT(*) c FROM genes $whereSql";
    $cstmt = $db->prepare($countSql);
    if ($whereParams) $cstmt->bind_param($whereTypes, ...$whereParams);
    $cstmt->execute();
    $total = (int)$cstmt->get_result()->fetch_assoc()['c'];

    respond(['success' => true, 'data' => $rows, 'total' => $total]);
}

function listInvestigations(mysqli $db): void {
    [$limit, $offset] = pageBounds();
    $q = searchTerm();
    $rawQ = rawSearchTerm();
    $category = trim($_GET['category'] ?? '');

    $where = []; $params = []; $types = '';
    if ($q !== null)         { $where[] = '(name LIKE ? OR description LIKE ?)'; $params[] = $q; $params[] = $q; $types .= 'ss'; }
    if ($category !== '')    { $where[] = 'category = ?'; $params[] = $category; $types .= 's'; }
    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

    $whereTypes = $types;
    $whereParams = $params;

    $orderSql = relevanceOrder('name', $rawQ, $params, $types);
    $sql = "SELECT id, name, category, description FROM investigations $whereSql $orderSql LIMIT ? OFFSET ?";
    $types .= 'ii'; $params[] = $limit; $params[] = $offset;

    $stmt = $db->prepare($sql);
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $countSql = "SELECT COUNT(*) c FROM investigations $whereSql";
    $cstmt = $db->prepare($countSql);
    if ($whereParams) $cstmt->bind_param($whereTypes, ...$whereParams);
    $cstmt->execute();
    $total = (int)$cstmt->get_result()->fetch_assoc()['c'];

    respond(['success' => true, 'data' => $rows, 'total' => $total]);
}

// ───────────────────────────────────────────────────────────────────────────
// DETAIL endpoints (with relationships)
// ───────────────────────────────────────────────────────────────────────────

function getFinding(mysqli $db): void {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) respond(['success' => false, 'error' => 'id required'], 400);

    $stmt = $db->prepare("SELECT id, name, system, description, details_md FROM findings WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $finding = $stmt->get_result()->fetch_assoc();
    if (!$finding) respond(['success' => false, 'error' => 'Not found'], 404);

    $synds = $db->prepare("SELECT s.id, s.name FROM syndromes s INNER JOIN finding_syndrome_map m ON m.syndrome_id = s.id WHERE m.finding_id = ? ORDER BY s.name");
    $synds->bind_param('i', $id); $synds->execute();
    $syndromes = $synds->get_result()->fetch_all(MYSQLI_ASSOC);

    $invs = $db->prepare("SELECT i.id, i.name, i.category FROM investigations i INNER JOIN finding_investigation_map m ON m.investigation_id = i.id WHERE m.finding_id = ? ORDER BY i.name");
    $invs->bind_param('i', $id); $invs->execute();
    $investigations = $invs->get_result()->fetch_all(MYSQLI_ASSOC);

    respond(['success' => true, 'data' => $finding + ['syndromes' => $syndromes, 'investigations' => $investigations]]);
}

function getSyndrome(mysqli $db): void {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) respond(['success' => false, 'error' => 'id required'], 400);

    $stmt = $db->prepare("SELECT id, name, omim_id, description, references_md FROM syndromes WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) respond(['success' => false, 'error' => 'Not found'], 404);

    $findings = $db->prepare("SELECT f.id, f.name FROM findings f INNER JOIN finding_syndrome_map m ON m.finding_id = f.id WHERE m.syndrome_id = ? ORDER BY f.name");
    $findings->bind_param('i', $id); $findings->execute();
    $findingsRows = $findings->get_result()->fetch_all(MYSQLI_ASSOC);

    $genes = $db->prepare("SELECT g.id, g.symbol, g.full_name FROM genes g INNER JOIN syndrome_gene_map m ON m.gene_id = g.id WHERE m.syndrome_id = ? ORDER BY g.symbol");
    $genes->bind_param('i', $id); $genes->execute();
    $geneRows = $genes->get_result()->fetch_all(MYSQLI_ASSOC);

    respond(['success' => true, 'data' => $row + ['findings' => $findingsRows, 'genes' => $geneRows]]);
}

function getGene(mysqli $db): void {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) respond(['success' => false, 'error' => 'id required'], 400);

    $stmt = $db->prepare("SELECT id, symbol, full_name, hgnc_id, description FROM genes WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) respond(['success' => false, 'error' => 'Not found'], 404);

    $synds = $db->prepare("SELECT s.id, s.name FROM syndromes s INNER JOIN syndrome_gene_map m ON m.syndrome_id = s.id WHERE m.gene_id = ? ORDER BY s.name");
    $synds->bind_param('i', $id); $synds->execute();
    $syndRows = $synds->get_result()->fetch_all(MYSQLI_ASSOC);

    respond(['success' => true, 'data' => $row + ['syndromes' => $syndRows]]);
}

// ───────────────────────────────────────────────────────────────────────────
// Match scoring — rank syndromes by overlap with the user's findings
// ───────────────────────────────────────────────────────────────────────────

function matchSyndromes(mysqli $db): void {
    $raw = trim($_GET['finding_ids'] ?? '');
    if ($raw === '') respond(['success' => true, 'data' => []]);

    $ids = array_values(array_filter(array_map('intval', explode(',', $raw))));
    if (empty($ids)) respond(['success' => true, 'data' => []]);

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types        = str_repeat('i', count($ids));

    /*
     * For every syndrome that shares ≥ 1 finding with the user's selection:
     *   - overlap          = count of matching findings (numerator)
     *   - total_findings   = total mapped findings for that syndrome (denominator)
     *   - score            = overlap / total_findings  (used for ordering)
     *
     * Tie-break by absolute overlap then by syndrome name.
     */
    $sql = "
        SELECT
          s.id,
          s.name,
          s.omim_id,
          COUNT(m.finding_id)                                AS overlap,
          (SELECT COUNT(*) FROM finding_syndrome_map m2 WHERE m2.syndrome_id = s.id) AS total_findings
        FROM syndromes s
        INNER JOIN finding_syndrome_map m ON m.syndrome_id = s.id
        WHERE m.finding_id IN ($placeholders)
        GROUP BY s.id, s.name, s.omim_id
        ORDER BY (overlap / NULLIF(total_findings, 0)) DESC, overlap DESC, s.name ASC
        LIMIT 200
    ";

    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$ids);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    // Cast numeric fields and add user-facing match label "N/M".
    foreach ($rows as &$r) {
        $r['overlap']        = (int)$r['overlap'];
        $r['total_findings'] = (int)$r['total_findings'];
        $r['match_label']    = $r['overlap'] . '/' . $r['total_findings'];
    }

    respond(['success' => true, 'data' => $rows, 'finding_count' => count($ids)]);
}
