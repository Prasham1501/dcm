<?php
/**
 * Growth chart reference data API
 *
 *   GET ?parameter=NT&author_id=1   - single author + parameter series
 *   GET ?parameter=BPD              - all authors for a parameter
 *   GET ?authors=1                  - list of available authors
 */

header('Content-Type: application/json');

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

if (!validateSession() && !isLocalRequest()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

$db = getDbConnection();

// List authors
if (isset($_GET['authors'])) {
    $res = $db->query('SELECT id, code, display_name, citation FROM growth_chart_authors ORDER BY id');
    $rows = [];
    while ($r = $res->fetch_assoc()) $rows[] = $r;
    echo json_encode(['success' => true, 'data' => $rows]);
    exit;
}

$parameter = $_GET['parameter'] ?? '';
if (!$parameter) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'parameter required']);
    exit;
}

$parameter = $db->real_escape_string($parameter);

if (isset($_GET['author_id'])) {
    $authorId = (int)$_GET['author_id'];
    $stmt = $db->prepare(
        'SELECT ga_weeks, p5, p50, p95, mean, sd
           FROM growth_chart_data
          WHERE author_id = ? AND parameter = ?
          ORDER BY ga_weeks'
    );
    $stmt->bind_param('is', $authorId, $parameter);
    $stmt->execute();
    $res = $stmt->get_result();
} else {
    $stmt = $db->prepare(
        'SELECT gcd.ga_weeks, gcd.p5, gcd.p50, gcd.p95, gcd.mean, gcd.sd,
                gca.id as author_id, gca.code, gca.display_name
           FROM growth_chart_data gcd
           JOIN growth_chart_authors gca ON gca.id = gcd.author_id
          WHERE gcd.parameter = ?
          ORDER BY gca.id, gcd.ga_weeks'
    );
    $stmt->bind_param('s', $parameter);
    $stmt->execute();
    $res = $stmt->get_result();
}

$rows = [];
while ($r = $res->fetch_assoc()) {
    $rows[] = array_map(function($v) { return is_numeric($v) ? (float)$v : $v; }, $r);
}

echo json_encode(['success' => true, 'data' => $rows]);
