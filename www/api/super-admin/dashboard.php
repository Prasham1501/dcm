<?php
/**
 * Super Admin Dashboard API
 * Comprehensive analytics for super admin portal
 *
 * GET - Get dashboard data
 *   ?section=overview    - Overall stats
 *   ?section=hospitals   - Stats by hospital/license
 *   ?section=locations   - Stats by location
 *   ?section=machines    - Stats by machine
 *   ?section=users       - Stats by user
 *   ?section=trend       - Print trend data
 *   ?section=billing     - Billing summary
 *   ?section=all         - All sections combined
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/LicenseManager.php';
require_once __DIR__ . '/../../includes/PrintTracker.php';
require_once __DIR__ . '/../../includes/BillingManager.php';
require_once __DIR__ . '/../../includes/ActivityLogger.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Check if super admin
$db = getDbConnection();
$stmt = $db->prepare("SELECT is_super_admin FROM users WHERE id = ?");
$stmt->bind_param("i", $_SESSION['user_id']);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$result || !$result['is_super_admin']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Super admin access required']);
    exit;
}

try {
    $section = $_GET['section'] ?? 'all';
    $dateFrom = $_GET['date_from'] ?? date('Y-m-d', strtotime('-30 days'));
    $dateTo = $_GET['date_to'] ?? date('Y-m-d');
    $days = $_GET['days'] ?? 30;

    $data = [];

    // Overview stats
    if ($section === 'overview' || $section === 'all') {
        $data['overview'] = getOverviewStats($db, $dateFrom, $dateTo);
    }

    // Hospital/License stats
    if ($section === 'hospitals' || $section === 'all') {
        $data['hospitals'] = getHospitalStats($db, $dateFrom, $dateTo);
    }

    // Location stats
    if ($section === 'locations' || $section === 'all') {
        $licenseKey = $_GET['license_key'] ?? null;
        $data['locations'] = getLocationStats($db, $licenseKey, $dateFrom, $dateTo);
    }

    // Machine stats
    if ($section === 'machines' || $section === 'all') {
        $data['machines'] = getMachineStats($db, $dateFrom, $dateTo);
    }

    // User stats
    if ($section === 'users' || $section === 'all') {
        $data['users'] = getUserStats($db, $dateFrom, $dateTo);
    }

    // Trend data
    if ($section === 'trend' || $section === 'all') {
        $data['trend'] = getTrendData($db, (int) $days);
    }

    // Billing summary
    if ($section === 'billing' || $section === 'all') {
        $billingManager = new BillingManager($db);
        $data['billing'] = $billingManager->getBillingSummary();
        $data['billing']['recent_invoices'] = $billingManager->getAllInvoices(null, 10);
    }

    // Recent activity
    if ($section === 'activity' || $section === 'all') {
        $data['activity'] = ActivityLogger::getActivity(20);
    }

    echo json_encode([
        'success' => true,
        'date_range' => [
            'from' => $dateFrom,
            'to' => $dateTo
        ],
        'data' => $data
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Get overview statistics
 */
function getOverviewStats($db, $dateFrom, $dateTo) {
    // License stats
    $licenseManager = new LicenseManager($db);
    $licenses = $licenseManager->getAllLicenses();

    $totalLicenses = count($licenses);
    $activeLicenses = count(array_filter($licenses, fn($l) => $l['status'] === 'active'));
    $totalActivations = array_sum(array_column($licenses, 'active_activations'));

    // Print stats
    $stmt = $db->prepare("
        SELECT
            COUNT(*) as total_prints,
            SUM(total_pages) as total_pages,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_prints,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_prints,
            SUM(COALESCE(total_cost, 0)) as total_cost,
            SUM(CASE WHEN billed = 0 THEN COALESCE(total_cost, 0) ELSE 0 END) as unbilled_cost,
            COUNT(DISTINCT license_key) as active_hospitals,
            COUNT(DISTINCT machine_id) as active_machines,
            COUNT(DISTINCT location_id) as active_locations,
            COUNT(DISTINCT user_id) as active_users
        FROM print_logs
        WHERE DATE(queued_at) BETWEEN ? AND ?
    ");
    $stmt->bind_param("ss", $dateFrom, $dateTo);
    $stmt->execute();
    $printStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Today's stats
    $today = date('Y-m-d');
    $stmt = $db->prepare("
        SELECT
            COUNT(*) as prints_today,
            SUM(total_pages) as pages_today,
            SUM(COALESCE(total_cost, 0)) as cost_today
        FROM print_logs
        WHERE DATE(queued_at) = ?
    ");
    $stmt->bind_param("s", $today);
    $stmt->execute();
    $todayStats = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return [
        'licenses' => [
            'total' => $totalLicenses,
            'active' => $activeLicenses,
            'total_activations' => $totalActivations
        ],
        'prints' => $printStats,
        'today' => $todayStats
    ];
}

/**
 * Get stats by hospital/license
 */
function getHospitalStats($db, $dateFrom, $dateTo) {
    $stmt = $db->prepare("
        SELECT
            l.id as license_id,
            l.license_key,
            l.customer_name,
            l.customer_hospital,
            l.license_type,
            l.valid_until,
            l.max_activations,
            COUNT(DISTINCT la.id) as active_machines,
            COUNT(DISTINCT pl.id) as total_prints,
            SUM(pl.total_pages) as total_pages,
            SUM(COALESCE(pl.total_cost, 0)) as total_cost,
            SUM(CASE WHEN pl.billed = 0 THEN COALESCE(pl.total_cost, 0) ELSE 0 END) as unbilled_amount,
            MAX(pl.queued_at) as last_print_at,
            MAX(la.last_heartbeat) as last_online
        FROM licenses l
        LEFT JOIN license_activations la ON l.id = la.license_id AND la.is_active = 1
        LEFT JOIN print_logs pl ON l.license_key = pl.license_key
            AND DATE(pl.queued_at) BETWEEN ? AND ?
        WHERE l.is_active = 1
        GROUP BY l.id
        ORDER BY total_pages DESC
    ");
    $stmt->bind_param("ss", $dateFrom, $dateTo);
    $stmt->execute();
    $result = $stmt->get_result();

    $hospitals = [];
    while ($row = $result->fetch_assoc()) {
        $hospitals[] = $row;
    }
    $stmt->close();

    return $hospitals;
}

/**
 * Get stats by location
 */
function getLocationStats($db, $licenseKey, $dateFrom, $dateTo) {
    $sql = "
        SELECT
            l.id as location_id,
            l.location_code,
            l.location_name,
            l.department,
            pl.license_key,
            lic.customer_hospital,
            COUNT(pl.id) as total_prints,
            SUM(pl.total_pages) as total_pages,
            SUM(COALESCE(pl.total_cost, 0)) as total_cost,
            MAX(pl.queued_at) as last_print_at
        FROM locations l
        LEFT JOIN print_logs pl ON l.id = pl.location_id
            AND DATE(pl.queued_at) BETWEEN ? AND ?
        LEFT JOIN licenses lic ON pl.license_key = lic.license_key
        WHERE 1=1
    ";

    $params = [$dateFrom, $dateTo];
    $types = "ss";

    if ($licenseKey) {
        $sql .= " AND pl.license_key = ?";
        $params[] = $licenseKey;
        $types .= "s";
    }

    $sql .= " GROUP BY l.id, l.location_code, l.location_name, l.department, pl.license_key, lic.customer_hospital
              ORDER BY total_pages DESC";

    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $result = $stmt->get_result();

    $locations = [];
    while ($row = $result->fetch_assoc()) {
        $locations[] = $row;
    }
    $stmt->close();

    return $locations;
}

/**
 * Get stats by machine
 */
function getMachineStats($db, $dateFrom, $dateTo) {
    $stmt = $db->prepare("
        SELECT
            la.id as activation_id,
            la.machine_id,
            la.machine_name,
            la.os_info,
            la.ip_address,
            la.last_heartbeat,
            la.activated_at,
            l.customer_hospital,
            l.license_key,
            loc.location_name,
            loc.location_code,
            COUNT(pl.id) as total_prints,
            SUM(pl.total_pages) as total_pages,
            SUM(COALESCE(pl.total_cost, 0)) as total_cost,
            MAX(pl.queued_at) as last_print_at,
            TIMESTAMPDIFF(MINUTE, la.last_heartbeat, NOW()) as minutes_since_heartbeat
        FROM license_activations la
        JOIN licenses l ON la.license_id = l.id
        LEFT JOIN machine_locations ml ON la.id = ml.activation_id AND ml.is_current = 1
        LEFT JOIN locations loc ON ml.location_id = loc.id
        LEFT JOIN print_logs pl ON la.machine_id = pl.machine_id
            AND DATE(pl.queued_at) BETWEEN ? AND ?
        WHERE la.is_active = 1
        GROUP BY la.id
        ORDER BY total_pages DESC
    ");
    $stmt->bind_param("ss", $dateFrom, $dateTo);
    $stmt->execute();
    $result = $stmt->get_result();

    $machines = [];
    while ($row = $result->fetch_assoc()) {
        // Determine online status
        $row['is_online'] = $row['minutes_since_heartbeat'] < 30; // Online if heartbeat within 30 mins
        $machines[] = $row;
    }
    $stmt->close();

    return $machines;
}

/**
 * Get stats by user
 */
function getUserStats($db, $dateFrom, $dateTo) {
    $stmt = $db->prepare("
        SELECT
            u.id as user_id,
            u.username,
            u.full_name,
            u.role,
            u.last_login,
            loc.location_name as default_location,
            l.customer_hospital,
            COUNT(pl.id) as total_prints,
            SUM(pl.total_pages) as total_pages,
            SUM(COALESCE(pl.total_cost, 0)) as total_cost,
            MAX(pl.queued_at) as last_print_at
        FROM users u
        LEFT JOIN print_logs pl ON u.id = pl.user_id
            AND DATE(pl.queued_at) BETWEEN ? AND ?
        LEFT JOIN locations loc ON u.default_location_id = loc.id
        LEFT JOIN (
            SELECT DISTINCT il.license_key, lic.customer_hospital
            FROM installation_license il
            JOIN licenses lic ON il.license_key = lic.license_key
        ) l ON 1=1
        WHERE u.is_active = 1
        GROUP BY u.id
        ORDER BY total_pages DESC
    ");
    $stmt->bind_param("ss", $dateFrom, $dateTo);
    $stmt->execute();
    $result = $stmt->get_result();

    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    $stmt->close();

    return $users;
}

/**
 * Get trend data
 */
function getTrendData($db, $days) {
    $stmt = $db->prepare("
        SELECT
            DATE(queued_at) as date,
            COUNT(*) as print_count,
            SUM(total_pages) as page_count,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(COALESCE(total_cost, 0)) as daily_cost,
            COUNT(DISTINCT license_key) as active_hospitals,
            COUNT(DISTINCT machine_id) as active_machines
        FROM print_logs
        WHERE queued_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(queued_at)
        ORDER BY date ASC
    ");
    $stmt->bind_param("i", $days);
    $stmt->execute();
    $result = $stmt->get_result();

    $trend = [];
    while ($row = $result->fetch_assoc()) {
        $trend[] = $row;
    }
    $stmt->close();

    // Also get trend by hospital
    $stmt = $db->prepare("
        SELECT
            DATE(pl.queued_at) as date,
            l.customer_hospital,
            COUNT(*) as print_count,
            SUM(pl.total_pages) as page_count
        FROM print_logs pl
        JOIN licenses l ON pl.license_key = l.license_key
        WHERE pl.queued_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(pl.queued_at), l.customer_hospital
        ORDER BY date ASC
    ");
    $stmt->bind_param("i", $days);
    $stmt->execute();
    $result = $stmt->get_result();

    $byHospital = [];
    while ($row = $result->fetch_assoc()) {
        $hospital = $row['customer_hospital'] ?? 'Unknown';
        if (!isset($byHospital[$hospital])) {
            $byHospital[$hospital] = [];
        }
        $byHospital[$hospital][] = [
            'date' => $row['date'],
            'prints' => $row['print_count'],
            'pages' => $row['page_count']
        ];
    }
    $stmt->close();

    return [
        'daily' => $trend,
        'by_hospital' => $byHospital
    ];
}