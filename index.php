<?php
// Start session and check authentication
define('DICOM_VIEWER', true);
require_once __DIR__ . '/auth/session.php';

// Redirect to login if not authenticated
requireLogin();

// Redirect to dashboard if no study selected (optional, but good UX)
if (empty($_GET['study_id']) && empty($_GET['series_id']) && empty($_GET['studyUID']) && empty($_GET['orthancId'])) {
    // Check if we are just landing here or if we want to show empty viewer
    // For now, let's redirect to dashboard to pick a study
    header('Location: dashboard.php');
    exit;
}

// BASE_PATH and BASE_URL are now defined in config.php (loaded via session.php)

// Get user info
$userName = $_SESSION['username'] ?? 'User';
$userRole = $_SESSION['role'] ?? 'viewer';
?>
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="base-path" content="<?= BASE_PATH ?>">
    <meta name="base-url" content="<?= BASE_URL ?>">
    <title>Accurate Viewer</title>

    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="<?= BASE_PATH ?>/css/styles.css">
    <link rel="stylesheet" href="<?= BASE_PATH ?>/assets/css/ai-styles.css">
    <link rel="stylesheet" href="<?= BASE_PATH ?>/assets/css/medical-report-styles.css">
    <link rel="stylesheet" href="<?= BASE_PATH ?>/assets/css/drag-drop-styles.css">
    <style>
        /* Mobile-First Responsive Enhancements */
        body {
            overscroll-behavior: none;
            -webkit-overflow-scrolling: touch;
        }

        /* Hide complex controls on mobile */
        @media (max-width: 767px) {
            .navbar-brand span {
                display: none;
            }
            .navbar-brand::after {
                content: "Accurate";
                font-size: 1.1rem;
                font-weight: bold;
            }
            #uploadForm, #exportBtn, #settingsBtn {
                display: none !important;
            }
            .sidebar:last-child {
                display: none !important;
            }
            .mpr-controls {
                display: none !important;
            }
        }

        /* Mobile header optimization */
        @media (max-width: 767px) {
            header {
                height: 48px !important;
                padding: 0.25rem !important;
            }
            header .container-fluid {
                padding: 0 0.5rem;
            }
            .main-layout {
                height: calc(100vh - 48px) !important;
            }
        }

        /* Mobile sidebar - collapsible */
        @media (max-width: 767px) {
            .sidebar:first-child {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                max-height: 50vh;
                background: #1c2128;
                border-top: 2px solid #0d6efd;
                transition: transform 0.3s ease;
            }
            .sidebar:first-child.collapsed {
                transform: translateY(calc(100% - 50px));
            }
            .sidebar-toggle-btn {
                display: block;
                width: 100%;
                background: #0d6efd;
                border: none;
                color: white;
                padding: 0.75rem;
                font-weight: bold;
                text-align: center;
            }
            .series-list-container {
                max-height: calc(50vh - 100px);
            }
        }

        /* Mobile viewport */
        @media (max-width: 767px) {
            .viewport-container {
                height: calc(100vh - 48px) !important;
                grid-template-columns: 1fr !important;
                grid-template-rows: 1fr !important;
                padding: 0 !important;
                gap: 0 !important;
            }
            .viewport-container.layout-2x2,
            .viewport-container.layout-2x1 {
                grid-template-columns: 1fr !important;
                grid-template-rows: 1fr !important;
            }
        }

        /* Image Thumbnail Selector */
        .image-thumbnails {
            display: none;
            position: fixed;
            bottom: 60px;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.9);
            padding: 10px;
            z-index: 999;
            overflow-x: auto;
            white-space: nowrap;
            border-top: 2px solid #0d6efd;
        }
        .image-thumbnails.show {
            display: block;
        }
        .thumbnail-item {
            display: inline-block;
            width: 80px;
            height: 80px;
            margin: 0 5px;
            border: 2px solid #444;
            cursor: pointer;
            position: relative;
            overflow: hidden;
            background: #000;
        }
        .thumbnail-item.active {
            border-color: #0d6efd;
            box-shadow: 0 0 10px #0d6efd;
        }
        .thumbnail-item img,
        .thumbnail-item canvas {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .thumbnail-number {
            position: absolute;
            top: 2px;
            left: 2px;
            background: rgba(13,110,253,0.8);
            color: white;
            padding: 2px 6px;
            font-size: 0.7rem;
            border-radius: 3px;
        }

        /* Mobile Tools - Bottom Bar */
        @media (max-width: 767px) {
            .mobile-tools-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(28,33,40,0.95);
                backdrop-filter: blur(10px);
                display: flex;
                justify-content: space-around;
                align-items: center;
                padding: 0.5rem;
                border-top: 1px solid #0d6efd;
                z-index: 1001;
            }
            .mobile-tools-bar button {
                flex: 1;
                margin: 0 3px;
                padding: 0.5rem;
                border: none;
                background: #1c2128;
                color: white;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 0.75rem;
            }
            .mobile-tools-bar button.active {
                background: #0d6efd;
                box-shadow: 0 0 10px rgba(13,110,253,0.5);
            }
            .mobile-tools-bar button i {
                font-size: 1.2rem;
                margin-bottom: 2px;
            }
        }

        /* Fullscreen mode */
        .fullscreen-mode {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            background: #000;
        }
        .fullscreen-mode .viewport-container {
            height: 100vh !important;
        }
        .fullscreen-exit-btn {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            background: rgba(13,110,253,0.8);
            border: none;
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 1.2rem;
        }

        /* Viewport touch improvements */
        .viewport {
            touch-action: none;
            -webkit-user-select: none;
            user-select: none;
        }

        /* Loading indicator */
        .loading-progress {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10001;
            background: rgba(0,0,0,0.9);
            padding: 20px 30px;
            border-radius: 10px;
            border: 2px solid #0d6efd;
        }

        /* Desktop - keep sidebar visible */
        @media (min-width: 768px) {
            .mobile-tools-bar {
                display: none;
            }
            .image-thumbnails {
                display: none;
            }
            .sidebar-toggle-btn {
                display: none;
            }
        }
        
        /* Sidebar collapse styles (#15) - Fixed */
        .sidebar {
            position: relative;
            width: 250px;
            min-width: 250px;
            max-width: 250px;
            transition: width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease, opacity 0.3s ease;
            flex-shrink: 0;
            overflow-x: hidden;
        }
        .sidebar.sidebar-hidden {
            width: 0 !important;
            min-width: 0 !important;
            max-width: 0 !important;
            padding: 0 !important;
            overflow: hidden;
            border: none !important;
            opacity: 0;
        }
        .sidebar.sidebar-hidden > * {
            display: none !important;
        }
        
        /* Float toggle buttons - positioned on sidebar borders */
        .sidebar-toggle-float {
            position: fixed;
            z-index: 1100;
            width: 20px;
            height: 50px;
            background: #1e2530;
            border: 1px solid #3a4556;
            color: #8892a0;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
            font-size: 12px;
        }
        .sidebar-toggle-float:hover {
            background: #0d6efd;
            color: white;
            border-color: #0d6efd;
        }
        .sidebar-toggle-float i {
            transition: transform 0.3s ease;
        }
        #toggleLeftSidebar {
            top: 50%;
            transform: translateY(-50%);
            border-radius: 0 6px 6px 0;
            border-left: none;
        }
        #toggleRightSidebar {
            top: 50%;
            transform: translateY(-50%);
            border-radius: 6px 0 0 6px;
            border-right: none;
        }
        
        /* Ensure main content fills space when sidebars hidden */
        .main-layout {
            display: flex;
            transition: all 0.3s ease;
        }
        
        /* Main content should expand when sidebars are hidden */
        #main-content {
            flex: 1;
            min-width: 0;
            transition: all 0.3s ease;
        }
    </style>

    <!-- PDF Export Libraries -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

    <!-- DICOM Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/dicom-parser@1.8.21/dist/dicomParser.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cornerstone-core@2.6.1/dist/cornerstone.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cornerstone-math@0.1.10/dist/cornerstoneMath.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
    <script
        src="https://cdn.jsdelivr.net/npm/cornerstone-wado-image-loader@3.1.2/dist/cornerstoneWADOImageLoader.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cornerstone-tools@5.1.5/dist/cornerstoneTools.min.js"></script>
    <script>
        // CRITICAL FIX: Image loading for remote storage with BASE_PATH support
        window.DICOM_VIEWER = window.DICOM_VIEWER || {};
        window.DICOM_VIEWER.getImageUrl = function (image) {
            if (!image) return null;

            const basePath = '<?= BASE_PATH ?>';
            const baseUrl = '<?= BASE_URL ?>';

            if (image.isOrthancImage && image.orthancInstanceId) {
                const instanceId = image.orthancInstanceId;
                // Use direct Orthanc proxy endpoint
                return `wadouri:${basePath}/api/get_dicom_from_orthanc.php?instanceId=${instanceId}`;
            }

            if (image.instanceId) {
                return `wadouri:${basePath}/api/get_dicom_from_orthanc.php?instanceId=${image.instanceId}`;
            }

            if (image.id) {
                return `wadouri:${basePath}/api/get_dicom_from_orthanc.php?instanceId=${image.id}`;
            }

            return null;
        };
        console.log('Image URL helper loaded with BASE_PATH:', '<?= BASE_PATH ?>');
    </script>
</head>

<body>
    <div id="loadingProgress" class="loading-progress" style="display: none;">
        <div class="d-flex align-items-center">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            <span>Loading images...</span>
        </div>
    </div>

    <header class="navbar navbar-expand-lg bg-body-tertiary border-bottom" style="height: 58px;">
        <div class="container-fluid">
            <a class="navbar-brand d-flex align-items-center" href="<?= BASE_PATH ?>/">
                <i class="bi bi-heart-pulse-fill text-primary fs-4 me-2"></i>
                <span class="fw-semibold">Accurate Viewer</span>
            </a>
            
            <!-- Patient Info in Navbar -->
            <div id="navbar-patient-info" class="d-flex align-items-center gap-2 ms-3" style="display: none;">
                <span class="badge bg-dark border border-secondary d-flex align-items-center gap-1">
                    <i class="bi bi-person-fill text-primary"></i>
                    <span id="nav-patient-name">-</span>
                </span>
                <span class="badge bg-dark border border-secondary" id="nav-age-badge">
                    <i class="bi bi-calendar3 text-info me-1"></i>
                    <span id="nav-patient-age">-</span>
                </span>
                <span class="badge bg-dark border border-secondary" id="nav-sex-badge">
                    <i class="bi bi-gender-ambiguous text-warning me-1" id="nav-sex-icon"></i>
                    <span id="nav-patient-sex">-</span>
                </span>
                <span class="badge bg-dark border border-secondary">
                    <small>ID:</small> <span id="nav-patient-id">-</span>
                </span>
            </div>
            <div class="d-flex align-items-center gap-2 ms-auto">
                <form id="uploadForm" enctype="multipart/form-data" class="m-0" style="display: none;">
                    <input type="file" id="dicomFileInput" name="dicomFile" class="d-none" accept=".dcm,.dicom"
                        multiple>
                    <input type="file" id="dicomFolderInput" name="dicomFolder" class="d-none" webkitdirectory directory
                        multiple>
                </form>
                <div class="btn-group">
                    <button class="btn btn-primary" id="exportBtn"><i class="bi bi-download me-2"></i>Export</button>
                    <button class="btn btn-primary dropdown-toggle dropdown-toggle-split"
                        data-bs-toggle="dropdown"></button>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="#" id="exportImage"><i class="bi bi-file-image me-2"></i>Export as Image</a></li>
                        <li><a class="dropdown-item" href="#" id="exportPDF"><i class="bi bi-file-pdf me-2"></i>Export as PDF</a></li>
                        <li><a class="dropdown-item" href="#" id="exportDicom"><i class="bi bi-file-earmark-medical me-2"></i>Export DICOM</a></li>
                        <li><a class="dropdown-item" href="#" id="exportMPR"><i class="bi bi-grid-3x3 me-2"></i>Export MPR Views</a></li>
                        <li>
                            <hr class="dropdown-divider">
                        </li>
                        <li><a class="dropdown-item" href="#" id="createMedicalReport">
                                <i class="bi bi-file-medical me-2"></i>Create Medical Report
                            </a></li>
                        <li><a class="dropdown-item" href="#" id="exportReport"><i class="bi bi-file-text me-2"></i>Export Report</a></li>
                    </ul>
                </div>
                <button class="btn btn-info" id="medicalReportBtn" title="Medical Report"><i class="bi bi-file-medical me-1"></i>Report</button>
                <button class="btn btn-secondary" id="printBtn" title="Print DICOM Image"><i class="bi bi-printer me-1"></i>Print</button>
                <button class="btn btn-secondary" id="settingsBtn" title="Settings"><i class="bi bi-gear me-1"></i>Settings</button>
                <button class="btn btn-secondary" id="fullscreenBtn" title="Fullscreen"><i class="bi bi-arrows-fullscreen"></i></button>
            </div>
        </div>
    </header>

    <div class="main-layout">
        <aside class="sidebar bg-body-tertiary border-end" id="leftSidebar">
            <button class="sidebar-toggle-btn" onclick="document.getElementById('leftSidebar').classList.toggle('collapsed')">
                <i class="bi bi-list"></i> Series & Controls
            </button>
            <div class="sidebar-section"
                style="padding: 1rem; flex-shrink: 0; border-bottom: 1px solid var(--bs-border-color);">
                <h6 class="text-light mb-2">Series Navigation</h6>
            </div>

            <div class="series-list-container" id="series-list">
                <div class="text-center text-muted small p-4">
                    No DICOM files uploaded
                </div>
            </div>

            <div class="sidebar-section fixed-section navigation-section">
                <h6 class="text-light mb-2">Image Navigation</h6>
                <div class="d-flex align-items-center gap-2 mb-2">
                    <button class="btn btn-sm btn-secondary" id="prevImage">
                        <i class="bi bi-chevron-left"></i>
                    </button>
                    <span class="small text-muted flex-fill text-center" id="imageCounter">- / -</span>
                    <button class="btn btn-sm btn-secondary" id="nextImage">
                        <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
                <input type="range" class="form-range" id="imageSlider" min="0" max="0" value="0">
            </div>

            <div class="sidebar-section fixed-section cine-section">
                <h6 class="text-light mb-2">Cine Controls</h6>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-secondary" id="playPause">
                        <i class="bi bi-play-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" id="stopCine">
                        <i class="bi bi-stop-fill"></i>
                    </button>
                    <small class="text-muted">FPS:</small>
                    <input type="range" class="form-range flex-fill" id="fpsSlider" min="1" max="30" value="10">
                    <small class="text-muted" id="fpsDisplay">10</small>
                </div>
            </div>
        </aside>

        <main id="main-content" class="d-flex flex-column" style="background-color: #000;">
            <div class="mpr-controls">
                <div class="top-controls-bar">
                    <div class="d-flex justify-content-center align-items-center w-100" style="gap: 8px; flex-wrap: nowrap; overflow-x: auto; padding: 4px 8px;">
                        <!-- Layout buttons -->
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-secondary" data-layout="1x1" title="1x1"><i class="bi bi-app"></i></button>
                            <button type="button" class="btn btn-primary" data-layout="2x2" title="2x2"><i class="bi bi-grid-fill"></i></button>
                            <button type="button" class="btn btn-secondary" data-layout="2x1" title="2x1"><i class="bi bi-layout-split"></i></button>
                            <button type="button" class="btn btn-info" id="customGridBtn" title="Custom Grid"><i class="bi bi-grid-3x3-gap"></i></button>
                        </div>

                        <!-- MPR buttons -->
                        <div class="btn-group btn-group-sm" role="group">
                            <button type="button" class="btn btn-outline-success" id="mprAxial" title="Axial">Axial</button>
                            <button type="button" class="btn btn-outline-success" id="mprSagittal" title="Sagittal">Sagittal</button>
                            <button type="button" class="btn btn-outline-success" id="mprCoronal" title="Coronal">Coronal</button>
                            <button type="button" class="btn btn-outline-success" id="mprAll" title="All Views">All</button>
                        </div>

                        <!-- Insert/Clear buttons -->
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn btn-success" id="insertAllBtn" title="Insert All Images"><i class="bi bi-grid-fill"></i> Insert All</button>
                            <button class="btn btn-danger" id="clearAllBtn" title="Clear All Viewports"><i class="bi bi-trash"></i> Clear All</button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="viewport-container" class="viewport-container layout-2x2">
                <div class="card bg-dark text-light text-center">
                    <div class="card-body d-flex flex-column justify-content-center">
                        <h5 class="card-title text-muted">No DICOM file selected</h5>
                        <p class="card-text text-muted small">Upload and select a DICOM file to begin viewing with
                            automatic MPR reconstruction</p>
                    </div>
                </div>
            </div>
        </main>

        <aside class="sidebar bg-body-tertiary border-start" id="rightSidebar">
            <div class="p-3 border-bottom">
                <h6 class="text-light mb-2">Tools</h6>
                <div class="row row-cols-3 g-1" id="tools-panel">
                    <div class="col"><button data-tool="Pan"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-arrows-move"></i><span class="small">Pan</span></button></div>
                    <div class="col"><button data-tool="Zoom"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-zoom-in"></i><span class="small">Zoom</span></button></div>
                    <div class="col"><button data-tool="Wwwc"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-sliders"></i><span class="small">W/L</span></button></div>
                    <div class="col"><button data-tool="Length"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-rulers"></i><span class="small">Length</span></button></div>
                    <div class="col"><button data-tool="Angle"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-triangle"></i><span class="small">Angle</span></button></div>
                    <div class="col"><button data-tool="FreehandRoi"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-pencil"></i><span class="small">Draw</span></button></div>
                    <div class="col"><button data-tool="EllipticalRoi"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-circle"></i><span class="small">Circle</span></button></div>
                    <div class="col"><button data-tool="RectangleRoi"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-square"></i><span class="small">Rectangle</span></button></div>
                    <div class="col"><button data-tool="Probe"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-eyedropper"></i><span class="small">Probe</span></button></div>
                    <div class="col"><button id="resetBtn"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-arrow-counterclockwise"></i><span class="small">Reset</span></button></div>
                    <div class="col"><button id="invertBtn"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-circle-half"></i><span class="small">Invert</span></button></div>
                    <div class="col"><button id="flipHBtn"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-arrow-left-right"></i><span class="small">Flip H</span></button></div>
                    <div class="col"><button id="flipVBtn"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-arrow-down-up"></i><span class="small">Flip V</span></button></div>
                    <div class="col"><button id="rotateLeftBtn"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-arrow-counterclockwise"></i><span class="small">Rotate L</span></button></div>
                    <div class="col"><button id="rotateRightBtn"
                            class="btn btn-secondary w-100 tool-btn d-flex flex-column justify-content-center align-items-center"><i
                                class="bi bi-arrow-clockwise"></i><span class="small">Rotate R</span></button></div>
                </div>
            </div>

            <div class="sidebar-scrollable">
                <div class="p-3 border-bottom">
                    <h6 class="text-light mb-2">Window/Level Presets</h6>
                    <div class="d-grid gap-1">
                        <button class="btn btn-sm btn-outline-secondary preset-btn"
                            data-preset="default">Default</button>
                        <button class="btn btn-sm btn-outline-secondary preset-btn" data-preset="lung">Lung
                            (-600/1500)</button>
                        <button class="btn btn-sm btn-outline-secondary preset-btn" data-preset="abdomen">Abdomen
                            (50/400)</button>
                        <button class="btn btn-sm btn-outline-secondary preset-btn" data-preset="brain">Brain
                            (40/80)</button>
                        <button class="btn btn-sm btn-outline-secondary preset-btn" data-preset="bone">Bone
                            (400/1000)</button>
                    </div>

                    <div class="mt-3">
                        <label class="form-label small text-light mb-1">Window Width</label>
                        <input type="range" class="form-range" id="windowSlider" min="1" max="4000" value="400">
                        <small class="text-muted" id="windowValue">400</small>
                    </div>
                    <div class="mt-2">
                        <label class="form-label small text-light mb-1">Window Level</label>
                        <input type="range" class="form-range" id="levelSlider" min="-1000" max="1000" value="40">
                        <small class="text-muted" id="levelValue">40</small>
                    </div>
                </div>

            </div>
        </aside>
    </div>
    
    <!-- Sidebar Toggle Buttons (Fixed Position) -->
    <button class="sidebar-toggle-float" id="toggleLeftSidebar" title="Toggle left sidebar (H)">
        <i class="bi bi-chevron-left" id="leftSidebarIcon"></i>
    </button>
    <button class="sidebar-toggle-float" id="toggleRightSidebar" title="Toggle right sidebar">
        <i class="bi bi-chevron-right" id="rightSidebarIcon"></i>
    </button>

    <!-- Mobile Tools Bar -->
    <div class="mobile-tools-bar">
        <button id="mobilePanTool" data-tool="Pan">
            <i class="bi bi-arrows-move"></i>
            <span>Pan</span>
        </button>
        <button id="mobileZoomTool" data-tool="Zoom">
            <i class="bi bi-zoom-in"></i>
            <span>Zoom</span>
        </button>
        <button id="mobileWLTool" data-tool="Wwwc" class="active">
            <i class="bi bi-sliders"></i>
            <span>W/L</span>
        </button>
        <button id="mobileImagesList">
            <i class="bi bi-grid-3x3"></i>
            <span>Images</span>
        </button>
        <button id="mobileFullscreen">
            <i class="bi bi-arrows-fullscreen"></i>
            <span>Full</span>
        </button>
    </div>

    <!-- Image Thumbnails Selector -->
    <div class="image-thumbnails" id="imageThumbnails">
        <!-- Thumbnails will be populated here -->
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Load utilities first -->
    <script src="<?= BASE_PATH ?>/js/utils/constants.js"></script>
    <script src="<?= BASE_PATH ?>/js/utils/cornerstone-init.js"></script>

    <!-- Load managers -->
    <script src="<?= BASE_PATH ?>/js/managers/enhancement-manager.js"></script>
    <script src="<?= BASE_PATH ?>/js/managers/crosshair-manager.js"></script>
    <script src="<?= BASE_PATH ?>/js/managers/viewport-manager.js"></script>
    <script src="<?= BASE_PATH ?>/js/managers/mpr-manager.js"></script>
    <script src="<?= BASE_PATH ?>/js/managers/reference-lines-manager.js"></script>

    <!-- Load components -->
    <script src="<?= BASE_PATH ?>/js/components/upload-handler.js"></script>
    <script src="<?= BASE_PATH ?>/js/components/ui-controls.js"></script>
    <script src="<?= BASE_PATH ?>/js/components/event-handlers.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/reporting-system.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/mouse-controls.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/export-manager.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/print-manager-v3.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/settings-manager.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/mobile-controls.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/mpr-button-handlers.js?v=<?= time() ?>"></script>


    <script src="https://unpkg.com/dicom-parser@1.8.21/dist/dicomParser.min.js"></script>


    <!-- Load main application -->
    <script src="<?= BASE_PATH ?>/js/main.js"></script>
    <script src="<?= BASE_PATH ?>/js/viewport-badge-updater.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/orthanc-autoload.js"></script>
    <script src="<?= BASE_PATH ?>/assets/js/ai-integration.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/assets/js/medical-report-generator.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/ocr-measurement-extractor.js?v=<?= time() ?>"></script>
    <script src="<?= BASE_PATH ?>/js/components/advanced-reporting-system.js?v=<?= time() ?>"></script>

    <script>
        // Fix sidebar visibility on load
        document.addEventListener('DOMContentLoaded', function() {
            const leftSidebar = document.getElementById('leftSidebar');
            const isMobile = window.innerWidth < 768;

            if (isMobile && leftSidebar) {
                // Collapse sidebar on mobile by default
                leftSidebar.classList.add('collapsed');
            } else if (leftSidebar) {
                // Ensure sidebar is visible on desktop
                leftSidebar.classList.remove('collapsed');
            }

            // Check for report existence and show indicator
            checkReportExistence();
        });

        // Function to check if a report exists for the current study
        async function checkReportExistence() {
            const urlParams = new URLSearchParams(window.location.search);
            const studyUID = urlParams.get('studyUID');

            if (!studyUID) {
                console.log('No studyUID in URL, skipping report check');
                return;
            }

            try {
                const basePath = document.querySelector('meta[name="base-path"]')?.content || '';
                const response = await fetch(`${basePath}/api/reports/by-study.php?studyUID=${encodeURIComponent(studyUID)}`);
                const data = await response.json();

                const reportIndicator = document.getElementById('report-indicator');
                if (data.success && data.data && data.data.count > 0) {
                    // Report exists - show indicator
                    if (reportIndicator) {
                        reportIndicator.style.display = 'block';
                        const report = data.data.reports[0];
                        const statusBadge = reportIndicator.querySelector('.badge');

                        // Update badge based on status
                        if (report.status === 'final') {
                            statusBadge.className = 'badge bg-success d-flex align-items-center gap-1';
                            statusBadge.innerHTML = '<i class="bi bi-file-earmark-check-fill"></i> Report (Final)';
                        } else if (report.status === 'printed') {
                            statusBadge.className = 'badge bg-info d-flex align-items-center gap-1';
                            statusBadge.innerHTML = '<i class="bi bi-printer-fill"></i> Report (Printed)';
                        } else {
                            statusBadge.className = 'badge bg-warning d-flex align-items-center gap-1';
                            statusBadge.innerHTML = '<i class="bi bi-file-earmark-text-fill"></i> Report (Draft)';
                        }
                    }
                } else {
                    // No report - hide indicator
                    if (reportIndicator) {
                        reportIndicator.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('Error checking report existence:', error);
                // Hide indicator on error
                const reportIndicator = document.getElementById('report-indicator');
                if (reportIndicator) {
                    reportIndicator.style.display = 'none';
                }
            }
        }

        // Make checkReportExistence globally available so it can be called after report save
        window.checkReportExistence = checkReportExistence;
        
        // Sidebar toggle functionality (#15) - Fixed positioning
        initializeSidebarToggles();
        
        function initializeSidebarToggles() {
            const leftSidebar = document.getElementById('leftSidebar');
            const rightSidebar = document.getElementById('rightSidebar');
            const toggleLeft = document.getElementById('toggleLeftSidebar');
            const toggleRight = document.getElementById('toggleRightSidebar');
            const leftIcon = document.getElementById('leftSidebarIcon');
            const rightIcon = document.getElementById('rightSidebarIcon');
            
            const SIDEBAR_WIDTH = 250; // Fixed sidebar width
            
            // Load saved preferences
            const leftHidden = localStorage.getItem('leftSidebarHidden') === 'true';
            const rightHidden = localStorage.getItem('rightSidebarHidden') === 'true';
            
            // Apply saved state
            if (leftHidden && leftSidebar) {
                leftSidebar.classList.add('sidebar-hidden');
            }
            if (rightHidden && rightSidebar) {
                rightSidebar.classList.add('sidebar-hidden');
            }
            
            // Initial button positioning
            updateAllButtonPositions();
            
            function updateAllButtonPositions() {
                const leftIsHidden = leftSidebar?.classList.contains('sidebar-hidden');
                const rightIsHidden = rightSidebar?.classList.contains('sidebar-hidden');
                
                if (toggleLeft) {
                    toggleLeft.style.left = leftIsHidden ? '0px' : SIDEBAR_WIDTH + 'px';
                }
                if (leftIcon) {
                    leftIcon.style.transform = leftIsHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
                if (toggleRight) {
                    toggleRight.style.right = rightIsHidden ? '0px' : SIDEBAR_WIDTH + 'px';
                }
                if (rightIcon) {
                    rightIcon.style.transform = rightIsHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            }
            
            function resizeViewports() {
                setTimeout(() => {
                    document.querySelectorAll('.viewport').forEach(vp => {
                        try { cornerstone.resize(vp); } catch(e) {}
                    });
                }, 350);
            }
            
            // Toggle left sidebar
            if (toggleLeft && leftSidebar) {
                toggleLeft.addEventListener('click', function(e) {
                    e.stopPropagation();
                    leftSidebar.classList.toggle('sidebar-hidden');
                    const isHidden = leftSidebar.classList.contains('sidebar-hidden');
                    localStorage.setItem('leftSidebarHidden', isHidden);
                    updateAllButtonPositions();
                    resizeViewports();
                });
            }
            
            // Toggle right sidebar
            if (toggleRight && rightSidebar) {
                toggleRight.addEventListener('click', function(e) {
                    e.stopPropagation();
                    rightSidebar.classList.toggle('sidebar-hidden');
                    const isHidden = rightSidebar.classList.contains('sidebar-hidden');
                    localStorage.setItem('rightSidebarHidden', isHidden);
                    updateAllButtonPositions();
                    resizeViewports();
                });
            }
            
            // Keyboard shortcut: 'H' to toggle both sidebars
            document.addEventListener('keydown', function(e) {
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                if (e.key.toLowerCase() === 'h') {
                    e.preventDefault();
                    
                    const leftIsHidden = leftSidebar?.classList.contains('sidebar-hidden');
                    const rightIsHidden = rightSidebar?.classList.contains('sidebar-hidden');
                    
                    if (leftIsHidden && rightIsHidden) {
                        // Both hidden, show both
                        leftSidebar?.classList.remove('sidebar-hidden');
                        rightSidebar?.classList.remove('sidebar-hidden');
                        localStorage.setItem('leftSidebarHidden', 'false');
                        localStorage.setItem('rightSidebarHidden', 'false');
                    } else {
                        // Hide both
                        leftSidebar?.classList.add('sidebar-hidden');
                        rightSidebar?.classList.add('sidebar-hidden');
                        localStorage.setItem('leftSidebarHidden', 'true');
                        localStorage.setItem('rightSidebarHidden', 'true');
                    }
                    
                    updateAllButtonPositions();
                    resizeViewports();
                }
            });
        }
    </script>

    <!-- Custom Grid Selector Modal -->
    <div id="customGridModal" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Select Grid Layout</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <p class="mb-3">Select number of rows and columns:</p>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label for="gridRows" class="form-label">Rows:</label>
                            <input type="number" class="form-control" id="gridRows" min="1" max="5" value="2">
                        </div>
                        <div class="col-md-6">
                            <label for="gridCols" class="form-label">Columns:</label>
                            <input type="number" class="form-control" id="gridCols" min="1" max="5" value="2">
                        </div>
                    </div>
                    <div class="mt-3">
                        <p class="text-muted small">Maximum: 5 rows × 5 columns (25 viewports)</p>
                        <p id="gridPreview" class="fw-bold text-info">Grid: 2 × 2 (4 viewports)</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="applyCustomGrid">Apply Grid</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Custom Grid Functionality -->
    <script>
        (function() {
            const customGridBtn = document.getElementById('customGridBtn');
            const customGridModal = new bootstrap.Modal(document.getElementById('customGridModal'));
            const gridRowsInput = document.getElementById('gridRows');
            const gridColsInput = document.getElementById('gridCols');
            const gridPreview = document.getElementById('gridPreview');
            const applyCustomGridBtn = document.getElementById('applyCustomGrid');

            // Update preview when inputs change
            function updatePreview() {
                const rows = parseInt(gridRowsInput.value) || 1;
                const cols = parseInt(gridColsInput.value) || 1;
                const total = rows * cols;
                gridPreview.textContent = `Grid: ${rows} × ${cols} (${total} viewport${total > 1 ? 's' : ''})`;
            }

            gridRowsInput.addEventListener('input', updatePreview);
            gridColsInput.addEventListener('input', updatePreview);

            // Show modal when button clicked
            customGridBtn.addEventListener('click', function() {
                customGridModal.show();
            });

            // Apply custom grid
            applyCustomGridBtn.addEventListener('click', function() {
                const rows = parseInt(gridRowsInput.value) || 1;
                const cols = parseInt(gridColsInput.value) || 1;

                // Validate
                if (rows < 1 || rows > 5 || cols < 1 || cols > 5) {
                    alert('Please enter valid rows and columns (1-5)');
                    return;
                }

                const total = rows * cols;
                if (total > 25) {
                    alert('Maximum 25 viewports allowed (5×5)');
                    return;
                }

                console.log(`Creating custom grid: ${rows} rows × ${cols} columns (${total} viewports)`);

                // Close modal
                customGridModal.hide();

                // Create the custom grid layout
                createCustomGridLayout(rows, cols);
            });

            function createCustomGridLayout(rows, cols) {
                const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
                if (!viewportManager) {
                    console.error('Viewport manager not initialized');
                    return;
                }

                const layoutKey = `custom-${rows}x${cols}`;
                const total = rows * cols;

                // Generate viewport configuration
                const viewports = [];
                for (let i = 0; i < total; i++) {
                    const row = Math.floor(i / cols);
                    const col = i % cols;
                    viewports.push({
                        name: `viewport-${i + 1}`,
                        gridArea: `${row + 1} / ${col + 1} / ${row + 2} / ${col + 2}`
                    });
                }

                // Register the custom layout
                viewportManager.layouts[layoutKey] = {
                    rows: rows,
                    cols: cols,
                    viewports: viewports.map(v => v.name)
                };

                // Create viewports with custom layout
                viewportManager.createViewports(layoutKey);

                // Apply CSS Grid styling
                const container = document.getElementById('viewport-container');
                if (container) {
                    container.style.display = 'grid';
                    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
                    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                    container.style.gap = '2px';
                    container.style.width = '100%';
                    container.style.height = '100%';
                }

                console.log(`Custom grid layout created: ${layoutKey}`);
            }

            // Initialize preview
            updatePreview();
        })();
    </script>

    <!-- Insert All and Clear All Functionality -->
    <script>
        (function() {
            const insertAllBtn = document.getElementById('insertAllBtn');
            const clearAllBtn = document.getElementById('clearAllBtn');

            // Calculate optimal grid based on number of images
            function calculateOptimalGrid(imageCount) {
                if (imageCount === 0) return { rows: 1, cols: 1 };

                const isPortrait = window.innerHeight > window.innerWidth;
                const isLandscape = window.innerWidth > window.innerHeight;

                // Portrait optimized layouts (more rows than columns)
                const portraitLayouts = {
                    2: { rows: 2, cols: 1 },
                    6: { rows: 3, cols: 2 },
                    8: { rows: 4, cols: 2 },
                    15: { rows: 5, cols: 3 },
                    18: { rows: 6, cols: 3 }
                };

                // Landscape optimized layouts (more columns than rows)
                const landscapeLayouts = {
                    4: { rows: 2, cols: 2 },
                    9: { rows: 3, cols: 3 },
                    12: { rows: 3, cols: 4 }
                };

                // Check for exact matches first
                if (isPortrait && portraitLayouts[imageCount]) {
                    return portraitLayouts[imageCount];
                }
                if (isLandscape && landscapeLayouts[imageCount]) {
                    return landscapeLayouts[imageCount];
                }

                // For other numbers, calculate optimal grid
                let cols = Math.ceil(Math.sqrt(imageCount));
                let rows = Math.ceil(imageCount / cols);

                // Adjust for orientation
                if (isLandscape && rows > cols) {
                    [rows, cols] = [cols, rows]; // Swap to prefer landscape
                }
                if (isPortrait && cols > rows) {
                    [rows, cols] = [cols, rows]; // Swap to prefer portrait
                }

                // Limit to max 5x5
                if (rows > 5) rows = 5;
                if (cols > 5) cols = 5;

                return { rows, cols };
            }

            // Insert All Images
            insertAllBtn.addEventListener('click', async function() {
                console.log('Insert All clicked');

                // Get images from STATE (has correct database IDs)
                const images = window.DICOM_VIEWER.STATE.currentSeriesImages;
                if (!images || images.length === 0) {
                    alert('No images available. Please load a study first.');
                    return;
                }

                const imageCount = images.length;
                console.log(`Found ${imageCount} images in STATE`);

                // Calculate optimal grid
                const grid = calculateOptimalGrid(imageCount);
                console.log(`Calculated optimal grid: ${grid.rows}×${grid.cols} for ${imageCount} images`);

                // Create custom grid layout
                const layoutKey = `custom-${grid.rows}x${grid.cols}`;
                const total = grid.rows * grid.cols;

                const viewportManager = window.DICOM_VIEWER.MANAGERS.viewportManager;
                if (!viewportManager) {
                    console.error('Viewport manager not initialized');
                    return;
                }

                // Generate viewport configuration
                const viewports = [];
                for (let i = 0; i < total; i++) {
                    viewports.push(`viewport-${i + 1}`);
                }

                // Register the custom layout
                viewportManager.layouts[layoutKey] = {
                    rows: grid.rows,
                    cols: grid.cols,
                    viewports: viewports
                };

                // Create viewports
                viewportManager.createViewports(layoutKey);

                // Apply CSS Grid styling
                const container = document.getElementById('viewport-container');
                if (container) {
                    container.style.display = 'grid';
                    container.style.gridTemplateRows = `repeat(${grid.rows}, 1fr)`;
                    container.style.gridTemplateColumns = `repeat(${grid.cols}, 1fr)`;
                    container.style.gap = '2px';
                    container.style.width = '100%';
                    container.style.height = '100%';
                }

                // Wait for viewports to be created, then load images
                setTimeout(async () => {
                    const viewportElements = document.querySelectorAll('.viewport');
                    console.log(`Created ${viewportElements.length} viewports`);

                    if (viewportElements.length === 0) {
                        console.error('No viewports found after creation');
                        return;
                    }

                    // Enable cornerstone on all viewports first
                    viewportElements.forEach(viewport => {
                        try {
                            if (!cornerstone.getEnabledElement(viewport)) {
                                cornerstone.enable(viewport);
                                console.log(`Enabled cornerstone on ${viewport.id}`);
                            }
                        } catch (e) {
                            console.warn(`Viewport ${viewport.id} already enabled or error:`, e);
                        }
                    });

                    // Wait a bit for cornerstone to initialize
                    await new Promise(resolve => setTimeout(resolve, 200));

                    // Load images into viewports using correct database IDs from STATE
                    for (let i = 0; i < Math.min(imageCount, viewportElements.length); i++) {
                        const viewport = viewportElements[i];
                        const image = images[i];

                        if (viewport && image) {
                            // Get the correct database ID from STATE
                            const fileId = image.id;

                            if (fileId) {
                                console.log(`Loading image ${i + 1}/${imageCount} (DB ID: ${fileId}) into viewport ${viewport.id}`);
                                try {
                                    await window.DICOM_VIEWER.loadImageInViewport(viewport, fileId);

                                    // Fit to window after loading
                                    try {
                                        cornerstone.fitToWindow(viewport);
                                        console.log(`Fitted image ${fileId} to viewport ${viewport.id}`);
                                    } catch (e) {
                                        console.warn('Error fitting viewport:', e);
                                    }
                                } catch (error) {
                                    console.error(`Error loading image ${fileId}:`, error);
                                }
                            }
                        }
                    }

                    console.log(`Loaded ${Math.min(imageCount, viewportElements.length)} images successfully`);
                }, 1000);
            });

            // Clear All Viewports
            clearAllBtn.addEventListener('click', function() {
                if (!confirm('Are you sure you want to clear all viewports?')) {
                    return;
                }

                console.log('Clear All clicked');

                const viewports = document.querySelectorAll('.viewport');
                viewports.forEach(viewport => {
                    try {
                        if (cornerstone.getEnabledElement(viewport)) {
                            cornerstone.disable(viewport);
                            cornerstone.enable(viewport);
                            console.log(`Cleared viewport ${viewport.id}`);
                        }
                    } catch (error) {
                        console.error(`Error clearing viewport ${viewport.id}:`, error);
                    }
                });

                console.log('All viewports cleared');
            });
        })();
    </script>
</body>

</html>
