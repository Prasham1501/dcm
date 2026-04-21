<?php
/**
 * Machine Location Assignment API
 * Assign machines to locations
 *
 * POST - Assign machine to location
 * GET  - Get current machine's location or all assignments
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

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * GET - Get machine location assignments
 */
function handleGet($db) {
    $machineId = $_GET['machine_id'] ?? null;
    $currentOnly = !isset($_GET['all']) || $_GET['all'] !== 'true';

    if ($machineId) {
        // Get specific machine's location
        $stmt = $db->prepare("
            SELECT ml.*, l.location_code, l.location_name, l.department,
                   la.machine_name, la.os_info
            FROM machine_locations ml
            JOIN locations l ON ml.location_id = l.id
            JOIN license_activations la ON ml.activation_id = la.id
            WHERE la.machine_id = ?
            " . ($currentOnly ? "AND ml.is_current = 1" : "") . "
            ORDER BY ml.assigned_at DESC
        ");
        $stmt->bind_param("s", $machineId);
    } else {
        // Get all assignments
        $stmt = $db->prepare("
            SELECT ml.*, l.location_code, l.location_name, l.department,
                   la.machine_id, la.machine_name, la.os_info, la.ip_address, la.last_heartbeat
            FROM machine_locations ml
            JOIN locations l ON ml.location_id = l.id
            JOIN license_activations la ON ml.activation_id = la.id
            " . ($currentOnly ? "WHERE ml.is_current = 1" : "") . "
            ORDER BY l.location_name, la.machine_name
        ");
    }

    $stmt->execute();
    $result = $stmt->get_result();

    $assignments = [];
    while ($row = $result->fetch_assoc()) {
        $assignments[] = $row;
    }
    $stmt->close();

    // Also get current machine's location using PrintTracker
    $printTracker = new PrintTracker($db);
    $currentLocation = $printTracker->getCurrentLocation();

    echo json_encode([
        'success' => true,
        'assignments' => $assignments,
        'current_machine_location' => $currentLocation
    ]);
}

/**
 * POST - Assign machine to location
 */
function handlePost($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    $machineId = $data['machine_id'] ?? null;
    $locationId = $data['location_id'] ?? null;
    $activationId = $data['activation_id'] ?? null;

    if (!$locationId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Location ID is required']);
        return;
    }

    // Get activation ID from machine_id if not provided
    if (!$activationId && $machineId) {
        $stmt = $db->prepare("
            SELECT id FROM license_activations
            WHERE machine_id = ? AND is_active = 1
            ORDER BY activated_at DESC LIMIT 1
        ");
        $stmt->bind_param("s", $machineId);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($row = $result->fetch_assoc()) {
            $activationId = $row['id'];
        }
        $stmt->close();
    }

    // If still no activation ID, use current machine
    if (!$activationId) {
        $printTracker = new PrintTracker($db);
        // Try to get from installation
        $result = $db->query("SELECT machine_id FROM installation_license WHERE id = 1");
        if ($row = $result->fetch_assoc()) {
            $machineId = $row['machine_id'];

            $stmt = $db->prepare("
                SELECT id FROM license_activations
                WHERE machine_id = ? AND is_active = 1
                ORDER BY activated_at DESC LIMIT 1
            ");
            $stmt->bind_param("s", $machineId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                $activationId = $row['id'];
            }
            $stmt->close();
        }
    }

    if (!$activationId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Could not determine machine activation']);
        return;
    }

    // Verify location exists
    $stmt = $db->prepare("SELECT id FROM locations WHERE id = ? AND is_active = 1");
    $stmt->bind_param("i", $locationId);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        $stmt->close();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Location not found or inactive']);
        return;
    }
    $stmt->close();

    // Mark previous assignments as not current
    $stmt = $db->prepare("UPDATE machine_locations SET is_current = 0 WHERE activation_id = ?");
    $stmt->bind_param("i", $activationId);
    $stmt->execute();
    $stmt->close();

    // Create new assignment
    $assignedBy = $_SESSION['user_id'] ?? null;
    $notes = $data['notes'] ?? null;

    $stmt = $db->prepare("
        INSERT INTO machine_locations (activation_id, location_id, assigned_by, notes, is_current)
        VALUES (?, ?, ?, ?, 1)
    ");
    $stmt->bind_param("iiis", $activationId, $locationId, $assignedBy, $notes);

    if ($stmt->execute()) {
        $assignmentId = $db->insert_id;
        $stmt->close();

        // Get location name for response
        $stmt = $db->prepare("SELECT location_code, location_name FROM locations WHERE id = ?");
        $stmt->bind_param("i", $locationId);
        $stmt->execute();
        $location = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        // Log activity
        if (class_exists('ActivityLogger')) {
            ActivityLogger::log('machine_assigned', 'settings', [
                'activation_id' => $activationId,
                'location_id' => $locationId,
                'location_name' => $location['location_name']
            ]);
        }

        echo json_encode([
            'success' => true,
            'assignment_id' => $assignmentId,
            'location' => $location,
            'message' => 'Machine assigned to location successfully'
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $stmt->error]);
        $stmt->close();
    }
}