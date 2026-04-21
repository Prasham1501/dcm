<?php
/**
 * Hospital DICOM Viewer Pro v2.0
 * Update Medical Report API Endpoint
 *
 * PUT /api/reports/update.php
 * Updates an existing medical report and creates a version history entry
 */

// Prevent direct access
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

// Load dependencies
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Set JSON response header
header('Content-Type: application/json');

// Handle CORS
header('Access-Control-Allow-Origin: ' . CORS_ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: PUT, OPTIONS');
header('Access-Control-Allow-Headers: ' . CORS_ALLOWED_HEADERS);

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow PUT method
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    sendErrorResponse('Method not allowed', 405);
}

// Validate session
if (!validateSession()) {
    sendErrorResponse('Unauthorized - Please log in', 401);
}

try {
    // Get current user
    $currentUser = getCurrentUser();

    // Get PUT data
    $input = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    if (!isset($input['id']) || empty($input['id'])) {
        sendErrorResponse('Missing required field: id', 400);
    }

    $report_id = intval($input['id']);

    if ($report_id <= 0) {
        sendErrorResponse('Invalid report ID', 400);
    }

    // Get database connection
    $db = getDbConnection();

    // First, retrieve the current report data to create a version
    $selectStmt = $db->prepare("
        SELECT
            id,
            indication,
            technique,
            findings,
            impression,
            status
        FROM medical_reports
        WHERE id = ?
    ");

    $selectStmt->bind_param("i", $report_id);
    $selectStmt->execute();
    $result = $selectStmt->get_result();

    if ($result->num_rows === 0) {
        $selectStmt->close();
        sendErrorResponse('Medical report not found', 404);
    }

    $currentReport = $result->fetch_assoc();
    $selectStmt->close();

    // Extract update fields (only update provided fields)
    $indication = isset($input['indication']) ? trim($input['indication']) : $currentReport['indication'];
    $technique = isset($input['technique']) ? trim($input['technique']) : $currentReport['technique'];
    $findings = isset($input['findings']) ? trim($input['findings']) : $currentReport['findings'];
    $impression = isset($input['impression']) ? trim($input['impression']) : $currentReport['impression'];
    $status = isset($input['status']) ? sanitizeInput($input['status']) : $currentReport['status'];
    $change_reason = isset($input['change_reason']) ? sanitizeInput($input['change_reason']) : null;

    // Validate status
    $validStatuses = ['draft', 'final', 'amended'];
    if (!in_array($status, $validStatuses)) {
        sendErrorResponse("Invalid status. Must be one of: " . implode(', ', $validStatuses), 400);
    }

    // Get the current version number
    $versionStmt = $db->prepare("
        SELECT COALESCE(MAX(version_number), 0) AS max_version
        FROM report_versions
        WHERE report_id = ?
    ");

    $versionStmt->bind_param("i", $report_id);
    $versionStmt->execute();
    $versionResult = $versionStmt->get_result();
    $versionRow = $versionResult->fetch_assoc();
    $next_version = $versionRow['max_version'] + 1;
    $versionStmt->close();

    // Begin transaction
    $db->begin_transaction();

    try {
        // Create version history entry with current data
        $insertVersionStmt = $db->prepare("
            INSERT INTO report_versions (
                report_id,
                version_number,
                indication,
                technique,
                findings,
                impression,
                changed_by,
                change_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $insertVersionStmt->bind_param(
            "iissssIs",
            $report_id,
            $next_version,
            $currentReport['indication'],
            $currentReport['technique'],
            $currentReport['findings'],
            $currentReport['impression'],
            $currentUser['id'],
            $change_reason
        );

        if (!$insertVersionStmt->execute()) {
            throw new Exception("Failed to create version history: " . $insertVersionStmt->error);
        }

        $version_id = $insertVersionStmt->insert_id;
        $insertVersionStmt->close();

        // Update the report with new data
        $updateStmt = $db->prepare("
            UPDATE medical_reports
            SET
                indication = ?,
                technique = ?,
                findings = ?,
                impression = ?,
                status = ?,
                finalized_at = CASE WHEN ? = 'final' AND status != 'final' THEN NOW() ELSE finalized_at END
            WHERE id = ?
        ");

        $updateStmt->bind_param(
            "ssssssi",
            $indication,
            $technique,
            $findings,
            $impression,
            $status,
            $status,
            $report_id
        );

        if (!$updateStmt->execute()) {
            throw new Exception("Failed to update medical report: " . $updateStmt->error);
        }

        $updateStmt->close();

        // Commit transaction
        $db->commit();

        // Get the updated report
        $selectUpdatedStmt = $db->prepare("
            SELECT
                r.*,
                u1.full_name AS created_by_name,
                u2.full_name AS reporting_physician_name
            FROM medical_reports r
            LEFT JOIN users u1 ON r.created_by = u1.id
            LEFT JOIN users u2 ON r.reporting_physician_id = u2.id
            WHERE r.id = ?
        ");

        $selectUpdatedStmt->bind_param("i", $report_id);
        $selectUpdatedStmt->execute();
        $updatedResult = $selectUpdatedStmt->get_result();
        $updatedReport = $updatedResult->fetch_assoc();
        $selectUpdatedStmt->close();

        // Log audit event
        logAuditEvent(
            $currentUser['id'],
            'update',
            'medical_report',
            $report_id,
            "Updated medical report ID {$report_id}, created version {$next_version}"
        );

        // Log to file
        logMessage(
            "User {$currentUser['username']} updated medical report ID {$report_id} (version {$next_version})",
            'info',
            'reports.log'
        );

        // Return success response with updated report
        sendSuccessResponse(
            [
                'report' => $updatedReport,
                'version_created' => $next_version,
                'version_id' => $version_id
            ],
            'Medical report updated successfully'
        );

    } catch (Exception $e) {
        // Rollback transaction on error
        $db->rollback();
        throw $e;
    }

} catch (Exception $e) {
    logMessage("Error updating medical report: " . $e->getMessage(), 'error', 'reports.log');
    sendErrorResponse('Failed to update medical report: ' . $e->getMessage(), 500);
}
