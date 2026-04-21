<?php
/**
 * Study Remarks API
 *
 * CRUD operations for study remarks
 * GET: Get remarks for a study
 * POST: Create new remark
 * PUT: Update existing remark
 * DELETE: Delete remark
 */

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Require authentication
requireLogin();

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

try {
    $conn = getDbConnection();

    switch ($method) {
        case 'GET':
            // Get remarks for a study
            $studyUID = $_GET['study_uid'] ?? null;

            if (!$studyUID) {
                throw new Exception('Study UID is required');
            }

            $stmt = $conn->prepare("
                SELECT
                    sr.id,
                    sr.study_instance_uid,
                    sr.remark,
                    sr.created_by,
                    sr.created_at,
                    sr.updated_at,
                    u.full_name as created_by_name,
                    u.role as created_by_role
                FROM study_remarks sr
                LEFT JOIN users u ON sr.created_by = u.id
                WHERE sr.study_instance_uid = ?
                ORDER BY sr.created_at DESC
            ");

            $stmt->bind_param('s', $studyUID);
            $stmt->execute();
            $result = $stmt->get_result();

            $remarks = [];
            while ($row = $result->fetch_assoc()) {
                $remarks[] = $row;
            }

            echo json_encode([
                'success' => true,
                'remarks' => $remarks
            ]);
            break;

        case 'POST':
            // Create new remark
            $data = json_decode(file_get_contents('php://input'), true);

            $studyUID = $data['study_uid'] ?? null;
            $remark = $data['remark'] ?? null;

            if (!$studyUID || !$remark) {
                throw new Exception('Study UID and remark are required');
            }

            $userId = $_SESSION['user_id'];

            $stmt = $conn->prepare("
                INSERT INTO study_remarks (study_instance_uid, remark, created_by)
                VALUES (?, ?, ?)
            ");

            $stmt->bind_param('ssi', $studyUID, $remark, $userId);

            if ($stmt->execute()) {
                $remarkId = $conn->insert_id;

                // Get the created remark with user info
                $stmt = $conn->prepare("
                    SELECT
                        sr.id,
                        sr.study_instance_uid,
                        sr.remark,
                        sr.created_by,
                        sr.created_at,
                        sr.updated_at,
                        u.full_name as created_by_name,
                        u.role as created_by_role
                    FROM study_remarks sr
                    LEFT JOIN users u ON sr.created_by = u.id
                    WHERE sr.id = ?
                ");

                $stmt->bind_param('i', $remarkId);
                $stmt->execute();
                $result = $stmt->get_result();
                $newRemark = $result->fetch_assoc();

                echo json_encode([
                    'success' => true,
                    'message' => 'Remark created successfully',
                    'remark' => $newRemark
                ]);
            } else {
                throw new Exception('Failed to create remark');
            }
            break;

        case 'PUT':
            // Update existing remark
            $data = json_decode(file_get_contents('php://input'), true);

            $remarkId = $data['id'] ?? null;
            $remark = $data['remark'] ?? null;

            if (!$remarkId || !$remark) {
                throw new Exception('Remark ID and remark text are required');
            }

            $userId = $_SESSION['user_id'];

            // Check if user owns the remark or is admin
            $stmt = $conn->prepare("SELECT created_by FROM study_remarks WHERE id = ?");
            $stmt->bind_param('i', $remarkId);
            $stmt->execute();
            $result = $stmt->get_result();
            $existing = $result->fetch_assoc();

            if (!$existing) {
                throw new Exception('Remark not found');
            }

            if ($existing['created_by'] != $userId && $_SESSION['role'] !== 'admin') {
                throw new Exception('You do not have permission to edit this remark');
            }

            $stmt = $conn->prepare("
                UPDATE study_remarks
                SET remark = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ");

            $stmt->bind_param('si', $remark, $remarkId);

            if ($stmt->execute()) {
                // Get the updated remark
                $stmt = $conn->prepare("
                    SELECT
                        sr.id,
                        sr.study_instance_uid,
                        sr.remark,
                        sr.created_by,
                        sr.created_at,
                        sr.updated_at,
                        u.full_name as created_by_name,
                        u.role as created_by_role
                    FROM study_remarks sr
                    LEFT JOIN users u ON sr.created_by = u.id
                    WHERE sr.id = ?
                ");

                $stmt->bind_param('i', $remarkId);
                $stmt->execute();
                $result = $stmt->get_result();
                $updatedRemark = $result->fetch_assoc();

                echo json_encode([
                    'success' => true,
                    'message' => 'Remark updated successfully',
                    'remark' => $updatedRemark
                ]);
            } else {
                throw new Exception('Failed to update remark');
            }
            break;

        case 'DELETE':
            // Delete remark
            $remarkId = $_GET['id'] ?? null;

            if (!$remarkId) {
                throw new Exception('Remark ID is required');
            }

            $userId = $_SESSION['user_id'];

            // Check if user owns the remark or is admin
            $stmt = $conn->prepare("SELECT created_by FROM study_remarks WHERE id = ?");
            $stmt->bind_param('i', $remarkId);
            $stmt->execute();
            $result = $stmt->get_result();
            $existing = $result->fetch_assoc();

            if (!$existing) {
                throw new Exception('Remark not found');
            }

            if ($existing['created_by'] != $userId && $_SESSION['role'] !== 'admin') {
                throw new Exception('You do not have permission to delete this remark');
            }

            $stmt = $conn->prepare("DELETE FROM study_remarks WHERE id = ?");
            $stmt->bind_param('i', $remarkId);

            if ($stmt->execute()) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Remark deleted successfully'
                ]);
            } else {
                throw new Exception('Failed to delete remark');
            }
            break;

        default:
            throw new Exception('Method not allowed');
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}