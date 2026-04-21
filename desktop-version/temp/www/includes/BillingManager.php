<?php
/**
 * Billing Manager
 * Handles invoice generation, pricing, and billing operations
 *
 * Features:
 * - Generate invoices for billing periods
 * - Manage pricing configurations
 * - Track payment status
 * - Generate billing reports
 */

if (!defined('DICOM_VIEWER')) {
    die('Direct access not allowed');
}

class BillingManager {

    private $db;
    private $defaultCurrency = 'INR';

    public function __construct($db = null) {
        $this->db = $db ?: getDbConnection();
        $this->loadDefaultCurrency();
    }

    /**
     * Load default currency from settings
     */
    private function loadDefaultCurrency(): void {
        $result = $this->db->query("
            SELECT setting_value FROM system_settings
            WHERE setting_key = 'print_default_currency'
        ");
        if ($result && $row = $result->fetch_assoc()) {
            $this->defaultCurrency = $row['setting_value'];
        }
    }

    /**
     * Generate invoice for a license
     *
     * @param int $licenseId License ID
     * @param string $periodStart Start date (Y-m-d)
     * @param string $periodEnd End date (Y-m-d)
     * @param int|null $generatedBy User ID who generated
     * @return array Result with invoice details
     */
    public function generateInvoice(int $licenseId, string $periodStart, string $periodEnd, ?int $generatedBy = null): array {
        // Get license info
        $stmt = $this->db->prepare("SELECT license_key, customer_name, customer_hospital FROM licenses WHERE id = ?");
        $stmt->bind_param("i", $licenseId);
        $stmt->execute();
        $license = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$license) {
            return ['success' => false, 'error' => 'License not found'];
        }

        // Check for existing invoice in this period
        $stmt = $this->db->prepare("
            SELECT id FROM invoices
            WHERE license_id = ?
            AND billing_period_start = ?
            AND billing_period_end = ?
            AND status != 'cancelled'
        ");
        $stmt->bind_param("iss", $licenseId, $periodStart, $periodEnd);
        $stmt->execute();
        if ($stmt->get_result()->num_rows > 0) {
            $stmt->close();
            return ['success' => false, 'error' => 'Invoice already exists for this period'];
        }
        $stmt->close();

        // Get billing data
        require_once __DIR__ . '/PrintTracker.php';
        $printTracker = new PrintTracker($this->db);
        $billingData = $printTracker->getBillingData($license['license_key'], $periodStart, $periodEnd);

        if ($billingData['summary']['total_prints'] === 0) {
            return ['success' => false, 'error' => 'No billable prints in this period'];
        }

        // Generate invoice number
        $invoiceNumber = $this->generateInvoiceNumber();

        // Calculate totals
        $subtotal = $billingData['summary']['total_cost'];
        $taxPercentage = $this->getTaxPercentage($licenseId);
        $taxAmount = round($subtotal * ($taxPercentage / 100), 2);
        $totalAmount = $subtotal + $taxAmount;

        // Prepare breakdown JSON
        $breakdownByLocation = json_encode($billingData['summary']['by_location']);
        $breakdownByPaper = json_encode($billingData['summary']['by_paper']);
        $breakdownByUser = json_encode($billingData['summary']['by_user']);

        // Create invoice
        $stmt = $this->db->prepare("
            INSERT INTO invoices (
                license_id, invoice_number, billing_period_start, billing_period_end,
                total_prints, total_pages, subtotal,
                tax_percentage, tax_amount, total_amount,
                currency, status, due_date,
                breakdown_by_location, breakdown_by_paper, breakdown_by_user,
                generated_by, generated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', DATE_ADD(?, INTERVAL 30 DAY), ?, ?, ?, ?, NOW())
        ");

        $totalPrints = $billingData['summary']['total_prints'];
        $totalPages = $billingData['summary']['total_pages'];

        $stmt->bind_param(
            "isssiiddddsssssi",
            $licenseId,
            $invoiceNumber,
            $periodStart,
            $periodEnd,
            $totalPrints,
            $totalPages,
            $subtotal,
            $taxPercentage,
            $taxAmount,
            $totalAmount,
            $this->defaultCurrency,
            $periodEnd,
            $breakdownByLocation,
            $breakdownByPaper,
            $breakdownByUser,
            $generatedBy
        );

        if (!$stmt->execute()) {
            $error = $stmt->error;
            $stmt->close();
            return ['success' => false, 'error' => $error];
        }

        $invoiceId = $this->db->insert_id;
        $stmt->close();

        // Create invoice line items
        $this->createInvoiceItems($invoiceId, $billingData);

        // Mark prints as billed
        $this->markPrintsAsBilled($license['license_key'], $periodStart, $periodEnd, $invoiceId);

        return [
            'success' => true,
            'invoice' => [
                'id' => $invoiceId,
                'invoice_number' => $invoiceNumber,
                'customer' => $license['customer_name'],
                'hospital' => $license['customer_hospital'],
                'period' => "$periodStart to $periodEnd",
                'total_prints' => $totalPrints,
                'total_pages' => $totalPages,
                'subtotal' => $subtotal,
                'tax' => $taxAmount,
                'total' => $totalAmount,
                'currency' => $this->defaultCurrency
            ]
        ];
    }

    /**
     * Generate unique invoice number
     */
    private function generateInvoiceNumber(): string {
        // Get prefix from settings
        $result = $this->db->query("
            SELECT setting_value FROM system_settings
            WHERE setting_key = 'print_invoice_prefix'
        ");
        $prefix = 'INV';
        if ($result && $row = $result->fetch_assoc()) {
            $prefix = $row['setting_value'];
        }

        $year = date('Y');

        // Get next sequence number
        $result = $this->db->query("
            SELECT MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)) as max_seq
            FROM invoices
            WHERE invoice_number LIKE '{$prefix}-{$year}-%'
        ");
        $row = $result->fetch_assoc();
        $nextSeq = ($row['max_seq'] ?? 0) + 1;

        return sprintf('%s-%s-%04d', $prefix, $year, $nextSeq);
    }

    /**
     * Get tax percentage for a license
     */
    private function getTaxPercentage(int $licenseId): float {
        // Check for license-specific tax rate first
        $stmt = $this->db->prepare("
            SELECT setting_value FROM system_settings
            WHERE setting_key = 'print_tax_percentage'
        ");
        $stmt->execute();
        $result = $stmt->get_result();
        $stmt->close();

        if ($result && $row = $result->fetch_assoc()) {
            return (float) $row['setting_value'];
        }

        return 0.0; // No tax by default
    }

    /**
     * Create invoice line items
     */
    private function createInvoiceItems(int $invoiceId, array $billingData): void {
        $sortOrder = 0;

        // Group by location
        foreach ($billingData['summary']['by_location'] as $locId => $locData) {
            $stmt = $this->db->prepare("
                INSERT INTO invoice_items (
                    invoice_id, item_type, description,
                    location_id, location_name,
                    quantity, unit_price, total_price, sort_order
                ) VALUES (?, 'print', ?, ?, ?, ?, ?, ?, ?)
            ");

            $description = "Print charges - {$locData['name']}";
            $unitPrice = $locData['pages'] > 0 ? $locData['cost'] / $locData['pages'] : 0;

            $stmt->bind_param(
                "ississdi",
                $invoiceId,
                $description,
                $locId,
                $locData['name'],
                $locData['pages'],
                $unitPrice,
                $locData['cost'],
                $sortOrder
            );
            $stmt->execute();
            $stmt->close();

            $sortOrder++;
        }
    }

    /**
     * Mark prints as billed
     */
    private function markPrintsAsBilled(string $licenseKey, string $periodStart, string $periodEnd, int $invoiceId): void {
        $stmt = $this->db->prepare("
            UPDATE print_logs
            SET billed = 1, invoice_id = ?
            WHERE license_key = ?
            AND billable = 1
            AND billed = 0
            AND status = 'completed'
            AND DATE(queued_at) BETWEEN ? AND ?
        ");
        $stmt->bind_param("isss", $invoiceId, $licenseKey, $periodStart, $periodEnd);
        $stmt->execute();
        $stmt->close();
    }

    /**
     * Get invoice by ID
     */
    public function getInvoice(int $invoiceId): ?array {
        $stmt = $this->db->prepare("
            SELECT i.*, l.customer_name, l.customer_email, l.customer_hospital
            FROM invoices i
            JOIN licenses l ON i.license_id = l.id
            WHERE i.id = ?
        ");
        $stmt->bind_param("i", $invoiceId);
        $stmt->execute();
        $result = $stmt->get_result();
        $invoice = $result->fetch_assoc();
        $stmt->close();

        if (!$invoice) {
            return null;
        }

        // Decode JSON fields
        $invoice['breakdown_by_location'] = json_decode($invoice['breakdown_by_location'], true);
        $invoice['breakdown_by_paper'] = json_decode($invoice['breakdown_by_paper'], true);
        $invoice['breakdown_by_user'] = json_decode($invoice['breakdown_by_user'], true);
        $invoice['breakdown_by_day'] = json_decode($invoice['breakdown_by_day'] ?? '{}', true);

        // Get line items
        $stmt = $this->db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order");
        $stmt->bind_param("i", $invoiceId);
        $stmt->execute();
        $itemsResult = $stmt->get_result();

        $invoice['items'] = [];
        while ($item = $itemsResult->fetch_assoc()) {
            $invoice['items'][] = $item;
        }
        $stmt->close();

        return $invoice;
    }

    /**
     * Get all invoices for a license
     */
    public function getInvoicesByLicense(int $licenseId): array {
        $stmt = $this->db->prepare("
            SELECT *
            FROM invoices
            WHERE license_id = ?
            ORDER BY created_at DESC
        ");
        $stmt->bind_param("i", $licenseId);
        $stmt->execute();
        $result = $stmt->get_result();

        $invoices = [];
        while ($row = $result->fetch_assoc()) {
            $invoices[] = $row;
        }
        $stmt->close();

        return $invoices;
    }

    /**
     * Get all invoices (for super admin)
     */
    public function getAllInvoices(?string $status = null, int $limit = 50): array {
        $sql = "
            SELECT i.*, l.customer_name, l.customer_hospital
            FROM invoices i
            JOIN licenses l ON i.license_id = l.id
        ";

        $params = [];
        $types = "";

        if ($status) {
            $sql .= " WHERE i.status = ?";
            $params[] = $status;
            $types .= "s";
        }

        $sql .= " ORDER BY i.created_at DESC LIMIT ?";
        $params[] = $limit;
        $types .= "i";

        $stmt = $this->db->prepare($sql);
        if (!empty($params)) {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $result = $stmt->get_result();

        $invoices = [];
        while ($row = $result->fetch_assoc()) {
            $invoices[] = $row;
        }
        $stmt->close();

        return $invoices;
    }

    /**
     * Update invoice status
     */
    public function updateInvoiceStatus(int $invoiceId, string $status, ?string $paymentReference = null): bool {
        $sql = "UPDATE invoices SET status = ?";
        $params = [$status];
        $types = "s";

        if ($status === 'paid') {
            $sql .= ", paid_date = CURDATE()";
            if ($paymentReference) {
                $sql .= ", payment_reference = ?";
                $params[] = $paymentReference;
                $types .= "s";
            }
        }

        $sql .= " WHERE id = ?";
        $params[] = $invoiceId;
        $types .= "i";

        $stmt = $this->db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $result = $stmt->execute();
        $stmt->close();

        return $result;
    }

    /**
     * Cancel invoice and unmark prints
     */
    public function cancelInvoice(int $invoiceId): bool {
        // Unmark prints as billed
        $stmt = $this->db->prepare("
            UPDATE print_logs SET billed = 0, invoice_id = NULL WHERE invoice_id = ?
        ");
        $stmt->bind_param("i", $invoiceId);
        $stmt->execute();
        $stmt->close();

        // Cancel invoice
        return $this->updateInvoiceStatus($invoiceId, 'cancelled');
    }

    /**
     * Get pricing configuration
     */
    public function getPricing(?int $licenseId = null): array {
        $sql = "SELECT * FROM print_pricing WHERE 1=1";
        $params = [];
        $types = "";

        if ($licenseId) {
            $sql .= " AND (license_id = ? OR license_id IS NULL)";
            $params[] = $licenseId;
            $types .= "i";
        } else {
            $sql .= " AND license_id IS NULL";
        }

        $sql .= " AND (effective_until IS NULL OR effective_until >= CURDATE())
                  ORDER BY license_id DESC, paper_size, color_mode";

        $stmt = $this->db->prepare($sql);
        if (!empty($params)) {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $result = $stmt->get_result();

        $pricing = [];
        while ($row = $result->fetch_assoc()) {
            $pricing[] = $row;
        }
        $stmt->close();

        return $pricing;
    }

    /**
     * Set pricing
     */
    public function setPricing(array $pricingData): array {
        $licenseId = $pricingData['license_id'] ?? null;
        $paperSize = $pricingData['paper_size'] ?? 'A4';
        $colorMode = $pricingData['color_mode'] ?? 'any';
        $costPerPage = $pricingData['cost_per_page'];
        $effectiveFrom = $pricingData['effective_from'] ?? date('Y-m-d');
        $effectiveUntil = $pricingData['effective_until'] ?? null;
        $description = $pricingData['description'] ?? null;
        $createdBy = $_SESSION['user_id'] ?? null;

        // End any existing pricing for this combination
        $stmt = $this->db->prepare("
            UPDATE print_pricing
            SET effective_until = DATE_SUB(?, INTERVAL 1 DAY)
            WHERE (license_id = ? OR (license_id IS NULL AND ? IS NULL))
            AND paper_size = ?
            AND color_mode = ?
            AND (effective_until IS NULL OR effective_until >= ?)
        ");
        $stmt->bind_param("siisss", $effectiveFrom, $licenseId, $licenseId, $paperSize, $colorMode, $effectiveFrom);
        $stmt->execute();
        $stmt->close();

        // Insert new pricing
        $stmt = $this->db->prepare("
            INSERT INTO print_pricing (
                license_id, paper_size, color_mode, cost_per_page,
                currency, effective_from, effective_until, description, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->bind_param(
            "issdssssi",
            $licenseId,
            $paperSize,
            $colorMode,
            $costPerPage,
            $this->defaultCurrency,
            $effectiveFrom,
            $effectiveUntil,
            $description,
            $createdBy
        );

        if ($stmt->execute()) {
            $id = $this->db->insert_id;
            $stmt->close();
            return ['success' => true, 'pricing_id' => $id];
        }

        $error = $stmt->error;
        $stmt->close();
        return ['success' => false, 'error' => $error];
    }

    /**
     * Get billing summary for dashboard
     */
    public function getBillingSummary(): array {
        $result = $this->db->query("
            SELECT
                COUNT(*) as total_invoices,
                SUM(CASE WHEN status = 'generated' OR status = 'sent' THEN 1 ELSE 0 END) as pending_invoices,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
                SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
                SUM(CASE WHEN status IN ('generated', 'sent') THEN total_amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
                SUM(CASE WHEN status = 'overdue' THEN total_amount ELSE 0 END) as overdue_amount
            FROM invoices
            WHERE status != 'cancelled'
        ");

        return $result->fetch_assoc() ?: [];
    }

    /**
     * Get unbilled amount for a license
     */
    public function getUnbilledAmount(string $licenseKey): array {
        $stmt = $this->db->prepare("
            SELECT
                COUNT(*) as prints,
                SUM(total_pages) as pages,
                SUM(COALESCE(total_cost, 0)) as amount
            FROM print_logs
            WHERE license_key = ?
            AND billable = 1
            AND billed = 0
            AND status = 'completed'
        ");
        $stmt->bind_param("s", $licenseKey);
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        return $result ?: ['prints' => 0, 'pages' => 0, 'amount' => 0];
    }

    /**
     * Check for overdue invoices and update status
     */
    public function updateOverdueInvoices(): int {
        $result = $this->db->query("
            UPDATE invoices
            SET status = 'overdue'
            WHERE status IN ('generated', 'sent')
            AND due_date < CURDATE()
        ");

        return $this->db->affected_rows;
    }

    /**
     * Generate invoice PDF data (for PDF generation)
     */
    public function getInvoicePdfData(int $invoiceId): ?array {
        $invoice = $this->getInvoice($invoiceId);
        if (!$invoice) {
            return null;
        }

        // Get system settings for company info
        $settings = [];
        $result = $this->db->query("
            SELECT setting_key, setting_value FROM system_settings
            WHERE setting_key LIKE 'company_%'
        ");
        while ($row = $result->fetch_assoc()) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }

        return [
            'invoice' => $invoice,
            'company' => $settings,
            'generated_at' => date('Y-m-d H:i:s')
        ];
    }
}