<?php
/**
 * Print Tracker
 * Handles print logging, tracking, and analytics for billing
 *
 * Features:
 * - Log every print with full details
 * - Calculate costs based on pricing configuration
 * - Support offline print queueing
 * - Aggregate statistics for dashboards
 * - Generate billing data
 */

if (!defined('DICOM_VIEWER')) {
    die('Direct access not allowed');
}

class PrintTracker {

    private $db;
    private $licenseKey;
    private $machineId;
    private $activationId;
    private $locationId;

    public function __construct($db = null) {
        $this->db = $db ?: getDbConnection();
        $this->loadInstallationInfo();
    }

    /**
     * Load current installation info (license, machine, location)
     */
    private function loadInstallationInfo(): void {
        // Get license and machine info
        $result = $this->db->query("SELECT license_key, machine_id FROM installation_license WHERE id = 1");
        if ($result && $row = $result->fetch_assoc()) {
            $this->licenseKey = $row['license_key'];
            $this->machineId = $row['machine_id'];
        }

        // Get activation ID
        if ($this->licenseKey && $this->machineId) {
            $stmt = $this->db->prepare("
                SELECT la.id, ml.location_id
                FROM license_activations la
                LEFT JOIN machine_locations ml ON la.id = ml.activation_id AND ml.is_current = 1
                WHERE la.machine_id = ? AND la.is_active = 1
                ORDER BY la.activated_at DESC LIMIT 1
            ");
            $stmt->bind_param("s", $this->machineId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($row = $result->fetch_assoc()) {
                $this->activationId = $row['id'];
                $this->locationId = $row['location_id'];
            }
            $stmt->close();
        }
    }

    /**
     * Generate unique print job ID
     */
    public function generatePrintJobId(): string {
        return sprintf('%s-%s-%s',
            date('Ymd-His'),
            substr($this->machineId ?? 'local', 0, 8),
            bin2hex(random_bytes(4))
        );
    }

    /**
     * Log a print job
     *
     * @param array $printData Print job details
     * @return array Result with success status and print_job_id
     */
    public function logPrint(array $printData): array {
        $printJobId = $printData['print_job_id'] ?? $this->generatePrintJobId();

        // Calculate cost
        $costInfo = $this->calculateCost(
            $printData['paper_size'] ?? 'A4',
            $printData['color_mode'] ?? 'grayscale',
            $printData['total_pages'] ?? 1
        );

        // Get user info
        $userId = $_SESSION['user_id'] ?? null;
        $userName = $_SESSION['username'] ?? null;

        // Use provided location or default
        $locationId = $printData['location_id'] ?? $this->locationId;

        $stmt = $this->db->prepare("
            INSERT INTO print_logs (
                license_key, machine_id, activation_id, location_id,
                user_id, user_name, print_job_id,
                study_uid, patient_id, patient_name,
                paper_size, orientation, copies, pages_per_copy, total_pages,
                color_mode, quality, printer_name, printer_type,
                layout_type, print_type, include_patient_info, include_annotations, include_measurements,
                status, is_offline_print, offline_queue_id,
                cost_per_page, total_cost, billable
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $copies = $printData['copies'] ?? 1;
        $pagesPerCopy = $printData['pages_per_copy'] ?? 1;
        $totalPages = $printData['total_pages'] ?? ($copies * $pagesPerCopy);
        $status = $printData['status'] ?? 'queued';
        $isOffline = $printData['is_offline'] ?? 0;
        $offlineQueueId = $printData['offline_queue_id'] ?? null;
        $billable = $printData['billable'] ?? 1;
        $printType = $printData['print_type'] ?? 'image'; // 'image' or 'report'

        $stmt->bind_param(
            "ssiissssssssiiissssssiiisssisd",
            $this->licenseKey,
            $this->machineId,
            $this->activationId,
            $locationId,
            $userId,
            $userName,
            $printJobId,
            $printData['study_uid'],
            $printData['patient_id'],
            $printData['patient_name'],
            $printData['paper_size'],
            $printData['orientation'],
            $copies,
            $pagesPerCopy,
            $totalPages,
            $printData['color_mode'],
            $printData['quality'],
            $printData['printer_name'],
            $printData['printer_type'],
            $printData['layout_type'],
            $printType,
            $printData['include_patient_info'],
            $printData['include_annotations'],
            $printData['include_measurements'],
            $status,
            $isOffline,
            $offlineQueueId,
            $costInfo['cost_per_page'],
            $costInfo['total_cost'],
            $billable
        );

        if ($stmt->execute()) {
            $printLogId = $this->db->insert_id;
            $stmt->close();

            // Log activity
            if (class_exists('ActivityLogger')) {
                ActivityLogger::logPrint('print_queued', [
                    'print_job_id' => $printJobId,
                    'paper_size' => $printData['paper_size'] ?? 'A4',
                    'pages' => $totalPages,
                    'printer' => $printData['printer_name'] ?? 'Unknown'
                ]);
            }

            return [
                'success' => true,
                'print_log_id' => $printLogId,
                'print_job_id' => $printJobId,
                'cost' => $costInfo
            ];
        }

        $error = $stmt->error;
        $stmt->close();

        return ['success' => false, 'error' => $error];
    }

    /**
     * Update print job status
     *
     * @param string $printJobId Print job ID
     * @param string $status New status (printing, completed, failed, cancelled)
     * @param string|null $errorMessage Error message if failed
     * @return bool Success status
     */
    public function updatePrintStatus(string $printJobId, string $status, ?string $errorMessage = null): bool {
        $timestampField = match($status) {
            'printing' => 'started_at',
            'completed', 'failed', 'cancelled' => 'completed_at',
            default => null
        };

        $sql = "UPDATE print_logs SET status = ?";
        $params = [$status];
        $types = "s";

        if ($timestampField) {
            $sql .= ", $timestampField = NOW()";
        }

        if ($errorMessage && $status === 'failed') {
            $sql .= ", error_message = ?";
            $params[] = $errorMessage;
            $types .= "s";
        }

        $sql .= " WHERE print_job_id = ?";
        $params[] = $printJobId;
        $types .= "s";

        $stmt = $this->db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $result = $stmt->execute();
        $stmt->close();

        // Log activity for completion
        if ($result && in_array($status, ['completed', 'failed'])) {
            if (class_exists('ActivityLogger')) {
                ActivityLogger::logPrint('print_' . $status, [
                    'print_job_id' => $printJobId
                ]);
            }

            // Update daily stats
            $this->updateDailyStats();
        }

        return $result;
    }

    /**
     * Calculate cost for a print job
     */
    public function calculateCost(string $paperSize, string $colorMode, int $pages): array {
        // Try to get license-specific pricing first, then global
        $stmt = $this->db->prepare("
            SELECT cost_per_page
            FROM print_pricing
            WHERE (license_id IS NULL OR license_id = (
                SELECT id FROM licenses WHERE license_key = ? LIMIT 1
            ))
            AND (paper_size = ? OR paper_size = 'default')
            AND (color_mode = ? OR color_mode = 'any')
            AND effective_from <= CURDATE()
            AND (effective_until IS NULL OR effective_until >= CURDATE())
            ORDER BY
                license_id DESC,
                CASE WHEN paper_size = ? THEN 0 ELSE 1 END,
                CASE WHEN color_mode = ? THEN 0 ELSE 1 END
            LIMIT 1
        ");

        $stmt->bind_param("sssss", $this->licenseKey, $paperSize, $colorMode, $paperSize, $colorMode);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        $stmt->close();

        $costPerPage = $row['cost_per_page'] ?? 5.00; // Default fallback

        return [
            'cost_per_page' => (float) $costPerPage,
            'total_cost' => round($costPerPage * $pages, 2),
            'pages' => $pages,
            'currency' => 'INR'
        ];
    }

    /**
     * Get prints by location
     */
    public function getPrintsByLocation(int $locationId, ?string $dateFrom = null, ?string $dateTo = null): array {
        $dateFrom = $dateFrom ?? date('Y-m-d', strtotime('-30 days'));
        $dateTo = $dateTo ?? date('Y-m-d');

        $stmt = $this->db->prepare("
            SELECT
                pl.*,
                l.location_name,
                l.location_code
            FROM print_logs pl
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.location_id = ?
            AND DATE(pl.queued_at) BETWEEN ? AND ?
            ORDER BY pl.queued_at DESC
        ");

        $stmt->bind_param("iss", $locationId, $dateFrom, $dateTo);
        $stmt->execute();
        $result = $stmt->get_result();

        $prints = [];
        while ($row = $result->fetch_assoc()) {
            $prints[] = $row;
        }
        $stmt->close();

        return $prints;
    }

    /**
     * Get prints by machine
     */
    public function getPrintsByMachine(string $machineId, ?string $dateFrom = null, ?string $dateTo = null): array {
        $dateFrom = $dateFrom ?? date('Y-m-d', strtotime('-30 days'));
        $dateTo = $dateTo ?? date('Y-m-d');

        $stmt = $this->db->prepare("
            SELECT
                pl.*,
                l.location_name,
                l.location_code
            FROM print_logs pl
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.machine_id = ?
            AND DATE(pl.queued_at) BETWEEN ? AND ?
            ORDER BY pl.queued_at DESC
        ");

        $stmt->bind_param("sss", $machineId, $dateFrom, $dateTo);
        $stmt->execute();
        $result = $stmt->get_result();

        $prints = [];
        while ($row = $result->fetch_assoc()) {
            $prints[] = $row;
        }
        $stmt->close();

        return $prints;
    }

    /**
     * Get prints by user
     */
    public function getPrintsByUser(int $userId, ?string $dateFrom = null, ?string $dateTo = null): array {
        $dateFrom = $dateFrom ?? date('Y-m-d', strtotime('-30 days'));
        $dateTo = $dateTo ?? date('Y-m-d');

        $stmt = $this->db->prepare("
            SELECT
                pl.*,
                l.location_name,
                l.location_code
            FROM print_logs pl
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.user_id = ?
            AND DATE(pl.queued_at) BETWEEN ? AND ?
            ORDER BY pl.queued_at DESC
        ");

        $stmt->bind_param("iss", $userId, $dateFrom, $dateTo);
        $stmt->execute();
        $result = $stmt->get_result();

        $prints = [];
        while ($row = $result->fetch_assoc()) {
            $prints[] = $row;
        }
        $stmt->close();

        return $prints;
    }

    /**
     * Get print statistics summary
     */
    public function getStatsSummary(?string $licenseKey = null, ?string $dateFrom = null, ?string $dateTo = null): array {
        $licenseKey = $licenseKey ?? $this->licenseKey;
        $dateFrom = $dateFrom ?? date('Y-m-d', strtotime('-30 days'));
        $dateTo = $dateTo ?? date('Y-m-d');

        $whereClause = "DATE(queued_at) BETWEEN ? AND ?";
        $params = [$dateFrom, $dateTo];
        $types = "ss";

        if ($licenseKey) {
            $whereClause .= " AND license_key = ?";
            $params[] = $licenseKey;
            $types .= "s";
        }

        $stmt = $this->db->prepare("
            SELECT
                COUNT(*) as total_prints,
                SUM(total_pages) as total_pages,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_prints,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_prints,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_prints,
                SUM(CASE WHEN paper_size = 'A4' THEN total_pages ELSE 0 END) as a4_pages,
                SUM(CASE WHEN paper_size = 'A3' THEN total_pages ELSE 0 END) as a3_pages,
                SUM(CASE WHEN color_mode = 'grayscale' THEN total_pages ELSE 0 END) as grayscale_pages,
                SUM(CASE WHEN color_mode = 'color' THEN total_pages ELSE 0 END) as color_pages,
                SUM(COALESCE(total_cost, 0)) as total_cost,
                SUM(CASE WHEN billed = 1 THEN COALESCE(total_cost, 0) ELSE 0 END) as billed_cost,
                SUM(CASE WHEN billed = 0 THEN COALESCE(total_cost, 0) ELSE 0 END) as unbilled_cost,
                COUNT(DISTINCT location_id) as locations_used,
                COUNT(DISTINCT user_id) as users_active,
                COUNT(DISTINCT machine_id) as machines_active
            FROM print_logs
            WHERE $whereClause
        ");

        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
        $stats = $result->fetch_assoc();
        $stmt->close();

        return $stats ?: [];
    }

    /**
     * Get statistics by location
     */
    public function getStatsByLocation(?string $licenseKey = null, ?string $dateFrom = null, ?string $dateTo = null): array {
        $licenseKey = $licenseKey ?? $this->licenseKey;
        $dateFrom = $dateFrom ?? date('Y-m-d', strtotime('-30 days'));
        $dateTo = $dateTo ?? date('Y-m-d');

        $sql = "
            SELECT
                l.id as location_id,
                l.location_code,
                l.location_name,
                l.department,
                COUNT(pl.id) as total_prints,
                SUM(pl.total_pages) as total_pages,
                SUM(CASE WHEN pl.status = 'completed' THEN 1 ELSE 0 END) as completed_prints,
                SUM(COALESCE(pl.total_cost, 0)) as total_cost,
                MAX(pl.queued_at) as last_print_at
            FROM locations l
            LEFT JOIN print_logs pl ON l.id = pl.location_id
                AND DATE(pl.queued_at) BETWEEN ? AND ?
        ";

        $params = [$dateFrom, $dateTo];
        $types = "ss";

        if ($licenseKey) {
            $sql .= " AND (pl.license_key = ? OR pl.license_key IS NULL)";
            $params[] = $licenseKey;
            $types .= "s";
        }

        $sql .= " GROUP BY l.id, l.location_code, l.location_name, l.department
                  ORDER BY total_pages DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();

        $stats = [];
        while ($row = $result->fetch_assoc()) {
            $stats[] = $row;
        }
        $stmt->close();

        return $stats;
    }

    /**
     * Get statistics by user
     */
    public function getStatsByUser(?string $licenseKey = null, ?string $dateFrom = null, ?string $dateTo = null): array {
        $licenseKey = $licenseKey ?? $this->licenseKey;
        $dateFrom = $dateFrom ?? date('Y-m-d', strtotime('-30 days'));
        $dateTo = $dateTo ?? date('Y-m-d');

        $whereClause = "DATE(pl.queued_at) BETWEEN ? AND ?";
        $params = [$dateFrom, $dateTo];
        $types = "ss";

        if ($licenseKey) {
            $whereClause .= " AND pl.license_key = ?";
            $params[] = $licenseKey;
            $types .= "s";
        }

        $stmt = $this->db->prepare("
            SELECT
                u.id as user_id,
                u.username,
                u.full_name,
                l.location_name,
                COUNT(pl.id) as total_prints,
                SUM(pl.total_pages) as total_pages,
                SUM(COALESCE(pl.total_cost, 0)) as total_cost,
                MAX(pl.queued_at) as last_print_at
            FROM users u
            INNER JOIN print_logs pl ON u.id = pl.user_id
            LEFT JOIN locations l ON u.default_location_id = l.id
            WHERE $whereClause
            GROUP BY u.id, u.username, u.full_name, l.location_name
            ORDER BY total_pages DESC
        ");

        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();

        $stats = [];
        while ($row = $result->fetch_assoc()) {
            $stats[] = $row;
        }
        $stmt->close();

        return $stats;
    }

    /**
     * Get daily trend data
     */
    public function getDailyTrend(?string $licenseKey = null, int $days = 30): array {
        $licenseKey = $licenseKey ?? $this->licenseKey;

        $sql = "
            SELECT
                DATE(queued_at) as print_date,
                COUNT(*) as print_count,
                SUM(total_pages) as page_count,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(COALESCE(total_cost, 0)) as daily_cost
            FROM print_logs
            WHERE queued_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        ";

        $params = [$days];
        $types = "i";

        if ($licenseKey) {
            $sql .= " AND license_key = ?";
            $params[] = $licenseKey;
            $types .= "s";
        }

        $sql .= " GROUP BY DATE(queued_at) ORDER BY print_date DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();

        $trends = [];
        while ($row = $result->fetch_assoc()) {
            $trends[] = $row;
        }
        $stmt->close();

        return $trends;
    }

    /**
     * Get billing data for invoice generation
     */
    public function getBillingData(string $licenseKey, string $periodStart, string $periodEnd): array {
        $stmt = $this->db->prepare("
            SELECT
                pl.id,
                pl.print_job_id,
                pl.queued_at,
                pl.location_id,
                l.location_name,
                l.location_code,
                pl.user_name,
                pl.paper_size,
                pl.color_mode,
                pl.total_pages,
                pl.cost_per_page,
                pl.total_cost,
                pl.printer_name
            FROM print_logs pl
            LEFT JOIN locations l ON pl.location_id = l.id
            WHERE pl.license_key = ?
            AND pl.billable = 1
            AND pl.billed = 0
            AND pl.status = 'completed'
            AND DATE(pl.queued_at) BETWEEN ? AND ?
            ORDER BY pl.queued_at ASC
        ");

        $stmt->bind_param("sss", $licenseKey, $periodStart, $periodEnd);
        $stmt->execute();
        $result = $stmt->get_result();

        $prints = [];
        $summary = [
            'total_prints' => 0,
            'total_pages' => 0,
            'total_cost' => 0,
            'by_location' => [],
            'by_paper' => [],
            'by_user' => []
        ];

        while ($row = $result->fetch_assoc()) {
            $prints[] = $row;

            $summary['total_prints']++;
            $summary['total_pages'] += $row['total_pages'];
            $summary['total_cost'] += $row['total_cost'];

            // By location
            $locId = $row['location_id'] ?? 'unknown';
            if (!isset($summary['by_location'][$locId])) {
                $summary['by_location'][$locId] = [
                    'name' => $row['location_name'] ?? 'Unknown Location',
                    'code' => $row['location_code'] ?? '',
                    'prints' => 0,
                    'pages' => 0,
                    'cost' => 0
                ];
            }
            $summary['by_location'][$locId]['prints']++;
            $summary['by_location'][$locId]['pages'] += $row['total_pages'];
            $summary['by_location'][$locId]['cost'] += $row['total_cost'];

            // By paper size
            $paper = $row['paper_size'];
            $color = $row['color_mode'];
            $key = "{$paper}_{$color}";
            if (!isset($summary['by_paper'][$key])) {
                $summary['by_paper'][$key] = [
                    'paper_size' => $paper,
                    'color_mode' => $color,
                    'pages' => 0,
                    'cost' => 0
                ];
            }
            $summary['by_paper'][$key]['pages'] += $row['total_pages'];
            $summary['by_paper'][$key]['cost'] += $row['total_cost'];

            // By user
            $userName = $row['user_name'] ?? 'Unknown';
            if (!isset($summary['by_user'][$userName])) {
                $summary['by_user'][$userName] = [
                    'prints' => 0,
                    'pages' => 0
                ];
            }
            $summary['by_user'][$userName]['prints']++;
            $summary['by_user'][$userName]['pages'] += $row['total_pages'];
        }
        $stmt->close();

        return [
            'prints' => $prints,
            'summary' => $summary
        ];
    }

    /**
     * Update daily aggregated stats
     */
    public function updateDailyStats(?string $date = null): bool {
        $date = $date ?? date('Y-m-d');

        // Call stored procedure if available, otherwise do it manually
        try {
            $stmt = $this->db->prepare("CALL sp_aggregate_daily_stats(?)");
            $stmt->bind_param("s", $date);
            $result = $stmt->execute();
            $stmt->close();
            return $result;
        } catch (Exception $e) {
            // Stored procedure might not exist, do manual update
            return $this->manualDailyStatsUpdate($date);
        }
    }

    /**
     * Manual daily stats update (fallback)
     */
    private function manualDailyStatsUpdate(string $date): bool {
        $stmt = $this->db->prepare("
            INSERT INTO daily_print_stats (
                stat_date, license_key, machine_id, location_id, user_id,
                total_prints, total_pages, successful_prints, failed_prints,
                a4_pages, a3_pages, grayscale_pages, color_pages, total_cost
            )
            SELECT
                ?,
                license_key,
                machine_id,
                location_id,
                user_id,
                COUNT(*),
                SUM(total_pages),
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
                SUM(CASE WHEN paper_size = 'A4' THEN total_pages ELSE 0 END),
                SUM(CASE WHEN paper_size = 'A3' THEN total_pages ELSE 0 END),
                SUM(CASE WHEN color_mode = 'grayscale' THEN total_pages ELSE 0 END),
                SUM(CASE WHEN color_mode = 'color' THEN total_pages ELSE 0 END),
                SUM(COALESCE(total_cost, 0))
            FROM print_logs
            WHERE DATE(queued_at) = ?
            GROUP BY license_key, machine_id, location_id, user_id
            ON DUPLICATE KEY UPDATE
                total_prints = VALUES(total_prints),
                total_pages = VALUES(total_pages),
                successful_prints = VALUES(successful_prints),
                failed_prints = VALUES(failed_prints),
                a4_pages = VALUES(a4_pages),
                a3_pages = VALUES(a3_pages),
                grayscale_pages = VALUES(grayscale_pages),
                color_pages = VALUES(color_pages),
                total_cost = VALUES(total_cost),
                updated_at = NOW()
        ");

        $stmt->bind_param("ss", $date, $date);
        $result = $stmt->execute();
        $stmt->close();

        return $result;
    }

    /**
     * Get current machine's location
     */
    public function getCurrentLocation(): ?array {
        if (!$this->locationId) {
            return null;
        }

        $stmt = $this->db->prepare("SELECT * FROM locations WHERE id = ?");
        $stmt->bind_param("i", $this->locationId);
        $stmt->execute();
        $result = $stmt->get_result();
        $location = $result->fetch_assoc();
        $stmt->close();

        return $location;
    }

    /**
     * Set current machine's location
     */
    public function setMachineLocation(int $locationId, ?int $assignedBy = null): bool {
        if (!$this->activationId) {
            return false;
        }

        // Mark current assignment as not current
        $stmt = $this->db->prepare("
            UPDATE machine_locations SET is_current = 0 WHERE activation_id = ?
        ");
        $stmt->bind_param("i", $this->activationId);
        $stmt->execute();
        $stmt->close();

        // Create new assignment
        $stmt = $this->db->prepare("
            INSERT INTO machine_locations (activation_id, location_id, assigned_by, is_current)
            VALUES (?, ?, ?, 1)
        ");
        $stmt->bind_param("iii", $this->activationId, $locationId, $assignedBy);
        $result = $stmt->execute();
        $stmt->close();

        if ($result) {
            $this->locationId = $locationId;
        }

        return $result;
    }

    /**
     * Get all locations
     */
    public function getAllLocations(?int $licenseId = null): array {
        if ($licenseId) {
            $stmt = $this->db->prepare("
                SELECT * FROM locations WHERE license_id = ? OR license_id IS NULL ORDER BY location_name
            ");
            $stmt->bind_param("i", $licenseId);
        } else {
            $stmt = $this->db->prepare("SELECT * FROM locations ORDER BY location_name");
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $locations = [];
        while ($row = $result->fetch_assoc()) {
            $locations[] = $row;
        }
        $stmt->close();

        return $locations;
    }

    // Getters
    public function getLicenseKey(): ?string {
        return $this->licenseKey;
    }

    public function getMachineId(): ?string {
        return $this->machineId;
    }

    public function getLocationId(): ?int {
        return $this->locationId;
    }
}