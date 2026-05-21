<?php
declare(strict_types=1);

class RazorpayClient {

    private string $keyId;
    private string $keySecret;

    public function __construct() {
        $this->keyId     = Settings::get('razorpay.key_id');
        $this->keySecret = Settings::get('razorpay.key_secret');

        if (!$this->keyId || !$this->keySecret) {
            Response::error('Razorpay is not configured. Contact support.', 503);
        }
    }

    /** Cheap, non-throwing config check. */
    public static function isConfigured(): bool {
        $k = Settings::get('razorpay.key_id');
        $s = Settings::get('razorpay.key_secret');
        return !empty($k) && !empty($s);
    }

    /** Create a Razorpay order and return order details */
    public function createOrder(int $amountPaise, string $receipt, array $notes = []): array {
        // Use Razorpay SDK if available
        if (class_exists('Razorpay\Api\Api')) {
            $api   = new \Razorpay\Api\Api($this->keyId, $this->keySecret);
            $order = $api->order->create([
                'amount'   => $amountPaise,
                'currency' => 'INR',
                'receipt'  => $receipt,
                'notes'    => $notes,
            ]);
            return $order->toArray();
        }

        // Manual HTTP fallback
        $payload = json_encode(['amount' => $amountPaise, 'currency' => 'INR', 'receipt' => $receipt, 'notes' => $notes]);
        $resp    = $this->curlPost('https://api.razorpay.com/v1/orders', $payload);
        if (!isset($resp['id'])) throw new \RuntimeException('Razorpay order creation failed: ' . json_encode($resp));
        return $resp;
    }

    /** Verify payment signature (HMAC SHA-256) */
    public function verifySignature(string $orderId, string $paymentId, string $signature): bool {
        $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $this->keySecret);
        return hash_equals($expected, $signature);
    }

    /** Verify webhook signature */
    public function verifyWebhookSignature(string $body, string $signature): bool {
        $secret   = Settings::get('razorpay.webhook_secret');
        $expected = hash_hmac('sha256', $body, $secret);
        return hash_equals($expected, $signature);
    }

    /** Fetch payment details */
    public function fetchPayment(string $paymentId): array {
        if (class_exists('Razorpay\Api\Api')) {
            return (new \Razorpay\Api\Api($this->keyId, $this->keySecret))->payment->fetch($paymentId)->toArray();
        }
        return $this->curlGet("https://api.razorpay.com/v1/payments/$paymentId");
    }

    public function getPublicKey(): string {
        return $this->keyId;
    }

    private function curlPost(string $url, string $body): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_USERPWD        => "$this->keyId:$this->keySecret",
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        ]);
        $resp = curl_exec($ch); curl_close($ch);
        return json_decode($resp ?: '{}', true) ?: [];
    }

    private function curlGet(string $url): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERPWD        => "$this->keyId:$this->keySecret",
        ]);
        $resp = curl_exec($ch); curl_close($ch);
        return json_decode($resp ?: '{}', true) ?: [];
    }
}
