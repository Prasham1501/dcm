# Sync System API Reference - Hospital DICOM Viewer Pro v2.0

## Authentication
All endpoints require:
- Admin authentication (session-based)
- Valid session cookie
- Admin role

## Base URL
```
/api/sync/
```

---

## Endpoints

### 1. Configure Sync Settings

**Endpoint**: `POST /api/sync/configure-sync.php`

**Description**: Updates sync configuration including FTP credentials and sync intervals.

**Request Body**:
```json
{
    "orthanc_storage_path": "C:\\Orthanc\\OrthancStorage",
    "hospital_data_path": "C:\\HospitalData",
    "ftp_host": "ftp.godaddy.com",
    "ftp_username": "your-username",
    "ftp_password": "your-password",
    "ftp_port": 21,
    "ftp_path": "/public_html/dicom_viewer/",
    "ftp_passive": true,
    "sync_enabled": false,
    "sync_interval": 120,
    "monitoring_enabled": false,
    "monitoring_interval": 30
}
```

**Fields** (all optional):
- `orthanc_storage_path` (string): Path to Orthanc storage directory
- `hospital_data_path` (string): Path to hospital data directory
- `ftp_host` (string): FTP server hostname
- `ftp_username` (string): FTP username (required if ftp_host is set)
- `ftp_password` (string): FTP password (encrypted before storage)
- `ftp_port` (integer): FTP port (default: 21)
- `ftp_path` (string): Remote FTP directory path
- `ftp_passive` (boolean): Enable passive FTP mode
- `sync_enabled` (boolean): Enable automatic sync
- `sync_interval` (integer): Sync interval in minutes (1-1440)
- `monitoring_enabled` (boolean): Enable monitoring
- `monitoring_interval` (integer): Monitoring interval in minutes

**Success Response** (200):
```json
{
    "success": true,
    "message": "Sync configuration updated successfully",
    "data": {
        "id": 1,
        "orthanc_storage_path": "C:\\Orthanc\\OrthancStorage",
        "ftp_host": "ftp.godaddy.com",
        "ftp_username": "your-username",
        "ftp_password": "********",
        "ftp_port": 21,
        "ftp_path": "/public_html/dicom_viewer/",
        "ftp_passive": true,
        "sync_enabled": false,
        "sync_interval": 120,
        "last_sync_at": null
    }
}
```

**Error Responses**:
- `400`: Invalid input or validation error
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

---

### 2. Get Sync Configuration

**Endpoint**: `GET /api/sync/get-config.php`

**Description**: Retrieves current sync configuration with password masked.

**Query Parameters**: None

**Success Response** (200):
```json
{
    "success": true,
    "message": "Sync configuration retrieved successfully",
    "data": {
        "configuration": {
            "id": 1,
            "orthanc_storage_path": "C:\\Orthanc\\OrthancStorage",
            "ftp_host": "ftp.godaddy.com",
            "ftp_username": "your-username",
            "ftp_password": "********",
            "ftp_port": 21,
            "ftp_path": "/public_html/dicom_viewer/",
            "ftp_passive": true,
            "sync_enabled": true,
            "sync_interval": 120,
            "last_sync_at": "2025-11-22 10:30:45"
        },
        "statistics": {
            "total_syncs": 23,
            "total_files_synced": 1842,
            "total_size_synced": 5947392000,
            "last_sync": "2025-11-22 10:30:45",
            "successful_syncs": 21,
            "failed_syncs": 2
        }
    }
}
```

**Error Responses**:
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

---

### 3. Sync Now (Manual Sync)

**Endpoint**: `POST /api/sync/sync-now.php`

**Description**: Triggers immediate synchronization of new files to FTP.

**Request Body**: None

**Success Response** (200):
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

**Partial Success Response** (200):
```json
{
    "success": true,
    "message": "Sync partially completed with errors",
    "data": {
        "files_synced": 38,
        "total_size_mb": 245.50,
        "duration_seconds": 52.10,
        "status": "partial",
        "errors": [
            "Failed to upload: file1.dcm",
            "Failed to upload: file2.dcm"
        ]
    }
}
```

**No New Files Response** (200):
```json
{
    "success": true,
    "message": "Sync completed - No new files found",
    "data": {
        "files_synced": 0,
        "total_size_mb": 0,
        "duration_seconds": 2.15,
        "message": "No new files to sync"
    }
}
```

**Error Responses**:
- `400`: FTP not configured
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Sync failed

**Notes**:
- Includes automatic retry logic (3 attempts)
- Creates sync_history record
- Updates last_sync_at timestamp
- Detects new files using MD5 hash comparison

---

### 4. Get Sync Status

**Endpoint**: `GET /api/sync/status.php`

**Description**: Returns detailed sync status, history, and statistics.

**Query Parameters**: None

**Success Response** (200):
```json
{
    "success": true,
    "message": "Sync status retrieved successfully",
    "data": {
        "last_sync": {
            "id": 15,
            "sync_type": "manual",
            "destination": "godaddy",
            "files_synced": 42,
            "total_size_bytes": 269157376,
            "total_size_mb": 256.75,
            "status": "success",
            "error_message": null,
            "started_at": "2025-11-22 10:30:00",
            "completed_at": "2025-11-22 10:30:45",
            "duration_seconds": 45
        },
        "sync_history": [
            {
                "id": 15,
                "sync_type": "manual",
                "files_synced": 42,
                "total_size_mb": 256.75,
                "status": "success",
                "started_at": "2025-11-22 10:30:00",
                "completed_at": "2025-11-22 10:30:45",
                "duration_seconds": 45
            }
        ],
        "configuration": {
            "sync_enabled": true,
            "sync_interval": 120,
            "last_sync_at": "2025-11-22 10:30:45",
            "next_sync_at": "2025-11-22 12:30:45"
        },
        "statistics": {
            "total_syncs": 23,
            "total_files_synced": 1842,
            "total_size_synced": 5947392000,
            "total_size_synced_mb": 5672.18,
            "total_size_synced_gb": 5.54,
            "successful_syncs": 21,
            "failed_syncs": 2,
            "partial_syncs": 0
        }
    }
}
```

**Error Responses**:
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

**Notes**:
- Returns last 10 sync operations in history
- Calculates next sync time if auto-sync enabled
- Provides comprehensive statistics

---

### 5. Test FTP Connection

**Endpoint**: `POST /api/sync/test-connection.php`

**Description**: Tests FTP connectivity and permissions.

**Request Body**: None

**Success Response** (200):
```json
{
    "success": true,
    "message": "FTP connection successful",
    "data": {
        "connection_status": "success",
        "ftp_host": "ftp.godaddy.com",
        "ftp_port": 21,
        "ftp_path": "/public_html/dicom_viewer/",
        "files_in_directory": 15,
        "message": "FTP connection successful"
    }
}
```

**Error Response** (400):
```json
{
    "success": false,
    "error": "Failed to connect to FTP server"
}
```

**Error Responses**:
- `400`: FTP not configured or connection failed
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

**Notes**:
- Verifies FTP credentials
- Tests directory access
- Counts files in remote directory
- Does not upload any files

---

### 6. Enable Auto-Sync

**Endpoint**: `POST /api/sync/enable-auto.php`

**Description**: Enables automatic synchronization.

**Request Body**: None

**Success Response** (200):
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

**Error Responses**:
- `400`: FTP not configured
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

**Notes**:
- Requires FTP to be configured first
- Background service must be running for scheduled syncs
- Sync will occur based on sync_interval setting

---

### 7. Disable Auto-Sync

**Endpoint**: `POST /api/sync/disable-auto.php`

**Description**: Disables automatic synchronization.

**Request Body**: None

**Success Response** (200):
```json
{
    "success": true,
    "message": "Auto-sync disabled successfully",
    "data": {
        "sync_enabled": false
    }
}
```

**Error Responses**:
- `401`: Unauthorized
- `403`: Forbidden (not admin)
- `500`: Server error

**Notes**:
- Stops future scheduled syncs
- Does not affect currently running sync
- Manual sync still available

---

## Error Response Format

All error responses follow this format:

```json
{
    "success": false,
    "error": "Error message description"
}
```

**Common HTTP Status Codes**:
- `400`: Bad Request - Invalid input or validation error
- `401`: Unauthorized - Not logged in or session expired
- `403`: Forbidden - Insufficient permissions (not admin)
- `405`: Method Not Allowed - Wrong HTTP method used
- `500`: Internal Server Error - Server-side error

---

## CORS Headers

All endpoints support CORS:
- `Access-Control-Allow-Origin`: Configured in CORS_ALLOWED_ORIGINS
- `Access-Control-Allow-Methods`: GET, POST, OPTIONS
- `Access-Control-Allow-Headers`: Content-Type, Authorization

---

## Rate Limiting

No rate limiting currently implemented. Consider implementing for production:
- Limit sync-now requests to prevent abuse
- Monitor FTP connection attempts
- Track failed authentication attempts

---

## Logging & Audit

All API calls are logged:
- **Audit Logs**: Database table `audit_logs`
- **Sync Logs**: File `logs/sync.log`
- **Session Logs**: File `logs/auth.log`

Logged information includes:
- User ID and username
- Action performed
- Timestamp
- IP address
- User agent
- Request details
- Response status

---

## Example Usage (JavaScript)

### Configure Sync
```javascript
fetch('/api/sync/configure-sync.php', {
    method: 'POST',
    credentials: 'include',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        ftp_host: 'ftp.godaddy.com',
        ftp_username: 'username',
        ftp_password: 'password',
        sync_interval: 120
    })
})
.then(response => response.json())
.then(data => console.log(data));
```

### Trigger Manual Sync
```javascript
fetch('/api/sync/sync-now.php', {
    method: 'POST',
    credentials: 'include'
})
.then(response => response.json())
.then(data => console.log(data));
```

### Get Status
```javascript
fetch('/api/sync/status.php', {
    method: 'GET',
    credentials: 'include'
})
.then(response => response.json())
.then(data => console.log(data));
```

### Test Connection
```javascript
fetch('/api/sync/test-connection.php', {
    method: 'POST',
    credentials: 'include'
})
.then(response => response.json())
.then(data => console.log(data));
```

---

## Example Usage (cURL)

### Configure Sync
```bash
curl -X POST http://localhost/api/sync/configure-sync.php \
  -H "Content-Type: application/json" \
  -b "DICOM_VIEWER_SESSION=your-session-id" \
  -d '{
    "ftp_host": "ftp.godaddy.com",
    "ftp_username": "username",
    "ftp_password": "password",
    "sync_interval": 120
  }'
```

### Get Configuration
```bash
curl -X GET http://localhost/api/sync/get-config.php \
  -b "DICOM_VIEWER_SESSION=your-session-id"
```

### Trigger Sync
```bash
curl -X POST http://localhost/api/sync/sync-now.php \
  -b "DICOM_VIEWER_SESSION=your-session-id"
```

### Get Status
```bash
curl -X GET http://localhost/api/sync/status.php \
  -b "DICOM_VIEWER_SESSION=your-session-id"
```

---

## Security Considerations

1. **Password Storage**: FTP passwords encrypted using AES-256-CBC
2. **Session Security**: HTTP-only cookies, session timeout
3. **Admin Only**: All endpoints require admin role
4. **Audit Trail**: All operations logged
5. **Input Validation**: All inputs sanitized and validated
6. **HTTPS**: Recommended for production
7. **CSRF Protection**: Consider implementing CSRF tokens

---

## Version History

- **v2.0.0** (2025-11-22): Initial release
  - Full sync system implementation
  - 7 API endpoints
  - Background service support
  - Retry logic and error handling

---

**System**: Hospital DICOM Viewer Pro v2.0
**Last Updated**: November 22, 2025
