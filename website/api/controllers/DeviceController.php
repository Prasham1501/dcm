<?php
declare(strict_types=1);

class DeviceController {

    public function index(Request $req): void {
        $stmt = db()->prepare(
            "SELECT d.*, l.key_code, l.plan, l.seats,
                    (SELECT COUNT(*) FROM devices d2 WHERE d2.license_id=l.id AND d2.status='active') AS seats_used
             FROM devices d JOIN licenses l ON d.license_id=l.id
             WHERE d.account_id = ?
             ORDER BY d.activated_at DESC"
        );
        $stmt->execute([$req->user['account_id']]);
        Response::json($stmt->fetchAll());
    }

    public function deactivate(Request $req): void {
        $devId = $req->param('id');

        $stmt = db()->prepare("SELECT id, account_id, machine_name FROM devices WHERE id = ?");
        $stmt->execute([$devId]);
        $dev = $stmt->fetch();

        if (!$dev || $dev['account_id'] !== $req->user['account_id']) {
            Response::error('Device not found', 404);
        }

        db()->prepare("UPDATE devices SET status='deactivated', deactivated_at=? WHERE id=?")
            ->execute([nowDb(), $devId]);

        AuditLog::fromRequest($req, 'device.deactivate', $dev['machine_name']);
        Response::ok(['message' => 'Device deactivated. The seat is now free.']);
    }
}
