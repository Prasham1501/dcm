<?php
/**
 * Dropbox API Setup Guide
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';
requireLogin();
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dropbox Setup Guide - Accurate Viewer</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body { background-color: #1a1d21; }
        .guide-container { max-width: 900px; margin: 0 auto; padding: 2rem; }
        .step-card { 
            background: linear-gradient(145deg, #2d3748 0%, #1a202c 100%);
            border: 1px solid #4a5568;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .step-number {
            background: #0061ff;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2rem;
        }
        .code-block {
            background: #1e1e1e;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Courier New', monospace;
            color: #d4d4d4;
        }
        .dropbox-blue { color: #0061ff; }
        .highlight-box {
            background: rgba(0, 97, 255, 0.1);
            border-left: 4px solid #0061ff;
            padding: 1rem;
            border-radius: 0 8px 8px 0;
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-dark bg-dark border-bottom">
        <div class="container">
            <a class="navbar-brand" href="hospital-config.php">
                <i class="bi bi-arrow-left me-2"></i>Back to Configuration
            </a>
            <span class="navbar-text">
                <i class="bi bi-dropbox dropbox-blue me-2"></i>Dropbox Integration Guide
            </span>
        </div>
    </nav>

    <div class="guide-container">
        <div class="text-center mb-5">
            <i class="bi bi-dropbox dropbox-blue" style="font-size: 4rem;"></i>
            <h1 class="mt-3">Dropbox API Setup Guide</h1>
            <p class="text-muted">Follow these steps to connect your Dropbox account for DICOM backup</p>
        </div>

        <!-- Step 1 -->
        <div class="step-card">
            <div class="d-flex align-items-start gap-3">
                <div class="step-number">1</div>
                <div class="flex-grow-1">
                    <h4>Go to Dropbox App Console</h4>
                    <p>Visit the Dropbox Developer portal to create a new app:</p>
                    <a href="https://www.dropbox.com/developers/apps" target="_blank" class="btn btn-primary">
                        <i class="bi bi-box-arrow-up-right me-2"></i>Open Dropbox App Console
                    </a>
                </div>
            </div>
        </div>

        <!-- Step 2 -->
        <div class="step-card">
            <div class="d-flex align-items-start gap-3">
                <div class="step-number">2</div>
                <div class="flex-grow-1">
                    <h4>Create a New App</h4>
                    <p>Click <strong>"Create app"</strong> and configure:</p>
                    <ul class="list-unstyled">
                        <li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i><strong>API:</strong> Choose "Scoped access"</li>
                        <li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i><strong>Type:</strong> Choose "App folder" (recommended)</li>
                        <li class="mb-2"><i class="bi bi-check-circle text-success me-2"></i><strong>Name:</strong> Enter a unique name like "DICOM-Backup"</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Step 3 -->
        <div class="step-card">
            <div class="d-flex align-items-start gap-3">
                <div class="step-number">3</div>
                <div class="flex-grow-1">
                    <h4>Configure Permissions</h4>
                    <p>In your app settings, go to <strong>"Permissions"</strong> tab and enable:</p>
                    <div class="code-block mb-3">
                        <div class="mb-2"><i class="bi bi-check text-success"></i> files.content.write</div>
                        <div class="mb-2"><i class="bi bi-check text-success"></i> files.content.read</div>
                        <div><i class="bi bi-check text-success"></i> files.metadata.read</div>
                    </div>
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        <strong>Important:</strong> Click "Submit" after changing permissions!
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 4 -->
        <div class="step-card">
            <div class="d-flex align-items-start gap-3">
                <div class="step-number">4</div>
                <div class="flex-grow-1">
                    <h4>Generate Access Token</h4>
                    <p>In <strong>"Settings"</strong> tab, scroll to "OAuth 2":</p>
                    <ol>
                        <li class="mb-2">Find "Generated access token"</li>
                        <li class="mb-2">Click <strong>"Generate"</strong></li>
                        <li class="mb-2">Copy the token (starts with <code>sl.</code>)</li>
                    </ol>
                    <div class="alert alert-danger">
                        <i class="bi bi-shield-exclamation me-2"></i>
                        <strong>Keep this token secret!</strong>
                    </div>
                </div>
            </div>
        </div>

        <!-- Step 5 -->
        <div class="step-card">
            <div class="d-flex align-items-start gap-3">
                <div class="step-number">5</div>
                <div class="flex-grow-1">
                    <h4>Add to Accurate Viewer</h4>
                    <p>Paste the access token in backup configuration:</p>
                    <ol>
                        <li>Go to Hospital Configuration</li>
                        <li>Find "Backup Accounts" section</li>
                        <li>Click "Add Backup Account"</li>
                        <li>Select "Dropbox" as provider</li>
                        <li>Paste your access token</li>
                        <li>Test the connection</li>
                    </ol>
                </div>
            </div>
        </div>

        <div class="text-center mt-4">
            <a href="hospital-config.php" class="btn btn-primary btn-lg">
                <i class="bi bi-arrow-left me-2"></i>Return to Configuration
            </a>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
