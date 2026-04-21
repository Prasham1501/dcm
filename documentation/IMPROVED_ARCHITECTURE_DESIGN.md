# Hospital DICOM Viewer Pro v2.0 - Improved Architecture Design

## Executive Summary

This document outlines the improved architecture for Hospital DICOM Viewer Pro v2.0, eliminating database synchronization pain points while **KEEPING YOUR EXISTING TECH STACK** (Vanilla JS, Cornerstone 2.x, Bootstrap, MySQLi, PHP).

### Key Improvements
1. **NO DATABASE SYNCING** - Direct DICOMweb API integration (queries Orthanc in real-time)
2. **AUTOMATED FILE SYNC** - UI to configure hospital data path, auto-syncs to localhost & GoDaddy every 2 minutes
3. **GOOGLE DRIVE BACKUPS** - Automated daily backups with 30-day retention
4. **KEEP EXISTING STACK** - Vanilla JavaScript, Cornerstone 2.x, Bootstrap 5, MySQLi, PHP (NO frameworks)
5. **XAMPP + cPanel DEPLOYMENT** - Works on XAMPP localhost + GoDaddy cPanel (100% free)
6. **Production-ready** - Folder browser UI, automated sync, backup system

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   MRI/CT IMAGING DEVICE                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ DICOM C-STORE (Port 4242)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│         ORTHANC SERVER (PC - with DICOMweb Plugin)              │
│         - WADO-RS (Retrieve)                                   │
│         - QIDO-RS (Query)                                      │
│         - Storage: C:\Orthanc\OrthancStorage\                  │
│         Port: 8042                                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ DICOMweb APIs (queries in real-time)
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│               LOCALHOST (XAMPP on PC)                           │
│  ┌────────────────────────────────────────────────┐            │
│  │ PHP API (MySQLi, Session-based Auth)           │            │
│  │ - DICOMweb Proxy (queries Orthanc)             │            │
│  │ - Medical Reports, Measurements, Notes         │            │
│  │ - Automated Sync Manager (monitors directory)  │            │
│  │ - Google Drive Backup Manager                  │            │
│  └────────────────────────────────────────────────┘            │
│  ┌────────────────────────────────────────────────┐            │
│  │ FRONTEND (Vanilla JS + Cornerstone 2.x)        │            │
│  │ - Bootstrap 5 UI                                │            │
│  │ - No build tools                                │            │
│  │ - /js/main.js, /js/managers/, /js/components/  │            │
│  └────────────────────────────────────────────────┘            │
│  MySQL Database: dicom_viewer_v2_production                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ FTP Sync (every 2 minutes)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               GODADDY cPanel (PRODUCTION)                       │
│  - Same PHP API + Frontend files                               │
│  - MySQL Database (synced)                                     │
│  - Queries same Orthanc server (via internet)                  │
│  - Doctors access: https://yourhospital.com                    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Daily Backup (2 AM)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               GOOGLE DRIVE (AUTOMATED BACKUPS)                  │
│  - Database SQL dumps                                          │
│  - All PHP/JS files                                            │
│  - 30-day retention                                            │
│  - Restore with one click                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack (KEEPING YOUR CURRENT STACK)

### Backend
- **PHP 8.2+** (existing XAMPP compatibility)
- **Database Driver**: **MySQLi** (NOT PDO - keep existing approach)
- **Database**: MySQL 8.0+ (new database: `dicom_viewer_v2_production`)
  - **NO patient/study caching** - queries directly from Orthanc via DICOMweb
  - Only stores: users, sessions, reports, measurements, notes, audit logs, sync config
- **Authentication**: **Session-based** (keep existing session.php approach, NOT JWT)
- **FTP**: Built-in PHP FTP functions for syncing to GoDaddy
- **Google Drive API**: For automated backups (production-level)

### Frontend (KEEP EXISTING STACK - NO CHANGES)
- **JavaScript**: Vanilla ES6+ (NO React, NO TypeScript)
- **UI Framework**: Bootstrap 5.3.3 (existing)
- **DICOM Libraries** (KEEP CURRENT VERSIONS):
  - **Cornerstone Core 2.x** (your current version, NOT Cornerstone3D)
  - **Cornerstone WADO Image Loader** (existing)
  - **Cornerstone Tools** (existing measurements)
  - **DICOM Parser** (existing)
  - **Cornerstone Math** (existing)
  - **Hammer.js** (existing touch support)
- **No Build Tool**: Pure JavaScript (no Webpack, no Vite)
- **File Structure**: Keep existing component pattern in `/js/`

### DICOM Server
- **Orthanc** with **DICOMweb Plugin** enabled
- **Storage**: Configurable directory path (localhost & GoDaddy)

### Deployment (PRIMARY: XAMPP + cPanel)
- **PRIMARY DEPLOYMENT**: XAMPP (localhost) + GoDaddy cPanel (production)
  - PC runs XAMPP with Orthanc
  - Automated FTP sync to GoDaddy every 2 minutes
  - Works simultaneously on both environments
  - 100% FREE (uses existing domain and hosting)
- **OPTIONAL**: Docker Compose (see appendix for beginner guide if interested)

### NEW FEATURES ADDED
1. **Hospital Existing Data Path Configuration**:
   - UI with **folder browser** to select hospital's existing DICOM data directory
   - One-time initial sync of all existing DICOM files to Orthanc
   - Continuous monitoring for new files added to the directory
   - Displays sync progress and file count in real-time

2. **Automated Directory Sync**:
   - Monitors Orthanc storage directory for new DICOM files
   - Auto-syncs to localhost XAMPP every 2 minutes
   - Auto-syncs to GoDaddy cPanel via FTP every 2 minutes
   - Configurable sync interval via UI

3. **Google Drive Automated Backup**:
   - Daily automated backups (configurable time, default 2 AM)
   - Backs up: MySQL database, PHP files, JS files, configuration
   - 30-day retention policy (auto-deletes old backups)
   - One-click restore from any backup

4. **Dual Environment**:
   - Works simultaneously on localhost (XAMPP) and production (GoDaddy)
   - No manual file copying or database syncing needed
   - Doctors can access from domain (e.g., yourhospital.com)
   - Technicians use localhost for faster local access

---

## Core Design Principles

### 1. **Zero Database Synchronization**

**Problem Eliminated**: Manual sync scripts, stale data, batch jobs

**Solution**: Query Orthanc directly via DICOMweb APIs

```javascript
// Example: Get patient list
const response = await fetch('/api/dicomweb/patients', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${jwt}` }
});
// PHP proxies to Orthanc QIDO-RS: /dicom-web/studies?PatientName=*
```

**Implementation**:
- PHP API acts as **authenticated proxy** to Orthanc DICOMweb endpoints
- Orthanc's built-in indexing handles patient/study queries
- No separate MySQL cache for patient/study data
- Real-time data - always up-to-date

### 2. **Simplified Database Schema**

**Only store application data, not DICOM metadata**

```sql
-- REMOVED TABLES (no longer needed):
-- cached_patients (query Orthanc instead)
-- cached_studies (query Orthanc instead)
-- dicom_instances (Orthanc handles this)

-- KEEP TABLES (application-specific):
users (authentication, roles)
sessions (if not using JWT)
medical_reports (custom data)
measurements (saved annotations)
prescriptions (clinical data)
user_preferences (settings)
audit_logs (compliance)
```

### 3. **Frontend Architecture (KEEP EXISTING STRUCTURE)**

**Keep your existing component structure** (Vanilla JavaScript):
```
js/
├── main.js                        # Main initialization (KEEP)
├── studies.js                     # Patient/Study list (KEEP)
├── orthanc-autoload.js            # Auto-load studies (KEEP)
├── managers/
│   ├── viewport-manager.js        # Layout manager (KEEP)
│   ├── mpr-manager.js             # MPR reconstruction (KEEP)
│   ├── enhancement-manager.js     # Image enhancement (KEEP)
│   ├── crosshair-manager.js       # Crosshairs (KEEP)
│   └── reference-lines-manager.js # Reference lines (KEEP)
├── components/
│   ├── upload-handler.js          # File upload (KEEP)
│   ├── ui-controls.js             # UI controls (KEEP)
│   ├── event-handlers.js          # Event handlers (KEEP)
│   ├── medical-notes.js           # Notes (KEEP)
│   ├── reporting-system.js        # Reports (KEEP)
│   ├── mouse-controls.js          # Mouse/touch (KEEP)
│   ├── export-manager.js          # Export (KEEP)
│   ├── print-manager.js           # Print (KEEP)
│   ├── settings-manager.js        # Settings (KEEP)
│   ├── mobile-controls.js         # Mobile (KEEP)
│   └── layout-toggle.js           # Layouts (KEEP)
├── utils/
│   ├── cornerstone-init.js        # Cornerstone init (KEEP)
│   └── constants.js               # Constants (KEEP)
└── NEW FILES TO ADD:
    ├── sync-manager.js            # NEW: Auto-sync manager
    └── backup-manager.js          # NEW: Google Drive backup
```

**NEW: Automated Sync & Backup Components** (Vanilla JavaScript):
```javascript
// js/sync-manager.js - NEW FILE
class SyncManager {
    constructor() {
        this.orthancPath = '';
        this.syncInterval = null;
    }

    configurePath(path) { /* Configure Orthanc directory */ }
    startAutoSync() { /* Auto-sync to localhost & GoDaddy */ }
    syncNow() { /* Manual sync trigger */ }
}

// js/backup-manager.js - NEW FILE
class BackupManager {
    constructor() {
        this.driveApiKey = '';
        this.lastBackup = null;
    }

    backupToGoogleDrive() { /* Backup files & DB to Drive */ }
    scheduleDaily() { /* Schedule daily backups */ }
    restoreFromBackup(backupId) { /* Restore from backup */ }
}
```

### 4. **DICOMweb Integration Pattern**

**Orthanc DICOMweb Endpoints**:
```
QIDO-RS (Query):
- GET /dicom-web/studies
- GET /dicom-web/studies/{study}/series
- GET /dicom-web/studies/{study}/series/{series}/instances

WADO-RS (Retrieve):
- GET /dicom-web/studies/{study}/metadata
- GET /dicom-web/studies/{study}/series/{series}/metadata
- GET /dicom-web/studies/{study}/series/{series}/instances/{instance}
- GET /dicom-web/studies/{study}/series/{series}/instances/{instance}/frames/1

STOW-RS (Store):
- POST /dicom-web/studies (for uploading new DICOM files)
```

**PHP Proxy Implementation** (using MySQLi and session-based auth):
```php
// api/dicomweb/proxy.php
<?php
require_once '../auth/session.php';

// Check if user is logged in
if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

class DicomWebProxy {
    private $orthancUrl = 'http://localhost:8042/dicom-web';
    private $db;

    public function __construct($mysqli) {
        $this->db = $mysqli;
    }

    public function queryStudies($filters) {
        // Build QIDO-RS query
        $params = [];
        if ($filters['patientName']) {
            $params['PatientName'] = $filters['patientName'];
        }
        if ($filters['studyDate']) {
            $params['StudyDate'] = $filters['studyDate'];
        }
        if ($filters['modality']) {
            $params['ModalitiesInStudy'] = $filters['modality'];
        }

        $url = $this->orthancUrl . '/studies?' . http_build_query($params);

        // Forward to Orthanc with authentication
        $response = $this->curlRequest($url);

        // Log access for HIPAA compliance
        $this->logAccess($_SESSION['user_id'], 'view_studies', json_encode($filters));

        // Return JSON directly (DICOMweb returns JSON)
        return $response;
    }

    private function logAccess($userId, $action, $details) {
        $stmt = $this->db->prepare("INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, 'study', ?, ?)");
        $ipAddress = $_SERVER['REMOTE_ADDR'];
        $stmt->bind_param("isss", $userId, $action, $details, $ipAddress);
        $stmt->execute();
        $stmt->close();
    }
}

// Initialize database connection (MySQLi)
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

if ($mysqli->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Handle request
$proxy = new DicomWebProxy($mysqli);
$filters = json_decode(file_get_contents('php://input'), true);
$result = $proxy->queryStudies($filters);

echo json_encode($result);
$mysqli->close();
?>
```

### 5. **Progressive Image Loading**

**Strategy**:
1. Load thumbnail/preview images first (small, fast)
2. Load full-resolution on viewport focus
3. Pre-fetch adjacent slices in background
4. Cache in IndexedDB for offline access

**Implementation**:
```javascript
// Progressive loading with Cornerstone3D
const loadStudy = async (studyUID) => {
  // 1. Load metadata first (fast)
  const metadata = await dicomwebClient.retrieveStudyMetadata({ studyUID });

  // 2. Load thumbnails (low-res, cached)
  const thumbnails = await loadThumbnails(metadata);

  // 3. Load first series full-res
  const firstSeries = metadata.series[0];
  await loadSeriesToViewport(firstSeries);

  // 4. Pre-fetch remaining series in background
  prefetchSeries(metadata.series.slice(1));
};
```

### 6. **Authentication & Security** (Session-Based - Keep Existing)

**Session-Based Authentication** (MySQLi):
```php
// auth/session.php (KEEP EXISTING APPROACH)
<?php
session_start();

function isLoggedIn() {
    return isset($_SESSION['user_id']) && $_SESSION['user_id'] > 0;
}

function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: /login.php');
        exit;
    }
}

function login($username, $password, $mysqli) {
    // Prepare statement to prevent SQL injection
    $stmt = $mysqli->prepare("SELECT id, username, password_hash, role, full_name FROM users WHERE username = ? AND is_active = 1");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $user = $result->fetch_assoc();

        // Verify password
        if (password_verify($password, $user['password_hash'])) {
            // Set session variables
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['full_name'] = $user['full_name'];

            // Update last login
            $updateStmt = $mysqli->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
            $updateStmt->bind_param("i", $user['id']);
            $updateStmt->execute();
            $updateStmt->close();

            // Log login
            $logStmt = $mysqli->prepare("INSERT INTO audit_logs (user_id, action, ip_address) VALUES (?, 'login', ?)");
            $ipAddress = $_SERVER['REMOTE_ADDR'];
            $logStmt->bind_param("is", $user['id'], $ipAddress);
            $logStmt->execute();
            $logStmt->close();

            $stmt->close();
            return ['success' => true, 'user' => $user];
        }
    }

    $stmt->close();
    return ['success' => false, 'error' => 'Invalid credentials'];
}

function logout() {
    session_destroy();
    header('Location: /login.php');
    exit;
}
?>
```

**Frontend Session Check** (Vanilla JavaScript):
```javascript
// js/utils/auth.js
const AuthUtils = {
    // Check if user is logged in (PHP session handles this)
    async checkSession() {
        const response = await fetch('/api/auth/check-session.php');
        const data = await response.json();

        if (!data.logged_in) {
            window.location.href = '/login.php';
        }

        return data;
    },

    // Get current user info
    async getCurrentUser() {
        const response = await fetch('/api/auth/me.php');
        return await response.json();
    },

    // Logout
    async logout() {
        await fetch('/api/auth/logout.php', { method: 'POST' });
        window.location.href = '/login.php';
    }
};
```

### 7. **Caching Strategy**

**Three-Layer Cache**:

1. **Browser Cache** (IndexedDB)
   - DICOM images
   - Study metadata
   - Offline access

2. **Server Cache** (Redis or File)
   - DICOMweb query results (short TTL: 5 minutes)
   - Rendered thumbnails
   - User preferences

3. **Orthanc Internal** (PostgreSQL)
   - DICOM file storage
   - Built-in indexing
   - Series/Instance metadata

**Cache Invalidation**:
- Use Orthanc `/changes` endpoint to detect new studies
- WebSocket or polling to notify frontend
- Clear browser cache on new data

---

## Database Schema (Simplified)

```sql
-- Users and Authentication
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    role ENUM('admin', 'radiologist', 'technician', 'viewer') DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Medical Reports (linked to Orthanc Study UID)
CREATE TABLE medical_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    study_instance_uid VARCHAR(255) NOT NULL,  -- DICOM Study UID
    report_type VARCHAR(50),                   -- ct_head, ct_chest, etc.
    indication TEXT,
    technique TEXT,
    findings TEXT,
    impression TEXT,
    reporting_physician_id INT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version INT DEFAULT 1,
    status ENUM('draft', 'final', 'amended') DEFAULT 'draft',
    FOREIGN KEY (reporting_physician_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_study_uid (study_instance_uid),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Report Version History
CREATE TABLE report_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    version INT NOT NULL,
    report_data JSON,  -- Full report snapshot
    modified_by INT,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES medical_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (modified_by) REFERENCES users(id),
    INDEX idx_report_id (report_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Image Measurements and Annotations
CREATE TABLE measurements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    series_instance_uid VARCHAR(255) NOT NULL,  -- DICOM Series UID
    sop_instance_uid VARCHAR(255),              -- DICOM Instance UID
    measurement_type ENUM('length', 'angle', 'roi', 'ellipse', 'rectangle', 'probe'),
    measurement_data JSON,  -- {value, unit, coordinates, etc.}
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_series_uid (series_instance_uid),
    INDEX idx_sop_uid (sop_instance_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clinical Notes (per series or instance)
CREATE TABLE clinical_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    study_instance_uid VARCHAR(255),
    series_instance_uid VARCHAR(255),
    note_text TEXT,
    note_category VARCHAR(50),  -- clinical_history, findings, etc.
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_study_uid (study_instance_uid),
    INDEX idx_series_uid (series_instance_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Prescriptions
CREATE TABLE prescriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    study_instance_uid VARCHAR(255),
    patient_identifier VARCHAR(255),  -- From DICOM PatientID
    prescription_data JSON,
    prescribed_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prescribed_by) REFERENCES users(id),
    INDEX idx_study_uid (study_instance_uid),
    INDEX idx_patient_id (patient_identifier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User Preferences
CREATE TABLE user_preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSON,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_pref (user_id, preference_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Audit Logs (HIPAA compliance)
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100),  -- login, view_study, export_image, etc.
    resource_type VARCHAR(50),  -- study, report, patient
    resource_id VARCHAR(255),   -- Study UID, Report ID, etc.
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## API Endpoints (Improved)

### Authentication (Session-Based)
```
POST   /api/auth/login.php          - Login with username/password, creates PHP session
POST   /api/auth/logout.php         - Destroy session
GET    /api/auth/check-session.php  - Check if session is active
GET    /api/auth/me.php             - Get current user info from session
```

### DICOMweb Proxy (queries Orthanc, no cache)
```
GET    /api/dicomweb/studies                    - Query studies (QIDO-RS)
       ?PatientName=John*&StudyDate=20250101-20250131&Modality=CT

GET    /api/dicomweb/studies/{studyUID}         - Get study metadata
GET    /api/dicomweb/studies/{studyUID}/series  - Get series list
GET    /api/dicomweb/studies/{studyUID}/series/{seriesUID}/instances
                                                 - Get instances list
GET    /api/dicomweb/instances/{instanceUID}    - Get DICOM file (WADO-RS)
GET    /api/dicomweb/thumbnail/{instanceUID}    - Get thumbnail image
```

### Medical Reports
```
POST   /api/reports             - Create new report
GET    /api/reports/{id}        - Get report by ID
PUT    /api/reports/{id}        - Update report
DELETE /api/reports/{id}        - Delete report (soft delete)
GET    /api/reports/study/{studyUID}  - Get report for study
GET    /api/reports/{id}/versions     - Get version history
```

### Measurements & Annotations
```
POST   /api/measurements        - Save measurement
GET    /api/measurements/series/{seriesUID}  - Get measurements for series
DELETE /api/measurements/{id}   - Delete measurement
```

### Clinical Notes
```
POST   /api/notes               - Create note
GET    /api/notes/study/{studyUID}     - Get notes for study
PUT    /api/notes/{id}          - Update note
DELETE /api/notes/{id}          - Delete note
```

### Utilities
```
GET    /api/orthanc/status      - Orthanc server health check
GET    /api/system/config       - Get frontend configuration
GET    /api/audit/logs          - Get audit logs (admin only)
```

### NEW: Automated Sync & Backup APIs
```
POST   /api/sync/configure-path.php      - Configure Orthanc storage directory path
GET    /api/sync/get-config.php          - Get current sync configuration
POST   /api/sync/sync-now.php            - Trigger immediate sync
GET    /api/sync/status.php              - Get sync status (last sync, next sync)
POST   /api/sync/enable-auto.php         - Enable automatic syncing
POST   /api/sync/disable-auto.php        - Disable automatic syncing

POST   /api/backup/configure-gdrive.php  - Configure Google Drive API credentials
POST   /api/backup/backup-now.php        - Trigger immediate backup to Google Drive
GET    /api/backup/list-backups.php      - List all Google Drive backups
POST   /api/backup/restore.php           - Restore from Google Drive backup
GET    /api/backup/status.php            - Get backup status
POST   /api/backup/schedule.php          - Configure backup schedule (daily/weekly)
```

---

## NEW: Automated Directory Sync & Google Drive Backup System

### Overview
This system eliminates manual file management by automatically syncing DICOM files and creating cloud backups.

### Architecture
```
┌──────────────────────────────────────────────────────────────────┐
│                     ORTHANC STORAGE DIRECTORY                    │
│              (Configured path: C:\Orthanc\Storage)              │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          │ Monitors for new files
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    AUTOMATED SYNC MANAGER                        │
│   - Watches configured directory                                │
│   - Detects new DICOM files                                     │
│   - Syncs to both localhost and GoDaddy                         │
│   - Runs as background service                                  │
└──────┬────────────────────────┬──────────────────────────────────┘
       │                        │
       │ Syncs to               │ Syncs to
       ▼                        ▼
┌─────────────┐          ┌─────────────────────┐
│  LOCALHOST  │          │  GODADDY cPanel     │
│  XAMPP      │          │  (Production)       │
│  Database   │          │  Database           │
└─────────────┘          └─────────────────────┘
       │                        │
       └────────┬───────────────┘
                │ Daily backup
                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     GOOGLE DRIVE BACKUP                          │
│   - Full database dump (SQL)                                    │
│   - All PHP files                                                │
│   - All JavaScript files                                         │
│   - Configuration files                                          │
│   - Backup retention: 30 days                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 1. Hospital Existing Data Directory Configuration UI

**Purpose**: Allow hospital to configure the path where they already have existing DICOM data, so the system can import and continuously monitor that directory.

**New Admin Page**: `/admin/data-import.php`

**UI Components**:
```html
┌─────────────────────────────────────────────────────────────┐
│  Hospital Existing Data Import Configuration                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hospital DICOM Data Directory:                             │
│  [D:\Hospital\DICOM\MRI_CT_Data\  ] [Browse Folder]  [Test] │
│                                                             │
│  Import Settings:                                           │
│  ☑ Import all existing DICOM files to Orthanc              │
│  ☑ Enable continuous monitoring (auto-import new files)    │
│                                                             │
│  File Filters:                                              │
│  ☑ Include .dcm files                                       │
│  ☑ Include files without extension (check DICOM header)    │
│  ☑ Recursively scan subdirectories                          │
│                                                             │
│  Scan Results:                                              │
│  Found: 1,247 DICOM files (4.8 GB)                          │
│  Patients: 45 | Studies: 156 | Series: 423                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Import Progress                                     │   │
│  │ [████████████████████████░░░░░░░░░] 80% (1,000/1,247)│   │
│  │ Current: CT_Brain_20250119_001.dcm                  │   │
│  │ Elapsed: 2m 15s | Remaining: ~34s                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Scan Directory]  [Start Import]  [Stop Import]            │
│                                                             │
│  Status: ✓ Monitoring enabled - checking every 30 seconds  │
│  Last check: 2025-11-21 10:45:30 AM                         │
│  New files imported today: 23                               │
└─────────────────────────────────────────────────────────────┘
```

**Folder Browser Component** (Vanilla JavaScript):
```javascript
// js/components/folder-browser.js
class FolderBrowser {
    constructor(inputElementId, browseButtonId) {
        this.input = document.getElementById(inputElementId);
        this.browseBtn = document.getElementById(browseButtonId);
        this.setupListeners();
    }

    setupListeners() {
        this.browseBtn.addEventListener('click', () => {
            this.openBrowserDialog();
        });
    }

    async openBrowserDialog() {
        // Call PHP backend to list directories
        const response = await fetch('/api/sync/list-directories.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_path: this.input.value || 'C:\\'
            })
        });

        const data = await response.json();
        this.showDirectoryModal(data.directories, data.current_path);
    }

    showDirectoryModal(directories, currentPath) {
        // Create Bootstrap modal with directory list
        const modalHtml = `
            <div class="modal fade" id="folderBrowserModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Select Folder</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <nav aria-label="breadcrumb">
                                <ol class="breadcrumb">
                                    ${this.renderBreadcrumb(currentPath)}
                                </ol>
                            </nav>
                            <div class="list-group">
                                ${directories.map(dir => `
                                    <a href="#" class="list-group-item list-group-item-action"
                                       data-path="${dir.path}">
                                        <i class="bi bi-folder"></i> ${dir.name}
                                    </a>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="selectFolderBtn">
                                Select Current Folder
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Show modal and handle selection
        // ... implementation continues
    }

    renderBreadcrumb(path) {
        const parts = path.split('\\').filter(p => p);
        return parts.map((part, index) => {
            const fullPath = parts.slice(0, index + 1).join('\\') + '\\';
            return `<li class="breadcrumb-item"><a href="#" data-path="${fullPath}">${part}</a></li>`;
        }).join('');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const folderBrowser = new FolderBrowser('hospitalDataPath', 'browseFolderBtn');
});
```

**Backend: Directory Scanner & Importer** (PHP with MySQLi):
```php
// api/sync/import-hospital-data.php
<?php
require_once '../auth/session.php';
require_once '../includes/db.php';

requireLogin();

// Only admin can import
if ($_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

class HospitalDataImporter {
    private $db;
    private $orthancUrl = 'http://localhost:8042';

    public function __construct($mysqli) {
        $this->db = $mysqli;
    }

    /**
     * Scan directory for DICOM files
     */
    public function scanDirectory($path) {
        if (!is_dir($path)) {
            throw new Exception("Directory does not exist: $path");
        }

        $dicomFiles = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                // Check if it's a DICOM file
                if ($this->isDicomFile($file->getPathname())) {
                    $dicomFiles[] = [
                        'path' => $file->getPathname(),
                        'size' => $file->getSize(),
                        'modified' => $file->getMTime()
                    ];
                }
            }
        }

        return $dicomFiles;
    }

    /**
     * Check if file is DICOM by reading DICM header
     */
    private function isDicomFile($filepath) {
        $handle = @fopen($filepath, 'rb');
        if (!$handle) return false;

        // Skip 128 bytes preamble
        fseek($handle, 128);

        // Read DICM prefix
        $prefix = fread($handle, 4);
        fclose($handle);

        return $prefix === 'DICM';
    }

    /**
     * Import DICOM file to Orthanc
     */
    public function importFileToOrthanc($filepath) {
        $fileData = file_get_contents($filepath);

        $ch = curl_init($this->orthancUrl . '/instances');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fileData);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/dicom',
            'Content-Length: ' . strlen($fileData)
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("Failed to import file to Orthanc: $filepath");
        }

        return json_decode($response, true);
    }

    /**
     * Batch import with progress tracking
     */
    public function batchImport($files, $jobId) {
        $totalFiles = count($files);
        $imported = 0;
        $failed = 0;
        $errors = [];

        foreach ($files as $index => $file) {
            try {
                $result = $this->importFileToOrthanc($file['path']);

                // Log successful import
                $stmt = $this->db->prepare("
                    INSERT INTO import_history
                    (job_id, file_path, orthanc_id, status, imported_at)
                    VALUES (?, ?, ?, 'success', NOW())
                ");
                $stmt->bind_param("iss", $jobId, $file['path'], $result['ID']);
                $stmt->execute();
                $stmt->close();

                $imported++;

            } catch (Exception $e) {
                $failed++;
                $errors[] = $file['path'] . ': ' . $e->getMessage();

                // Log failed import
                $stmt = $this->db->prepare("
                    INSERT INTO import_history
                    (job_id, file_path, status, error_message, imported_at)
                    VALUES (?, ?, 'failed', ?, NOW())
                ");
                $stmt->bind_param("iss", $jobId, $file['path'], $e->getMessage());
                $stmt->execute();
                $stmt->close();
            }

            // Update progress
            $progress = round(($index + 1) / $totalFiles * 100, 2);
            $this->updateJobProgress($jobId, $progress, $imported, $failed);

            // Allow PHP to send progress updates
            if ($index % 10 === 0) {
                usleep(10000); // Small delay to prevent CPU overload
            }
        }

        return [
            'total' => $totalFiles,
            'imported' => $imported,
            'failed' => $failed,
            'errors' => $errors
        ];
    }

    private function updateJobProgress($jobId, $progress, $imported, $failed) {
        $stmt = $this->db->prepare("
            UPDATE import_jobs
            SET progress = ?, files_imported = ?, files_failed = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->bind_param("diii", $progress, $imported, $failed, $jobId);
        $stmt->execute();
        $stmt->close();
    }
}

// Handle request
$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

$mysqli = getDbConnection();
$importer = new HospitalDataImporter($mysqli);

switch ($action) {
    case 'scan':
        $files = $importer->scanDirectory($data['path']);
        echo json_encode(['success' => true, 'files' => $files, 'count' => count($files)]);
        break;

    case 'import':
        $jobId = $data['job_id'];
        $files = $data['files'];
        $result = $importer->batchImport($files, $jobId);
        echo json_encode(['success' => true, 'result' => $result]);
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
}

$mysqli->close();
?>
```

### 2. Automated Sync Configuration UI

**Admin Page**: `/admin/sync-config.php`

**UI Components**:
```html
┌─────────────────────────────────────────────────────────────┐
│  Automated Sync Configuration                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Orthanc Storage Path:                                      │
│  [C:\Orthanc\OrthancStorage\          ] [Browse]  [Test]    │
│                                                             │
│  Auto-Sync Settings:                                        │
│  ☑ Enable automatic synchronization                         │
│  Sync Interval: [2] minutes                                 │
│                                                             │
│  Sync Destinations:                                         │
│  ☑ Localhost (127.0.0.1)                                    │
│  ☑ GoDaddy Production (your-domain.com)                     │
│                                                             │
│  GoDaddy FTP Settings:                                      │
│  Host:     [ftp.your-domain.com        ]                    │
│  Username: [your-username               ]                    │
│  Password: [••••••••••                  ]                    │
│  Path:     [/public_html/dicom_viewer/  ]                    │
│                                                             │
│  [Save Configuration]  [Test Connection]  [Sync Now]        │
│                                                             │
│  Last Sync: 2025-11-19 10:30:45 AM                          │
│  Status: ✓ Synced 145 files (2.3 GB)                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Google Drive Backup Configuration                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Google Drive API Configuration:                            │
│  Client ID:     [your-client-id.apps.googleusercontent.com] │
│  Client Secret: [••••••••••••••••••••]                      │
│  Folder Name:   [DICOM_Viewer_Backups]                      │
│                                                             │
│  Backup Schedule:                                           │
│  ☑ Enable automatic backups                                 │
│  Frequency: [Daily ▼] at [02:00 AM ▼]                       │
│                                                             │
│  Backup Contents:                                           │
│  ☑ MySQL Database (dicom_viewer_v2_production)              │
│  ☑ PHP Files (/api, /auth, /includes)                       │
│  ☑ JavaScript Files (/js)                                   │
│  ☑ Configuration Files (.env)                               │
│  ☑ Reports & Notes (if stored as files)                     │
│                                                             │
│  Retention: Keep backups for [30] days                      │
│                                                             │
│  [Save Configuration]  [Test Connection]  [Backup Now]      │
│                                                             │
│  Last Backup: 2025-11-19 02:00:12 AM                        │
│  Size: 450 MB                                                │
│  Backups Available: 15                                       │
│                                                             │
│  Recent Backups:                                            │
│  • 2025-11-19_backup.zip (450 MB) [Restore] [Download]      │
│  • 2025-11-18_backup.zip (448 MB) [Restore] [Download]      │
│  • 2025-11-17_backup.zip (445 MB) [Restore] [Download]      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Database Tables for Sync & Backup

```sql
-- Sync Configuration
CREATE TABLE sync_configuration (
    id INT PRIMARY KEY AUTO_INCREMENT,
    orthanc_storage_path VARCHAR(500) NOT NULL,
    auto_sync_enabled BOOLEAN DEFAULT TRUE,
    sync_interval_minutes INT DEFAULT 5,
    sync_to_localhost BOOLEAN DEFAULT TRUE,
    sync_to_godaddy BOOLEAN DEFAULT TRUE,
    godaddy_ftp_host VARCHAR(255),
    godaddy_ftp_username VARCHAR(255),
    godaddy_ftp_password VARCHAR(255),  -- Encrypted
    godaddy_ftp_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_tested TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sync History
CREATE TABLE sync_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_completed_at TIMESTAMP NULL,
    sync_destination ENUM('localhost', 'godaddy') NOT NULL,
    files_synced INT DEFAULT 0,
    total_size_mb DECIMAL(10,2) DEFAULT 0,
    status ENUM('running', 'completed', 'failed') DEFAULT 'running',
    error_message TEXT NULL,
    INDEX idx_started (sync_started_at),
    INDEX idx_destination (sync_destination)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Google Drive Backup Configuration
CREATE TABLE gdrive_backup_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id VARCHAR(500),
    client_secret VARCHAR(500),  -- Encrypted
    refresh_token TEXT,          -- Encrypted
    folder_name VARCHAR(255) DEFAULT 'DICOM_Viewer_Backups',
    auto_backup_enabled BOOLEAN DEFAULT TRUE,
    backup_frequency ENUM('daily', 'weekly', 'monthly') DEFAULT 'daily',
    backup_time TIME DEFAULT '02:00:00',
    backup_database BOOLEAN DEFAULT TRUE,
    backup_php_files BOOLEAN DEFAULT TRUE,
    backup_js_files BOOLEAN DEFAULT TRUE,
    backup_config_files BOOLEAN DEFAULT TRUE,
    retention_days INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backup History
CREATE TABLE backup_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    backup_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    backup_completed_at TIMESTAMP NULL,
    backup_filename VARCHAR(255),
    gdrive_file_id VARCHAR(255),
    backup_size_mb DECIMAL(10,2),
    status ENUM('running', 'completed', 'failed') DEFAULT 'running',
    error_message TEXT NULL,
    can_restore BOOLEAN DEFAULT TRUE,
    INDEX idx_started (backup_started_at),
    INDEX idx_filename (backup_filename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3. PHP Sync Manager

**File**: `/api/sync/SyncManager.php`

```php
<?php
class SyncManager {
    private $db;
    private $config;

    public function __construct($db) {
        $this->db = $db;
        $this->loadConfig();
    }

    /**
     * Configure Orthanc storage directory path
     */
    public function configurePath($path) {
        // Validate path exists
        if (!is_dir($path)) {
            throw new Exception("Directory does not exist: $path");
        }

        // Check read permissions
        if (!is_readable($path)) {
            throw new Exception("Directory is not readable: $path");
        }

        // Save to database
        $stmt = $this->db->prepare("
            UPDATE sync_configuration
            SET orthanc_storage_path = ?, updated_at = NOW()
            WHERE id = 1
        ");
        $stmt->execute([$path]);

        $this->config['orthanc_storage_path'] = $path;
        return true;
    }

    /**
     * Start automatic sync service
     */
    public function startAutoSync() {
        if (!$this->config['auto_sync_enabled']) {
            throw new Exception("Auto-sync is disabled");
        }

        $interval = $this->config['sync_interval_minutes'] * 60; // Convert to seconds

        // Use Windows Task Scheduler or cron job
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            // Windows: Create scheduled task
            $this->createWindowsScheduledTask($interval);
        } else {
            // Linux/Unix: Create cron job
            $this->createCronJob($interval);
        }

        return true;
    }

    /**
     * Sync files immediately
     */
    public function syncNow($destination = 'both') {
        $syncId = $this->createSyncRecord($destination);

        try {
            $storagePath = $this->config['orthanc_storage_path'];
            $fileCount = 0;
            $totalSize = 0;

            // Get list of DICOM files
            $files = $this->scanOrthancDirectory($storagePath);

            foreach ($files as $file) {
                if ($destination === 'localhost' || $destination === 'both') {
                    $this->syncToLocalhost($file);
                }

                if ($destination === 'godaddy' || $destination === 'both') {
                    $this->syncToGoDaddy($file);
                }

                $fileCount++;
                $totalSize += filesize($file);
            }

            // Update sync record
            $this->completeSyncRecord($syncId, $fileCount, $totalSize / 1024 / 1024);

            return [
                'success' => true,
                'files_synced' => $fileCount,
                'total_size_mb' => round($totalSize / 1024 / 1024, 2)
            ];

        } catch (Exception $e) {
            $this->failSyncRecord($syncId, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Scan Orthanc directory for DICOM files
     */
    private function scanOrthancDirectory($path) {
        $files = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path)
        );

        foreach ($iterator as $file) {
            if ($file->isFile()) {
                // Orthanc stores files without extension
                // Check if it's a DICOM file by reading header
                if ($this->isDicomFile($file->getPathname())) {
                    $files[] = $file->getPathname();
                }
            }
        }

        return $files;
    }

    /**
     * Check if file is DICOM
     */
    private function isDicomFile($filepath) {
        $handle = fopen($filepath, 'rb');
        if (!$handle) return false;

        // Skip 128 bytes preamble
        fseek($handle, 128);

        // Read DICM prefix
        $prefix = fread($handle, 4);
        fclose($handle);

        return $prefix === 'DICM';
    }

    /**
     * Sync file to GoDaddy via FTP
     */
    private function syncToGoDaddy($localFile) {
        $ftpConn = ftp_connect($this->config['godaddy_ftp_host']);
        if (!$ftpConn) {
            throw new Exception("Could not connect to GoDaddy FTP");
        }

        $login = ftp_login(
            $ftpConn,
            $this->config['godaddy_ftp_username'],
            $this->config['godaddy_ftp_password']
        );

        if (!$login) {
            throw new Exception("FTP login failed");
        }

        // Enable passive mode
        ftp_pasv($ftpConn, true);

        // Create remote path
        $remotePath = $this->config['godaddy_ftp_path'] . '/' . basename($localFile);

        // Upload file
        $upload = ftp_put($ftpConn, $remotePath, $localFile, FTP_BINARY);

        ftp_close($ftpConn);

        if (!$upload) {
            throw new Exception("Failed to upload file to GoDaddy");
        }

        return true;
    }

    /**
     * Sync file to localhost (copy to local database path)
     */
    private function syncToLocalhost($file) {
        // This could copy to a separate directory or update database records
        // For now, files are already on localhost (Orthanc storage)
        // So this mainly updates database metadata

        return true;
    }

    // Helper methods for database operations
    private function createSyncRecord($destination) { /* ... */ }
    private function completeSyncRecord($id, $files, $sizeMb) { /* ... */ }
    private function failSyncRecord($id, $error) { /* ... */ }
    private function loadConfig() { /* ... */ }
}
```

### 4. Google Drive Backup Manager

**File**: `/api/backup/GoogleDriveBackup.php`

```php
<?php
require_once __DIR__ . '/../../vendor/autoload.php';

use Google\Client;
use Google\Service\Drive;

class GoogleDriveBackup {
    private $db;
    private $client;
    private $driveService;
    private $config;

    public function __construct($db) {
        $this->db = $db;
        $this->loadConfig();
        $this->initializeGoogleClient();
    }

    /**
     * Initialize Google Drive API client
     */
    private function initializeGoogleClient() {
        $this->client = new Client();
        $this->client->setClientId($this->config['client_id']);
        $this->client->setClientSecret($this->config['client_secret']);
        $this->client->setRedirectUri('http://localhost/api/backup/oauth-callback.php');
        $this->client->addScope(Drive::DRIVE_FILE);

        if ($this->config['refresh_token']) {
            $this->client->setAccessToken([
                'refresh_token' => $this->config['refresh_token']
            ]);
        }

        $this->driveService = new Drive($this->client);
    }

    /**
     * Perform backup to Google Drive
     */
    public function backupNow() {
        $backupId = $this->createBackupRecord();

        try {
            // 1. Create temporary directory for backup
            $tempDir = sys_get_temp_dir() . '/dicom_backup_' . time();
            mkdir($tempDir);

            // 2. Backup MySQL database
            $dbBackupFile = $this->backupDatabase($tempDir);

            // 3. Backup PHP files
            $this->backupFiles($tempDir, __DIR__ . '/../../api', 'php_files');
            $this->backupFiles($tempDir, __DIR__ . '/../../auth', 'auth_files');
            $this->backupFiles($tempDir, __DIR__ . '/../../includes', 'includes_files');

            // 4. Backup JavaScript files
            $this->backupFiles($tempDir, __DIR__ . '/../../js', 'js_files');

            // 5. Backup configuration
            copy(__DIR__ . '/../../config/.env', $tempDir . '/.env');

            // 6. Create ZIP archive
            $zipFile = $this->createZipArchive($tempDir);

            // 7. Upload to Google Drive
            $fileId = $this->uploadToGoogleDrive($zipFile);

            // 8. Update backup record
            $fileSize = filesize($zipFile) / 1024 / 1024; // MB
            $this->completeBackupRecord($backupId, basename($zipFile), $fileId, $fileSize);

            // 9. Cleanup
            $this->cleanupTempFiles($tempDir, $zipFile);

            // 10. Delete old backups (retention policy)
            $this->deleteOldBackups();

            return [
                'success' => true,
                'backup_id' => $backupId,
                'file_id' => $fileId,
                'size_mb' => round($fileSize, 2)
            ];

        } catch (Exception $e) {
            $this->failBackupRecord($backupId, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Backup MySQL database to SQL file
     */
    private function backupDatabase($outputDir) {
        $dbHost = getenv('DB_HOST');
        $dbUser = getenv('DB_USER');
        $dbPass = getenv('DB_PASSWORD');
        $dbName = getenv('DB_NAME');

        $outputFile = $outputDir . '/database_backup.sql';

        // Use mysqldump
        $command = sprintf(
            'mysqldump -h %s -u %s -p%s %s > %s',
            escapeshellarg($dbHost),
            escapeshellarg($dbUser),
            escapeshellarg($dbPass),
            escapeshellarg($dbName),
            escapeshellarg($outputFile)
        );

        exec($command, $output, $returnCode);

        if ($returnCode !== 0) {
            throw new Exception("Database backup failed");
        }

        return $outputFile;
    }

    /**
     * Backup files recursively
     */
    private function backupFiles($outputDir, $sourceDir, $subDirName) {
        $targetDir = $outputDir . '/' . $subDirName;
        mkdir($targetDir, 0755, true);

        $this->recursiveCopy($sourceDir, $targetDir);
    }

    /**
     * Recursive copy helper
     */
    private function recursiveCopy($src, $dst) {
        $dir = opendir($src);
        @mkdir($dst);

        while (($file = readdir($dir)) !== false) {
            if ($file != '.' && $file != '..') {
                if (is_dir($src . '/' . $file)) {
                    $this->recursiveCopy($src . '/' . $file, $dst . '/' . $file);
                } else {
                    copy($src . '/' . $file, $dst . '/' . $file);
                }
            }
        }

        closedir($dir);
    }

    /**
     * Create ZIP archive
     */
    private function createZipArchive($sourceDir) {
        $zipFile = sys_get_temp_dir() . '/dicom_backup_' . date('Y-m-d_H-i-s') . '.zip';

        $zip = new ZipArchive();
        if ($zip->open($zipFile, ZipArchive::CREATE) !== true) {
            throw new Exception("Cannot create ZIP file");
        }

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = substr($filePath, strlen($sourceDir) + 1);
                $zip->addFile($filePath, $relativePath);
            }
        }

        $zip->close();
        return $zipFile;
    }

    /**
     * Upload file to Google Drive
     */
    private function uploadToGoogleDrive($filePath) {
        $fileName = basename($filePath);
        $folderName = $this->config['folder_name'];

        // Find or create backup folder
        $folderId = $this->findOrCreateFolder($folderName);

        // Upload file
        $fileMetadata = new Drive\DriveFile([
            'name' => $fileName,
            'parents' => [$folderId]
        ]);

        $content = file_get_contents($filePath);
        $file = $this->driveService->files->create($fileMetadata, [
            'data' => $content,
            'mimeType' => 'application/zip',
            'uploadType' => 'multipart',
            'fields' => 'id'
        ]);

        return $file->id;
    }

    /**
     * Find or create Google Drive folder
     */
    private function findOrCreateFolder($folderName) {
        // Search for existing folder
        $response = $this->driveService->files->listFiles([
            'q' => "name='$folderName' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            'fields' => 'files(id, name)'
        ]);

        if (count($response->files) > 0) {
            return $response->files[0]->id;
        }

        // Create new folder
        $fileMetadata = new Drive\DriveFile([
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder'
        ]);

        $folder = $this->driveService->files->create($fileMetadata, [
            'fields' => 'id'
        ]);

        return $folder->id;
    }

    /**
     * Restore from Google Drive backup
     */
    public function restoreFromBackup($backupId) {
        // Get backup record
        $backup = $this->getBackupRecord($backupId);

        if (!$backup || !$backup['gdrive_file_id']) {
            throw new Exception("Backup not found");
        }

        // Download from Google Drive
        $tempFile = sys_get_temp_dir() . '/restore_' . time() . '.zip';
        $response = $this->driveService->files->get($backup['gdrive_file_id'], [
            'alt' => 'media'
        ]);

        file_put_contents($tempFile, $response->getBody()->getContents());

        // Extract ZIP
        $extractDir = sys_get_temp_dir() . '/restore_' . time();
        $zip = new ZipArchive();
        $zip->open($tempFile);
        $zip->extractTo($extractDir);
        $zip->close();

        // Restore database
        $this->restoreDatabase($extractDir . '/database_backup.sql');

        // Restore files
        $this->restoreFiles($extractDir);

        // Cleanup
        unlink($tempFile);
        $this->recursiveDelete($extractDir);

        return ['success' => true];
    }

    /**
     * Restore MySQL database from SQL file
     */
    private function restoreDatabase($sqlFile) {
        $dbHost = getenv('DB_HOST');
        $dbUser = getenv('DB_USER');
        $dbPass = getenv('DB_PASSWORD');
        $dbName = getenv('DB_NAME');

        $command = sprintf(
            'mysql -h %s -u %s -p%s %s < %s',
            escapeshellarg($dbHost),
            escapeshellarg($dbUser),
            escapeshellarg($dbPass),
            escapeshellarg($dbName),
            escapeshellarg($sqlFile)
        );

        exec($command, $output, $returnCode);

        if ($returnCode !== 0) {
            throw new Exception("Database restore failed");
        }
    }

    /**
     * Delete backups older than retention period
     */
    private function deleteOldBackups() {
        $retentionDays = $this->config['retention_days'];
        $cutoffDate = date('Y-m-d H:i:s', strtotime("-$retentionDays days"));

        // Get old backups from database
        $stmt = $this->db->prepare("
            SELECT id, gdrive_file_id
            FROM backup_history
            WHERE backup_started_at < ? AND status = 'completed'
        ");
        $stmt->execute([$cutoffDate]);
        $oldBackups = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($oldBackups as $backup) {
            // Delete from Google Drive
            try {
                $this->driveService->files->delete($backup['gdrive_file_id']);
            } catch (Exception $e) {
                // Log error but continue
                error_log("Failed to delete Google Drive file: " . $e->getMessage());
            }

            // Mark as deleted in database
            $stmt = $this->db->prepare("
                UPDATE backup_history
                SET can_restore = FALSE
                WHERE id = ?
            ");
            $stmt->execute([$backup['id']]);
        }
    }

    // Helper methods
    private function loadConfig() { /* ... */ }
    private function createBackupRecord() { /* ... */ }
    private function completeBackupRecord($id, $filename, $fileId, $sizeMb) { /* ... */ }
    private function failBackupRecord($id, $error) { /* ... */ }
    private function getBackupRecord($id) { /* ... */ }
    private function cleanupTempFiles($dir, $file) { /* ... */ }
    private function recursiveDelete($dir) { /* ... */ }
}
```

### 5. Automated Services with NSSM (Non-Sucking Service Manager)

**IMPORTANT**: The system uses NSSM to run PHP scripts as Windows Services - much more reliable than Task Scheduler!

**What is NSSM?**
- NSSM (Non-Sucking Service Manager) is a free tool that wraps any executable as a Windows Service
- **More reliable** than Task Scheduler (services restart automatically on failure)
- **Better logging** (captures stdout/stderr to log files)
- **Auto-start** on Windows boot
- **No scheduled task limits** (runs continuously in background)

**File**: `/scripts/setup-nssm-services.bat`

```batch
@echo off
echo ===================================================
echo  Hospital DICOM Viewer Pro v2.0
echo  NSSM Windows Services Setup
echo ===================================================
echo.

REM Get current directory
SET SCRIPT_DIR=%~dp0
SET PROJECT_DIR=%SCRIPT_DIR%..
SET PHP_PATH=C:\xampp\php\php.exe
SET NSSM_PATH=%SCRIPT_DIR%nssm.exe

echo Project Directory: %PROJECT_DIR%
echo PHP Path: %PHP_PATH%
echo NSSM Path: %NSSM_PATH%
echo.

REM Check if PHP exists
IF NOT EXIST "%PHP_PATH%" (
    echo ERROR: PHP not found at %PHP_PATH%
    echo Please update PHP_PATH in this script
    pause
    exit /b 1
)

REM Check if NSSM exists
IF NOT EXIST "%NSSM_PATH%" (
    echo ERROR: NSSM not found at %NSSM_PATH%
    echo.
    echo Please download NSSM from: https://nssm.cc/download
    echo Extract nssm.exe (64-bit) to: %SCRIPT_DIR%
    echo.
    pause
    exit /b 1
)

echo Creating Windows Services...
echo.

REM Service 1: FTP Sync Service (runs continuously, syncs every 2 minutes)
echo [1/3] Installing FTP Sync Service...
"%NSSM_PATH%" install DicomViewer_FTP_Sync "%PHP_PATH%" "%PROJECT_DIR%\api\sync\sync-service.php"
"%NSSM_PATH%" set DicomViewer_FTP_Sync AppDirectory "%PROJECT_DIR%"
"%NSSM_PATH%" set DicomViewer_FTP_Sync DisplayName "DICOM Viewer - FTP Sync"
"%NSSM_PATH%" set DicomViewer_FTP_Sync Description "Automatically syncs DICOM files to GoDaddy cPanel every 2 minutes"
"%NSSM_PATH%" set DicomViewer_FTP_Sync Start SERVICE_AUTO_START
"%NSSM_PATH%" set DicomViewer_FTP_Sync AppStdout "%PROJECT_DIR%\logs\sync-service.log"
"%NSSM_PATH%" set DicomViewer_FTP_Sync AppStderr "%PROJECT_DIR%\logs\sync-service-error.log"
"%NSSM_PATH%" set DicomViewer_FTP_Sync AppRotateFiles 1
"%NSSM_PATH%" set DicomViewer_FTP_Sync AppRotateBytes 10485760
"%NSSM_PATH%" start DicomViewer_FTP_Sync
echo     ✓ FTP Sync Service installed and started
echo.

REM Service 2: Hospital Data Monitor Service
echo [2/3] Installing Hospital Data Monitor Service...
"%NSSM_PATH%" install DicomViewer_Data_Monitor "%PHP_PATH%" "%PROJECT_DIR%\api\sync\monitor-service.php"
"%NSSM_PATH%" set DicomViewer_Data_Monitor AppDirectory "%PROJECT_DIR%"
"%NSSM_PATH%" set DicomViewer_Data_Monitor DisplayName "DICOM Viewer - Data Monitor"
"%NSSM_PATH%" set DicomViewer_Data_Monitor Description "Monitors hospital DICOM directory and auto-imports new files"
"%NSSM_PATH%" set DicomViewer_Data_Monitor Start SERVICE_AUTO_START
"%NSSM_PATH%" set DicomViewer_Data_Monitor AppStdout "%PROJECT_DIR%\logs\monitor-service.log"
"%NSSM_PATH%" set DicomViewer_Data_Monitor AppStderr "%PROJECT_DIR%\logs\monitor-service-error.log"
"%NSSM_PATH%" set DicomViewer_Data_Monitor AppRotateFiles 1
"%NSSM_PATH%" set DicomViewer_Data_Monitor AppRotateBytes 10485760
"%NSSM_PATH%" start DicomViewer_Data_Monitor
echo     ✓ Data Monitor Service installed and started
echo.

REM Service 3: Google Drive Backup Service
echo [3/3] Installing Google Drive Backup Service...
"%NSSM_PATH%" install DicomViewer_GDrive_Backup "%PHP_PATH%" "%PROJECT_DIR%\api\backup\backup-service.php"
"%NSSM_PATH%" set DicomViewer_GDrive_Backup AppDirectory "%PROJECT_DIR%"
"%NSSM_PATH%" set DicomViewer_GDrive_Backup DisplayName "DICOM Viewer - GDrive Backup"
"%NSSM_PATH%" set DicomViewer_GDrive_Backup Description "Daily automated backups to Google Drive at 2:00 AM"
"%NSSM_PATH%" set DicomViewer_GDrive_Backup Start SERVICE_AUTO_START
"%NSSM_PATH%" set DicomViewer_GDrive_Backup AppStdout "%PROJECT_DIR%\logs\backup-service.log"
"%NSSM_PATH%" set DicomViewer_GDrive_Backup AppStderr "%PROJECT_DIR%\logs\backup-service-error.log"
"%NSSM_PATH%" set DicomViewer_GDrive_Backup AppRotateFiles 1
"%NSSM_PATH%" set DicomViewer_GDrive_Backup AppRotateBytes 10485760
"%NSSM_PATH%" start DicomViewer_GDrive_Backup
echo     ✓ Backup Service installed and started
echo.

echo ===================================================
echo Setup Complete!
echo ===================================================
echo.
echo The following Windows Services have been created and started:
echo   1. DicomViewer_FTP_Sync (syncs every 2 minutes)
echo   2. DicomViewer_Data_Monitor (checks every 30 seconds)
echo   3. DicomViewer_GDrive_Backup (daily at 2:00 AM)
echo.
echo Services will:
echo   - Start automatically on Windows boot
echo   - Restart automatically if they crash
echo   - Write logs to: %PROJECT_DIR%\logs\
echo.
echo To manage services: Open Services (services.msc)
echo.
pause
```

**Download NSSM**:
1. Go to: https://nssm.cc/download
2. Download latest release (e.g., nssm-2.24.zip)
3. Extract `win64\nssm.exe` to `c:\xampp\htdocs\dicom_viewer_v2\scripts\nssm.exe`

**Usage**:
1. Download and place nssm.exe in `/scripts/` folder
2. Right-click `setup-nssm-services.bat` → "Run as Administrator"
3. Services will install and start automatically!

**Verify Services are Running**:
```batch
REM Check service status
sc query DicomViewer_FTP_Sync
sc query DicomViewer_Data_Monitor
sc query DicomViewer_GDrive_Backup

REM Or open Services GUI
services.msc
```

**PHP Service Scripts** (Continuous Running):

**File**: `/api/sync/sync-service.php` (FTP Sync Service - runs continuously)
```php
<?php
// Continuous service that syncs to GoDaddy every 2 minutes
set_time_limit(0);
ini_set('max_execution_time', 0);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/SyncManager.php';

// Log startup
error_log("DicomViewer FTP Sync Service started");

while (true) {
    try {
        $mysqli = getDbConnection();
        $syncManager = new SyncManager($mysqli);

        // Check if auto-sync is enabled
        $config = $syncManager->getConfig();

        if ($config['auto_sync_enabled']) {
            echo "[" . date('Y-m-d H:i:s') . "] Starting FTP sync...\n";

            // Sync to GoDaddy via FTP
            $result = $syncManager->syncNow('godaddy');

            echo "[" . date('Y-m-d H:i:s') . "] Synced {$result['files_synced']} files ({$result['total_size_mb']} MB)\n";
        } else {
            echo "[" . date('Y-m-d H:i:s') . "] Auto-sync is disabled\n";
        }

        $mysqli->close();

    } catch (Exception $e) {
        error_log("FTP Sync failed: " . $e->getMessage());
        echo "[" . date('Y-m-d H:i:s') . "] ERROR: " . $e->getMessage() . "\n";
    }

    // Wait 2 minutes before next sync
    sleep(120);
}
?>
```

**File**: `/api/sync/monitor-service.php` (Hospital Data Monitor - runs continuously)
```php
<?php
// Continuous service that monitors hospital directory every 30 seconds
set_time_limit(0);
ini_set('max_execution_time', 0);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/HospitalDataImporter.php';

error_log("DicomViewer Data Monitor Service started");

while (true) {
    try {
        $mysqli = getDbConnection();
        $importer = new HospitalDataImporter($mysqli);

        // Get monitoring configuration
        $stmt = $mysqli->prepare("SELECT hospital_data_path, monitoring_enabled FROM sync_configuration WHERE id = 1");
        $stmt->execute();
        $result = $stmt->get_result();
        $config = $result->fetch_assoc();
        $stmt->close();

        if ($config && $config['monitoring_enabled']) {
            echo "[" . date('Y-m-d H:i:s') . "] Scanning directory: {$config['hospital_data_path']}\n";

            $path = $config['hospital_data_path'];
            $newFiles = $importer->scanForNewFiles($path);

            if (count($newFiles) > 0) {
                echo "[" . date('Y-m-d H:i:s') . "] Found {count($newFiles)} new files, starting import...\n";

                $jobId = $importer->createImportJob();
                $result = $importer->batchImport($newFiles, $jobId);

                echo "[" . date('Y-m-d H:i:s') . "] Imported {$result['imported']} files\n";
            } else {
                echo "[" . date('Y-m-d H:i:s') . "] No new files found\n";
            }
        } else {
            echo "[" . date('Y-m-d H:i:s') . "] Monitoring is disabled\n";
        }

        $mysqli->close();

    } catch (Exception $e) {
        error_log("Data Monitor failed: " . $e->getMessage());
        echo "[" . date('Y-m-d H:i:s') . "] ERROR: " . $e->getMessage() . "\n";
    }

    // Wait 30 seconds before next check
    sleep(30);
}
?>
```

**File**: `/api/backup/backup-service.php` (Google Drive Backup - runs continuously, backs up at 2 AM)
```php
<?php
// Continuous service that performs daily backup at 2:00 AM
set_time_limit(0);
ini_set('max_execution_time', 0);

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/GoogleDriveBackup.php';

error_log("DicomViewer Google Drive Backup Service started");

$lastBackupDate = null;

while (true) {
    try {
        $currentDate = date('Y-m-d');
        $currentTime = date('H:i');

        // Check if it's 2:00 AM and we haven't backed up today
        if ($currentTime >= '02:00' && $currentTime < '02:05' && $lastBackupDate !== $currentDate) {
            echo "[" . date('Y-m-d H:i:s') . "] Starting daily backup...\n";

            $mysqli = getDbConnection();
            $backupManager = new GoogleDriveBackup($mysqli);

            $config = $backupManager->getConfig();

            if ($config['auto_backup_enabled']) {
                $result = $backupManager->backupNow();

                echo "[" . date('Y-m-d H:i:s') . "] Backup completed: {$result['size_mb']} MB\n";

                $lastBackupDate = $currentDate;
            } else {
                echo "[" . date('Y-m-d H:i:s') . "] Auto-backup is disabled\n";
            }

            $mysqli->close();
        }

    } catch (Exception $e) {
        error_log("Backup failed: " . $e->getMessage());
        echo "[" . date('Y-m-d H:i:s') . "] ERROR: " . $e->getMessage() . "\n";
    }

    // Check every minute
    sleep(60);
}
?>
```

**Service Management**:

**View service status**:
```batch
REM Check if services are running
sc query DicomViewer_FTP_Sync
sc query DicomViewer_Data_Monitor
sc query DicomViewer_GDrive_Backup

REM Or use GUI
services.msc
```

**Start/Stop services**:
```batch
REM Stop a service
net stop DicomViewer_FTP_Sync

REM Start a service
net start DicomViewer_FTP_Sync

REM Restart a service
net stop DicomViewer_FTP_Sync && net start DicomViewer_FTP_Sync
```

**Remove services** (uninstall):
```batch
REM Stop and remove all services
nssm stop DicomViewer_FTP_Sync
nssm remove DicomViewer_FTP_Sync confirm

nssm stop DicomViewer_Data_Monitor
nssm remove DicomViewer_Data_Monitor confirm

nssm stop DicomViewer_GDrive_Backup
nssm remove DicomViewer_GDrive_Backup confirm
```

**View logs**:
```batch
REM Logs are written to project logs directory
type c:\xampp\htdocs\dicom_viewer_v2\logs\sync-service.log
type c:\xampp\htdocs\dicom_viewer_v2\logs\monitor-service.log
type c:\xampp\htdocs\dicom_viewer_v2\logs\backup-service.log
```

**Troubleshooting**:

1. **Service not starting?**
   - Open Services: `services.msc`
   - Right-click service → Properties
   - Check "Log On" tab (should be "Local System")
   - Check "Recovery" tab (should restart on failure)
   - View service event logs in Windows Event Viewer

2. **Service keeps restarting?**
   - Check error log: `logs\*-service-error.log`
   - Verify PHP path is correct
   - Verify database connection works
   - Check file permissions

3. **NSSM not found?**
   - Download from: https://nssm.cc/download
   - Extract `win64\nssm.exe` to project `/scripts/` folder
   - Re-run `setup-nssm-services.bat`

4. **Permission denied errors?**
   - Run `setup-nssm-services.bat` as Administrator
   - Services need elevated privileges to access files/network

**Linux/cPanel Alternative** (if deploying on Linux server):

**File**: `/scripts/setup-cron.sh`
```bash
#!/bin/bash
# Cron jobs for Linux/cPanel hosting

# Add to crontab: crontab -e

# FTP Sync (every 2 minutes)
*/2 * * * * /usr/bin/php /path/to/dicom_viewer/api/sync/sync-now.php >> /path/to/logs/sync.log 2>&1

# Hospital Data Monitor (every 1 minute)
* * * * * /usr/bin/php /path/to/dicom_viewer/api/sync/monitor-hospital-data.php >> /path/to/logs/monitor.log 2>&1

# Google Drive Backup (daily at 2:00 AM)
0 2 * * * /usr/bin/php /path/to/dicom_viewer/api/backup/backup-now.php >> /path/to/logs/backup.log 2>&1
```

### 6. Real-time Monitoring Dashboard

Add to main dashboard showing:
- Last sync time and status
- Files synced count
- Last backup time
- Backup size and count
- Quick action buttons (Sync Now, Backup Now)

---

## Deployment Strategies

### Option 1: XAMPP (Development/Testing)

**Setup Steps**:
1. Install XAMPP
2. Install Orthanc with DICOMweb plugin
3. Copy project to `htdocs/dicom_viewer_v2/`
4. Import SQL schema
5. Configure `.env` file
6. Build React frontend: `npm run build`
7. Access: `http://localhost/dicom_viewer_v2/`

**File Structure**:
```
c:\xampp\htdocs\dicom_viewer_v2\
├── api/               # PHP backend
├── frontend/          # React source
├── dist/              # Built React app (served by Apache)
├── config/
│   └── .env          # Environment variables
└── setup/
    └── schema.sql    # Database schema
```

### Option 2: Docker Compose (OPTIONAL - Step-by-Step Beginner Guide)

**What is Docker?**
Docker is a tool that packages your application and all its dependencies into "containers" so it works the same everywhere (your laptop, server, cloud).

**Why use Docker?**
- ✅ No manual installation of PHP, MySQL, Orthanc
- ✅ Works on Windows, Mac, Linux the same way
- ✅ Easy to deploy to cloud servers
- ✅ Isolated environment (doesn't mess with your system)

---

#### **Step 1: Install Docker** (One-time setup)

**For Windows:**
1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Run the installer (`Docker Desktop Installer.exe`)
3. Follow the installation wizard (accept defaults)
4. Restart your computer when prompted
5. After restart, Docker Desktop will start automatically
6. You'll see a whale icon in your system tray (bottom-right)

**Verify installation:**
Open Command Prompt and run:
```bash
docker --version
```
You should see something like: `Docker version 24.0.7`

Also check Docker Compose:
```bash
docker-compose --version
```
You should see: `Docker Compose version v2.23.3`

---

#### **Step 2: Understand Docker Compose File**

Create a file called `docker-compose.yml` in your project folder:

```yaml
version: '3.8'

services:
  # Service 1: Orthanc DICOM Server
  orthanc:
    image: orthancteam/orthanc:latest    # Download Orthanc image from Docker Hub
    ports:
      - "8042:8042"                      # Map port 8042 (Orthanc web interface)
      - "4242:4242"                      # Map port 4242 (DICOM protocol)
    volumes:
      - orthanc-data:/var/lib/orthanc/db # Persist Orthanc database
      - ./orthanc-config:/etc/orthanc    # Custom Orthanc config
    environment:
      - ORTHANC_USERNAME=orthanc         # Default username
      - ORTHANC_PASSWORD=orthanc         # Default password

  # Service 2: MySQL Database
  mysql:
    image: mysql:8.0                     # Download MySQL 8.0 image
    environment:
      - MYSQL_ROOT_PASSWORD=root         # Root password
      - MYSQL_DATABASE=dicom_viewer_v2_production  # Create this database
    volumes:
      - mysql-data:/var/lib/mysql        # Persist MySQL data
      - ./setup/schema.sql:/docker-entrypoint-initdb.d/schema.sql  # Auto-import schema
    ports:
      - "3306:3306"                      # Map MySQL port

  # Service 3: PHP API (Apache + PHP)
  php-api:
    build: ./api                         # Build from Dockerfile in ./api folder
    ports:
      - "8080:80"                        # Map port 8080 (API endpoint)
    volumes:
      - ./api:/var/www/html              # Mount your PHP code
      - ./config:/var/www/html/config    # Mount config files
    environment:
      - DB_HOST=mysql                    # Connect to mysql service
      - DB_USER=root
      - DB_PASSWORD=root
      - DB_NAME=dicom_viewer_v2_production
      - ORTHANC_URL=http://orthanc:8042  # Connect to orthanc service
    depends_on:
      - mysql                            # Wait for MySQL to start
      - orthanc                          # Wait for Orthanc to start

  # Service 4: Frontend (Nginx serving static files)
  frontend:
    image: nginx:alpine                  # Use lightweight Nginx image
    ports:
      - "3000:80"                        # Map port 3000 (main website)
    volumes:
      - ./public_html:/usr/share/nginx/html  # Mount your HTML/JS files
      - ./nginx.conf:/etc/nginx/conf.d/default.conf  # Custom Nginx config

# Named volumes (Docker manages these)
volumes:
  orthanc-data:                          # Stores Orthanc DICOM files
  mysql-data:                            # Stores MySQL database
```

---

#### **Step 3: Create Required Files**

**3.1 Create Dockerfile for PHP API**

Create file: `api/Dockerfile`
```dockerfile
# Use official PHP image with Apache
FROM php:8.2-apache

# Install PHP extensions needed for MySQL
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Install additional tools
RUN apt-get update && apt-get install -y \
    libzip-dev \
    zip \
    unzip \
    curl

# Install Composer (PHP package manager)
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set working directory
WORKDIR /var/www/html

# Copy your PHP files
COPY . /var/www/html/

# Install PHP dependencies
RUN composer install --no-dev

# Set permissions
RUN chown -R www-data:www-data /var/www/html
```

**3.2 Create Nginx config**

Create file: `nginx.conf`
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html index.php;

    # Handle PHP files (proxy to PHP-API container)
    location ~ \.php$ {
        proxy_pass http://php-api:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API routes
    location /api/ {
        proxy_pass http://php-api:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**3.3 Create Orthanc config**

Create folder: `orthanc-config/`
Create file: `orthanc-config/orthanc.json`
```json
{
  "Name": "DICOM Viewer Orthanc",
  "HttpPort": 8042,
  "DicomPort": 4242,
  "RemoteAccessAllowed": true,
  "AuthenticationEnabled": true,
  "RegisteredUsers": {
    "orthanc": "orthanc"
  },
  "Plugins": ["/usr/share/orthanc/plugins"]
}
```

---

#### **Step 4: Start Docker Containers**

Open Command Prompt or PowerShell in your project folder (where `docker-compose.yml` is):

**Start all services:**
```bash
docker-compose up -d
```

**What this does:**
- `-d` means "detached" (runs in background)
- Downloads all required images (first time only, takes 5-10 minutes)
- Creates and starts 4 containers: Orthanc, MySQL, PHP-API, Frontend
- Creates 2 volumes for data persistence

**Check if containers are running:**
```bash
docker-compose ps
```

You should see:
```
NAME                  STATUS          PORTS
orthanc               Up 2 minutes    0.0.0.0:4242->4242/tcp, 0.0.0.0:8042->8042/tcp
mysql                 Up 2 minutes    0.0.0.0:3306->3306/tcp
php-api               Up 2 minutes    0.0.0.0:8080->80/tcp
frontend              Up 2 minutes    0.0.0.0:3000->80/tcp
```

---

#### **Step 5: Access Your Application**

Open your browser and visit:

1. **Main Application**: http://localhost:3000
2. **Orthanc Explorer**: http://localhost:8042 (username: `orthanc`, password: `orthanc`)
3. **API Endpoint**: http://localhost:8080/api/

---

#### **Step 6: Common Docker Commands**

**View logs** (see what's happening):
```bash
docker-compose logs -f                 # All services
docker-compose logs -f orthanc         # Just Orthanc
docker-compose logs -f mysql           # Just MySQL
docker-compose logs -f php-api         # Just PHP
```

**Stop all containers:**
```bash
docker-compose down
```

**Stop and remove all data** (clean slate):
```bash
docker-compose down -v
```

**Restart a single service:**
```bash
docker-compose restart php-api
```

**Rebuild after code changes:**
```bash
docker-compose up -d --build
```

**Enter a container** (for debugging):
```bash
docker exec -it <container-name> bash
# Example:
docker exec -it php-api bash
```

**Check container resource usage:**
```bash
docker stats
```

---

#### **Step 7: Troubleshooting**

**Problem**: Port already in use (e.g., "port 3306 is already allocated")
**Solution**: Change ports in `docker-compose.yml`:
```yaml
ports:
  - "3307:3306"  # Use 3307 instead of 3306
```

**Problem**: Container keeps restarting
**Solution**: Check logs:
```bash
docker-compose logs <service-name>
```

**Problem**: Can't access from browser
**Solution**:
1. Make sure Docker Desktop is running
2. Check containers are up: `docker-compose ps`
3. Check Windows Firewall isn't blocking ports
4. Try: `http://127.0.0.1:3000` instead of `localhost`

**Problem**: MySQL connection refused
**Solution**: Wait 30-60 seconds after `docker-compose up` for MySQL to fully start

---

#### **Step 8: Deploying to Production Server**

**On your server** (Linux, VPS, Cloud):
1. Install Docker: `curl -fsSL https://get.docker.com | sh`
2. Install Docker Compose: `sudo apt install docker-compose`
3. Upload your project files via FTP/SCP
4. Run: `docker-compose up -d`
5. Set up nginx reverse proxy (optional, for HTTPS)

---

#### **Step 9: Backup Docker Volumes**

**Backup MySQL data:**
```bash
docker exec mysql mysqldump -u root -proot dicom_viewer_v2_production > backup.sql
```

**Backup Orthanc data:**
```bash
docker run --rm -v orthanc-data:/data -v $(pwd):/backup ubuntu tar czf /backup/orthanc-backup.tar.gz /data
```

**Restore MySQL:**
```bash
docker exec -i mysql mysql -u root -proot dicom_viewer_v2_production < backup.sql
```

---

**Summary: Docker in 3 Commands**
```bash
# 1. Start everything
docker-compose up -d

# 2. Check status
docker-compose ps

# 3. View logs
docker-compose logs -f
```

**That's it!** Your DICOM viewer is now running in Docker containers. 🎉

### Option 3: cPanel (Traditional Hosting)

**Requirements**:
- cPanel with PHP 8.2+
- MySQL database
- SSH access (recommended)
- Node.js (for building frontend)

**Setup**:
1. Build React frontend locally: `npm run build`
2. Upload `dist/` contents to `public_html/`
3. Upload `api/` to `public_html/api/`
4. Create MySQL database via cPanel
5. Import `schema.sql`
6. Configure `.env` in cPanel file manager
7. Set up Orthanc on separate VPS (Orthanc needs SSH/root access)
8. Point API to Orthanc VPS URL

---

## Performance Optimizations

### 1. **Lazy Loading**
```javascript
// Load studies on scroll
const StudyList = () => {
  const [studies, setStudies] = useState([]);
  const [page, setPage] = useState(1);

  const loadMore = useInfiniteScroll(() => {
    fetchStudies(page).then(newStudies => {
      setStudies([...studies, ...newStudies]);
      setPage(page + 1);
    });
  });

  return <div ref={loadMore}>...</div>;
};
```

### 2. **Web Workers for MPR**
```javascript
// mprWorker.js
self.addEventListener('message', (e) => {
  const { volumeData, slicePlane } = e.data;

  // Heavy MPR calculation in worker
  const sliceData = calculateMPRSlice(volumeData, slicePlane);

  self.postMessage({ sliceData });
});

// Main thread
const mprWorker = new Worker('mprWorker.js');
mprWorker.postMessage({ volumeData, slicePlane });
mprWorker.onmessage = (e) => {
  renderSlice(e.data.sliceData);
};
```

### 3. **IndexedDB Caching**
```javascript
// services/cacheService.ts
class CacheService {
  async cacheStudy(studyUID, data) {
    const db = await openDB('dicom-cache');
    await db.put('studies', data, studyUID);
  }

  async getStudy(studyUID) {
    const db = await openDB('dicom-cache');
    return db.get('studies', studyUID);
  }
}
```

### 4. **Service Worker (PWA)**
```javascript
// service-worker.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/dicom-web/')) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          return caches.open('dicom-cache').then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});
```

---

## Migration Path from Current System

### Phase 1: Setup New Environment
1. Install Orthanc with DICOMweb plugin
2. Create new MySQL database with simplified schema
3. Migrate users table data
4. Migrate medical_reports from JSON files to database

### Phase 2: Backend API
1. Build DICOMweb proxy endpoints
2. Implement JWT authentication
3. Migrate report endpoints
4. Add audit logging

### Phase 3: Frontend
1. Set up React + Vite project
2. Integrate Cornerstone3D
3. Build patient/study list with DICOMweb queries
4. Build viewer with MPR
5. Migrate reporting UI

### Phase 4: Testing
1. Compare study lists (old DB vs DICOMweb)
2. Test all measurement tools
3. Test report creation/editing
4. Performance testing with large studies
5. Mobile testing

### Phase 5: Deployment
1. Deploy to staging environment
2. User acceptance testing
3. Deploy to production (parallel run)
4. Decommission old sync scripts

---

## Security Considerations

1. **HTTPS Only** - Enforce SSL in production
2. **JWT Expiry** - Short-lived tokens (8 hours), refresh mechanism
3. **CORS** - Strict origin validation
4. **Input Validation** - Sanitize all user inputs
5. **SQL Injection Prevention** - Prepared statements only
6. **XSS Prevention** - React auto-escapes, but validate HTML reports
7. **HIPAA Compliance**:
   - Audit all access to patient data
   - Encrypt data at rest and in transit
   - Role-based access control
   - Session timeout (15 min idle)
8. **Rate Limiting** - Prevent brute-force attacks
9. **Orthanc Security**:
   - Change default credentials
   - Use strong passwords
   - Firewall rules (only allow API access)

---

## Success Metrics

### Functionality
- ✅ All existing features working
- ✅ No database sync scripts needed
- ✅ Real-time study updates
- ✅ All measurement tools working
- ✅ Report templates working
- ✅ Mobile responsive

### Performance
- ✅ Study list loads < 2 seconds
- ✅ First image display < 3 seconds
- ✅ MPR reconstruction < 5 seconds
- ✅ Supports 500+ image studies

### Deployment
- ✅ Single-command setup (Docker)
- ✅ Works on localhost (XAMPP)
- ✅ Works on cPanel hosting
- ✅ Environment-based configuration

### Security
- ✅ JWT authentication
- ✅ Role-based access
- ✅ Audit logging
- ✅ HTTPS enforced

---

## Conclusion

This improved architecture eliminates the database synchronization pain point by leveraging Orthanc's built-in DICOMweb APIs, while maintaining all existing functionality and adding modern best practices for performance, security, and deployment.

**Key Benefits**:
- **Zero sync scripts** - real-time data from Orthanc
- **Simpler database** - only application data, no DICOM metadata cache
- **Better performance** - progressive loading, caching, Web Workers
- **Modern stack** - React, Cornerstone3D, DICOMweb standard
- **Production-ready** - Docker, environment configs, audit logs
- **Easy deployment** - works on XAMPP, Docker, or cPanel

---

**Document Version**: 1.0
**Date**: 2025-11-19
**Author**: Architecture Team
