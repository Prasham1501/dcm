# Automated Directory Sync System - Hospital DICOM Viewer Pro v2.0

## Overview
The Automated Directory Sync System synchronizes DICOM files from Orthanc storage to GoDaddy hosting via FTP. This system supports both manual and automatic synchronization with retry logic, progress tracking, and comprehensive error handling.

## Architecture

### Components

1. **SyncManager Class** (`/includes/classes/SyncManager.php`)
   - Core sync engine
   - Handles file scanning, detection, and FTP operations
   - Manages configuration and encryption

2. **API Endpoints** (`/api/sync/`)
   - configure-sync.php - Configure sync settings
   - get-config.php - Retrieve current configuration
   - sync-now.php - Trigger immediate sync
   - status.php - Get sync status and history
   - test-connection.php - Test FTP connectivity
   - enable-auto.php - Enable automatic sync
   - disable-auto.php - Disable automatic sync

3. **Background Service** (`/scripts/sync-service.php`)
   - Continuous background process
   - Monitors sync configuration
   - Executes scheduled syncs

### Database Tables

#### sync_configuration
Stores sync configuration settings including FTP credentials (encrypted).

```sql
- orthanc_storage_path: Path to Orthanc storage directory
- ftp_host: FTP server hostname
- ftp_username: FTP username
- ftp_password: Encrypted FTP password
- ftp_port: FTP port (default: 21)
- ftp_path: Remote FTP directory path
- ftp_passive: Enable passive mode (boolean)
- sync_enabled: Enable automatic sync (boolean)
- sync_interval: Sync interval in minutes
- last_sync_at: Timestamp of last successful sync
```

#### sync_history
Tracks all sync operations with detailed metrics.

```sql
- sync_type: manual, scheduled, or monitoring
- destination: localhost, godaddy, or both
- files_synced: Number of files synced
- total_size_bytes: Total size in bytes
- status: success, failed, or partial
- error_message: Error details if failed
- started_at: Sync start time
- completed_at: Sync completion time
```

## Installation & Setup

### 1. Database Configuration
The sync tables are already created via `schema_v2_production.sql`. Default configuration is inserted automatically.

### 2. FTP Configuration

Configure FTP settings via API or directly in database:

```bash
POST /api/sync/configure-sync.php
{
    "orthanc_storage_path": "C:\\Orthanc\\OrthancStorage",
    "ftp_host": "your-godaddy-ftp.com",
    "ftp_username": "your-username",
    "ftp_password": "your-password",
    "ftp_port": 21,
    "ftp_path": "/public_html/dicom_viewer/",
    "ftp_passive": true,
    "sync_enabled": false,
    "sync_interval": 120
}
```

### 3. Test FTP Connection

```bash
POST /api/sync/test-connection.php
```

Response:
```json
{
    "success": true,
    "data": {
        "connection_status": "success",
        "ftp_host": "your-godaddy-ftp.com",
        "ftp_port": 21,
        "ftp_path": "/public_html/dicom_viewer/",
        "files_in_directory": 15,
        "message": "FTP connection successful"
    }
}
```

## Usage

### Manual Sync

Trigger immediate synchronization:

```bash
POST /api/sync/sync-now.php
```

Response:
```json
{
    "success": true,
    "message": "Sync completed successfully",
    "data": {
        "files_synced": 42,
        "total_size_mb": 256.75,
        "duration_seconds": 45.23,
        "status": "success"
    }
}
```

### Enable Auto-Sync

```bash
POST /api/sync/enable-auto.php
```

Response:
```json
{
    "success": true,
    "message": "Auto-sync enabled successfully",
    "data": {
        "sync_enabled": true,
        "sync_interval": 120
    }
}
```

### Disable Auto-Sync

```bash
POST /api/sync/disable-auto.php
```

### Get Sync Status

```bash
GET /api/sync/status.php
```

Response:
```json
{
    "success": true,
    "data": {
        "last_sync": {
            "id": 15,
            "sync_type": "manual",
            "files_synced": 42,
            "total_size_mb": 256.75,
            "status": "success",
            "started_at": "2025-11-22 10:30:00",
            "completed_at": "2025-11-22 10:30:45",
            "duration_seconds": 45
        },
        "sync_history": [...],
        "configuration": {
            "sync_enabled": true,
            "sync_interval": 120,
            "last_sync_at": "2025-11-22 10:30:45",
            "next_sync_at": "2025-11-22 12:30:45"
        },
        "statistics": {
            "total_syncs": 23,
            "total_files_synced": 1842,
            "total_size_synced_mb": 5678.90,
            "successful_syncs": 21,
            "failed_syncs": 2,
            "partial_syncs": 0
        }
    }
}
```

## Background Service

### Running the Service

#### Method 1: Direct Execution
```bash
php C:\xampp\htdocs\papa\dicom_again\claude\scripts\sync-service.php
```

#### Method 2: Windows Service (NSSM)

1. **Download NSSM**: https://nssm.cc/download
2. **Install Service**:
```bash
nssm install DicomSyncService "C:\xampp\php\php.exe" "C:\xampp\htdocs\papa\dicom_again\claude\scripts\sync-service.php"
```

3. **Configure Service**:
```bash
nssm set DicomSyncService AppDirectory C:\xampp\htdocs\papa\dicom_again\claude
nssm set DicomSyncService DisplayName "DICOM Sync Service"
nssm set DicomSyncService Description "Hospital DICOM Viewer Pro - Automated Sync Service"
nssm set DicomSyncService Start SERVICE_AUTO_START
```

4. **Start Service**:
```bash
nssm start DicomSyncService
```

5. **Check Status**:
```bash
nssm status DicomSyncService
```

6. **Stop Service**:
```bash
nssm stop DicomSyncService
```

7. **Remove Service**:
```bash
nssm remove DicomSyncService confirm
```

### Service Behavior

- Checks sync configuration every 60 seconds
- Executes sync when interval has elapsed
- Logs all operations to `logs/sync-service.log`
- Handles errors with automatic retry (3 attempts)
- Reconnects to database to avoid timeouts
- Graceful shutdown on SIGTERM/SIGINT signals

## Security Features

### Password Encryption
FTP passwords are encrypted using AES-256-CBC before storage:
- Encryption key derived from secure hash
- Each encrypted value includes unique IV
- Passwords decrypted only when needed for FTP connection

### Access Control
- All API endpoints require admin authentication
- Session validation on every request
- Audit logging for all configuration changes
- IP address and user agent tracking

## Error Handling

### Retry Logic
- Maximum 3 retry attempts for FTP operations
- 2-second delay between retries for manual sync
- 5-second delay for scheduled sync
- Partial success tracked when some files fail

### Status Types
- **success**: All files synced successfully
- **partial**: Some files synced, some failed
- **failed**: No files synced or critical error

### Error Logging
All errors logged to multiple locations:
- Database: `sync_history.error_message`
- File: `logs/sync.log`
- Service Log: `logs/sync-service.log`
- Audit Log: `audit_logs` table

## File Detection

The system uses MD5 file hashing to detect new files:
1. Scans Orthanc storage directory recursively
2. Calculates MD5 hash for each file
3. Checks `import_history` table for existing hash
4. Only syncs files not previously imported
5. Maintains relative directory structure on FTP

## Performance Considerations

### Memory Management
- Service memory limit: 512MB
- Database connections reestablished periodically
- Objects destroyed after each sync cycle
- Garbage collection between operations

### Bandwidth Optimization
- Files transferred in binary mode
- Passive FTP mode for firewall compatibility
- Directory structure created incrementally
- Failed files can be retried without re-uploading successful files

## Monitoring

### Log Files

1. **sync.log** - General sync operations
2. **sync-service.log** - Background service activity
3. **audit.log** - Security and access events

### Database Monitoring

Check recent sync history:
```sql
SELECT * FROM sync_history ORDER BY started_at DESC LIMIT 10;
```

Check configuration:
```sql
SELECT * FROM sync_configuration;
```

Get statistics:
```sql
SELECT
    COUNT(*) as total_syncs,
    SUM(files_synced) as total_files,
    SUM(total_size_bytes)/1024/1024 as total_mb,
    AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_duration
FROM sync_history
WHERE status = 'success';
```

## Troubleshooting

### Common Issues

#### 1. FTP Connection Failed
- Verify FTP credentials
- Check firewall settings
- Enable passive mode if behind NAT
- Test with FTP client (FileZilla) first

#### 2. Files Not Syncing
- Check Orthanc storage path exists
- Verify permissions on storage directory
- Check sync interval configuration
- Review sync_history for errors

#### 3. Service Not Running
- Check service status: `nssm status DicomSyncService`
- Review service log: `logs/sync-service.log`
- Verify PHP path in NSSM configuration
- Check for port conflicts or permission issues

#### 4. Partial Sync
- Review error messages in sync_history
- Check disk space on FTP server
- Verify network stability
- Check file permissions

### Debug Mode

Enable detailed logging:
1. Set LOG_LEVEL to 'debug' in .env
2. Monitor logs/sync.log
3. Check database sync_history table
4. Review FTP server logs

## API Authentication

All endpoints require:
- Valid session (PHP session-based)
- Admin role
- Active user account

Example request headers:
```
Cookie: DICOM_VIEWER_SESSION=your-session-id
Content-Type: application/json
```

## Best Practices

1. **Test FTP Before Enabling Auto-Sync**
   - Use test-connection.php endpoint
   - Verify credentials and permissions
   - Check available disk space

2. **Set Appropriate Sync Interval**
   - Minimum: 1 minute (not recommended)
   - Recommended: 60-120 minutes
   - Maximum: 1440 minutes (24 hours)

3. **Monitor Sync History**
   - Check status regularly
   - Review failed syncs promptly
   - Monitor disk space on both servers

4. **Regular Maintenance**
   - Clean old sync_history records (optional)
   - Monitor log file sizes
   - Verify FTP credentials periodically

5. **Backup Configuration**
   - Export sync_configuration table
   - Document FTP credentials securely
   - Keep encrypted passwords backed up

## Security Recommendations

1. Use strong FTP passwords
2. Enable SSL/TLS for FTP if available
3. Restrict FTP user permissions
4. Monitor audit logs regularly
5. Keep encryption keys secure
6. Use firewall rules to restrict FTP access
7. Regularly update passwords

## Support

For issues or questions:
- Check logs: `logs/sync.log`, `logs/sync-service.log`
- Review sync_history table
- Test FTP connection manually
- Verify Orthanc storage path
- Check system requirements

## System Requirements

- PHP 7.4 or higher
- MySQLi extension
- FTP extension enabled
- OpenSSL extension (for encryption)
- Windows (for NSSM service) or Linux cron
- Sufficient disk space on FTP server
- Network connectivity to FTP server

## Configuration Reference

### Environment Variables (.env)
```
ORTHANC_STORAGE_PATH=C:\Orthanc\OrthancStorage
FTP_HOST=your-ftp-server.com
FTP_USERNAME=your-username
FTP_PASSWORD=your-password
FTP_PORT=21
FTP_PATH=/public_html/dicom_viewer/
FTP_PASSIVE=true
SYNC_ENABLED=false
SYNC_INTERVAL=120
```

### Default Values
- FTP Port: 21
- FTP Path: /public_html/dicom_viewer/
- Passive Mode: Enabled
- Sync Interval: 120 minutes
- Auto-Sync: Disabled

---

**Version**: 2.0.0
**Last Updated**: November 22, 2025
**System**: Hospital DICOM Viewer Pro v2.0
