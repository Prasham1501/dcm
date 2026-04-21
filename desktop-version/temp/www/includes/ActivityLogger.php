<?php
/**
 * Activity Logger
 * Logs user activity for super admin monitoring
 */

if (!defined('DICOM_VIEWER')) {
    die('Direct access not allowed');
}

class ActivityLogger {
    
    private static $db = null;
    
    /**
     * Log an activity event
     */
    public static function log(string $eventType, string $category, array $data = []): bool {
        try {
            $db = self::getDb();
            if (!$db) return false;
            
            // Get license info
            $licenseKey = null;
            $machineId = null;
            
            $licenseResult = $db->query("SELECT license_key, machine_id FROM installation_license WHERE id = 1");
            if ($licenseResult && $row = $licenseResult->fetch_assoc()) {
                $licenseKey = $row['license_key'];
                $machineId = $row['machine_id'];
            }
            
            // Get user info
            $userId = $_SESSION['user_id'] ?? null;
            $userName = $_SESSION['username'] ?? null;
            
            $stmt = $db->prepare("
                INSERT INTO activity_log 
                (license_key, machine_id, user_id, user_name, event_type, event_category, event_data, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $eventDataJson = json_encode($data);
            $ipAddress = $_SERVER['REMOTE_ADDR'] ?? '';
            
            $stmt->bind_param(
                "ssisssss",
                $licenseKey,
                $machineId,
                $userId,
                $userName,
                $eventType,
                $category,
                $eventDataJson,
                $ipAddress
            );
            
            $result = $stmt->execute();
            $stmt->close();
            
            return $result;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Log authentication events
     */
    public static function logAuth(string $action, array $data = []): bool {
        return self::log($action, 'auth', $data);
    }
    
    /**
     * Log study events
     */
    public static function logStudy(string $action, array $data = []): bool {
        return self::log($action, 'study', $data);
    }
    
    /**
     * Log print events
     */
    public static function logPrint(string $action, array $data = []): bool {
        return self::log($action, 'print', $data);
    }
    
    /**
     * Log report events
     */
    public static function logReport(string $action, array $data = []): bool {
        return self::log($action, 'report', $data);
    }
    
    /**
     * Get recent activity (for super admin)
     */
    public static function getActivity(int $limit = 50, ?string $licenseKey = null): array {
        $db = self::getDb();
        if (!$db) return [];
        
        $sql = "SELECT * FROM activity_log";
        $params = [];
        $types = "";
        
        if ($licenseKey) {
            $sql .= " WHERE license_key = ?";
            $params[] = $licenseKey;
            $types .= "s";
        }
        
        $sql .= " ORDER BY created_at DESC LIMIT ?";
        $params[] = $limit;
        $types .= "i";
        
        $stmt = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $activities = [];
        while ($row = $result->fetch_assoc()) {
            $row['event_data'] = json_decode($row['event_data'], true);
            $activities[] = $row;
        }
        $stmt->close();
        
        return $activities;
    }
    
    /**
     * Get activity statistics
     */
    public static function getStats(?string $licenseKey = null, int $days = 30): array {
        $db = self::getDb();
        if (!$db) return [];
        
        $whereClause = $licenseKey ? "AND license_key = ?" : "";
        
        $sql = "
            SELECT 
                event_category,
                event_type,
                COUNT(*) as count,
                DATE(created_at) as date
            FROM activity_log 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            $whereClause
            GROUP BY event_category, event_type, DATE(created_at)
            ORDER BY date DESC
        ";
        
        if ($licenseKey) {
            $stmt = $db->prepare($sql);
            $stmt->bind_param("is", $days, $licenseKey);
        } else {
            $stmt = $db->prepare($sql);
            $stmt->bind_param("i", $days);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        $stats = [];
        while ($row = $result->fetch_assoc()) {
            $stats[] = $row;
        }
        $stmt->close();
        
        return $stats;
    }
    
    private static function getDb() {
        if (self::$db === null) {
            self::$db = getDbConnection();
        }
        return self::$db;
    }
}
