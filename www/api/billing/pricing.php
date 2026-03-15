<?php
/**
 * Pricing Management API
 * Manage print pricing configuration
 *
 * GET  - Get pricing configuration
 * POST - Set/update pricing
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
 * GET - Get pricing configuration
 */
function handleGet($db) {
    $licenseId = isset($_GET['license_id']) ? (int) $_GET['license_id'] : null;

    $billingManager = new BillingManager($db);
    $pricing = $billingManager->getPricing($licenseId);

    // Group pricing by paper size for easier display
    $grouped = [];
    foreach ($pricing as $p) {
        $key = $p['paper_size'];
        if (!isset($grouped[$key])) {
            $grouped[$key] = [];
        }
        $grouped[$key][$p['color_mode']] = [
            'id' => $p['id'],
            'cost_per_page' => $p['cost_per_page'],
            'currency' => $p['currency'],
            'effective_from' => $p['effective_from'],
            'effective_until' => $p['effective_until']
        ];
    }

    echo json_encode([
        'success' => true,
        'pricing' => $pricing,
        'grouped' => $grouped
    ]);
}

/**
 * POST - Set/update pricing
 */
function handlePost($db) {
    $data = json_decode(file_get_contents('php://input'), true);

    // Validate required fields
    if (!isset($data['paper_size']) || !isset($data['cost_per_page'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'paper_size and cost_per_page are required']);
        return;
    }

    // Validate cost
    if (!is_numeric($data['cost_per_page']) || $data['cost_per_page'] < 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'cost_per_page must be a positive number']);
        return;
    }

    $billingManager = new BillingManager($db);
    $result = $billingManager->setPricing([
        'license_id' => $data['license_id'] ?? null,
        'paper_size' => $data['paper_size'],
        'color_mode' => $data['color_mode'] ?? 'any',
        'cost_per_page' => (float) $data['cost_per_page'],
        'effective_from' => $data['effective_from'] ?? date('Y-m-d'),
        'effective_until' => $data['effective_until'] ?? null,
        'description' => $data['description'] ?? null
    ]);

    if ($result['success']) {
        // Log activity
        if (class_exists('ActivityLogger')) {
            ActivityLogger::log('pricing_updated', 'billing', [
                'paper_size' => $data['paper_size'],
                'color_mode' => $data['color_mode'] ?? 'any',
                'cost_per_page' => $data['cost_per_page']
            ]);
        }

        echo json_encode($result);
    } else {
        http_response_code(500);
        echo json_encode($result);
    }
}