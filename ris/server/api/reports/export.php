<?php
/**
 * MIS CSV export. GET ?type=visits|payments|commission&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Streams a CSV download (admin/receptionist).
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/ris/RisDashboardRepository.php';

if (!validateSession()) {
    header('Content-Type: application/json');
    sendErrorResponse('Unauthorized - Please log in', 401);
}
if (!hasRole(['admin', 'super_admin', 'receptionist'])) {
    header('Content-Type: application/json');
    sendErrorResponse('Forbidden', 403);
}

$type = $_GET['type'] ?? 'visits';
$from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : date('Y-m-01');
$to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : date('Y-m-d');

try {
    $repo = new RisDashboardRepository(getDbConnection());
    switch ($type) {
        case 'payments': $rows = $repo->exportPayments($from, $to); break;
        case 'commission': $rows = $repo->exportCommission($from, $to); break;
        case 'visits': default: $type = 'visits'; $rows = $repo->exportVisits($from, $to); break;
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $type . '_' . $from . '_to_' . $to . '.csv"');
    $out = fopen('php://output', 'w');
    if (count($rows) > 0) {
        fputcsv($out, array_keys($rows[0]));
        foreach ($rows as $r) { fputcsv($out, $r); }
    } else {
        fputcsv($out, ['no_data']);
    }
    fclose($out);
} catch (Throwable $e) {
    header('Content-Type: application/json');
    logMessage('MIS export error: ' . $e->getMessage(), 'error', 'ris.log');
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
