<?php
/**
 * Invoice Management API
 * Generate and manage invoices
 *
 * GET    - List invoices or get specific invoice
 * POST   - Generate new invoice
 * PUT    - Update invoice status
 * DELETE - Cancel invoice
 */

define('DICOM_VIEWER', true);
require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';
require_once __DIR__ . '/../../includes/rbac.php';
require_once __DIR__ . '/../../includes/BillingManager.php';

header('Content-Type: application/json');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

// Only admins can manage billing
requirePermission('manage_settings', true);

$db = getDbConnection();
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            handleGet($db);
            break;

        case 'POST':
            handlePost($db);
            break;

        case 'PUT':
            handlePut($db);
            break;

        case 'DELETE':
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
 * GET - List invoices or get specific invoice
 */
function handleGet($db) {
    $billingManager = new BillingManager($db);

    $invoiceId = $_GET['id'] ?? null;
    $licenseId = $_GET['license_id'] ?? null;
    $status = $_GET['status'] ?? null;

    if ($invoiceId) {
        // Get specific invoice
        $invoice = $billingManager->getInvoice((int) $invoiceId);

        if ($invoice) {
            echo json_encode(['success' => true, 'invoice' => $invoice]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Invoice not found']);
        }
    } else if ($licenseId) {
        // Get invoices for a license
        $invoices = $billingManager->getInvoicesByLicense((int) $licenseId);
        echo json_encode(['success' => true, 'invoices' => $invoices]);
    } else {
        // Get all invoices
        $limit = $_GET['limit'] ?? 50;
        $invoices = $billingManager->getAllInvoices($status, (int) $limit);
        $summary = $billingManager->getBillingSummary();

        echo json_encode([
            'success' => true,
            'invoices' => $invoices,
            'summary' => $summary
        ]);
    }
}

/**
 * POST - Generate new invoice
 */
function handlePost($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['license_id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'License ID is required']);
        return;
    }

    $periodStart = $data['period_start'] ?? date('Y-m-01', strtotime('last month'));
    $periodEnd = $data['period_end'] ?? date('Y-m-t', strtotime('last month'));

    $billingManager = new BillingManager($db);
    $result = $billingManager->generateInvoice(
        (int) $data['license_id'],
        $periodStart,
        $periodEnd,
        $_SESSION['user_id']
    );

    if ($result['success']) {
        // Log activity
        if (class_exists('ActivityLogger')) {
            ActivityLogger::log('invoice_generated', 'billing', [
                'invoice_number' => $result['invoice']['invoice_number'],
                'license_id' => $data['license_id'],
                'amount' => $result['invoice']['total']
            ]);
        }

        echo json_encode($result);
    } else {
        http_response_code(400);
        echo json_encode($result);
    }
}

/**
 * PUT - Update invoice status
 */
function handlePut($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['id']) || empty($data['status'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invoice ID and status are required']);
        return;
    }

    $allowedStatuses = ['generated', 'sent', 'paid', 'overdue', 'cancelled'];
    if (!in_array($data['status'], $allowedStatuses)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid status']);
        return;
    }

    $billingManager = new BillingManager($db);

    if ($data['status'] === 'cancelled') {
        $result = $billingManager->cancelInvoice((int) $data['id']);
    } else {
        $result = $billingManager->updateInvoiceStatus(
            (int) $data['id'],
            $data['status'],
            $data['payment_reference'] ?? null
        );
    }

    if ($result) {
        echo json_encode(['success' => true, 'message' => 'Invoice status updated']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update invoice']);
    }
}

/**
 * DELETE - Cancel invoice
 */
function handleDelete($db) {
    $id = $_GET['id'] ?? null;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invoice ID is required']);
        return;
    }

    $billingManager = new BillingManager($db);
    $result = $billingManager->cancelInvoice((int) $id);

    if ($result) {
        echo json_encode(['success' => true, 'message' => 'Invoice cancelled']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to cancel invoice']);
    }
}