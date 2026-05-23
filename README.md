# 🏥 One Clickz

<div align="center">

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)
![PHP](https://img.shields.io/badge/PHP-8.0%2B-777BB4?logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-4479A1?logo=mysql&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green.svg)

**A Professional Medical Imaging Platform for DICOM Studies**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Documentation](#-documentation) • [Support](#-support)

</div>

---

## 📋 Overview

Accurate DICOM Viewer Pro is a comprehensive web-based medical imaging platform designed for radiologists, doctors, and medical professionals. Built with modern web technologies, it provides powerful tools for viewing, analyzing, and managing DICOM medical images with enterprise-grade features.

### 🎯 Key Highlights

- **Zero-Installation Web Viewer** - Access from any modern browser
- **Orthanc PACS Integration** - Seamless connection to PACS servers
- **Advanced MPR Rendering** - Multi-planar reconstruction for 3D analysis
- **AI-Powered Analysis** - Integrated Google Gemini AI for preliminary findings
- **Professional Reporting** - Generate, edit, and print medical reports
- **Automatic Backups** - Google Drive integration for secure cloud backups
- **Multi-User System** - Role-based access control (Admin, Doctor, Viewer)
- **Mobile Responsive** - Touch-optimized interface for tablets and phones

---

## ✨ Features

### 🖼️ Image Viewing & Manipulation

- **Cornerstone.js Integration** - High-performance medical image rendering
- **Multi-Viewport Layouts** - 1x1, 2x2, 3x4, and custom grid layouts
- **Window/Level Adjustment** - Presets for lung, bone, brain, abdomen
- **Image Tools** - Pan, zoom, rotate, flip, invert
- **Measurements** - Length, angle, area (ROI)
- **Annotations** - Freehand drawing, shapes, text labels

### 🔄 MPR (Multi-Planar Reconstruction)

- **Real-Time 3D Reconstruction** - Axial, Sagittal, Coronal views
- **Synchronized Viewports** - Cross-reference lines across views
- **Automatic Orientation** - Intelligent image positioning
- **Custom MPR Angles** - Free rotation and oblique planes

### 📝 Reporting System

- **Template-Based Reports** - Pre-configured templates for common studies
- **Rich Text Editor** - Professional report formatting
- **Report Status Tracking** - Draft, Final, Printed states
- **Version Control** - Track report modifications
- **Digital Signatures** - Radiologist authentication

### 🖨️ Professional Printing (v3.0)

- **Exact Viewport Capture** - Print exactly what you see on screen
- **One-Time Configuration** - Set print preferences once
- **Multiple Format Support** - A4, A3, Letter, Legal
- **Medical Report Templates** - Professional report layouts
- **Printer Management** - Configure multiple printers
- **Keyboard Shortcuts** - Ctrl+P to print, Enter to confirm

### 🤖 AI Integration

- **Google Gemini AI** - Preliminary image analysis
- **Automatic Findings Generation** - AI-suggested impressions
- **Learning System** - Feedback mechanism for AI improvement
- **Context-Aware Analysis** - Patient history consideration

### 💾 Data Management

- **Automated Imports** - Monitor folders for auto-import
- **Batch Processing** - Import multiple studies simultaneously
- **Google Drive Backup** - Scheduled cloud backups
- **Local Backups** - Configurable backup retention
- **Data Synchronization** - Multi-location sync support

### 🔐 Security & Access Control

- **Role-Based Permissions** - Admin, Doctor, Viewer roles
- **Session Management** - Secure authentication system
- **Audit Logging** - Track all user actions
- **HIPAA Considerations** - Privacy-focused architecture

---

## 🚀 Installation

### Prerequisites

- **XAMPP** (or similar): Apache 2.4+, MySQL 8.0+, PHP 8.0+
- **Orthanc PACS Server** (optional): For DICOM networking
- **Modern Browser**: Chrome, Firefox, Edge, Safari (latest versions)

### Quick Start

1. **Clone or Download**
   ```bash
   git clone https://github.com/yourusername/dicom-viewer-pro.git
   cd dicom-viewer-pro
   ```

2. **Database Setup**
   ```bash
   # Import the database schema
   mysql -u root -p < setup/schema_v2_production.sql

   # Or use phpMyAdmin to import the SQL file
   ```

3. **Configuration**
   ```bash
   # Copy and configure environment settings
   cp includes/config.example.php includes/config.php

   # Edit config.php with your database credentials
   ```

4. **Set Permissions** (Linux/Mac)
   ```bash
   chmod -R 755 assets/uploads
   chmod -R 755 backups
   ```

5. **Access the Application**
   ```
   http://localhost/papa/dicom_again/claude
   ```

6. **Default Login**
   ```
   Username: admin
   Password: admin123
   ```
   **⚠️ Change this immediately after first login!**

### Orthanc Integration (Optional)

1. Install Orthanc PACS server
2. Configure in: **Admin → Settings → Orthanc PACS Server**
3. Default connection:
   - URL: `http://localhost:8042`
   - Username: `orthanc`
   - Password: `orthanc`

---

## 📖 Usage

### For Administrators

#### Initial Setup
1. Navigate to **Admin → Settings**
2. Configure Hospital Information
3. Set up DICOM nodes and printers
4. Configure Orthanc connection
5. Set print preferences

#### User Management
1. Go to **Admin → User Management**
2. Create user accounts
3. Assign roles (Admin, Doctor, Viewer)

#### Backup Configuration
1. **Admin → Settings → Backup**
2. Configure Google Drive (optional)
3. Set backup schedule
4. Test backup functionality

### For Doctors/Radiologists

#### Viewing Studies
1. Open **Dashboard** or **Studies** page
2. Search for patient
3. Click on study to open viewer
4. Use tools panel for measurements and annotations

#### Creating Reports
1. Open study in viewer
2. Click **Create Medical Report**
3. Fill in clinical information
4. Add findings and impression
5. Save as Draft or Finalize

#### Printing
1. Arrange images in desired layout
2. Adjust W/L and add annotations
3. Press **Ctrl+P** or click Print button
4. Select printer → Press **Enter** or click Print

#### Keyboard Shortcuts
- **Ctrl+P**: Open print dialog
- **Enter**: Confirm print
- **H**: Toggle sidebars
- **W**: Window/Level tool
- **Z**: Zoom tool
- **P**: Pan tool

### For Viewers

- Browse studies
- View images
- Export images (if permitted)
- Cannot create or modify reports

---

## 🏗️ Architecture

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Vanilla JavaScript, Bootstrap 5.3 |
| **Medical Imaging** | Cornerstone.js, cornerstone-tools |
| **Backend** | PHP 8.0+, MySQL 8.0+ |
| **PACS** | Orthanc DICOM Server |
| **AI** | Google Gemini API |
| **Cloud Storage** | Google Drive API |
| **PDF Generation** | jsPDF, html2canvas |

### Directory Structure

```
dicom-viewer-pro/
├── admin/              # Admin panel pages
├── api/                # REST API endpoints
│   ├── backup/         # Backup system APIs
│   ├── reports/        # Medical reports APIs
│   ├── settings/       # Configuration APIs
│   ├── studies/        # DICOM studies APIs
│   └── sync/           # Data synchronization
├── assets/             # Static assets
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript modules
│   └── uploads/        # User uploads
├── auth/               # Authentication system
├── backups/            # Backup storage
├── database/           # Database migrations
├── documentation/      # Technical docs
├── includes/           # PHP includes
│   └── classes/        # PHP classes
├── js/                 # Main JavaScript
│   ├── components/     # UI components
│   ├── managers/       # Business logic
│   └── utils/          # Utilities
├── pages/              # HTML pages
├── setup/              # Installation scripts
└── vendor/             # Composer dependencies
```

---

## 🔧 Configuration

### Environment Variables

Edit `includes/config.php`:

```php
<?php
// Database Configuration
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'dicom_viewer_v2_production');

// Application Settings
define('BASE_PATH', '/papa/dicom_again/claude');
define('BASE_URL', 'http://localhost' . BASE_PATH);

// Orthanc Configuration
define('ORTHANC_URL', 'http://localhost:8042');
define('ORTHANC_USER', 'orthanc');
define('ORTHANC_PASS', 'orthanc');

// Google API (Optional)
define('GEMINI_API_KEY', 'your-api-key-here');
```

### Print Settings

Configure once in **Admin → Settings → Print Settings**:

- **Information**: Patient info, study info, W/L values
- **Layout**: Paper size, orientation, margins
- **Quality**: Print quality, color mode

---

## 📚 Documentation

### User Guides
- [Quick Start Guide](QUICK_START.md)
- [Print System Guide](PRINT_SYSTEM_V3_IMPLEMENTATION.md)
- [Import System](api/sync/QUICK_START.md)

### Technical Documentation
- [API Reference](api/sync/SYNC_API_REFERENCE.md)
- [Database Schema](setup/schema_v2_production.sql)
- [Architecture Design](documentation/IMPROVED_ARCHITECTURE_DESIGN.md)

### Administration
- [Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Backup System](BACKUP_SCHEDULER_SETUP.md)
- [Configuration Checklist](CONFIGURATION_CHECKLIST.md)

---

## 🤝 Support

### Common Issues

**Q: Images not loading?**
- Check Orthanc connection in settings
- Verify CORS settings in Orthanc
- Check browser console for errors

**Q: Print not working?**
- Ensure popup blocker is disabled
- Check print settings configuration
- Verify printer is configured

**Q: AI analysis failing?**
- Verify Gemini API key is valid
- Check internet connection
- Review API quota limits

**Q: Backups not running?**
- Check cron job configuration
- Verify Google Drive permissions
- Check disk space

### Getting Help

- 📧 **Email**: support@yourcompany.com
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/dicom-viewer-pro/issues)
- 📖 **Documentation**: [Wiki](https://github.com/yourusername/dicom-viewer-pro/wiki)
- 💬 **Discussions**: [Community Forum](https://github.com/yourusername/dicom-viewer-pro/discussions)

---

## 🛣️ Roadmap

### Planned Features

- [ ] **3D Volume Rendering** - Advanced 3D visualization
- [ ] **DICOM Print (SCU)** - Direct printing to film printers
- [ ] **Worklist Integration** - DICOM Modality Worklist
- [ ] **Mobile Apps** - Native iOS and Android apps
- [ ] **Telemedicine** - Real-time collaboration tools
- [ ] **Voice Dictation** - Speech-to-text for reports
- [ ] **Multi-Language** - Internationalization support
- [ ] **Dark Mode** - User preference themes

---

## 📊 System Requirements

### Minimum Requirements
- **CPU**: Dual-core processor
- **RAM**: 4 GB
- **Storage**: 20 GB free space
- **Browser**: Chrome 90+, Firefox 88+, Edge 90+

### Recommended Requirements
- **CPU**: Quad-core processor or better
- **RAM**: 8 GB or more
- **Storage**: 100 GB+ for image storage
- **Browser**: Latest version of Chrome/Firefox
- **Network**: 10 Mbps+ for PACS connectivity

---

## 🔒 Security Considerations

- Change default admin credentials immediately
- Use HTTPS in production environments
- Configure firewall rules for Orthanc
- Regular database backups
- Keep software dependencies updated
- Implement audit logging review
- Consider HIPAA compliance requirements

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

### Technologies & Libraries

- [Cornerstone.js](https://cornerstonejs.org/) - Medical imaging rendering
- [Orthanc](https://www.orthanc-server.com/) - DICOM server
- [Bootstrap](https://getbootstrap.com/) - UI framework
- [Google Gemini](https://ai.google.dev/) - AI integration
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation
- [PHPUnit](https://phpunit.de/) - Testing framework

### Contributors

Built with ❤️ by medical imaging professionals for the healthcare community.

---

## 📞 Contact

**Project Maintainer**: Your Name
- Website: https://yourcompany.com
- Email: admin@yourcompany.com
- LinkedIn: [Your Profile](https://linkedin.com/in/yourprofile)

---

<div align="center">

**⭐ Star this repository if you find it helpful!**

Made with ❤️ for better healthcare

[⬆ Back to Top](#-accurate-dicom-viewer-pro)

</div>
