<?php
/**
 * License Manager
 * Handles license key generation, validation, and activation
 * 
 * Security features:
 * - Embedded checksum in key for offline validation
 * - Periodic online heartbeat for revocation check
 * - 7-day grace period for offline operation
 * - Machine fingerprint tracking
 */

if (!defined('DICOM_VIEWER')) {
    die('Direct access not allowed');
}

class LicenseManager {
    
    // License types with durations in days
    const LICENSE_TYPES = [
        'trial_15' => 15,
        'trial_30' => 30,
        'trial_90' => 90,
        'full' => 365,
        'enterprise' => null // perpetual
    ];
    
    // Grace period for offline operation (days)
    const GRACE_PERIOD_DAYS = 7;
    
    // Heartbeat interval (hours) - how often to check online
    const HEARTBEAT_INTERVAL_HOURS = 24;
    
    // Key prefix
    const KEY_PREFIX = 'DICOM';
    
    // Secret key for checksum (change this for your installation)
    const SECRET_KEY = 'DICOM_VIEWER_LICENSE_2024_SECRET';
    
    private $db;
    
    public function __construct($db = null) {
        $this->db = $db ?: getDbConnection();
    }
    
    /**
     * Generate a new license key
     * Format: DICOM-XXXX-XXXX-XXXX-XXXX
     */
    public function generateKey(): string {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0,O,1,I)
        $key = '';
        
        // Generate 16 random characters
        for ($i = 0; $i < 16; $i++) {
            $key .= $chars[random_int(0, strlen($chars) - 1)];
        }
        
        // Add 4-character checksum
        $checksum = $this->generateChecksum($key);
        
        // Format: DICOM-XXXX-XXXX-XXXX-XXXX (checksum is last 4)
        $fullKey = substr($key, 0, 4) . substr($key, 4, 4) . substr($key, 8, 4) . substr($key, 12, 4) . $checksum;
        
        return self::KEY_PREFIX . '-' . 
               substr($fullKey, 0, 4) . '-' . 
               substr($fullKey, 4, 4) . '-' . 
               substr($fullKey, 8, 4) . '-' . 
               substr($fullKey, 12, 4) . substr($fullKey, 16, 4);
    }
    
    /**
     * Generate checksum for key validation
     */
    private function generateChecksum(string $key): string {
        $hash = hash_hmac('sha256', $key, self::SECRET_KEY);
        return strtoupper(substr($hash, 0, 4));
    }
    
    /**
     * Validate key format and checksum (offline validation)
     */
    public function validateKeyFormat(string $key): bool {
        // Remove prefix and dashes
        $cleanKey = str_replace([self::KEY_PREFIX . '-', '-'], '', strtoupper(trim($key)));
        
        if (strlen($cleanKey) !== 20) {
            return false;
        }
        
        // Extract key parts
        $keyPart = substr($cleanKey, 0, 16);
        $providedChecksum = substr($cleanKey, 16, 4);
        
        // Verify checksum
        $expectedChecksum = $this->generateChecksum($keyPart);
        
        return hash_equals($expectedChecksum, $providedChecksum);
    }
    
    /**
     * Format key for storage (without dashes)
     */
    public function formatKeyForStorage(string $key): string {
        return str_replace([self::KEY_PREFIX . '-', '-'], '', strtoupper(trim($key)));
    }
    
    /**
     * Format key for display (with dashes)
     */
    public function formatKeyForDisplay(string $key): string {
        $clean = $this->formatKeyForStorage($key);
        if (strlen($clean) !== 20) return $key;
        
        return self::KEY_PREFIX . '-' .
               substr($clean, 0, 4) . '-' .
               substr($clean, 4, 4) . '-' .
               substr($clean, 8, 4) . '-' .
               substr($clean, 12, 8);
    }
    
    /**
     * Create a new license in database
     */
    public function createLicense(array $data): array {
        $key = $this->generateKey();
        $storageKey = $this->formatKeyForStorage($key);
        
        $type = $data['license_type'] ?? 'trial_15';
        
        // Handle custom duration
        if ($type === 'custom' && isset($data['custom_days'])) {
            $duration = intval($data['custom_days']);
        } else {
            $duration = self::LICENSE_TYPES[$type] ?? 15;
        }
        
        $validFrom = date('Y-m-d');
        $validUntil = $duration ? date('Y-m-d', strtotime("+{$duration} days")) : null;
        
        $stmt = $this->db->prepare("
            INSERT INTO licenses (
                license_key, license_type, customer_name, customer_email, 
                customer_phone, customer_hospital, max_activations, 
                valid_from, valid_until, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        $maxActivations = $data['max_activations'] ?? 5;
        $notes = $data['notes'] ?? '';
        
        $stmt->bind_param(
            "ssssssssss",
            $storageKey,
            $type,
            $data['customer_name'],
            $data['customer_email'],
            $data['customer_phone'],
            $data['customer_hospital'],
            $maxActivations,
            $validFrom,
            $validUntil,
            $notes
        );
        
        if ($stmt->execute()) {
            $licenseId = $this->db->insert_id;
            $stmt->close();
            
            return [
                'success' => true,
                'license_id' => $licenseId,
                'license_key' => $this->formatKeyForDisplay($storageKey),
                'valid_until' => $validUntil,
                'type' => $type
            ];
        }
        
        $error = $stmt->error;
        $stmt->close();
        
        return ['success' => false, 'error' => $error];
    }
    
    /**
     * Get license by key
     */
    public function getLicenseByKey(string $key): ?array {
        $storageKey = $this->formatKeyForStorage($key);
        
        $stmt = $this->db->prepare("
            SELECT l.*, 
                   COUNT(DISTINCT la.id) as active_activations,
                   DATEDIFF(l.valid_until, CURDATE()) as days_remaining
            FROM licenses l
            LEFT JOIN license_activations la ON l.id = la.license_id AND la.is_active = 1
            WHERE l.license_key = ?
            GROUP BY l.id
        ");
        $stmt->bind_param("s", $storageKey);
        $stmt->execute();
        $result = $stmt->get_result();
        $license = $result->fetch_assoc();
        $stmt->close();
        
        return $license ?: null;
    }
    
    /**
     * Get license by ID
     */
    public function getLicenseById(int $id): ?array {
        $stmt = $this->db->prepare("
            SELECT l.*, 
                   COUNT(DISTINCT la.id) as active_activations,
                   DATEDIFF(l.valid_until, CURDATE()) as days_remaining,
                   CASE 
                       WHEN l.is_active = 0 THEN 'revoked'
                       WHEN l.valid_until IS NOT NULL AND l.valid_until < CURDATE() THEN 'expired'
                       ELSE 'active'
                   END as status
            FROM licenses l
            LEFT JOIN license_activations la ON l.id = la.license_id AND la.is_active = 1
            WHERE l.id = ?
            GROUP BY l.id
        ");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $license = $result->fetch_assoc();
        $stmt->close();
        
        if ($license) {
            $license['license_key_display'] = $this->formatKeyForDisplay($license['license_key']);
        }
        
        return $license ?: null;
    }
    
    /**
     * Validate license (full check)
     */
    public function validateLicense(string $key, string $machineId = null): array {
        // First check format
        if (!$this->validateKeyFormat($key)) {
            return ['valid' => false, 'error' => 'Invalid license key format'];
        }
        
        // Get license from database
        $license = $this->getLicenseByKey($key);
        
        if (!$license) {
            return ['valid' => false, 'error' => 'License key not found'];
        }
        
        // Check if active
        if (!$license['is_active']) {
            return ['valid' => false, 'error' => 'License has been revoked', 'revoked' => true];
        }
        
        // Check expiration
        if ($license['valid_until'] && strtotime($license['valid_until']) < strtotime('today')) {
            return ['valid' => false, 'error' => 'License has expired', 'expired' => true];
        }
        
        // Check activation limit if machine ID provided
        if ($machineId) {
            $isActivated = $this->isMachineActivated($license['id'], $machineId);
            
            if (!$isActivated && $license['active_activations'] >= $license['max_activations']) {
                return [
                    'valid' => false, 
                    'error' => 'Maximum activation limit reached',
                    'limit_reached' => true
                ];
            }
        }
        
        return [
            'valid' => true,
            'license' => [
                'id' => $license['id'],
                'type' => $license['license_type'],
                'customer_name' => $license['customer_name'],
                'valid_until' => $license['valid_until'],
                'days_remaining' => $license['days_remaining'],
                'active_activations' => $license['active_activations'],
                'max_activations' => $license['max_activations']
            ]
        ];
    }
    
    /**
     * Check if machine is already activated
     */
    public function isMachineActivated(int $licenseId, string $machineId): bool {
        $stmt = $this->db->prepare("
            SELECT id FROM license_activations 
            WHERE license_id = ? AND machine_id = ? AND is_active = 1
        ");
        $stmt->bind_param("is", $licenseId, $machineId);
        $stmt->execute();
        $result = $stmt->get_result();
        $exists = $result->num_rows > 0;
        $stmt->close();
        
        return $exists;
    }
    
    /**
     * Activate license on a machine
     */
    public function activateLicense(string $key, string $machineId, array $machineInfo = []): array {
        // Validate license first
        $validation = $this->validateLicense($key, $machineId);
        
        if (!$validation['valid']) {
            return $validation;
        }
        
        $license = $this->getLicenseByKey($key);
        
        // Check if already activated on this machine
        if ($this->isMachineActivated($license['id'], $machineId)) {
            // Update heartbeat
            $this->updateHeartbeat($license['id'], $machineId);
            
            return [
                'success' => true,
                'message' => 'License already activated on this machine',
                'license' => $validation['license']
            ];
        }
        
        // Create new activation
        $stmt = $this->db->prepare("
            INSERT INTO license_activations 
            (license_id, machine_id, machine_name, os_info, ip_address, last_heartbeat)
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        
        $machineName = $machineInfo['machine_name'] ?? gethostname();
        $osInfo = $machineInfo['os_info'] ?? PHP_OS;
        $ipAddress = $machineInfo['ip_address'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
        
        $stmt->bind_param(
            "issss",
            $license['id'],
            $machineId,
            $machineName,
            $osInfo,
            $ipAddress
        );
        
        if ($stmt->execute()) {
            $activationId = $this->db->insert_id;
            $stmt->close();
            
            // Update local installation cache
            $this->updateLocalLicense($key, $machineId, $license);
            
            return [
                'success' => true,
                'activation_id' => $activationId,
                'message' => 'License activated successfully',
                'license' => $validation['license']
            ];
        }
        
        $error = $stmt->error;
        $stmt->close();
        
        return ['success' => false, 'error' => $error];
    }
    
    /**
     * Update heartbeat for an activation
     */
    public function updateHeartbeat(int $licenseId, string $machineId): bool {
        $stmt = $this->db->prepare("
            UPDATE license_activations 
            SET last_heartbeat = NOW(), ip_address = ?
            WHERE license_id = ? AND machine_id = ? AND is_active = 1
        ");
        
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        $stmt->bind_param("sis", $ip, $licenseId, $machineId);
        $result = $stmt->execute();
        $stmt->close();
        
        return $result;
    }
    
    /**
     * Update local installation license cache
     */
    public function updateLocalLicense(string $key, string $machineId, array $license): bool {
        $storageKey = $this->formatKeyForStorage($key);
        
        $stmt = $this->db->prepare("
            UPDATE installation_license SET
                license_key = ?,
                machine_id = ?,
                license_type = ?,
                activated_at = NOW(),
                last_online_check = NOW(),
                cached_valid_until = ?,
                cached_is_active = 1,
                grace_period_start = NULL
            WHERE id = 1
        ");
        
        $stmt->bind_param(
            "ssss",
            $storageKey,
            $machineId,
            $license['license_type'],
            $license['valid_until']
        );
        
        $result = $stmt->execute();
        $stmt->close();
        
        return $result;
    }
    
    /**
     * Get local installation license
     */
    public function getLocalLicense(): ?array {
        // Ensure table exists
        $this->db->query("
            CREATE TABLE IF NOT EXISTS installation_license (
                id INT PRIMARY KEY DEFAULT 1,
                license_key VARCHAR(32),
                machine_id VARCHAR(64),
                license_type VARCHAR(20),
                activated_at DATETIME,
                last_online_check DATETIME,
                cached_valid_until DATE,
                cached_is_active TINYINT(1) DEFAULT 1,
                grace_period_start DATETIME
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        // Ensure a row exists
        $this->db->query("INSERT IGNORE INTO installation_license (id, cached_is_active) VALUES (1, 1)");

        $result = $this->db->query("SELECT * FROM installation_license WHERE id = 1");
        return $result ? $result->fetch_assoc() : null;
    }
    
    /**
     * Check local license validity (for offline operation)
     */
    public function checkLocalLicense(): array {
        $local = $this->getLocalLicense();
        
        if (!$local || empty($local['license_key'])) {
            return ['valid' => false, 'reason' => 'no_license'];
        }
        
        // Check if revoked in cache
        if (!$local['cached_is_active']) {
            return ['valid' => false, 'reason' => 'revoked'];
        }
        
        // Check expiration
        if ($local['cached_valid_until'] && strtotime($local['cached_valid_until']) < strtotime('today')) {
            return ['valid' => false, 'reason' => 'expired'];
        }
        
        // Check if online check is needed
        $lastCheck = $local['last_online_check'] ? strtotime($local['last_online_check']) : 0;
        $checkInterval = self::HEARTBEAT_INTERVAL_HOURS * 3600;
        
        $needsOnlineCheck = (time() - $lastCheck) > $checkInterval;
        
        // Check grace period
        $graceOk = true;
        if ($needsOnlineCheck && $local['grace_period_start']) {
            $graceStart = strtotime($local['grace_period_start']);
            $graceDays = (time() - $graceStart) / 86400;
            $graceOk = $graceDays < self::GRACE_PERIOD_DAYS;
        }
        
        return [
            'valid' => true,
            'license_key' => $this->formatKeyForDisplay($local['license_key']),
            'license_type' => $local['license_type'],
            'valid_until' => $local['cached_valid_until'],
            'needs_online_check' => $needsOnlineCheck,
            'grace_ok' => $graceOk,
            'days_remaining' => $local['cached_valid_until'] 
                ? max(0, floor((strtotime($local['cached_valid_until']) - time()) / 86400))
                : null
        ];
    }
    
    /**
     * Revoke a license
     */
    public function revokeLicense(int $licenseId): bool {
        $stmt = $this->db->prepare("UPDATE licenses SET is_active = 0 WHERE id = ?");
        $stmt->bind_param("i", $licenseId);
        $result = $stmt->execute();
        $stmt->close();
        
        return $result;
    }
    
    /**
     * Reactivate a license
     */
    public function reactivateLicense(int $licenseId): bool {
        $stmt = $this->db->prepare("UPDATE licenses SET is_active = 1 WHERE id = ?");
        $stmt->bind_param("i", $licenseId);
        $result = $stmt->execute();
        $stmt->close();
        
        return $result;
    }
    
    /**
     * Get all licenses with activation counts
     */
    public function getAllLicenses(): array {
        $result = $this->db->query("
            SELECT l.*, 
                   COUNT(DISTINCT la.id) as active_activations,
                   DATEDIFF(l.valid_until, CURDATE()) as days_remaining,
                   CASE 
                       WHEN l.is_active = 0 THEN 'revoked'
                       WHEN l.valid_until IS NOT NULL AND l.valid_until < CURDATE() THEN 'expired'
                       ELSE 'active'
                   END as status
            FROM licenses l
            LEFT JOIN license_activations la ON l.id = la.license_id AND la.is_active = 1
            GROUP BY l.id
            ORDER BY l.created_at DESC
        ");
        
        $licenses = [];
        while ($row = $result->fetch_assoc()) {
            $row['license_key_display'] = $this->formatKeyForDisplay($row['license_key']);
            $licenses[] = $row;
        }
        
        return $licenses;
    }
    
    /**
     * Get activations for a license
     */
    public function getLicenseActivations(int $licenseId): array {
        $stmt = $this->db->prepare("
            SELECT la.*, 
                   TIMESTAMPDIFF(MINUTE, la.last_heartbeat, NOW()) as minutes_since_heartbeat
            FROM license_activations la
            WHERE la.license_id = ?
            ORDER BY la.last_heartbeat DESC
        ");
        $stmt->bind_param("i", $licenseId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $activations = [];
        while ($row = $result->fetch_assoc()) {
            $activations[] = $row;
        }
        $stmt->close();
        
        return $activations;
    }
    
    /**
     * Record usage statistics
     */
    public function recordUsage(int $activationId, array $stats): bool {
        $today = date('Y-m-d');
        
        // Get current stats for today
        $stmt = $this->db->prepare("
            SELECT id, printer_stats, paper_stats FROM license_usage_stats 
            WHERE activation_id = ? AND stat_date = ?
        ");
        $stmt->bind_param("is", $activationId, $today);
        $stmt->execute();
        $existing = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        
        if ($existing) {
            // Merge stats
            $printerStats = json_decode($existing['printer_stats'] ?: '{}', true);
            $paperStats = json_decode($existing['paper_stats'] ?: '{}', true);
            
            if (isset($stats['printer'])) {
                $printerStats[$stats['printer']] = ($printerStats[$stats['printer']] ?? 0) + 1;
            }
            if (isset($stats['paper_type'])) {
                $paperStats[$stats['paper_type']] = ($paperStats[$stats['paper_type']] ?? 0) + 1;
            }
            
            $stmt = $this->db->prepare("
                UPDATE license_usage_stats SET
                    total_prints = total_prints + ?,
                    printer_stats = ?,
                    paper_stats = ?,
                    studies_opened = studies_opened + ?,
                    reports_created = reports_created + ?,
                    dicom_images_viewed = dicom_images_viewed + ?
                WHERE id = ?
            ");
            
            $printerJson = json_encode($printerStats);
            $paperJson = json_encode($paperStats);
            $prints = $stats['prints'] ?? 0;
            $studies = $stats['studies'] ?? 0;
            $reports = $stats['reports'] ?? 0;
            $images = $stats['images'] ?? 0;
            
            $stmt->bind_param(
                "issiiii",
                $prints, $printerJson, $paperJson, $studies, $reports, $images, $existing['id']
            );
        } else {
            // Create new stats row
            $printerStats = isset($stats['printer']) ? [$stats['printer'] => 1] : [];
            $paperStats = isset($stats['paper_type']) ? [$stats['paper_type'] => 1] : [];
            
            $stmt = $this->db->prepare("
                INSERT INTO license_usage_stats 
                (activation_id, stat_date, total_prints, printer_stats, paper_stats, 
                 studies_opened, reports_created, dicom_images_viewed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $printerJson = json_encode($printerStats);
            $paperJson = json_encode($paperStats);
            $prints = $stats['prints'] ?? 0;
            $studies = $stats['studies'] ?? 0;
            $reports = $stats['reports'] ?? 0;
            $images = $stats['images'] ?? 0;
            
            $stmt->bind_param(
                "isissiiii",
                $activationId, $today, $prints, $printerJson, $paperJson, $studies, $reports, $images
            );
        }
        
        $result = $stmt->execute();
        $stmt->close();
        
        return $result;
    }
    
    /**
     * Get usage statistics for a license
     */
    public function getLicenseUsageStats(int $licenseId, int $days = 30): array {
        $stmt = $this->db->prepare("
            SELECT 
                lus.stat_date,
                la.machine_name,
                lus.total_prints,
                lus.printer_stats,
                lus.paper_stats,
                lus.studies_opened,
                lus.reports_created,
                lus.dicom_images_viewed
            FROM license_usage_stats lus
            JOIN license_activations la ON lus.activation_id = la.id
            WHERE la.license_id = ? AND lus.stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            ORDER BY lus.stat_date DESC, la.machine_name
        ");
        $stmt->bind_param("ii", $licenseId, $days);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $stats = [];
        while ($row = $result->fetch_assoc()) {
            $row['printer_stats'] = json_decode($row['printer_stats'] ?: '{}', true);
            $row['paper_stats'] = json_decode($row['paper_stats'] ?: '{}', true);
            $stats[] = $row;
        }
        $stmt->close();
        
        return $stats;
    }
    
    /**
     * Generate unique machine ID
     */
    public static function generateMachineId(): string {
        // Combine multiple factors for fingerprint
        $factors = [
            php_uname('n'), // hostname
            php_uname('s'), // OS
            php_uname('r'), // release
        ];
        
        // Try to get MAC address on Windows
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            exec('getmac /FO CSV /NH 2>nul', $output);
            if (!empty($output[0])) {
                $factors[] = $output[0];
            }
        }
        
        return hash('sha256', implode('|', $factors));
    }
    
    /**
     * Deactivate installation
     */
    public function deactivateInstallation(): bool {
        return $this->db->query("
            UPDATE installation_license SET
                license_key = NULL,
                cached_is_active = 0
            WHERE id = 1
        ");
    }
    
    /**
     * Start grace period (when offline check fails)
     */
    public function startGracePeriod(): void {
        $this->db->query("
            UPDATE installation_license SET
                grace_period_start = COALESCE(grace_period_start, NOW())
            WHERE id = 1
        ");
    }
    
    /**
     * Mark local license as revoked
     */
    public function markLocalRevoked(): void {
        $this->db->query("
            UPDATE installation_license SET cached_is_active = 0 WHERE id = 1
        ");
    }
}
