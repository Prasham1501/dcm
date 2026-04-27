<?php
declare(strict_types=1);

class ApiKeyController {

    public function index(Request $req): void {
        $stmt = db()->prepare(
            "SELECT id, label, prefix, last_used_at, created_at FROM api_keys
             WHERE account_id = ? AND revoked_at IS NULL ORDER BY created_at DESC"
        );
        $stmt->execute([$req->user['account_id']]);
        Response::json($stmt->fetchAll());
    }

    public function create(Request $req): void {
        $body = $req->body();
        Validator::make($body, ['label' => 'required|min:2|max:100'])->throwIfFails();

        // Limit to 10 active keys
        $countStmt = db()->prepare("SELECT COUNT(*) FROM api_keys WHERE account_id = ? AND revoked_at IS NULL");
        $countStmt->execute([$req->user['account_id']]);
        if ((int)$countStmt->fetchColumn() >= 10) {
            Response::error('Maximum of 10 API keys allowed. Revoke one first.', 400);
        }

        $plain  = 'mv_live_' . bin2hex(random_bytes(20));
        $prefix = substr($plain, 0, 12);
        $hash   = Auth::passwordHash($plain);

        db()->prepare(
            "INSERT INTO api_keys (id, account_id, user_id, label, prefix, key_hash, created_at)
             VALUES (?,?,?,?,?,?,?)"
        )->execute([generateId(), $req->user['account_id'], $req->user['id'], $body['label'], $prefix, $hash, nowDb()]);

        AuditLog::fromRequest($req, 'apikey.create', $body['label']);

        Response::json(['prefix' => $prefix, 'plain' => $plain, 'label' => $body['label'], 'message' => 'Copy this key — it will not be shown again.'], 201);
    }

    public function delete(Request $req): void {
        $keyId = $req->param('id');

        $stmt = db()->prepare("SELECT id, label FROM api_keys WHERE id = ? AND account_id = ?");
        $stmt->execute([$keyId, $req->user['account_id']]);
        $key = $stmt->fetch();
        if (!$key) Response::error('API key not found', 404);

        db()->prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?")->execute([nowDb(), $keyId]);
        AuditLog::fromRequest($req, 'apikey.revoke', $key['label']);
        Response::ok();
    }
}
