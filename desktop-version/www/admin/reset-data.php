<?php
/**
 * System Reset Tool
 * DANGER: Clears all data
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/../includes/config.php';
require_once __DIR__ . '/../auth/session.php';

// Require login
requireLogin('../pages/login.html');

// Only admin can access
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
    <meta name="base-path" content="<?= BASE_PATH ?>">
    <title>System Reset - DICOM Viewer</title>
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
        .danger-card {
            background: rgba(220, 53, 69, 0.1);
            border: 1px solid rgba(220, 53, 69, 0.3);
            border-radius: 15px;
            padding: 30px;
            max-width: 600px;
            margin: 50px auto;
            text-align: center;
        }
        .danger-icon {
            font-size: 4rem;
            color: #dc3545;
            margin-bottom: 20px;
        }
        .form-control {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            text-align: center;
            font-size: 1.2rem;
            letter-spacing: 2px;
        }
        .form-control:focus {
            background: rgba(255, 255, 255, 0.15);
            border-color: #dc3545;
            color: #fff;
            box-shadow: 0 0 0 0.25rem rgba(220, 53, 69, 0.25);
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
                <a href="<?= BASE_PATH ?>/admin/settings.php" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-gear"></i> Settings
                </a>
                <a href="<?= BASE_PATH ?>/pages/patients.html" class="btn btn-sm btn-outline-secondary">
                    <i class="bi bi-arrow-left"></i> Back
                </a>
                <span class="text-light">
                    <i class="bi bi-person-circle"></i>
                    <?= htmlspecialchars($userName) ?> (Admin)
                </span>
            </div>
        </div>
    </nav>

    <div class="container">
        <div class="danger-card">
            <i class="bi bi-exclamation-triangle-fill danger-icon"></i>
            <h2 class="text-danger mb-3">System Reset</h2>
            <p class="lead mb-4">
                This action will <strong>permanently delete</strong> all patient data, studies, and images from both the database and the Orthanc server.
            </p>
            <p class="text-warning mb-4">
                This cannot be undone. Please be absolutely sure.
            </p>

            <div class="mb-4">
                <label class="form-label">Type <strong>DELETE_EVERYTHING</strong> to confirm:</label>
                <input type="text" class="form-control" id="confirmationInput" autocomplete="off">
            </div>

            <button class="btn btn-danger btn-lg w-100" id="resetBtn" disabled>
                <i class="bi bi-trash3-fill"></i> Reset System Data
            </button>

            <div id="statusMessage" class="mt-3" style="display:none;"></div>
        </div>
    </div>

    <script>
        const basePath = document.querySelector('meta[name="base-path"]').content;
        const input = document.getElementById('confirmationInput');
        const btn = document.getElementById('resetBtn');
        const status = document.getElementById('statusMessage');

        input.addEventListener('input', () => {
            btn.disabled = input.value !== 'DELETE_EVERYTHING';
        });

        btn.addEventListener('click', async () => {
            if (!confirm('Are you absolutely sure you want to delete all data?')) return;

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Resetting...';
            input.disabled = true;

            try {
                const response = await fetch(`${basePath}/api/system/reset-data.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ confirmation: 'DELETE_EVERYTHING' })
                });

                const data = await response.json();

                status.style.display = 'block';
                if (data.success) {
                    status.className = 'alert alert-success';
                    status.innerHTML = `
                        <strong>Success!</strong> System has been reset.<br>
                        Tables truncated: ${data.details.tables_truncated}<br>
                        Orthanc deleted: ${data.details.orthanc_deleted}
                    `;
                    setTimeout(() => {
                        window.location.href = `${basePath}/pages/patients.html`;
                    }, 3000);
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            } catch (error) {
                status.className = 'alert alert-danger';
                status.innerHTML = 'Error: ' + error.message;
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-trash3-fill"></i> Reset System Data';
                input.disabled = false;
            }
        });
    </script>
</body>
</html>
