<?php
/**
 * Print Statistics API
 * Get print statistics and analytics
 *
 * GET - Get print statistics
 *   ?type=summary     - Overall summary stats
 *   ?type=by_location - Stats grouped by location
 *   ?type=by_user     - Stats grouped by user
 *   ?type=by_machine  - Stats grouped by machine
 *   ?type=trend       - Daily trend data
 *   ?date_from=YYYY-MM-DD - Start date filter
 *   ?date_to=YYYY-MM-DD   - End date filter
 *   ?license_key=XXX  - Filter by license (super admin only)
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/rbac.php';
require_once __DIR__ . '/../../includes/PrintTracker.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$db = getDbConnection();

try {
    $type = $_GET['type'] ?? 'summary';
    $dateFrom = $_GET['date_from'] ?? date('Y-m-d', strtotime('-30 days'));
    $dateTo = $_GET['date_to'] ?? date('Y-m-d');
    $licenseKey = $_GET['license_key'] ?? null;

    // Only super admin can filter by license
    if ($licenseKey && !isSuperAdmin($db)) {
        $licenseKey = null;
    }

    $printTracker = new PrintTracker($db);

    switch ($type) {
        case 'summary':
            $stats = $printTracker->getStatsSummary($licenseKey, $dateFrom, $dateTo);
            break;

        case 'by_location':
            $stats = $printTracker->getStatsByLocation($licenseKey, $dateFrom, $dateTo);
            break;

        case 'by_user':
            $stats = $printTracker->getStatsByUser($licenseKey, $dateFrom, $dateTo);
            break;

        case 'by_machine':
            $stats = getStatsByMachine($db, $licenseKey, $dateFrom, $dateTo);
            break;

        case 'trend':
            $days = isset($_GET['days']) ? (int) $_GET['days'] : 30;
            $stats = $printTracker->getDailyTrend($licenseKey, $days);
            break;

        case 'today':
            $stats = $printTracker->getStatsSummary($licenseKey, date('Y-m-d'), date('Y-m-d'));
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid stats type']);
            return;
    }

    echo json_encode([
        'success' => true,
        'type' => $type,
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        'stats' => $stats
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Check if current user is super admin
 */
function isSuperAdmin($db): bool {
    $stmt = $db->prepare("SELECT is_super_admin FROM users WHERE id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $result && $result['is_super_admin'];
}

/**
 * Get stats grouped by machine
 */
function getStatsByMachine($db, ?string $licenseKey, string $dateFrom, string $dateTo): array {
    $sql = "
        SELECT
            la.machine_id,
            la.machine_name,
            la.os_info,
            la.ip_address,
            la.last_heartbeat,
            l.location_name,
            COUNT(pl.id) as total_prints,
            SUM(pl.total_pages) as total_pages,
            SUM(COALESCE(pl.total_cost, 0)) as total_cost,
            MAX(pl.queued_at) as last_print_at
        FROM license_activations la
        LEFT JOIN print_logs pl ON la.machine_id = pl.machine_id
            AND DATE(pl.queued_at) BETWEEN ? AND ?
        LEFT JOIN machine_locations ml ON la.id = ml.activation_id AND ml.is_current = 1
        LEFT JOIN locations l ON ml.location_id = l.id
        WHERE la.is_active = 1
    ";

    $params = [$dateFrom, $dateTo];
    $types = "ss";

    if ($licenseKey) {
        $sql .= " AND pl.license_key = ?";
        $params[] = $licenseKey;
        $types .= "s";
    }

    $sql .= " GROUP BY la.machine_id, la.machine_name, la.os_info, la.ip_address, la.last_heartbeat, l.location_name
              ORDER BY total_pages DESC";

    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    $stats = [];
    while ($row = $result->fetch_assoc()) {
        $stats[] = $row;
    }
    $stmt->close();

    return $stats;
}