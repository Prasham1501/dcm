<?php
/**
 * Print Count API
 * Real-time endpoint for getting print count for badge display
 *
 * GET - Get print counts
 *   ?period=today     - Today's prints (default)
 *   ?period=week      - This week's prints
 *   ?period=month     - This month's prints
 *   ?period=all       - All time prints
 *   ?license_key=XXX  - Filter by license (super admin only)
 *   ?since=TIMESTAMP  - Get count of prints since timestamp (for real-time updates)
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

// Allow unauthenticated access - session info used for license scoping if available
$isLoggedIn = isLoggedIn();

$db = getDbConnection();

try {
    $period = $_GET['period'] ?? 'today';
    $licenseKey = $_GET['license_key'] ?? null;
    $since = $_GET['since'] ?? null;

    // Check if super admin for cross-license queries (only if logged in)
    $isSuperAdmin = false;
    if ($isLoggedIn && isset($_SESSION['user_id'])) {
        $stmt = $db->prepare("SELECT is_super_admin FROM users WHERE id = ?");
        $stmt->bind_param("i", $_SESSION['user_id']);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $isSuperAdmin = $result && $result['is_super_admin'];
    }

    // Only super admin can filter by license
    if ($licenseKey && !$isSuperAdmin) {
        $licenseKey = null;
    }

    // Build date filter based on period
    $dateFilter = match($period) {
        'today' => "DATE(queued_at) = CURDATE()",
        'week' => "queued_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
        'month' => "queued_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)",
        'all' => "1=1",
        default => "DATE(queued_at) = CURDATE()"
    };

    // Build the main query - SUM copies to count actual prints (not just print jobs)
    // If user prints 5 copies, we should count 5 prints, not 1 print job
    $sql = "
        SELECT
            SUM(COALESCE(copies, 1)) as total_prints,
            SUM(CASE WHEN status = 'completed' THEN COALESCE(copies, 1) ELSE 0 END) as completed_prints,
            SUM(CASE WHEN status = 'queued' OR status = 'printing' THEN COALESCE(copies, 1) ELSE 0 END) as pending_prints,
            SUM(CASE WHEN status = 'failed' THEN COALESCE(copies, 1) ELSE 0 END) as failed_prints,
            SUM(CASE WHEN status = 'completed' AND (print_type = 'image' OR print_type IS NULL) THEN COALESCE(copies, 1) ELSE 0 END) as image_prints,
            SUM(CASE WHEN status = 'completed' AND print_type = 'report' THEN COALESCE(copies, 1) ELSE 0 END) as report_prints,
            SUM(CASE WHEN status = 'completed' AND print_type = 'pcpndt' THEN COALESCE(copies, 1) ELSE 0 END) as pcpndt_prints,
            SUM(total_pages) as total_pages,
            SUM(COALESCE(total_cost, 0)) as total_cost,
            MAX(queued_at) as last_print_time,
            MAX(id) as last_print_id,
            COUNT(*) as total_print_jobs
        FROM print_logs
        WHERE $dateFilter
    ";

    $params = [];
    $types = "";

    // Add license filter for non-super-admin or when specified
    if ($licenseKey) {
        $sql .= " AND license_key = ?";
        $params[] = $licenseKey;
        $types .= "s";
    } elseif (!$isSuperAdmin) {
        // Get current installation's license key
        $licResult = $db->query("SELECT license_key FROM installation_license WHERE id = 1");
        if ($licRow = $licResult->fetch_assoc()) {
            $sql .= " AND license_key = ?";
            $params[] = $licRow['license_key'];
            $types .= "s";
        }
    }

    // If since is provided, also get count of new prints (sum copies, not count rows)
    $newPrintsSince = 0;
    if ($since) {
        $sinceTime = date('Y-m-d H:i:s', (int)$since);
        $sinceSql = "
            SELECT SUM(COALESCE(copies, 1)) as new_count
            FROM print_logs
            WHERE queued_at > ?
        ";
        $sinceParams = [$sinceTime];
        $sinceTypes = "s";

        if ($licenseKey) {
            $sinceSql .= " AND license_key = ?";
            $sinceParams[] = $licenseKey;
            $sinceTypes .= "s";
        } elseif (!$isSuperAdmin) {
            $licResult = $db->query("SELECT license_key FROM installation_license WHERE id = 1");
            if ($licRow = $licResult->fetch_assoc()) {
                $sinceSql .= " AND license_key = ?";
                $sinceParams[] = $licRow['license_key'];
                $sinceTypes .= "s";
            }
        }

        $sinceStmt = $db->prepare($sinceSql);
        if ($sinceTypes) {
            $sinceStmt->bind_param($sinceTypes, ...$sinceParams);
        }
        $sinceStmt->execute();
        $sinceResult = $sinceStmt->get_result()->fetch_assoc();
        $newPrintsSince = (int)($sinceResult['new_count'] ?? 0);
        $sinceStmt->close();
    }

    // Execute main query
    $stmt = $db->prepare($sql);
    if ($types) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $stats = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Get breakdown by status for today (useful for detailed badge)
    $todayBreakdown = [];
    if ($period === 'today') {
        $breakdownSql = "
            SELECT
                status,
                SUM(COALESCE(copies, 1)) as count,
                SUM(total_pages) as pages
            FROM print_logs
            WHERE DATE(queued_at) = CURDATE()
        ";

        if ($licenseKey) {
            $breakdownSql .= " AND license_key = ?";
        } elseif (!$isSuperAdmin) {
            $licResult = $db->query("SELECT license_key FROM installation_license WHERE id = 1");
            if ($licRow = $licResult->fetch_assoc()) {
                $breakdownSql .= " AND license_key = '" . $db->real_escape_string($licRow['license_key']) . "'";
            }
        }

        $breakdownSql .= " GROUP BY status";

        $breakdownResult = $db->query($breakdownSql);
        while ($row = $breakdownResult->fetch_assoc()) {
            $todayBreakdown[$row['status']] = [
                'count' => (int)$row['count'],
                'pages' => (int)$row['pages']
            ];
        }
    }

    $response = [
        'success' => true,
        'period' => $period,
        'timestamp' => time(),
        'counts' => [
            'total' => (int)($stats['total_prints'] ?? 0),
            'completed' => (int)($stats['completed_prints'] ?? 0),
            'pending' => (int)($stats['pending_prints'] ?? 0),
            'failed' => (int)($stats['failed_prints'] ?? 0),
            'images' => (int)($stats['image_prints'] ?? 0),
            'reports' => (int)($stats['report_prints'] ?? 0),
            'pcpndt' => (int)($stats['pcpndt_prints'] ?? 0),
            'pages' => (int)($stats['total_pages'] ?? 0),
            'cost' => (float)($stats['total_cost'] ?? 0),
            'print_jobs' => (int)($stats['total_print_jobs'] ?? 0) // Number of print job records (for reference)
        ],
        'last_print_time' => $stats['last_print_time'],
        'last_print_id' => (int)($stats['last_print_id'] ?? 0)
    ];


    if ($since) {
        $response['new_since'] = $newPrintsSince;
    }

    if (!empty($todayBreakdown)) {
        $response['breakdown'] = $todayBreakdown;
    }

    // For super admin, add cross-license totals
    if ($isSuperAdmin && !$licenseKey) {
        $allLicensesSql = "
            SELECT
                license_key,
                SUM(COALESCE(copies, 1)) as total_prints,
                SUM(total_pages) as total_pages,
                SUM(COALESCE(total_cost, 0)) as total_cost
            FROM print_logs
            WHERE $dateFilter
            GROUP BY license_key
        ";

        $allResult = $db->query($allLicensesSql);
        $byLicense = [];
        while ($row = $allResult->fetch_assoc()) {
            $byLicense[] = [
                'license_key' => $row['license_key'],
                'prints' => (int)$row['total_prints'],
                'pages' => (int)$row['total_pages'],
                'cost' => (float)$row['total_cost']
            ];
        }
        $response['by_license'] = $byLicense;
    }

    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
