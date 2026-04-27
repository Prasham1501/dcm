<?php
declare(strict_types=1);

class WebhookController {

    public function razorpay(Request $req): void {
        $body = file_get_contents('php://input');
        $sig  = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

        $rzp = new RazorpayClient();
        if (!$rzp->verifyWebhookSignature($body, $sig)) {
            http_response_code(400);
            exit('Invalid signature');
        }

        $event = json_decode($body, true);
        $type  = $event['event'] ?? '';

        switch ($type) {
            case 'payment.captured':
                $this->handleCapture($event['payload']['payment']['entity'] ?? []);
                break;
            case 'payment.failed':
                $this->handleFailed($event['payload']['payment']['entity'] ?? []);
                break;
        }

        http_response_code(200);
        echo 'ok';
        exit;
    }

    private function handleCapture(array $payment): void {
        $orderId = $payment['order_id'] ?? '';
        if (!$orderId) return;

        // Mark payment as captured if not already done by frontend verify
        try {
            db()->prepare("UPDATE payments SET status='captured', rzp_payment_id=?, captured_at=? WHERE rzp_order_id=? AND status='created'")
                ->execute([$payment['id'] ?? '', nowDb(), $orderId]);
        } catch (\Throwable $e) {
            error_log('[Webhook/capture] ' . $e->getMessage());
        }
    }

    private function handleFailed(array $payment): void {
        $orderId = $payment['order_id'] ?? '';
        if (!$orderId) return;
        try {
            db()->prepare("UPDATE payments SET status='failed' WHERE rzp_order_id=? AND status='created'")
                ->execute([$orderId]);
        } catch (\Throwable) {}
    }
}
