# Hospital DICOM Viewer Pro v2.0 - Complete Rebuild Prompt
## COPY THIS ENTIRE PROMPT AND PASTE INTO CLAUDE CODE

---

## ⚠️ IMPORTANT: READ BEFORE STARTING

**What this prompt does:**
- Creates a complete DICOM medical imaging viewer
- Keeps your EXISTING tech stack (Vanilla JS + Cornerstone 2.x + Bootstrap 5)
- Eliminates database syncing (queries Orthanc directly via DICOMweb)
- Adds automated directory sync UI (sync to localhost & GoDaddy)
- Adds Google Drive automated backups
- Creates fresh database (`dicom_viewer_v2_production`)
- All features working perfectly

**Time estimate:** 30-60 minutes for Claude to generate all code

---

## START OF PROMPT

I need you to build **Hospital DICOM Viewer Pro v2.0** - a complete web-based medical imaging system that works independently without manual database synchronization, includes automated file syncing, and production-level Google Drive backups.

---

## CRITICAL REQUIREMENTS

### 1. KEEP CURRENT TECH STACK (DO NOT CHANGE)

**Backend:**
- PHP 8.2+ (vanilla PHP, no frameworks)
- **MySQLi** (NOT PDO - use MySQLi for all database operations)
- MySQL 8.0+ (new database: `dicom_viewer_v2_production`)
- **Session-based authentication** (keep existing session.php approach, NO JWT)
- Composer for PHP dependencies (Google Drive API only)

**Frontend:**
- **Vanilla JavaScript ES6+** (NO React, NO TypeScript, NO Vue)
- **Bootstrap 5.3.3** (existing UI framework)
- **Cornerstone Core 2.x** (current version, NOT Cornerstone3D)
- **Cornerstone WADO Image Loader** (existing)
- **Cornerstone Tools** (existing measurements)
- **DICOM Parser** (existing)
- **Hammer.js** (existing touch support)
- **NO build tools** (no Webpack, no Vite, no npm build step for frontend)

**File Structure:**
- Keep existing `/js/` component structure
- Keep existing `/api/`, `/auth/`, `/includes/` structure
- Add new `/admin/` folder for sync/backup UI

---

## 2. CORE FUNCTIONALITY (ALL MUST WORK)

### Patient/Study Management
- Patient list with advanced filtering (name, ID, date range, modality, sex)
- Study list for each patient
- **Real-time data from Orthanc via DICOMweb** (NO manual database sync)
- Pagination and search
- Auto-load study via URL: `?studyUID=XXXXX`

### DICOM Viewer
- Multi-layout: 1x1, 2x1, 2x2 viewports
- MPR (Multi-Planar Reconstruction): Axial, Sagittal, Coronal
- Synchronized crosshairs and reference lines
- Series navigation with slider
- Cine mode (play/pause) with FPS control

### Image Enhancement
- Window/Level (W/L) adjustment with sliders
- Presets: Lung, Abdomen, Brain, Bone, Default
- Auto W/L
- Invert, flip, rotate, zoom, pan
- Reset view

### Measurement Tools
- Length, angle, ROI (free-hand, elliptical, rectangle), probe
- Save measurements to database
- Load saved measurements

### Medical Reporting
- Templates: CT Head, CT Chest, CT Abdomen, MRI Brain, X-Ray Chest
- Sections: Indication, Technique, Findings, Impression
- Auto-save to **DATABASE** (NOT file system)
- Version history
- Reporting physician assignment

### Clinical Notes
- Per-series/per-image notes
- Clinical history
- Save to database

### Authentication
- Login/logout with existing session system
- Roles: admin, radiologist, technician, viewer
- Session management (keep existing approach)
- Bcrypt password hashing

### Mobile Support
- Fully responsive (Bootstrap 5)
- Touch gestures (Hammer.js)
- Mobile-optimized UI

### Export & Print
- Export PNG, PDF
- Print functionality

---

## 3. NEW FEATURES (CRITICAL)

### A. Hospital Existing Data Directory Import

**IMPORTANT**: This feature allows the hospital to configure the path where they ALREADY have existing DICOM data stored, so the system can import all existing files and continuously monitor for new ones.

**Admin UI** (`/admin/data-import.php`):
```
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

**Features:**
- **Folder browser UI** (Bootstrap modal) to browse and select directory
- Scan directory for DICOM files (checks DICM header for files without extension)
- Display scan results (file count, total size, patient/study/series counts)
- **One-time initial import** of all existing DICOM files to Orthanc
- Real-time progress bar showing import status
- **Continuous monitoring** - checks directory every 30 seconds for new files
- Auto-import new files when detected
- Track import history in database

**Implementation Requirements:**
- JavaScript class: `/js/components/folder-browser.js`
  - Bootstrap 5 modal for directory selection
  - Breadcrumb navigation
  - Directory listing (show folders only)
  - "Select Current Folder" button
- PHP class: `/api/sync/HospitalDataImporter.php` (using MySQLi)
  - `scanDirectory($path)` - recursively scan for DICOM files
  - `isDicomFile($filepath)` - check DICM header
  - `importFileToOrthanc($filepath)` - POST to Orthanc `/instances`
  - `batchImport($files, $jobId)` - import with progress tracking
  - `scanForNewFiles($path)` - check for files not in import_history
- Database tables (add to schema):
  - `import_jobs` - track import job progress
  - `import_history` - log each imported file
  - Update `sync_configuration` table to add `hospital_data_path` and `monitoring_enabled` columns
- NSSM Windows Service: Continuous monitoring service (checks every 30 seconds)

### B. Automated Directory Sync System

**Admin UI** (`/admin/sync-config.php`):
```
┌─────────────────────────────────────────────────────────────┐
│  Automated Sync Configuration                               │
├─────────────────────────────────────────────────────────────┤
│  Orthanc Storage Path:                                      │
│  [C:\Orthanc\OrthancStorage\          ] [Browse]  [Test]    │
│                                                             │
│  Auto-Sync Settings:                                        │
│  ☑ Enable automatic synchronization                         │
│  Sync Interval: [5] minutes                                 │
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
```

**Features:**
- Configure Orthanc storage directory path (with folder browser)
- Enable/disable auto-sync
- Set sync interval (1-60 minutes)
- Sync to localhost AND GoDaddy simultaneously
- FTP upload to GoDaddy cPanel
- Test connection button
- Manual "Sync Now" button
- Display sync status and history

**Implementation:**
- PHP class: `/api/sync/SyncManager.php`
- Scan Orthanc directory for DICOM files
- Detect new files automatically
- Upload to GoDaddy via FTP
- Track sync history in database
- NSSM Windows Service integration (install 3 continuous-running services)

### B. Google Drive Backup System

**Admin UI** (`/admin/backup-config.php`):
```
┌─────────────────────────────────────────────────────────────┐
│  Google Drive Backup Configuration                          │
├─────────────────────────────────────────────────────────────┤
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
│                                                             │
│  Retention: Keep backups for [30] days                      │
│                                                             │
│  [Save Configuration]  [Test Connection]  [Backup Now]      │
│                                                             │
│  Last Backup: 2025-11-19 02:00:12 AM                        │
│  Size: 450 MB                                                │
│                                                             │
│  Recent Backups:                                            │
│  • 2025-11-19_backup.zip (450 MB) [Restore] [Download]      │
│  • 2025-11-18_backup.zip (448 MB) [Restore] [Download]      │
│  • 2025-11-17_backup.zip (445 MB) [Restore] [Download]      │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Configure Google Drive API credentials
- Set backup schedule (daily/weekly/monthly)
- Select backup contents (database, PHP, JS, config)
- Set retention policy (days to keep backups)
- Manual "Backup Now" button
- List existing backups
- Restore from backup (one-click)
- Download backup locally
- Auto-delete old backups (retention)

**Implementation:**
- PHP class: `/api/backup/GoogleDriveBackup.php`
- Use Google Drive API PHP library (`composer require google/apiclient`)
- Backup database (mysqldump)
- Backup all PHP, JS, config files
- Create ZIP archive
- Upload to Google Drive
- Track backup history
- Restore functionality
- Scheduled task integration

---

## 4. DATABASE SCHEMA

**Database Name:** `dicom_viewer_v2_production`

**IMPORTANT:** Use the SQL file at `/setup/schema_v2_production.sql`

**Tables:**
1. `users` - User authentication
2. `sessions` - Session management
3. `medical_reports` - Reports (in database, NOT files)
4. `report_versions` - Report version history
5. `measurements` - Image measurements
6. `clinical_notes` - Clinical notes
7. `prescriptions` - Prescriptions
8. `user_preferences` - User settings
9. `audit_logs` - HIPAA compliance
10. **NEW:** `sync_configuration` - Sync settings
11. **NEW:** `sync_history` - Sync tracking
12. **NEW:** `gdrive_backup_config` - Backup settings
13. **NEW:** `backup_history` - Backup tracking

**REMOVED TABLES (from old system):**
- `cached_patients` - NO LONGER NEEDED (query Orthanc)
- `cached_studies` - NO LONGER NEEDED (query Orthanc)
- `dicom_instances` - NO LONGER NEEDED (Orthanc handles this)

---

## 5. API ENDPOINTS TO BUILD

### Authentication (`/auth/`)
```
POST   /auth/login.php          - Login (returns session token)
POST   /auth/logout.php         - Logout
GET    /auth/check_session.php  - Validate session
```

### DICOMweb Proxy (`/api/dicomweb/`) - QUERIES ORTHANC DIRECTLY
```
GET    /api/dicomweb/studies.php
       ?PatientName=John*&StudyDate=20250101-&Modality=CT&limit=50&offset=0
       → Proxies to Orthanc QIDO-RS: /dicom-web/studies

GET    /api/dicomweb/study-metadata.php?studyUID={uid}
       → Get full study metadata

GET    /api/dicomweb/series.php?studyUID={uid}
       → Get series list

GET    /api/dicomweb/instances.php?studyUID={uid}&seriesUID={uid}
       → Get instances

GET    /api/dicomweb/instance-file.php?instanceUID={uid}
       → Proxy DICOM file (WADO-RS)
```

### Medical Reports (`/api/reports/`)
```
POST   /api/reports/create.php   - Create report (save to database)
GET    /api/reports/get.php?id={id}
PUT    /api/reports/update.php
DELETE /api/reports/delete.php?id={id}
GET    /api/reports/by-study.php?studyUID={uid}
GET    /api/reports/versions.php?reportId={id}
```

### Measurements (`/api/measurements/`)
```
POST   /api/measurements/create.php
GET    /api/measurements/by-series.php?seriesUID={uid}
DELETE /api/measurements/delete.php?id={id}
```

### Clinical Notes (`/api/notes/`)
```
POST   /api/notes/create.php
GET    /api/notes/by-study.php?studyUID={uid}
PUT    /api/notes/update.php
DELETE /api/notes/delete.php?id={id}
```

### **NEW:** Automated Sync (`/api/sync/`)
```
POST   /api/sync/configure-path.php    - Set Orthanc storage path
GET    /api/sync/get-config.php        - Get current config
POST   /api/sync/sync-now.php          - Trigger immediate sync
GET    /api/sync/status.php            - Get last sync status
POST   /api/sync/enable-auto.php       - Enable auto-sync
POST   /api/sync/disable-auto.php      - Disable auto-sync
POST   /api/sync/test-connection.php   - Test GoDaddy FTP
```

### **NEW:** Google Drive Backup (`/api/backup/`)
```
POST   /api/backup/configure-gdrive.php  - Save Google Drive credentials
POST   /api/backup/backup-now.php        - Trigger immediate backup
GET    /api/backup/list-backups.php      - List all backups
POST   /api/backup/restore.php           - Restore from backup
GET    /api/backup/status.php            - Get last backup status
POST   /api/backup/schedule.php          - Set backup schedule
POST   /api/backup/test-connection.php   - Test Google Drive API
```

---

## 6. FRONTEND STRUCTURE (VANILLA JAVASCRIPT)

**Keep existing structure, add new components:**

```
js/
├── main.js                          # KEEP (initialization)
├── studies.js                       # KEEP (patient/study list)
├── orthanc-autoload.js              # KEEP (auto-load studies)
├── managers/
│   ├── viewport-manager.js          # KEEP
│   ├── mpr-manager.js               # KEEP
│   ├── enhancement-manager.js       # KEEP
│   ├── crosshair-manager.js         # KEEP
│   └── reference-lines-manager.js   # KEEP
├── components/
│   ├── upload-handler.js            # KEEP
│   ├── ui-controls.js               # KEEP
│   ├── event-handlers.js            # KEEP
│   ├── medical-notes.js             # KEEP
│   ├── reporting-system.js          # KEEP
│   ├── mouse-controls.js            # KEEP
│   ├── export-manager.js            # KEEP
│   ├── print-manager.js             # KEEP
│   ├── settings-manager.js          # KEEP
│   ├── mobile-controls.js           # KEEP
│   ├── layout-toggle.js             # KEEP
│   ├── sync-manager.js              # NEW - Auto-sync UI
│   └── backup-manager.js            # NEW - Backup UI
└── utils/
    ├── cornerstone-init.js          # KEEP
    └── constants.js                 # KEEP
```

**NEW JavaScript components to create:**

`js/components/sync-manager.js`:
```javascript
class SyncManager {
    constructor() {
        this.config = null;
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupUI();
        this.startStatusPolling();
    }

    async loadConfig() {
        const response = await fetch('/api/sync/get-config.php');
        this.config = await response.json();
    }

    setupUI() {
        // Create sync status widget in dashboard
        const widget = `
            <div class="sync-status-widget">
                <h5>Auto-Sync Status</h5>
                <p>Last Sync: <span id="last-sync-time">--</span></p>
                <p>Files Synced: <span id="files-synced">--</span></p>
                <button onclick="syncNow()" class="btn btn-primary btn-sm">
                    Sync Now
                </button>
            </div>
        `;
        document.getElementById('dashboard-widgets').insertAdjacentHTML('beforeend', widget);
    }

    async syncNow() {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Syncing...';

        try {
            const response = await fetch('/api/sync/sync-now.php', {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                alert(`Synced ${result.files_synced} files (${result.total_size_mb} MB)`);
                this.updateStatus();
            }
        } catch (error) {
            alert('Sync failed: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sync Now';
        }
    }

    async updateStatus() {
        const response = await fetch('/api/sync/status.php');
        const status = await response.json();

        document.getElementById('last-sync-time').textContent = status.last_sync;
        document.getElementById('files-synced').textContent = status.files_count;
    }

    startStatusPolling() {
        setInterval(() => this.updateStatus(), 60000); // Every minute
    }
}

// Initialize on page load
window.syncManager = new SyncManager();
```

`js/components/backup-manager.js`:
```javascript
class BackupManager {
    constructor() {
        this.config = null;
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupUI();
        this.loadBackupsList();
    }

    async loadConfig() {
        const response = await fetch('/api/backup/status.php');
        this.config = await response.json();
    }

    setupUI() {
        const widget = `
            <div class="backup-status-widget">
                <h5>Google Drive Backup</h5>
                <p>Last Backup: <span id="last-backup-time">--</span></p>
                <p>Size: <span id="backup-size">--</span></p>
                <button onclick="backupNow()" class="btn btn-success btn-sm">
                    Backup Now
                </button>
            </div>
        `;
        document.getElementById('dashboard-widgets').insertAdjacentHTML('beforeend', widget);
    }

    async backupNow() {
        const btn = event.target;
        btn.disabled = true;
        btn.textContent = 'Backing up...';

        try {
            const response = await fetch('/api/backup/backup-now.php', {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                alert(`Backup completed: ${result.size_mb} MB`);
                this.loadBackupsList();
            }
        } catch (error) {
            alert('Backup failed: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Backup Now';
        }
    }

    async loadBackupsList() {
        const response = await fetch('/api/backup/list-backups.php');
        const backups = await response.json();

        // Update UI with backups list
        // ...
    }

    async restoreBackup(backupId) {
        if (!confirm('Are you sure you want to restore from this backup? Current data will be replaced.')) {
            return;
        }

        const response = await fetch('/api/backup/restore.php', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({backup_id: backupId})
        });

        const result = await response.json();
        if (result.success) {
            alert('Restore completed successfully. Please refresh the page.');
            location.reload();
        }
    }
}

// Initialize
window.backupManager = new BackupManager();
```

---

## 7. CONFIGURATION FILES

### `/config/.env`
```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=dicom_viewer_v2_production

# Orthanc
ORTHANC_URL=http://localhost:8042
ORTHANC_USERNAME=orthanc
ORTHANC_PASSWORD=orthanc
ORTHANC_DICOMWEB_ROOT=/dicom-web

# Session
SESSION_LIFETIME=28800
SESSION_SECURE=false

# Environment
APP_ENV=development
APP_URL=http://localhost
APP_NAME=Hospital DICOM Viewer Pro v2.0

# Google Drive API (leave blank initially)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost/api/backup/oauth-callback.php
```

### `/composer.json`
```json
{
    "require": {
        "php": ">=8.2",
        "google/apiclient": "^2.15",
        "ext-mysqli": "*",
        "ext-pdo": "*",
        "ext-zip": "*",
        "ext-ftp": "*"
    }
}
```

---

## 8. ORTHANC CONFIGURATION

**Enable DICOMweb plugin** in Orthanc configuration file:

Create `/orthanc-config/orthanc.json`:
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
  "Plugins": [
    "/usr/share/orthanc/plugins"
  ],
  "DicomWeb": {
    "Enable": true,
    "Root": "/dicom-web/",
    "EnableWado": true,
    "WadoRoot": "/wado/",
    "Ssl": false,
    "QidoCaseSensitive": false
  }
}
```

---

## 9. DEPLOYMENT INSTRUCTIONS

### PRIMARY DEPLOYMENT: XAMPP + GoDaddy cPanel (Dual Environment)

**This is the recommended deployment strategy - works 100% free with existing domain and hosting!**

#### Step 1: XAMPP Setup (Localhost - Hospital PC)

1. Install XAMPP with PHP 8.2+
2. Install Orthanc with DICOMweb plugin
3. Copy project to `C:\xampp\htdocs\dicom_viewer_v2\`
4. Create database:
   ```bash
   mysql -u root -p
   source C:\xampp\htdocs\dicom_viewer_v2\setup\schema_v2_production.sql
   ```
5. Install PHP dependencies:
   ```bash
   cd C:\xampp\htdocs\dicom_viewer_v2
   composer install
   ```
6. Configure `.env` file (localhost settings)
7. Start XAMPP (Apache, MySQL)
8. Start Orthanc
9. Access: `http://localhost/dicom_viewer_v2/`

#### Step 2: Automated Sync Setup (Sync to GoDaddy)

1. Login as admin
2. Navigate to `/admin/sync-config.php`
3. Configure Orthanc storage path (use folder browser)
4. Enter GoDaddy FTP credentials:
   - Host: `ftp.your-domain.com`
   - Username: Your cPanel username
   - Password: Your cPanel password
   - Path: `/public_html/dicom_viewer/`
5. Enable auto-sync
6. Set sync interval: **2 minutes**
7. Click "Save Configuration"
8. Click "Test Connection" to verify
9. Download NSSM from https://nssm.cc/download and extract `win64\nssm.exe` to `scripts\` folder
10. Run setup script: Right-click `scripts/setup-nssm-services.bat` → "Run as Administrator"
11. Verify services installed: Open Services (`services.msc`) - look for "DICOM Viewer" services

#### Step 3: GoDaddy cPanel Setup (Production - Online Access)

1. **First-time setup** (database):
   - Login to cPanel
   - Create MySQL database: `dicom_viewer_v2_production`
   - Create MySQL user and grant all privileges
   - Note: Database name, username, password

2. **Upload files** (automated via FTP sync):
   - Files will auto-sync from XAMPP every 2 minutes
   - Or manually: Click "Sync Now" in sync config UI
   - Or upload manually via cPanel File Manager to `/public_html/dicom_viewer/`

3. **Import database** (one-time):
   - Export from localhost: `mysqldump -u root dicom_viewer_v2_production > database.sql`
   - cPanel → phpMyAdmin → Import `database.sql`

4. **Configure environment**:
   - Edit `/public_html/dicom_viewer/.env` in cPanel File Manager
   - Update database credentials (GoDaddy database info)
   - Update Orthanc URL to point to hospital PC public IP (e.g., `http://your-hospital-ip:8042`)
   - **Note**: You may need to configure port forwarding on hospital router for Orthanc port 8042

5. **Install Composer dependencies** (if SSH available):
   ```bash
   cd /home/username/public_html/dicom_viewer
   composer install
   ```

6. Access production site: `https://your-domain.com/dicom_viewer/`

#### Step 4: NSSM Windows Services (Automated Background Processing)

The setup script creates 3 Windows Services using NSSM:

1. **DicomViewer_FTP_Sync** - Continuous service that syncs files to GoDaddy every 2 minutes
2. **DicomViewer_Data_Monitor** - Continuous service that monitors hospital data directory (checks every 30 seconds)
3. **DicomViewer_GDrive_Backup** - Continuous service that performs daily backup to Google Drive at 2:00 AM

**Advantages of NSSM over Task Scheduler:**
- ✅ **Auto-restart on failure** - Services restart automatically if they crash
- ✅ **Auto-start on boot** - Services start when Windows starts
- ✅ **Better logging** - Captures all output to log files
- ✅ **Continuous running** - No scheduling gaps or delays
- ✅ **Service recovery** - Built-in Windows service management

**Verify services are running:**
```batch
REM Check service status
sc query DicomViewer_FTP_Sync
sc query DicomViewer_Data_Monitor
sc query DicomViewer_GDrive_Backup

REM Or open Services GUI
services.msc
```

**View service logs:**
```batch
REM Check logs for service output
type c:\xampp\htdocs\dicom_viewer_v2\logs\sync-service.log
type c:\xampp\htdocs\dicom_viewer_v2\logs\monitor-service.log
type c:\xampp\htdocs\dicom_viewer_v2\logs\backup-service.log
```

**Manual control:**
```batch
REM Stop a service
net stop DicomViewer_FTP_Sync

REM Start a service
net start DicomViewer_FTP_Sync

REM Restart a service
net stop DicomViewer_FTP_Sync && net start DicomViewer_FTP_Sync

REM Or use GUI
services.msc
```

#### Architecture Summary:
```
Hospital PC (XAMPP) ──────────> GoDaddy cPanel (Production)
│                     FTP Sync   │
│ - Orthanc Server    (2 min)    │ - PHP/MySQL
│ - XAMPP            via NSSM    │ - Doctors access online
│ - NSSM Services    Services    │ - Same code & database
│ - Technicians use              │
│   locally                      │
│                                │
└────────> Google Drive
           Daily Backup (2 AM via NSSM Service)

NSSM Services Running 24/7:
- DicomViewer_FTP_Sync (every 2 min)
- DicomViewer_Data_Monitor (every 30 sec)
- DicomViewer_GDrive_Backup (daily at 2 AM)
```

---

## 10. TESTING CHECKLIST

After implementation, verify:

**Authentication:**
- [ ] Login works
- [ ] Logout works
- [ ] Session validation works
- [ ] Role-based access works (admin, radiologist, etc.)

**Patient/Study List:**
- [ ] Patient list loads from Orthanc (no database sync needed)
- [ ] Filtering works (name, ID, date, modality)
- [ ] Pagination works
- [ ] Search works
- [ ] Studies display for selected patient

**DICOM Viewer:**
- [ ] Images load and render
- [ ] 1x1, 2x1, 2x2 layouts work
- [ ] MPR (Axial, Sagittal, Coronal) works
- [ ] Series navigation works
- [ ] Cine mode works

**Image Tools:**
- [ ] Window/Level adjustment works
- [ ] All W/L presets work (Lung, Abdomen, Brain, Bone)
- [ ] Zoom, pan, rotate, flip work
- [ ] All measurement tools work (length, angle, ROI)
- [ ] Measurements save to database
- [ ] Saved measurements load correctly

**Reporting:**
- [ ] Report creation works
- [ ] All templates work
- [ ] Reports save to database (NOT files)
- [ ] Version history works
- [ ] Report editing works
- [ ] Report loading works

**Clinical Notes:**
- [ ] Notes creation works
- [ ] Notes save to database
- [ ] Notes load correctly

**Automated Sync:**
- [ ] Sync config UI loads
- [ ] Can configure Orthanc storage path
- [ ] "Test Connection" button works
- [ ] Manual "Sync Now" works
- [ ] FTP upload to GoDaddy works
- [ ] Sync history displays correctly
- [ ] Auto-sync (scheduled task) works

**Google Drive Backup:**
- [ ] Backup config UI loads
- [ ] Can configure Google Drive API
- [ ] "Test Connection" works
- [ ] Manual "Backup Now" works
- [ ] Backup creates ZIP file
- [ ] Backup uploads to Google Drive
- [ ] Backup history displays
- [ ] Restore from backup works
- [ ] Auto-delete old backups works (retention)

**Mobile:**
- [ ] Responsive on tablet
- [ ] Responsive on phone
- [ ] Touch gestures work
- [ ] Mobile UI displays correctly

**Export:**
- [ ] Export to PNG works
- [ ] Export to PDF works
- [ ] Print works

**Performance:**
- [ ] Study list loads < 2 seconds
- [ ] First image displays < 3 seconds
- [ ] Handles 100+ image studies
- [ ] No console errors

---

## 11. SUCCESS CRITERIA

1. ✅ **Zero Database Sync** - Patient/study data comes directly from Orthanc
2. ✅ **All Features Work** - Every feature from requirements works perfectly
3. ✅ **Automated Sync** - Directory monitoring and FTP upload works
4. ✅ **Google Drive Backup** - Automated backups and restore works
5. ✅ **Works on Localhost** - XAMPP deployment successful
6. ✅ **Works on GoDaddy** - cPanel deployment successful
7. ✅ **No Manual Scripts** - Everything automated via UI
8. ✅ **Production-Ready** - Proper error handling, logging, security

---

## 12. IMPORTANT NOTES

- Use **Vanilla JavaScript ES6+** throughout (NO frameworks)
- Keep **existing Cornerstone 2.x** (NOT Cornerstone3D)
- Keep **Bootstrap 5.3.3** for UI
- Follow **existing file structure** in `/js/` folder
- Implement **proper error handling** in all API calls
- Add **loading states** for better UX
- Use **prepared statements** for all SQL queries
- Add **comprehensive logging** for debugging
- Implement **audit trail** in audit_logs table
- Use **bcrypt** for password hashing
- Store reports in **database**, NOT files
- Query Orthanc **directly**, NO database cache for patients/studies
- Make UI **fully responsive** (mobile-first)
- Add **keyboard shortcuts** for common actions
- Use **session-based auth** (NOT JWT - keep existing approach)

---

## 13. PHP CODING STANDARDS

- Use PDO or MySQLi with prepared statements
- Always validate and sanitize input
- Return JSON for all API endpoints
- Use proper HTTP status codes
- Log errors to `/logs/` directory
- Use environment variables from `.env`
- Follow PSR-4 autoloading (use Composer)
- Add PHPDoc comments to all functions

---

## 14. JAVASCRIPT CODING STANDARDS

- Use ES6+ syntax (const, let, arrow functions, async/await)
- Add JSDoc comments to classes and functions
- Handle errors with try/catch
- Use fetch API for AJAX (NOT jQuery.ajax)
- Keep existing Cornerstone initialization
- Follow existing component patterns
- Add event listeners properly (removeEventListener when needed)
- Use meaningful variable names

---

## 15. SECURITY CHECKLIST

- [ ] All SQL queries use prepared statements
- [ ] All user input is validated and sanitized
- [ ] Passwords are hashed with bcrypt
- [ ] Sessions have proper timeout
- [ ] CORS headers properly configured
- [ ] File uploads validated (size, type)
- [ ] SQL injection prevention
- [ ] XSS prevention (escape output)
- [ ] CSRF tokens on forms (optional but recommended)
- [ ] Sensitive data encrypted (FTP passwords, Google API secrets)
- [ ] Audit logging for all important actions
- [ ] Rate limiting on login attempts
- [ ] HTTPS enforced in production (via .htaccess)

---

## END OF PROMPT

---

## HOW TO USE THIS PROMPT

1. Copy everything between "START OF PROMPT" and "END OF PROMPT"
2. Open Claude Code
3. Create new project or navigate to your project folder
4. Paste the entire prompt
5. Claude will generate:
   - Complete PHP backend (all API endpoints)
   - Complete JavaScript frontend (vanilla JS with Bootstrap)
   - Database schema SQL file
   - Configuration files (.env, composer.json, etc.)
   - Orthanc configuration
   - Admin UI for sync and backup
   - Deployment instructions

6. Follow deployment steps for XAMPP or GoDaddy
7. Test using the checklist above

**Estimated Time:**
- Claude generation: 30-60 minutes
- Setup on XAMPP: 1-2 hours
- Testing: 2-4 hours
- Deployment to GoDaddy: 1-2 hours
- **Total: Ready in 1 day**

**Result:**
A fully functional, production-ready DICOM viewer with:
- Zero database syncing
- Automated file synchronization
- Google Drive backups
- All features working perfectly
- Works on localhost AND GoDaddy

---

**Document Version**: 2.0 Final
**Date**: 2025-11-19
**Ready to use**: ✅ YES - Copy and paste into Claude Code!
