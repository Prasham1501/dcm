<?php
/**
 * Location Management API
 * CRUD operations for locations/rooms
 *
 * GET    - List all locations
 * POST   - Create new location
 * PUT    - Update location
 * DELETE - Delete location
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/rbac.php';

header('Content-Type: application/json');

// Require login
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGet($db);
            break;

        case 'POST':
            requirePermission('manage_settings', true);
            handlePost($db);
            break;

        case 'PUT':
            requirePermission('manage_settings', true);
            handlePut($db);
            break;

        case 'DELETE':
            requirePermission('manage_settings', true);
            handleDelete($db);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * GET - List locations or get single location
 */
function handleGet($db) {
    // If ID is provided, return single location
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        $stmt = $db->prepare("SELECT * FROM locations WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $location = $result->fetch_assoc();
        $stmt->close();
        
        if ($location) {
            echo json_encode(['success' => true, 'location' => $location]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Location not found']);
        }
        return;
    }

    $includeStats = isset($_GET['include_stats']) && $_GET['include_stats'] === 'true';
    $activeOnly = !isset($_GET['include_inactive']) || $_GET['include_inactive'] !== 'true';

    $sql = "
        SELECT l.*,
               COUNT(DISTINCT ml.activation_id) as assigned_machines
        FROM locations l
        LEFT JOIN machine_locations ml ON l.id = ml.location_id AND ml.is_current = 1
    ";

    if ($activeOnly) {
        $sql .= " WHERE l.is_active = 1";
    }

    $sql .= " GROUP BY l.id ORDER BY l.location_name";

    $result = $db->query($sql);

    $locations = [];
    while ($row = $result->fetch_assoc()) {
        $locations[] = $row;
    }

    // Add print stats if requested
    if ($includeStats && !empty($locations)) {
        $locationIds = array_column($locations, 'id');
        $placeholders = implode(',', array_fill(0, count($locationIds), '?'));

        $stmt = $db->prepare("
            SELECT
                location_id,
                COUNT(*) as total_prints,
                SUM(total_pages) as total_pages,
                SUM(COALESCE(total_cost, 0)) as total_cost,
                MAX(queued_at) as last_print_at
            FROM print_logs
            WHERE location_id IN ($placeholders)
            AND queued_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY location_id
        ");

        $types = str_repeat('i', count($locationIds));
        $stmt->bind_param($types, ...$locationIds);
        $stmt->execute();
        $statsResult = $stmt->get_result();

        $stats = [];
        while ($row = $statsResult->fetch_assoc()) {
            $stats[$row['location_id']] = $row;
        }
        $stmt->close();

        foreach ($locations as &$loc) {
            $loc['stats'] = $stats[$loc['id']] ?? [
                'total_prints' => 0,
                'total_pages' => 0,
                'total_cost' => 0,
                'last_print_at' => null
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'locations' => $locations
    ]);
}

/**
 * POST - Create location
 */
function handlePost($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['location_code']) || empty($data['location_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Location code and name are required']);
        return;
    }

    // Check for duplicate code
    $stmt = $db->prepare("SELECT id FROM locations WHERE location_code = ?");
    $stmt->bind_param("s", $data['location_code']);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        $stmt->close();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Location code already exists']);
        return;
    }
    $stmt->close();

    // Auto-detect license_id from current installation
    $licenseId = $data['license_id'] ?? null;
    if (!$licenseId) {
        // Get from installation_license table
        $result = $db->query("SELECT license_key FROM installation_license WHERE id = 1");
        if ($result && $row = $result->fetch_assoc()) {
            if (!empty($row['license_key'])) {
                // Look up the license ID from the key
                $stmt = $db->prepare("SELECT id FROM licenses WHERE license_key = ?");
                $stmt->bind_param("s", $row['license_key']);
                $stmt->execute();
                $licResult = $stmt->get_result();
                if ($licResult && $licRow = $licResult->fetch_assoc()) {
                    $licenseId = $licRow['id'];
                }
                $stmt->close();
            }
        }
    }

    $stmt = $db->prepare("
        INSERT INTO locations (location_code, location_name, department, floor, building, description, license_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->bind_param(
        "ssssssi",
        $data['location_code'],
        $data['location_name'],
        $data['department'],
        $data['floor'],
        $data['building'],
        $data['description'],
        $licenseId
    );

    if ($stmt->execute()) {
        $locationId = $db->insert_id;
        $stmt->close();

        // Log activity
        if (class_exists('ActivityLogger')) {
            ActivityLogger::log('location_created', 'settings', [
                'location_id' => $locationId,
                'location_code' => $data['location_code']
            ]);
        }

        echo json_encode([
            'success' => true,
            'location_id' => $locationId,
            'message' => 'Location created successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $stmt->error]);
        $stmt->close();
    }
}

/**
 * PUT - Update location
 */
function handlePut($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Location ID is required']);
        return;
    }

    // Build dynamic update query
    $updates = [];
    $params = [];
    $types = "";

    $allowedFields = ['location_code', 'location_name', 'department', 'floor', 'building', 'description', 'is_active'];

    foreach ($allowedFields as $field) {
        if (isset($data[$field])) {
            $updates[] = "$field = ?";
            $params[] = $data[$field];
            $types .= is_int($data[$field]) ? 'i' : 's';
        }
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No fields to update']);
        return;
    }

    $sql = "UPDATE locations SET " . implode(', ', $updates) . " WHERE id = ?";
    $params[] = $data['id'];
    $types .= "i";

    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        $stmt->close();
        echo json_encode(['success' => true, 'message' => 'Location updated successfully']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $stmt->error]);
        $stmt->close();
    }
}

/**
 * DELETE - Delete location
 */
function handleDelete($db) {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? $_GET['id'] ?? null;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Location ID is required']);
        return;
    }

    // Check if location has prints
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM print_logs WHERE location_id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($result['count'] > 0) {
        // Soft delete - just deactivate
        $stmt = $db->prepare("UPDATE locations SET is_active = 0 WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();

        echo json_encode([
            'success' => true,
            'message' => 'Location deactivated (has print history)',
            'deactivated' => true
        ]);
    } else {
        // Hard delete
        $stmt = $db->prepare("DELETE FROM locations WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $stmt->close();

        echo json_encode([
            'success' => true,
            'message' => 'Location deleted successfully'
        ]);
    }
}