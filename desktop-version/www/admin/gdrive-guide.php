<?php
/**
 * Google Drive Credentials Setup Guide
 * Step-by-step instructions for obtaining Google Drive API credentials
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
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Drive API Setup Guide - DICOM Viewer</title>
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
        .guide-container {
            max-width: 900px;
            margin: 0 auto;
        }
        .step-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 20px;
        }
        .step-number {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            background: #0d6efd;
            border-radius: 50%;
            font-weight: bold;
            font-size: 1.2rem;
            margin-right: 15px;
        }
        .code-block {
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 5px;
            padding: 15px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
            word-wrap: break-word;
        }
        .alert-custom {
            background: rgba(13, 110, 253, 0.1);
            border: 1px solid rgba(13, 110, 253, 0.3);
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }
        .method-tab {
            cursor: pointer;
            padding: 10px 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 5px;
            margin: 0 5px;
            transition: all 0.3s;
        }
        .method-tab.active {
            background: #0d6efd;
            border-color: #0d6efd;
        }
        .method-content {
            display: none;
        }
        .method-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-custom mb-4">
        <div class="container-fluid">
            <a class="navbar-brand text-white" href="<?= BASE_PATH ?>/admin/settings.php">
                <i class="bi bi-arrow-left me-2"></i>
                Back to Settings
            </a>
            <div class="d-flex align-items-center gap-3">
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

    <div class="container guide-container">
        <div class="text-center mb-4">
            <h1 class="text-white">
                <i class="bi bi-google text-primary me-2"></i>
                Google Drive API Setup Guide
            </h1>
            <p class="text-muted">Complete step-by-step instructions to obtain your credentials.json file</p>
        </div>

        <!-- Method Selection -->
        <div class="d-flex justify-content-center mb-4">
            <button class="method-tab active" onclick="showMethod('service-account')">
                <i class="bi bi-server"></i> Service Account (Recommended)
            </button>
            <button class="method-tab" onclick="showMethod('oauth')">
                <i class="bi bi-person-check"></i> OAuth 2.0 Client
            </button>
        </div>

        <!-- Service Account Method -->
        <div id="service-account-method" class="method-content active">
            <div class="step-card">
                <h3>
                    <span class="step-number">1</span>
                    Access Google Cloud Console
                </h3>
                <p class="mt-3">Open your web browser and navigate to:</p>
                <div class="code-block">
                    <a href="https://console.developers.google.com" target="_blank" class="text-primary">
                        https://console.developers.google.com
                    </a>
                </div>
                <p class="text-muted small">Sign in with your Google account if prompted.</p>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">2</span>
                    Create or Select a Project
                </h3>
                <ul class="mt-3">
                    <li>Click the project dropdown at the top of the page</li>
                    <li>Click "<strong>NEW PROJECT</strong>" button</li>
                    <li>Enter project name (e.g., "DICOM-Viewer-Backup")</li>
                    <li>Click "<strong>CREATE</strong>"</li>
                    <li>Wait for project creation, then click "<strong>SELECT PROJECT</strong>"</li>
                </ul>
                <div class="alert-custom">
                    <i class="bi bi-lightbulb text-warning"></i>
                    <strong>Tip:</strong> You can reuse an existing project if you prefer.
                </div>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">3</span>
                    Enable Google Drive API
                </h3>
                <ol class="mt-3">
                    <li>In the left sidebar, click "<strong>APIs & Services</strong>" → "<strong>Library</strong>"</li>
                    <li>Search for "<strong>Google Drive API</strong>"</li>
                    <li>Click on the Google Drive API result</li>
                    <li>Click the blue "<strong>ENABLE</strong>" button</li>
                    <li>Wait for the API to be enabled (usually takes a few seconds)</li>
                </ol>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">4</span>
                    Create Service Account
                </h3>
                <ol class="mt-3">
                    <li>Go to "<strong>APIs & Services</strong>" → "<strong>Credentials</strong>"</li>
                    <li>Click "<strong>CREATE CREDENTIALS</strong>" → "<strong>Service account</strong>"</li>
                    <li>Fill in the service account details:
                        <ul class="mt-2">
                            <li><strong>Service account name:</strong> dicom-backup-service</li>
                            <li><strong>Service account ID:</strong> (auto-generated)</li>
                            <li><strong>Description:</strong> Service account for DICOM viewer backups</li>
                        </ul>
                    </li>
                    <li>Click "<strong>CREATE AND CONTINUE</strong>"</li>
                    <li>For role, select "<strong>Basic</strong>" → "<strong>Editor</strong>" (or leave blank)</li>
                    <li>Click "<strong>CONTINUE</strong>", then "<strong>DONE</strong>"</li>
                </ol>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">5</span>
                    Download JSON Key File
                </h3>
                <ol class="mt-3">
                    <li>In the Credentials page, find your newly created service account</li>
                    <li>Click on the service account email (under "Service Accounts" section)</li>
                    <li>Go to the "<strong>KEYS</strong>" tab</li>
                    <li>Click "<strong>ADD KEY</strong>" → "<strong>Create new key</strong>"</li>
                    <li>Select "<strong>JSON</strong>" as the key type</li>
                    <li>Click "<strong>CREATE</strong>"</li>
                </ol>
                <div class="alert alert-success mt-3">
                    <i class="bi bi-download"></i>
                    <strong>Success!</strong> Your credentials JSON file will automatically download to your computer.
                </div>
                <div class="alert alert-warning">
                    <i class="bi bi-shield-exclamation"></i>
                    <strong>Important:</strong> Keep this file secure! It grants access to your Google Drive.
                </div>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">6</span>
                    Share Google Drive Folder (Important!)
                </h3>
                <ol class="mt-3">
                    <li>Open your <a href="https://drive.google.com" target="_blank" class="text-primary">Google Drive</a></li>
                    <li>Create a folder for backups (e.g., "DICOM_Viewer_Backups")</li>
                    <li>Right-click the folder and select "<strong>Share</strong>"</li>
                    <li>Copy the <strong>service account email</strong> from the JSON file (looks like: xxx@xxx.iam.gserviceaccount.com)</li>
                    <li>Paste it in the share dialog and give "<strong>Editor</strong>" permissions</li>
                    <li>Click "<strong>Send</strong>"</li>
                </ol>
                <div class="alert-custom">
                    <i class="bi bi-info-circle"></i>
                    This step is <strong>crucial</strong>! Without sharing the folder with the service account, backups will fail.
                </div>
            </div>
        </div>

        <!-- OAuth 2.0 Method -->
        <div id="oauth-method" class="method-content">
            <div class="step-card">
                <h3>
                    <span class="step-number">1</span>
                    Access Google Cloud Console
                </h3>
                <p class="mt-3">Navigate to:</p>
                <div class="code-block">
                    <a href="https://console.developers.google.com" target="_blank" class="text-primary">
                        https://console.developers.google.com
                    </a>
                </div>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">2</span>
                    Create Project and Enable API
                </h3>
                <p>Follow steps 2-3 from the Service Account method above.</p>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">3</span>
                    Configure OAuth Consent Screen
                </h3>
                <ol class="mt-3">
                    <li>Go to "<strong>OAuth consent screen</strong>" in the left sidebar</li>
                    <li>Select "<strong>External</strong>" user type</li>
                    <li>Click "<strong>CREATE</strong>"</li>
                    <li>Fill in required fields:
                        <ul class="mt-2">
                            <li><strong>App name:</strong> DICOM Viewer Backup</li>
                            <li><strong>User support email:</strong> Your email</li>
                            <li><strong>Developer contact:</strong> Your email</li>
                        </ul>
                    </li>
                    <li>Click "<strong>SAVE AND CONTINUE</strong>" through all steps</li>
                </ol>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">4</span>
                    Create OAuth Client ID
                </h3>
                <ol class="mt-3">
                    <li>Go to "<strong>Credentials</strong>" page</li>
                    <li>Click "<strong>CREATE CREDENTIALS</strong>" → "<strong>OAuth client ID</strong>"</li>
                    <li>Select application type: "<strong>Desktop app</strong>"</li>
                    <li>Name: DICOM Viewer Desktop</li>
                    <li>Click "<strong>CREATE</strong>"</li>
                </ol>
            </div>

            <div class="step-card">
                <h3>
                    <span class="step-number">5</span>
                    Download Credentials
                </h3>
                <ol class="mt-3">
                    <li>In the popup dialog, click "<strong>OK</strong>"</li>
                    <li>Find your OAuth 2.0 Client ID in the list</li>
                    <li>Click the <i class="bi bi-download"></i> download icon</li>
                    <li>Save the <code>client_secret_xxx.json</code> file</li>
                </ol>
                <div class="alert alert-success mt-3">
                    <i class="bi bi-download"></i>
                    This is your credentials file! Rename it to <code>credentials.json</code>
                </div>
            </div>
        </div>

        <!-- Upload Section -->
        <div class="step-card bg-primary bg-opacity-10 border-primary">
            <h3 class="text-primary">
                <i class="bi bi-cloud-upload"></i>
                Upload Your Credentials
            </h3>
            <p class="mt-3">Once you have downloaded your credentials.json file, return to the Settings page to upload it.</p>
            <a href="<?= BASE_PATH ?>/admin/settings.php#gdrive-section" class="btn btn-primary mt-2">
                <i class="bi bi-arrow-left"></i> Go to Settings Page
            </a>
        </div>

        <!-- Troubleshooting -->
        <div class="step-card">
            <h3 class="text-warning">
                <i class="bi bi-tools"></i>
                Troubleshooting
            </h3>
            <div class="mt-3">
                <h5>Issue: "Access Denied" or "Permission Denied"</h5>
                <p><strong>Solution:</strong> Make sure you shared the Google Drive folder with the service account email (Step 6 in Service Account method).</p>

                <h5 class="mt-3">Issue: "Invalid Credentials"</h5>
                <p><strong>Solution:</strong> Ensure you downloaded the JSON file correctly and it's not corrupted. Try creating a new key.</p>

                <h5 class="mt-3">Issue: "Quota Exceeded"</h5>
                <p><strong>Solution:</strong> Google Drive API has usage limits. Wait 24 hours or increase quota in Google Cloud Console.</p>

                <h5 class="mt-3">Need More Help?</h5>
                <p>Visit the <a href="https://developers.google.com/drive/api/guides/about-sdk" target="_blank" class="text-primary">official Google Drive API documentation</a></p>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function showMethod(method) {
            // Hide all methods
            document.querySelectorAll('.method-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.method-tab').forEach(el => el.classList.remove('active'));

            // Show selected method
            if (method === 'service-account') {
                document.getElementById('service-account-method').classList.add('active');
                event.target.closest('.method-tab').classList.add('active');
            } else {
                document.getElementById('oauth-method').classList.add('active');
                event.target.closest('.method-tab').classList.add('active');
            }
        }
    </script>
</body>
</html>
