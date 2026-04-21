<?php
/**
 * Patient Studies Page
 * Shows all studies for a specific patient
 */
define('DICOM_VIEWER', true);
require_once __DIR__ . '/auth/session.php';
requireLogin();

// Get patient ID
$patientOrthancId = $_GET['patient_id'] ?? '';
if (!$patientOrthancId) {
    header('Location: ' . BASE_PATH . '/patients.php');
    exit;
}

// Get database connection
$mysqli = getDbConnection();

// Get patient info
$stmt = $mysqli->prepare("SELECT * FROM cached_patients WHERE orthanc_id = ?");
$stmt->bind_param("s", $patientOrthancId);
$stmt->execute();
$patient = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$patient) {
    header('Location: ' . BASE_PATH . '/patients.php');
    exit;
}

// Sync studies from Orthanc
try {
    $ch = curl_init(ORTHANC_URL . '/patients/' . $patientOrthancId . '/studies');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
    curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $studyIds = json_decode($response, true);

        foreach ($studyIds as $studyId) {
            // Get study details
            $ch = curl_init(ORTHANC_URL . '/studies/' . $studyId);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
            curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
            $studyData = json_decode(curl_exec($ch), true);
            curl_close($ch);

            if ($studyData) {
                $studyInstanceUID = $studyData['MainDicomTags']['StudyInstanceUID'] ?? '';
                $studyDescription = $studyData['MainDicomTags']['StudyDescription'] ?? 'No Description';
                $studyDate = $studyData['MainDicomTags']['StudyDate'] ?? date('Ymd');
                $studyTime = $studyData['MainDicomTags']['StudyTime'] ?? '';
                $accessionNumber = $studyData['MainDicomTags']['AccessionNumber'] ?? '';

                // Get modalities from series
                $modalities = [];
                if (isset($studyData['Series'])) {
                    foreach ($studyData['Series'] as $seriesId) {
                        $ch = curl_init(ORTHANC_URL . '/series/' . $seriesId);
                        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                        curl_setopt($ch, CURLOPT_USERPWD, ORTHANC_USER . ':' . ORTHANC_PASS);
                        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
                        $seriesData = json_decode(curl_exec($ch), true);
                        curl_close($ch);

                        if (isset($seriesData['MainDicomTags']['Modality'])) {
                            $modalities[] = $seriesData['MainDicomTags']['Modality'];
                        }
                    }
                }
                $modalitiesStr = implode(',', array_unique($modalities));

                // Insert or update study
                $stmt = $mysqli->prepare("
                    INSERT INTO cached_studies (
                        orthanc_id, study_instance_uid, patient_id,
                        study_description, study_date, study_time,
                        accession_number, modalities, last_sync
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        study_description = VALUES(study_description),
                        study_date = VALUES(study_date),
                        study_time = VALUES(study_time),
                        accession_number = VALUES(accession_number),
                        modalities = VALUES(modalities),
                        last_sync = NOW()
                ");
                $stmt->bind_param(
                    "ssssssss",
                    $studyId,
                    $studyInstanceUID,
                    $patient['patient_id'],
                    $studyDescription,
                    $studyDate,
                    $studyTime,
                    $accessionNumber,
                    $modalitiesStr
                );
                $stmt->execute();
                $stmt->close();
            }
        }
    }
} catch (Exception $e) {
    // Continue even if sync fails
}

// Get all studies for this patient
$stmt = $mysqli->prepare("
    SELECT * FROM cached_studies
    WHERE patient_id = ?
    ORDER BY study_date DESC, study_time DESC
");
$stmt->bind_param("s", $patient['patient_id']);
$stmt->execute();
$studies = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Patient Studies - DICOM Viewer</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body {
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            min-height: 100vh;
        }
        .navbar-custom {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .patient-info-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .study-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 15px;
            transition: all 0.3s;
            cursor: pointer;
        }
        .study-card:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: #0d6efd;
            transform: translateX(5px);
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-custom mb-4">
        <div class="container-fluid">
            <a class="navbar-brand text-white" href="<?= BASE_PATH ?>/patients.php">
                <i class="bi bi-arrow-left me-2"></i>
                Back to Patients
            </a>
            <div class="d-flex align-items-center">
                <a href="<?= BASE_PATH ?>/logout.php" class="btn btn-outline-danger btn-sm">
                    <i class="bi bi-box-arrow-right"></i> Logout
                </a>
            </div>
        </div>
    </nav>

    <div class="container">
        <!-- Patient Info -->
        <div class="patient-info-card">
            <h3 class="text-white mb-3">
                <i class="bi bi-person-badge text-primary me-2"></i>
                <?= htmlspecialchars($patient['patient_name']) ?>
            </h3>
            <div class="row">
                <div class="col-md-3">
                    <strong class="text-light">Patient ID:</strong>
                    <div class="text-muted"><?= htmlspecialchars($patient['patient_id']) ?></div>
                </div>
                <?php if ($patient['birth_date']): ?>
                <div class="col-md-3">
                    <strong class="text-light">Date of Birth:</strong>
                    <div class="text-muted"><?= htmlspecialchars($patient['birth_date']) ?></div>
                </div>
                <?php endif; ?>
                <?php if ($patient['sex']): ?>
                <div class="col-md-3">
                    <strong class="text-light">Gender:</strong>
                    <div class="text-muted">
                        <?= $patient['sex'] === 'M' ? 'Male' : ($patient['sex'] === 'F' ? 'Female' : 'Other') ?>
                    </div>
                </div>
                <?php endif; ?>
                <div class="col-md-3">
                    <strong class="text-light">Total Studies:</strong>
                    <div class="text-info"><?= count($studies) ?></div>
                </div>
            </div>
        </div>

        <!-- Studies List -->
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="text-white">
                <i class="bi bi-file-medical text-primary me-2"></i>
                Studies
            </h4>
            <button class="btn btn-primary btn-sm" onclick="window.location.reload()">
                <i class="bi bi-arrow-clockwise"></i> Refresh
            </button>
        </div>

        <?php if (empty($studies)): ?>
            <div class="alert alert-info text-center">
                <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                <h5>No studies found for this patient</h5>
                <p>Send DICOM studies from your imaging equipment</p>
            </div>
        <?php else: ?>
            <!-- Studies Table -->
            <div class="table-responsive">
                <table class="table table-dark table-hover table-striped">
                    <thead>
                        <tr>
                            <th>Study Description</th>
                            <th>Study Date</th>
                            <th>Accession #</th>
                            <th>Modalities</th>
                            <th class="text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($studies as $study): ?>
                            <tr>
                                <td>
                                    <strong><?= htmlspecialchars($study['study_description']) ?></strong>
                                </td>
                                <td>
                                    <?= date('Y-m-d', strtotime($study['study_date'])) ?>
                                    <?php if ($study['study_time']): ?>
                                        <br><small class="text-muted"><?= substr($study['study_time'], 0, 2) . ':' . substr($study['study_time'], 2, 2) ?></small>
                                    <?php endif; ?>
                                </td>
                                <td><?= htmlspecialchars($study['accession_number'] ?: '-') ?></td>
                                <td>
                                    <?php if ($study['modalities']): ?>
                                        <?php foreach (explode(',', $study['modalities']) as $modality): ?>
                                            <span class="badge bg-info me-1"><?= htmlspecialchars($modality) ?></span>
                                        <?php endforeach; ?>
                                    <?php else: ?>
                                        <span class="text-muted">-</span>
                                    <?php endif; ?>
                                </td>
                                <td class="text-center">
                                    <div class="btn-group" role="group">
                                        <button type="button"
                                                class="btn btn-sm btn-primary"
                                                onclick="viewStudy('<?= $study['orthanc_id'] ?>')"
                                                title="View Images">
                                            <i class="bi bi-eye"></i> View
                                        </button>
                                        <button type="button"
                                                class="btn btn-sm btn-success"
                                                onclick="exportToJPG('<?= $study['study_instance_uid'] ?>', '<?= addslashes($study['study_description']) ?>')"
                                                title="Export all images as JPG">
                                            <i class="bi bi-download"></i> Export JPG
                                        </button>
                                        <button type="button"
                                                class="btn btn-sm btn-warning"
                                                onclick="showRemarkModal('<?= $study['study_instance_uid'] ?>', '<?= addslashes($study['study_description']) ?>')"
                                                title="Add/View Remarks">
                                            <i class="bi bi-chat-square-text"></i> Remark
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>
    </div>

    <!-- Remark Modal -->
    <div class="modal fade" id="remarkModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content bg-dark text-light">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-chat-square-text me-2"></i>
                        Study Remarks: <span id="remarkStudyName"></span>
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <!-- Add New Remark Form -->
                    <div class="mb-4">
                        <label class="form-label fw-bold">Add New Remark</label>
                        <textarea id="newRemarkText" class="form-control bg-secondary text-light" rows="3" placeholder="Enter your remark here..."></textarea>
                        <button class="btn btn-primary mt-2" onclick="saveRemark()">
                            <i class="bi bi-plus-circle me-1"></i> Add Remark
                        </button>
                    </div>

                    <!-- Existing Remarks -->
                    <div>
                        <label class="form-label fw-bold">Previous Remarks</label>
                        <div id="remarksList">
                            <div class="text-center text-muted py-3">
                                <i class="bi bi-hourglass-split"></i> Loading remarks...
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        let currentStudyUID = null;
        const remarkModal = new bootstrap.Modal(document.getElementById('remarkModal'));

        function viewStudy(orthancId) {
            window.location.href = '<?= BASE_PATH ?>/index.php?study_id=' + encodeURIComponent(orthancId);
        }

        async function exportToJPG(studyUID, studyDescription) {
            const btn = event.target.closest('button');
            const originalHTML = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting...';

            try {
                const response = await fetch(`<?= BASE_PATH ?>/api/studies/export-images.php?study_uid=${encodeURIComponent(studyUID)}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to export images');
                }

                // Create a blob from the response
                const blob = await response.blob();

                // Create a download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;

                // Get filename from Content-Disposition header or use default
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `Study_${studyDescription.replace(/[^a-zA-Z0-9]/g, '_')}_images.zip`;
                if (contentDisposition) {
                    const matches = /filename="(.+)"/.exec(contentDisposition);
                    if (matches) filename = matches[1];
                }

                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                alert('Images exported successfully!');
            } catch (error) {
                console.error('Export error:', error);
                alert('Error exporting images: ' + error.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHTML;
            }
        }

        async function showRemarkModal(studyUID, studyDescription) {
            currentStudyUID = studyUID;
            document.getElementById('remarkStudyName').textContent = studyDescription;
            document.getElementById('newRemarkText').value = '';

            remarkModal.show();
            await loadRemarks();
        }

        async function loadRemarks() {
            const remarksList = document.getElementById('remarksList');
            remarksList.innerHTML = '<div class="text-center text-muted py-3"><i class="bi bi-hourglass-split"></i> Loading remarks...</div>';

            try {
                const response = await fetch(`<?= BASE_PATH ?>/api/studies/remarks.php?study_uid=${encodeURIComponent(currentStudyUID)}`);
                const data = await response.json();

                if (data.success) {
                    if (data.remarks.length === 0) {
                        remarksList.innerHTML = '<div class="text-center text-muted py-3"><i class="bi bi-inbox"></i> No remarks yet</div>';
                    } else {
                        remarksList.innerHTML = data.remarks.map(remark => `
                            <div class="card bg-secondary mb-2">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div class="flex-grow-1">
                                            <p class="mb-2">${escapeHtml(remark.remark)}</p>
                                            <small class="text-muted">
                                                <i class="bi bi-person"></i> ${escapeHtml(remark.created_by_name || 'Unknown')}
                                                (${escapeHtml(remark.created_by_role || 'N/A')})
                                                <i class="bi bi-clock ms-2"></i> ${new Date(remark.created_at).toLocaleString()}
                                                ${remark.created_at !== remark.updated_at ? '<i class="bi bi-pencil ms-2"></i> Updated: ' + new Date(remark.updated_at).toLocaleString() : ''}
                                            </small>
                                        </div>
                                        <button class="btn btn-sm btn-danger ms-2" onclick="deleteRemark(${remark.id})" title="Delete">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
            } catch (error) {
                console.error('Error loading remarks:', error);
                remarksList.innerHTML = '<div class="alert alert-danger">Failed to load remarks</div>';
            }
        }

        async function saveRemark() {
            const remarkText = document.getElementById('newRemarkText').value.trim();

            if (!remarkText) {
                alert('Please enter a remark');
                return;
            }

            try {
                const response = await fetch('<?= BASE_PATH ?>/api/studies/remarks.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        study_uid: currentStudyUID,
                        remark: remarkText
                    })
                });

                const data = await response.json();

                if (data.success) {
                    document.getElementById('newRemarkText').value = '';
                    await loadRemarks();
                    alert('Remark added successfully!');
                } else {
                    throw new Error(data.error || 'Failed to save remark');
                }
            } catch (error) {
                console.error('Error saving remark:', error);
                alert('Error saving remark: ' + error.message);
            }
        }

        async function deleteRemark(remarkId) {
            if (!confirm('Are you sure you want to delete this remark?')) {
                return;
            }

            try {
                const response = await fetch(`<?= BASE_PATH ?>/api/studies/remarks.php?id=${remarkId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    await loadRemarks();
                    alert('Remark deleted successfully!');
                } else {
                    throw new Error(data.error || 'Failed to delete remark');
                }
            } catch (error) {
                console.error('Error deleting remark:', error);
                alert('Error deleting remark: ' + error.message);
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>