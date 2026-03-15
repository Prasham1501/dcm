<?php
/**
 * Get Current Machine Location
 * Returns the location assigned to the current machine based on its activation
 * Used for print tracking
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$db = getDbConnection();

// Get machine ID from session/license activation
$activationId = $_SESSION['activation_id'] ?? null;
$machineId = $_SESSION['machine_id'] ?? null;

// If no activation in session, try to find it
if (!$activationId && $machineId) {
    $stmt = $db->prepare("SELECT id FROM license_activations WHERE machine_id = ? AND is_active = 1 LIMIT 1");
    $stmt->bind_param("s", $machineId);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $activationId = $result['id'] ?? null;
    $stmt->close();
}

// If still no activation, try to find based on installation license
if (!$activationId) {
    $result = $db->query("SELECT activation_id FROM installation_license WHERE id = 1");
    if ($result && $row = $result->fetch_assoc()) {
        $activationId = $row['activation_id'];
    }
}

if (!$activationId) {
    echo json_encode([
        'success' => true,
        'location_id' => null,
        'location_name' => null,
        'message' => 'No activation found'
    ]);
    exit;
}

// Get assigned location for this machine
$stmt = $db->prepare("
    SELECT loc.id as location_id, 
           loc.location_code, 
           loc.location_name,
           loc.department,
           ml.assigned_at
    FROM machine_locations ml
    JOIN locations loc ON ml.location_id = loc.id
    WHERE ml.activation_id = ? AND ml.is_current = 1
    LIMIT 1
");
$stmt->bind_param("i", $activationId);
$stmt->execute();
$result = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($result) {
    echo json_encode([
        'success' => true,
        'location_id' => intval($result['location_id']),
        'location_code' => $result['location_code'],
        'location_name' => $result['location_name'],
        'department' => $result['department'],
        'activation_id' => intval($activationId)
    ]);
} else {
    echo json_encode([
        'success' => true,
        'location_id' => null,
        'location_name' => null,
        'activation_id' => intval($activationId),
        'message' => 'Machine not assigned to any location'
    ]);
}
