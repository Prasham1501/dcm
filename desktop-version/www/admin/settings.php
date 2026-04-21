<?php
/**
 * System Settings Page
 * Comprehensive settings management for hospital administrators
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';

// Require login
requireLogin('../pages/login.html');

// Only admin can access settings
if (!isAdmin()) {
    header('Location: ../pages/patients.html');
    exit;
}

$userName = $_SESSION['username'] ?? 'Admin';

/**
 * Get local IP address of the server
 * @return string Local IP address
 */
function getLocalIPAddress() {
    // Try to get the server's local IP address
    $localIP = '0.0.0.0';
    
    // Method 1: Use $_SERVER variables
    if (!empty($_SERVER['SERVER_ADDR'])) {
        $localIP = $_SERVER['SERVER_ADDR'];
    } elseif (!empty($_SERVER['LOCAL_ADDR'])) {
        $localIP = $_SERVER['LOCAL_ADDR'];
    } else {
        // Method 2: Create a socket connection to external IP to get local IP
        $sock = @socket_create(AF_INET, SOCK_DGRAM, SOL_UDP);
        if ($sock) {
            @socket_connect($sock, "8.8.8.8", 53);
            @socket_getsockname($sock, $localIP);
            @socket_close($sock);
        }
        
        // Method 3: Use hostname
        if ($localIP == '0.0.0.0' || $localIP == '::1' || $localIP == '127.0.0.1') {
            $localIP = gethostbyname(gethostname());
        }
    }
    
    // Filter out localhost addresses
    if ($localIP == '::1' || $localIP == '127.0.0.1') {
        $localIP = '0.0.0.0';
    }
    
    return $localIP;
}

$detectedIP = getLocalIPAddress();
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="base-path" content="<?= BASE_PATH ?>">
    <meta name="detected-ip" content="<?= htmlspecialchars($detectedIP) ?>">
    <title>System Settings - DICOM Viewer</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body {
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            min-height: 100vh;
            color: #fff;
        }
        .navbar-custom {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .settings-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 20px;
            transition: all 0.3s;
        }
        .settings-card:hover {
            border-color: #0d6efd;
            box-shadow: 0 0 20px rgba(13, 110, 253, 0.2);
        }
        .category-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid rgba(13, 110, 253, 0.5);
        }
        .category-icon {
            font-size: 1.5rem;
            color: #0d6efd;
        }
        .form-control, .form-select {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
        }
        .form-control:focus, .form-select:focus {
            background: rgba(255, 255, 255, 0.08);
            border-color: #0d6efd;
            color: #fff;
            box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
        }
        .table-dark-custom {
            --bs-table-bg: rgba(255, 255, 255, 0.02);
            --bs-table-color: #fff;
            --bs-table-border-color: rgba(255, 255, 255, 0.1);
        }
        .btn-action {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
        }
        .modal-content {
            background: #1a1f3a;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
        }
        .modal-header {
            border-bottom-color: rgba(255, 255, 255, 0.1);
        }
        .modal-footer {
            border-top-color: rgba(255, 255, 255, 0.1);
        }
        .save-indicator {
            display: none;
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1050;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-custom mb-4">
        <div class="container-fluid">
            <a class="navbar-brand text-white" href="<?= BASE_PATH ?>/patients.php">
                <i class="bi bi-heart-pulse-fill text-primary"></i>
                DICOM Viewer Pro
            </a>
            <div class="d-flex align-items-center gap-3">
                <a href="<?= BASE_PATH ?>/pages/patients.html" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-arrow-left"></i> Back to Patients
                </a>
                <span class="text-light">
                    <i class="bi bi-person-circle"></i>
                    <?= htmlspecialchars($userName) ?> (Admin)
                </span>
                <a href="<?= BASE_PATH ?>/logout.php" class="btn btn-outline-danger btn-sm">
                    <i class="bi bi-box-arrow-right"></i> Logout
                </a>
            </div>
        </div>
    </nav>

    <div class="container">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2 class="text-white">
                <i class="bi bi-gear-fill text-primary"></i>
                System Settings
            </h2>
            <button class="btn btn-success" id="saveAllBtn">
                <i class="bi bi-check-circle"></i> Save General Settings
            </button>
        </div>

        <!-- Save Indicator -->
        <div class="save-indicator alert alert-success" id="saveIndicator">
            <i class="bi bi-check-circle-fill"></i> Settings saved successfully
        </div>

        <!-- Settings Form -->
        <form id="settingsForm">
            
            <!-- Hospital Information -->
            <div class="settings-card">
                <div class="category-header">
                    <i class="bi bi-hospital category-icon"></i>
                    <h4 class="mb-0 text-white">Hospital Information</h4>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light">Hospital Name</label>
                        <input type="text" class="form-control" name="hospital_name" placeholder="General Hospital">
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light">Timezone</label>
                        <select class="form-select" name="hospital_timezone">
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="America/New_York">America/New_York (EST)</option>
                            <option value="Europe/London">Europe/London (GMT)</option>
                            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                            <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                        </select>
                    </div>
                </div>
                
                <!-- Hospital Logo Upload -->
                <div class="row mt-3">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light">Hospital Logo</label>
                        <div class="d-flex align-items-center gap-3">
                            <div id="logoPreviewContainer" class="border border-secondary rounded p-2" style="width: 120px; height: 80px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05);">
                                <img id="logoPreview" src="" alt="Logo Preview" style="max-width: 100%; max-height: 100%; display: none;">
                                <span id="noLogoText" class="text-muted small"><i class="bi bi-image"></i> No Logo</span>
                            </div>
                            <div class="flex-grow-1">
                                <input type="file" class="form-control" id="hospitalLogoInput" accept=".jpg,.jpeg,.png" style="display: none;">
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="document.getElementById('hospitalLogoInput').click()">
                                    <i class="bi bi-upload"></i> Upload Logo
                                </button>
                                <button type="button" class="btn btn-outline-danger btn-sm" id="removeLogoBtn" onclick="removeLogo()" style="display: none;">
                                    <i class="bi bi-trash"></i> Remove
                                </button>
                                <div class="form-text text-muted small mt-1">
                                    Supported: JPG, PNG. Max 2MB. Recommended: 200x100px
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light">Logo Display</label>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" name="show_logo_header" id="showLogoHeader" checked>
                            <label class="form-check-label text-light" for="showLogoHeader">
                                Show logo in application header
                            </label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" name="show_logo_print" id="showLogoPrint" checked>
                            <label class="form-check-label text-light" for="showLogoPrint">
                                Show logo in print/PDF exports
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <!-- DICOM Nodes Configuration -->
            <div class="settings-card">
                <div class="category-header d-flex justify-content-between">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-wifi category-icon"></i>
                        <h4 class="mb-0 text-white">DICOM Nodes (Servers)</h4>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm" onclick="openNodeModal()">
                        <i class="bi bi-plus-circle"></i> Add Node
                    </button>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-dark-custom table-hover" id="nodesTable">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>AE Title</th>
                                <th>Host/IP</th>
                                <th>Port</th>
                                <th>Default</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Nodes will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- DICOM Printers Configuration -->
            <div class="settings-card">
                <div class="category-header d-flex justify-content-between">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-printer category-icon"></i>
                        <h4 class="mb-0 text-white">DICOM Printers</h4>
                    </div>
                    <div class="btn-group">
                        <button type="button" class="btn btn-info btn-sm" onclick="detectSystemPrinters()">
                            <i class="bi bi-search"></i> Detect Printers
                        </button>
                        <button type="button" class="btn btn-primary btn-sm" onclick="openPrinterModal()">
                            <i class="bi bi-plus-circle"></i> Add Printer
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="table table-dark-custom table-hover" id="printersTable">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>AE Title</th>
                                <th>Host/IP</th>
                                <th>Port</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Printers will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Orthanc Configuration -->
            <div class="settings-card">
                <div class="category-header">
                    <i class="bi bi-server category-icon"></i>
                    <h4 class="mb-0 text-white">Orthanc PACS Server</h4>
                </div>
                
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light">Orthanc URL</label>
                        <input type="url" class="form-control" name="orthanc_url" placeholder="http://localhost:8042">
                    </div>
                    <div class="col-md-3 mb-3">
                        <label class="form-label text-light">Username</label>
                        <input type="text" class="form-control" name="orthanc_username" placeholder="orthanc">
                    </div>
                    <div class="col-md-3 mb-3">
                        <label class="form-label text-light">Password</label>
                        <input type="password" class="form-control" name="orthanc_password" placeholder="••••••••">
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light">DICOM AE Title</label>
                        <input type="text" class="form-control" name="orthanc_dicom_aet" placeholder="ORTHANC" maxlength="16">
                        <small class="form-text text-muted">Application Entity Title (max 16 characters)</small>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label class="form-label text-light">DICOM Port</label>
                        <input type="number" class="form-control" name="orthanc_dicom_port" placeholder="4242">
                        <small class="form-text text-muted">For receiving DICOM images</small>
                    </div>
                    <div class="col-md-3 mb-3">
                        <label class="form-label text-light">HTTP Port</label>
                        <input type="number" class="form-control" name="orthanc_http_port" placeholder="8042">
                        <small class="form-text text-muted">For web interface</small>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light">DICOMweb Root Path</label>
                        <input type="text" class="form-control" name="orthanc_dicomweb_root" placeholder="/dicom-web">
                    </div>
                    <div class="col-md-6 mb-3 d-flex align-items-end">
                        <button type="button" class="btn btn-outline-success w-100" id="testOrthancBtn">
                            <i class="bi bi-check-circle"></i> Test Connection
                        </button>
                    </div>
                    <div class="col-md-6 mb-3 d-flex align-items-end">
                        <button type="button" class="btn btn-success w-100" id="saveOrthancConfigBtn">
                            <i class="bi bi-save"></i> Save & Apply Configuration
                        </button>
                    </div>
                    <div class="col-12">
                        <div id="connectionResult" class="mt-2" style="display:none;"></div>
                    </div>
                    <div class="col-12">
                        <div class="alert alert-info small">
                            <i class="bi bi-info-circle"></i>
                            <strong>Auto-Configuration:</strong> Click "Save & Apply Configuration" to automatically update settings. 
                            You may need to restart Orthanc service for changes to take effect.
                        </div>
                    </div>
                </div>
            </div>

            <!-- Print Settings -->
            <div class="settings-card" id="print-settings">
                <div class="category-header d-flex justify-content-between">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-printer-fill category-icon"></i>
                        <h4 class="mb-0 text-white">Print Settings</h4>
                    </div>
                    <button type="button" class="btn btn-success btn-sm" id="savePrintSettingsBtn">
                        <i class="bi bi-check-circle"></i> Save Print Settings
                    </button>
                </div>

                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    <strong>Configure once, print consistently:</strong> These settings will be applied to all prints across the system.
                    Doctors can simply click print without configuring each time.
                </div>

                <form id="printSettingsForm">
                    <!-- Include Information Section -->
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="bi bi-card-text me-2"></i>Information to Include on Prints
                        </h6>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="printIncludePatientInfo" name="includePatientInfo" checked>
                                    <label class="form-check-label text-light" for="printIncludePatientInfo">
                                        <i class="bi bi-person-badge me-2 text-info"></i>Patient Information
                                    </label>
                                </div>
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="printIncludeStudyInfo" name="includeStudyInfo" checked>
                                    <label class="form-check-label text-light" for="printIncludeStudyInfo">
                                        <i class="bi bi-file-medical me-2 text-success"></i>Study Information
                                    </label>
                                </div>
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="printIncludeInstitutionInfo" name="includeInstitutionInfo" checked>
                                    <label class="form-check-label text-light" for="printIncludeInstitutionInfo">
                                        <i class="bi bi-hospital me-2 text-primary"></i>Hospital/Institution Info
                                    </label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="printIncludeAnnotations" name="includeAnnotations" checked>
                                    <label class="form-check-label text-light" for="printIncludeAnnotations">
                                        <i class="bi bi-pencil-square me-2 text-warning"></i>Annotations & Shapes
                                    </label>
                                </div>
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="printIncludeWindowLevel" name="includeWindowLevel" checked>
                                    <label class="form-check-label text-light" for="printIncludeWindowLevel">
                                        <i class="bi bi-sliders me-2 text-success"></i>Window/Level Values
                                    </label>
                                </div>
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="printIncludeMeasurements" name="includeMeasurements" checked>
                                    <label class="form-check-label text-light" for="printIncludeMeasurements">
                                        <i class="bi bi-rulers me-2 text-danger"></i>Measurements
                                    </label>
                                </div>
                                <div class="form-check form-switch mb-2">
                                    <input class="form-check-input" type="checkbox" id="printIncludeTimestamp" name="includeTimestamp" checked>
                                    <label class="form-check-label text-light" for="printIncludeTimestamp">
                                        <i class="bi bi-clock me-2 text-info"></i>Timestamp
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Page Layout Section -->
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="bi bi-layout-text-window me-2"></i>Page Layout
                        </h6>
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label class="form-label text-light">Paper Size</label>
                                <select class="form-select" id="printPaperSize" name="paperSize">
                                    <option value="A4" selected>A4 (210 × 297 mm)</option>
                                    <option value="A3">A3 (297 × 420 mm)</option>
                                    <option value="Letter">Letter (8.5 × 11 in)</option>
                                    <option value="Legal">Legal (8.5 × 14 in)</option>
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label text-light">Orientation</label>
                                <select class="form-select" id="printOrientation" name="orientation">
                                    <option value="landscape" selected>Landscape</option>
                                    <option value="portrait">Portrait</option>
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label text-light">Margins</label>
                                <select class="form-select" id="printMargins" name="margins">
                                    <option value="none">None</option>
                                    <option value="narrow">Narrow (5mm)</option>
                                    <option value="normal" selected>Normal (10mm)</option>
                                    <option value="wide">Wide (20mm)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Output Quality Section -->
                    <div class="mb-4">
                        <h6 class="text-primary mb-3">
                            <i class="bi bi-image me-2"></i>Output Quality
                        </h6>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-light">Print Quality</label>
                                <select class="form-select" id="printQuality" name="quality">
                                    <option value="draft">Draft (Fast, Lower Quality)</option>
                                    <option value="normal">Normal</option>
                                    <option value="high" selected>High Quality (Recommended)</option>
                                    <option value="maximum">Maximum (Slow, Best Quality)</option>
                                </select>
                                <small class="form-text text-muted">Higher quality = slower processing but better output</small>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label text-light">Color Mode</label>
                                <select class="form-select" id="printColorMode" name="colorMode">
                                    <option value="grayscale" selected>Grayscale (Medical Standard)</option>
                                    <option value="color">Color</option>
                                    <option value="inverted">Inverted Grayscale</option>
                                </select>
                                <small class="form-text text-muted">Grayscale is standard for medical imaging</small>
                            </div>
                        </div>
                    </div>

                    <div class="alert alert-success">
                        <i class="bi bi-check-circle-fill me-2"></i>
                        <strong>Tip:</strong> These settings ensure consistent professional prints every time without having to reconfigure.
                    </div>
                </form>
            </div>

            <!-- Advanced Settings -->
            <div class="settings-card">
                <div class="category-header">
                    <i class="bi bi-sliders category-icon"></i>
                    <h4 class="mb-0 text-white">Advanced Settings</h4>
                </div>
                <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" name="enable_technical_preview" id="techPreview">
                    <label class="form-check-label text-light" for="techPreview">
                        Enable Technical Preview Mode
                    </label>
                </div>
            </div>

            <!-- Danger Zone -->
            <div class="settings-card border-danger" style="background: rgba(220, 53, 69, 0.05);">
                <div class="category-header border-danger">
                    <i class="bi bi-exclamation-octagon-fill category-icon text-danger"></i>
                    <h4 class="mb-0 text-danger">Danger Zone</h4>
                </div>
                <div class="row align-items-center">
                    <div class="col-md-8">
                        <h5 class="text-white">System Reset</h5>
                        <p class="text-muted mb-0">Permanently delete all data, patients, and images to start fresh.</p>
                    </div>
                    <div class="col-md-4 text-end">
                        <a href="<?= BASE_PATH ?>/admin/reset-data.php" class="btn btn-outline-danger">
                            <i class="bi bi-trash3"></i> Reset System Data
                        </a>
                    </div>
                </div>
            </div>

        </form>
    </div>

    <!-- Node Modal -->
    <div class="modal fade" id="nodeModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Configure DICOM Node</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="nodeForm">
                        <input type="hidden" name="id" id="nodeId">
                        <div class="mb-3">
                            <label class="form-label">Friendly Name</label>
                            <input type="text" class="form-control" name="name" id="nodeName" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">AE Title</label>
                            <input type="text" class="form-control" name="ae_title" id="nodeAET" required>
                        </div>
                        <div class="row">
                            <div class="col-md-8 mb-3">
                                <label class="form-label">Host / IP</label>
                                <input type="text" class="form-control" name="host_name" id="nodeHost" required 
                                       placeholder="<?= htmlspecialchars($detectedIP) ?>">
                                <small class="form-text text-muted">
                                    <i class="bi bi-info-circle"></i> 
                                    Auto-detected: <code><?= htmlspecialchars($detectedIP) ?></code> | 
                                    Use 0.0.0.0 for all network interfaces
                                </small>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Port</label>
                                <input type="number" class="form-control" name="port" id="nodePort" 
                                       placeholder="4242" required>
                                <small class="form-text text-muted">
                                    <i class="bi bi-info-circle"></i> 
                                    DICOM port (default: 4242)
                                </small>
                            </div>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" name="is_default" id="nodeDefault">
                            <label class="form-check-label">Set as Default Node</label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="saveNode()">Save Node</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Printer Modal -->
    <div class="modal fade" id="printerModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Configure DICOM Printer</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="printerForm">
                        <input type="hidden" name="id" id="printerId">
                        <div class="mb-3">
                            <label class="form-label">Printer Name</label>
                            <input type="text" class="form-control" name="name" id="printerName" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">AE Title</label>
                            <input type="text" class="form-control" name="ae_title" id="printerAET" required>
                        </div>
                        <div class="row">
                            <div class="col-md-8 mb-3">
                                <label class="form-label">Host / IP</label>
                                <input type="text" class="form-control" name="host_name" id="printerHost" required>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Port</label>
                                <input type="number" class="form-control" name="port" id="printerPort" required>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Description</label>
                            <textarea class="form-control" name="description" id="printerDesc" rows="2"></textarea>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" name="is_active" id="printerActive" checked>
                            <label class="form-check-label">Printer Active</label>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="savePrinter()">Save Printer</button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        const basePath = document.querySelector('meta[name="base-path"]').content;
        let nodeModal, printerModal;

        document.addEventListener('DOMContentLoaded', () => {
            nodeModal = new bootstrap.Modal(document.getElementById('nodeModal'));
            printerModal = new bootstrap.Modal(document.getElementById('printerModal'));

            loadSettings();
            loadNodes();
            loadPrinters();
            loadCurrentLogo();
            loadPrintSettings(); // Load print settings
            setupEventListeners();
        });

        // --- General Settings ---
        async function loadSettings() {
            try {
                const response = await fetch(`${basePath}/api/settings/get-settings.php`);
                const data = await response.json();
                if (data.success) populateForm(data.settings);
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }

        function populateForm(settings) {
            Object.values(settings).flat().forEach(setting => {
                const input = document.querySelector(`[name="${setting.setting_key}"]`);
                if (input) {
                    if (input.type === 'checkbox') input.checked = Boolean(setting.setting_value);
                    else input.value = setting.setting_value || '';
                }
            });
        }

        async function saveAllSettings() {
            const form = document.getElementById('settingsForm');
            const formData = new FormData(form);
            const settings = {};
            
            for (let [key, value] of formData.entries()) {
                const input = form.querySelector(`[name="${key}"]`);
                if (input && input.type === 'checkbox') settings[key] = input.checked;
                else settings[key] = value;
            }
            
            try {
                const response = await fetch(`${basePath}/api/settings/update-settings.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings })
                });
                const data = await response.json();
                if (data.success) showSuccess(data.message);
                else alert('Error: ' + data.error);
            } catch (error) {
                alert('Error saving settings: ' + error.message);
            }
        }

        // --- Nodes Management ---
        async function loadNodes() {
            const tbody = document.querySelector('#nodesTable tbody');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
            
            try {
                const response = await fetch(`${basePath}/api/settings/nodes.php`);
                const data = await response.json();
                
                if (data.success && data.nodes.length > 0) {
                    tbody.innerHTML = data.nodes.map(node => `
                        <tr>
                            <td>${node.name}</td>
                            <td>${node.ae_title}</td>
                            <td>${node.host_name}</td>
                            <td>${node.port}</td>
                            <td>${node.is_default == 1 ? '<span class="badge bg-success">Default</span>' : ''}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary btn-action" onclick='editNode(${JSON.stringify(node)})'>
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-action" onclick="deleteNode(${node.id})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No nodes configured</td></tr>';
                }
            } catch (error) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading nodes</td></tr>';
            }
        }

        function openNodeModal() {
            document.getElementById('nodeForm').reset();
            document.getElementById('nodeId').value = '';
            
            // Auto-populate host with detected IP
            const detectedIP = document.querySelector('meta[name="detected-ip"]')?.content || '0.0.0.0';
            if (detectedIP && detectedIP !== '0.0.0.0') {
                document.getElementById('nodeHost').value = detectedIP;
            }
            
            // Set default DICOM port as placeholder (user can change it)
            // Note: Orthanc must be configured to listen on the chosen port
            if (!document.getElementById('nodePort').value) {
                document.getElementById('nodePort').placeholder = '4242 (default)';
            }
            
            nodeModal.show();
        }

        function editNode(node) {
            document.getElementById('nodeId').value = node.id;
            document.getElementById('nodeName').value = node.name;
            document.getElementById('nodeAET').value = node.ae_title;
            document.getElementById('nodeHost').value = node.host_name;
            document.getElementById('nodePort').value = node.port;
            document.getElementById('nodeDefault').checked = node.is_default == 1;
            nodeModal.show();
        }

        async function saveNode() {
            const form = document.getElementById('nodeForm');
            const data = {
                id: document.getElementById('nodeId').value,
                name: document.getElementById('nodeName').value,
                ae_title: document.getElementById('nodeAET').value,
                host_name: document.getElementById('nodeHost').value,
                port: document.getElementById('nodePort').value,
                is_default: document.getElementById('nodeDefault').checked
            };

            try {
                const response = await fetch(`${basePath}/api/settings/nodes.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                
                if (result.success) {
                    nodeModal.hide();
                    loadNodes();
                    showSuccess('Node saved successfully');
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error saving node: ' + error.message);
            }
        }

        async function deleteNode(id) {
            if (!confirm('Are you sure you want to delete this node?')) return;
            
            try {
                const response = await fetch(`${basePath}/api/settings/nodes.php`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const result = await response.json();
                
                if (result.success) {
                    loadNodes();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error deleting node: ' + error.message);
            }
        }

        // --- Printers Management ---
        async function loadPrinters() {
            const tbody = document.querySelector('#printersTable tbody');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
            
            try {
                const response = await fetch(`${basePath}/api/settings/printers.php`);
                const data = await response.json();
                
                if (data.success && data.printers.length > 0) {
                    tbody.innerHTML = data.printers.map(printer => {
                        // Escape printer data for safe JSON embedding
                        const printerData = JSON.stringify(printer).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
                        return `
                        <tr>
                            <td>${printer.name}</td>
                            <td>${printer.ae_title}</td>
                            <td>${printer.host_name}</td>
                            <td>${printer.port}</td>
                            <td>${printer.is_active == 1 ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
                            <td>
                                <button type="button" class="btn btn-sm btn-outline-primary btn-action" onclick="event.preventDefault(); event.stopPropagation(); editPrinter(JSON.parse(this.dataset.printer));" data-printer="${printerData}">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-danger btn-action" onclick="event.preventDefault(); event.stopPropagation(); deletePrinter(${printer.id});">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                    }).join('');
                } else {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No printers configured</td></tr>';
                }
            } catch (error) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading printers</td></tr>';
            }
        }

        function openPrinterModal() {
            document.getElementById('printerForm').reset();
            document.getElementById('printerId').value = '';
            printerModal.show();
        }

        function editPrinter(printer) {
            // Prevent any default behavior
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            // Reset form first
            document.getElementById('printerForm').reset();
            
            // Set values
            document.getElementById('printerId').value = printer.id;
            document.getElementById('printerName').value = printer.name;
            document.getElementById('printerAET').value = printer.ae_title;
            document.getElementById('printerHost').value = printer.host_name;
            document.getElementById('printerPort').value = printer.port;
            document.getElementById('printerDesc').value = printer.description || '';
            document.getElementById('printerActive').checked = printer.is_active == 1;
            
            // Show modal
            printerModal.show();
            return false;
        }

        async function savePrinter() {
            const data = {
                id: document.getElementById('printerId').value,
                name: document.getElementById('printerName').value,
                ae_title: document.getElementById('printerAET').value,
                host_name: document.getElementById('printerHost').value,
                port: document.getElementById('printerPort').value,
                description: document.getElementById('printerDesc').value,
                is_active: document.getElementById('printerActive').checked
            };

            try {
                const response = await fetch(`${basePath}/api/settings/printers.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                
                if (result.success) {
                    printerModal.hide();
                    loadPrinters();
                    showSuccess('Printer saved successfully');
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error saving printer: ' + error.message);
            }
        }

        async function deletePrinter(id) {
            if (!confirm('Are you sure you want to delete this printer?')) return;

            try {
                const response = await fetch(`${basePath}/api/settings/printers.php`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                const result = await response.json();

                if (result.success) {
                    loadPrinters();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error deleting printer: ' + error.message);
            }
        }

        async function detectSystemPrinters() {
            const btn = event.target.closest('button');
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Detecting...';

            try {
                const response = await fetch(`${basePath}/api/settings/detect-printers.php`);
                const result = await response.json();

                if (result.success) {
                    if (result.printers && result.printers.length > 0) {
                        // Show modal with detected printers
                        showDetectedPrintersModal(result.printers);
                    } else {
                        alert(result.message || 'No printers detected on this system.');
                    }
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error detecting printers: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        }

        function showDetectedPrintersModal(printers) {
            const modalHTML = `
                <div class="modal fade" id="detectedPrintersModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content bg-dark text-light">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="bi bi-printer me-2"></i>
                                    Detected System Printers
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p class="text-muted mb-3">Found ${printers.length} printer(s). Select printers to add to DICOM configuration:</p>
                                <div class="table-responsive">
                                    <table class="table table-dark table-hover">
                                        <thead>
                                            <tr>
                                                <th width="50"><input type="checkbox" id="selectAllPrinters" onchange="toggleAllPrinters(this)"></th>
                                                <th>Printer Name</th>
                                                <th>Driver</th>
                                                <th>Port</th>
                                                <th>Type</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${printers.map((printer, index) => `
                                                <tr>
                                                    <td><input type="checkbox" class="printer-checkbox" data-index="${index}"></td>
                                                    <td><strong>${printer.name}</strong></td>
                                                    <td><small class="text-muted">${printer.driver}</small></td>
                                                    <td><small class="text-muted">${printer.port}</small></td>
                                                    <td><span class="badge bg-info">${printer.type}</span></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                                <div class="alert alert-info mt-3">
                                    <i class="bi bi-info-circle"></i>
                                    <strong>Note:</strong> These are regular system printers. You'll need to configure DICOM settings (AE Title, Host, Port) for each printer after adding.
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" onclick="addSelectedPrinters()">
                                    <i class="bi bi-plus-circle"></i> Add Selected Printers
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.getElementById('detectedPrintersModal');
            if (existingModal) {
                existingModal.remove();
            }

            // Add modal to page
            document.body.insertAdjacentHTML('beforeend', modalHTML);

            // Store printers data globally for later use
            window.detectedPrinters = printers;

            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('detectedPrintersModal'));
            modal.show();
        }

        function toggleAllPrinters(checkbox) {
            const checkboxes = document.querySelectorAll('.printer-checkbox');
            checkboxes.forEach(cb => cb.checked = checkbox.checked);
        }

        async function addSelectedPrinters() {
            const checkboxes = document.querySelectorAll('.printer-checkbox:checked');

            if (checkboxes.length === 0) {
                alert('Please select at least one printer');
                return;
            }

            const selectedPrinters = [];
            checkboxes.forEach(cb => {
                const index = parseInt(cb.dataset.index);
                const printer = window.detectedPrinters[index];
                selectedPrinters.push(printer);
            });

            let successCount = 0;
            let errorCount = 0;

            for (const printer of selectedPrinters) {
                try {
                    const data = {
                        name: printer.name,
                        ae_title: printer.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 16).toUpperCase(),
                        host_name: 'localhost', // Default, user can edit later
                        port: 11112, // Default DICOM print port
                        description: `Detected: ${printer.driver} on ${printer.port}`,
                        is_active: true
                    };

                    const response = await fetch(`${basePath}/api/settings/printers.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    const result = await response.json();

                    if (result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                        console.error('Failed to add printer:', printer.name, result.error);
                    }
                } catch (error) {
                    errorCount++;
                    console.error('Error adding printer:', printer.name, error);
                }
            }

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('detectedPrintersModal'));
            modal.hide();

            // Reload printers list
            loadPrinters();

            // Show result
            if (successCount > 0) {
                showSuccess(`Successfully added ${successCount} printer(s)${errorCount > 0 ? `. Failed: ${errorCount}` : ''}`);
            } else {
                alert('Failed to add any printers. Please try again or add manually.');
            }
        }

        // --- Print Settings Management ---
        async function loadPrintSettings() {
            try {
                const response = await fetch(`${basePath}/api/settings/print-settings.php`);
                const data = await response.json();

                if (data.success && data.settings) {
                    const settings = data.settings;

                    // Populate checkboxes
                    document.getElementById('printIncludePatientInfo').checked = settings.includePatientInfo !== false;
                    document.getElementById('printIncludeStudyInfo').checked = settings.includeStudyInfo !== false;
                    document.getElementById('printIncludeInstitutionInfo').checked = settings.includeInstitutionInfo !== false;
                    document.getElementById('printIncludeAnnotations').checked = settings.includeAnnotations !== false;
                    document.getElementById('printIncludeWindowLevel').checked = settings.includeWindowLevel !== false;
                    document.getElementById('printIncludeMeasurements').checked = settings.includeMeasurements !== false;
                    document.getElementById('printIncludeTimestamp').checked = settings.includeTimestamp !== false;

                    // Populate selects
                    document.getElementById('printPaperSize').value = settings.paperSize || 'A4';
                    document.getElementById('printOrientation').value = settings.orientation || 'landscape';
                    document.getElementById('printMargins').value = settings.margins || 'normal';
                    document.getElementById('printQuality').value = settings.quality || 'high';
                    document.getElementById('printColorMode').value = settings.colorMode || 'grayscale';
                }
            } catch (error) {
                console.error('Error loading print settings:', error);
            }
        }

        async function savePrintSettings() {
            const settings = {
                includePatientInfo: document.getElementById('printIncludePatientInfo').checked,
                includeStudyInfo: document.getElementById('printIncludeStudyInfo').checked,
                includeInstitutionInfo: document.getElementById('printIncludeInstitutionInfo').checked,
                includeAnnotations: document.getElementById('printIncludeAnnotations').checked,
                includeWindowLevel: document.getElementById('printIncludeWindowLevel').checked,
                includeMeasurements: document.getElementById('printIncludeMeasurements').checked,
                includeTimestamp: document.getElementById('printIncludeTimestamp').checked,
                paperSize: document.getElementById('printPaperSize').value,
                orientation: document.getElementById('printOrientation').value,
                margins: document.getElementById('printMargins').value,
                quality: document.getElementById('printQuality').value,
                colorMode: document.getElementById('printColorMode').value
            };

            try {
                const btn = document.getElementById('savePrintSettingsBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Saving...';

                const response = await fetch(`${basePath}/api/settings/print-settings.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings)
                });

                const data = await response.json();

                if (data.success) {
                    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Saved!';
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-success', 'border-success');

                    setTimeout(() => {
                        btn.innerHTML = '<i class="bi bi-check-circle"></i> Save Print Settings';
                        btn.classList.remove('border-success');
                        btn.disabled = false;
                    }, 2000);

                    showSuccess('Print settings saved successfully!');
                } else {
                    throw new Error(data.error || 'Failed to save settings');
                }
            } catch (error) {
                alert('Error saving print settings: ' + error.message);
                const btn = document.getElementById('savePrintSettingsBtn');
                btn.innerHTML = '<i class="bi bi-x-circle"></i> Save Failed';
                btn.disabled = false;

                setTimeout(() => {
                    btn.innerHTML = '<i class="bi bi-check-circle"></i> Save Print Settings';
                }, 2000);
            }
        }

        function setupEventListeners() {
            document.getElementById('saveAllBtn').addEventListener('click', saveAllSettings);
            document.getElementById('testOrthancBtn').addEventListener('click', testOrthancConnection);
            document.getElementById('saveOrthancConfigBtn').addEventListener('click', saveOrthancConfiguration);
            document.getElementById('savePrintSettingsBtn').addEventListener('click', savePrintSettings);

            // Logo upload handler
            document.getElementById('hospitalLogoInput').addEventListener('change', handleLogoUpload);
        }
        
        // Hospital Logo Functions
        async function handleLogoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            // Validate file type
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                alert('Please select a valid image file (JPG or PNG)');
                return;
            }
            
            // Validate file size (2MB max)
            if (file.size > 2 * 1024 * 1024) {
                alert('File size must be less than 2MB');
                return;
            }
            
            // Show preview immediately
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('logoPreview').src = e.target.result;
                document.getElementById('logoPreview').style.display = 'block';
                document.getElementById('noLogoText').style.display = 'none';
                document.getElementById('removeLogoBtn').style.display = 'inline-block';
            };
            reader.readAsDataURL(file);
            
            // Upload to server
            const formData = new FormData();
            formData.append('logo', file);
            
            try {
                const response = await fetch(`${basePath}/api/settings/upload-logo.php`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showSuccess('Logo uploaded successfully!');
                } else {
                    alert('Error uploading logo: ' + result.error);
                }
            } catch (error) {
                alert('Error uploading logo: ' + error.message);
            }
        }
        
        async function removeLogo() {
            if (!confirm('Are you sure you want to remove the hospital logo?')) return;
            
            try {
                const response = await fetch(`${basePath}/api/settings/upload-logo.php`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('logoPreview').style.display = 'none';
                    document.getElementById('logoPreview').src = '';
                    document.getElementById('noLogoText').style.display = 'block';
                    document.getElementById('removeLogoBtn').style.display = 'none';
                    document.getElementById('hospitalLogoInput').value = '';
                    showSuccess('Logo removed successfully!');
                } else {
                    alert('Error removing logo: ' + result.error);
                }
            } catch (error) {
                alert('Error removing logo: ' + error.message);
            }
        }
        
        async function loadCurrentLogo() {
            try {
                const response = await fetch(`${basePath}/api/settings/upload-logo.php`);
                const result = await response.json();
                
                if (result.success && result.logo_path) {
                    // Build full path including basePath
                    const logoPreview = document.getElementById('logoPreview');
                    const fullLogoPath = `${basePath}/${result.logo_path}`;
                    
                    // Add cache buster to prevent caching issues
                    logoPreview.src = fullLogoPath + '?t=' + Date.now();
                    
                    // Wait for image to load before showing
                    logoPreview.onload = function() {
                        logoPreview.style.display = 'block';
                        document.getElementById('noLogoText').style.display = 'none';
                        document.getElementById('removeLogoBtn').style.display = 'inline-block';
                    };
                    
                    // Handle load error
                    logoPreview.onerror = function() {
                        console.error('Failed to load logo from:', fullLogoPath);
                        logoPreview.style.display = 'none';
                        document.getElementById('noLogoText').style.display = 'block';
                        document.getElementById('removeLogoBtn').style.display = 'none';
                    };
                }
            } catch (error) {
                console.error('Error loading logo:', error);
            }
        }

        function showSuccess(message) {
            const indicator = document.getElementById('saveIndicator');
            indicator.textContent = message;
            indicator.style.display = 'block';
            setTimeout(() => { indicator.style.display = 'none'; }, 3000);
        }

        // Test Orthanc connection
        async function testOrthancConnection() {
            const btn = document.getElementById('testOrthancBtn');
            const resultDiv = document.getElementById('connectionResult');
            
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Testing...';
            
            const orthancUrl = document.querySelector('[name="orthanc_url"]').value;
            const orthancUser = document.querySelector('[name="orthanc_username"]').value;
            const orthancPass = document.querySelector('[name="orthanc_password"]').value;
            
            try {
                const response = await fetch(`${basePath}/api/settings/test-connection.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        orthanc_url: orthancUrl,
                        orthanc_username: orthancUser,
                        orthanc_password: orthancPass
                    })
                });
                
                const data = await response.json();
                
                resultDiv.style.display = 'block';
                
                if (data.success) {
                    // Support both old and new response formats
                    const orthancInfo = data.orthanc_info || {};
                    const version = orthancInfo.version || data.version || 'Unknown';
                    const aet = orthancInfo.dicom_aet || orthancInfo.name || data.name || 'ORTHANC';
                    const port = orthancInfo.dicom_port || 4242;
                    
                    resultDiv.className = 'alert alert-success';
                    resultDiv.innerHTML = `
                        <i class="bi bi-check-circle-fill"></i> Connection successful!<br>
                        <small>
                            <strong>Orthanc ${version}</strong><br>
                            AE Title: ${aet} | Port: ${port}
                        </small>
                    `;
                } else {
                    resultDiv.className = 'alert alert-danger';
                    resultDiv.innerHTML = `
                        <i class="bi bi-x-circle-fill"></i> Connection failed<br>
                        <small>${data.error}</small>
                    `;
                }
            } catch (error) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'alert alert-danger';
                resultDiv.innerHTML = `
                    <i class="bi bi-x-circle-fill"></i> Error: ${error.message}
                `;
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-check-circle"></i> Test Connection';
            }
        }

        // Save and Apply Orthanc Configuration
        async function saveOrthancConfiguration() {
            const btn = document.getElementById('saveOrthancConfigBtn');
            const resultDiv = document.getElementById('connectionResult');
            
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
            
            // Collect all Orthanc settings
            const settings = {
                orthanc_url: document.querySelector('[name="orthanc_url"]').value,
                orthanc_username: document.querySelector('[name="orthanc_username"]').value,
                orthanc_password: document.querySelector('[name="orthanc_password"]').value,
                orthanc_dicom_aet: document.querySelector('[name="orthanc_dicom_aet"]').value || 'ORTHANC',
                dicom_aet: document.querySelector('[name="orthanc_dicom_aet"]').value || 'ORTHANC',
                dicom_port: parseInt(document.querySelector('[name="orthanc_dicom_port"]').value) || 4242,
                http_port: parseInt(document.querySelector('[name="orthanc_http_port"]').value) || 8042
            };
            
            try {
                const response = await fetch(`${basePath}/api/settings/update-orthanc-config.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings)
                });
                
                const data = await response.json();
                
                resultDiv.style.display = 'block';
                
                if (data.success) {
                    resultDiv.className = 'alert alert-success';
                    
                    let message = '<i class="bi bi-check-circle-fill"></i> <strong>Configuration saved successfully!</strong><br><small>';
                    
                    if (data.database_saved) {
                        message += '✓ Settings saved to database<br>';
                    }
                    
                    if (data.config_updated) {
                        message += `✓ Orthanc config file updated: ${data.config_path}<br>`;
                        if (data.restart_required) {
                            message += '<span class="text-warning">⚠️ Restart Orthanc service to apply changes</span><br>';
                        }
                    } else if (data.warning) {
                        message += `<span class="text-warning">⚠️ ${data.warning}</span><br>`;
                        if (data.suggestion) {
                            message += `💡 ${data.suggestion}<br>`;
                        }
                    }
                    
                    message += '</small>';
                    resultDiv.innerHTML = message;
                    
                    // Show generated config if file wasn't updated
                    if (data.generated_config && !data.config_updated) {
                        console.log('Generated Orthanc Configuration:', data.generated_config);
                        resultDiv.innerHTML += `<details class="mt-2"><summary>Show generated configuration</summary><pre class="mt-2 p-2 bg-dark text-light">${JSON.stringify(data.generated_config, null, 2)}</pre></details>`;
                    }
                } else {
                    resultDiv.className = 'alert alert-danger';
                    resultDiv.innerHTML = `
                        <i class="bi bi-x-circle-fill"></i> Error: ${data.error}
                    `;
                }
            } catch (error) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'alert alert-danger';
                resultDiv.innerHTML = `
                    <i class="bi bi-x-circle-fill"></i> Error: ${error.message}
                `;
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-save"></i> Save & Apply Configuration';
            }
        }
    </script>
</body>
</html>
