<?php
/**
 * Hospital Printers Management API
 *
 * Manages Windows/system printers assigned to a hospital.
 * These are the printers shown in the custom print dialog.
 *
 * GET - List all printers assigned to current hospital
 * POST - Add/Update a printer assignment
 * DELETE - Remove a printer assignment
 */

error_reporting(0);
ini_set('display_errors', 0);
ob_start();

define('DICOM_VIEWER', true);

try {
    require_once __DIR__ . '/../../auth/session.php';
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'System load failed']);
    exit;
}

ob_end_clean();
header('Content-Type: application/json');

// Allow any authenticated user to read printers, but only admin can modify
$method = $_SERVER['REQUEST_METHOD'];

if (!isLoggedIn()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Login required']);
    exit;
}

// For POST/DELETE, require admin
if ($method !== 'GET' && !isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Admin access required']);
    exit;
}

$db = getDbConnection();

// Get current license ID (hospital)
$licenseId = null;
if (isset($_SESSION['license_id'])) {
    $licenseId = $_SESSION['license_id'];
}

try {
    // Ensure table exists
    $db->query("
        CREATE TABLE IF NOT EXISTS hospital_printers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            license_id INT NULL,
            printer_name VARCHAR(255) NOT NULL,
            display_name VARCHAR(255),
            description TEXT,
            location_id INT NULL,
            is_default TINYINT(1) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            supports_color TINYINT(1) DEFAULT 1,
            supports_duplex TINYINT(1) DEFAULT 0,
            default_paper_size VARCHAR(20) DEFAULT 'A4',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
            created_by INT,
            INDEX idx_license (license_id),
            INDEX idx_active (is_active),
            INDEX idx_printer_name (printer_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");

    if ($method === 'GET') {
        // List all active printers for this hospital
        $includeInactive = isset($_GET['include_inactive']) && $_GET['include_inactive'] === 'true';

        $sql = "SELECT hp.*, l.location_name, l.location_code
                FROM hospital_printers hp
                LEFT JOIN locations l ON hp.location_id = l.id
                WHERE (hp.license_id = ? OR hp.license_id IS NULL)";

        if (!$includeInactive) {
            $sql .= " AND hp.is_active = 1";
        }

        $sql .= " ORDER BY hp.is_default DESC, hp.display_name ASC, hp.printer_name ASC";

        $stmt = $db->prepare($sql);
        $stmt->bind_param("i", $licenseId);
        $stmt->execute();
        $result = $stmt->get_result();
        $printers = $result->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        echo json_encode([
            'success' => true,
            'printers' => $printers,
            'count' => count($printers)
        ]);

    } elseif ($method === 'POST') {
        // Add or update a printer
        $input = json_decode(file_get_contents('php://input'), true);

        $id = $input['id'] ?? null;
        $printerName = trim($input['printer_name'] ?? '');
        $displayName = trim($input['display_name'] ?? '');
        $description = trim($input['description'] ?? '');
        $locationId = !empty($input['location_id']) ? intval($input['location_id']) : null;
        $isDefault = !empty($input['is_default']) ? 1 : 0;
        $isActive = isset($input['is_active']) ? ($input['is_active'] ? 1 : 0) : 1;
        $supportsColor = isset($input['supports_color']) ? ($input['supports_color'] ? 1 : 0) : 1;
        $supportsDuplex = isset($input['supports_duplex']) ? ($input['supports_duplex'] ? 1 : 0) : 0;
        $defaultPaperSize = $input['default_paper_size'] ?? 'A4';

        if (empty($printerName)) {
            throw new Exception("Printer name is required");
        }

        // If setting as default, unset other defaults for this hospital
        if ($isDefault) {
            $stmt = $db->prepare("UPDATE hospital_printers SET is_default = 0 WHERE license_id = ? OR license_id IS NULL");
            $stmt->bind_param("i", $licenseId);
            $stmt->execute();
            $stmt->close();
        }

        if ($id) {
            // Update existing
            $stmt = $db->prepare("
                UPDATE hospital_printers SET
                    printer_name = ?,
                    display_name = ?,
                    description = ?,
                    location_id = ?,
                    is_default = ?,
                    is_active = ?,
                    supports_color = ?,
                    supports_duplex = ?,
                    default_paper_size = ?
                WHERE id = ?
            ");
            $stmt->bind_param(
                "sssiiiiisi",
                $printerName,
                $displayName,
                $description,
                $locationId,
                $isDefault,
                $isActive,
                $supportsColor,
                $supportsDuplex,
                $defaultPaperSize,
                $id
            );
        } else {
            // Create new
            $userId = $_SESSION['user_id'] ?? null;
            $stmt = $db->prepare("
                INSERT INTO hospital_printers
                    (license_id, printer_name, display_name, description, location_id,
                     is_default, is_active, supports_color, supports_duplex, default_paper_size, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->bind_param(
                "isssiiiiiis",
                $licenseId,
                $printerName,
                $displayName,
                $description,
                $locationId,
                $isDefault,
                $isActive,
                $supportsColor,
                $supportsDuplex,
                $defaultPaperSize,
                $userId
            );
        }

        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }

        $newId = $id ?? $db->insert_id;
        $stmt->close();

        echo json_encode([
            'success' => true,
            'message' => $id ? 'Printer updated successfully' : 'Printer added successfully',
            'printer_id' => $newId
        ]);

    } elseif ($method === 'DELETE') {
        // Remove a printer
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;

        if (!$id) {
            throw new Exception("Printer ID is required");
        }

        $stmt = $db->prepare("DELETE FROM hospital_printers WHERE id = ?");
        $stmt->bind_param("i", $id);

        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }

        $stmt->close();

        echo json_encode([
            'success' => true,
            'message' => 'Printer removed successfully'
        ]);

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
