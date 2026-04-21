# 🏥 Hospital DICOM Viewer Pro - Desktop Edition

**Standalone Offline Desktop Application**

---

## Quick Start

### Prerequisites

1. **XAMPP** installed with MySQL service running
2. **Orthanc PACS Server** (optional, will auto-detect)
3. **PHP 8.0+** in system PATH

### First Time Setup

1. **Download Dependencies** (requires internet once):
   ```
   Double-click: download-dependencies.bat
   ```

2. **Start the Application**:
   ```
   Double-click: start.bat
   ```

3. **Login**:
   - URL: http://localhost:8080
   - Username: `admin`
   - Password: `admin123`

---

## Features

- ✅ **Works 100% Offline** - No internet required after initial setup
- ✅ **MySQLi Database** - Local data storage
- ✅ **Orthanc Integration** - Auto-detects and starts Orthanc
- ✅ **All Features Preserved** - Reports, backups, AI analysis
- ✅ **Debug Mode** - Enhanced logging for troubleshooting

---

## File Structure

```
desktop-version/
├── start.bat              # Main launcher (double-click to start)
├── stop.bat               # Stop the application
├── download-dependencies.bat  # Download CDN assets (run once)
├── config/
│   ├── .env               # Application configuration
│   └── orthanc.json       # Orthanc PACS configuration
├── data/
│   ├── logs/              # Debug logs
│   ├── backups/           # Local backups
│   └── orthanc/           # DICOM storage
└── www/                   # PHP application
    ├── index.php          # DICOM viewer
    ├── login.php          # Login page
    ├── api/               # REST APIs
    └── assets/vendor/     # Local JS/CSS libraries
```

---

## Troubleshooting

### "PHP not found"
Add PHP to your PATH:
```
setx PATH "%PATH%;C:\xampp\php"
```

### "MySQL not running"
Start MySQL from XAMPP Control Panel.

### "Database creation failed"
1. Open XAMPP Control Panel
2. Start MySQL service
3. Run start.bat again

### "Orthanc not found"
Install Orthanc from: https://orthanc-server.com/download.php

---

## Debug Logs

Logs are saved to: `data/logs/YYYY-MM-DD.log`

Access debug logs API: http://localhost:8080/api/debug-logs.php

---

## Offline Backup

Local backups are saved to: `data/backups/`

To enable automatic backups, configure in: Admin → Settings → Backup

---

## Support

For issues, check the debug logs first, then contact support.

