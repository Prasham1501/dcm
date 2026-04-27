<?php
declare(strict_types=1);

class TeamController {

    public function index(Request $req): void {
        $stmt = db()->prepare(
            "SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login_at
             FROM users u WHERE u.account_id = ? ORDER BY u.created_at ASC"
        );
        $stmt->execute([$req->user['account_id']]);
        $members = $stmt->fetchAll();

        $iStmt = db()->prepare(
            "SELECT id, email, role, created_at, expires_at FROM team_invites
             WHERE account_id = ? AND used_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC"
        );
        $iStmt->execute([$req->user['account_id']]);
        $invites = $iStmt->fetchAll();

        Response::json(['members' => $members, 'invites' => $invites]);
    }

    public function invite(Request $req): void {
        $body = $req->body();
        Validator::make($body, [
            'email' => 'required|email',
            'role'  => 'required|in:admin,member',
        ])->throwIfFails();

        $email = strtolower(trim($body['email']));
        $role  = $body['role'];

        $existing = db()->prepare("SELECT id FROM users WHERE email = ? AND account_id = ?");
        $existing->execute([$email, $req->user['account_id']]);
        if ($existing->fetch()) Response::error('User is already a team member', 409);

        db()->prepare("DELETE FROM team_invites WHERE account_id = ? AND email = ? AND used_at IS NULL")
            ->execute([$req->user['account_id'], $email]);

        $token   = Auth::generateToken(32);
        $expires = gmdate('Y-m-d H:i:s', time() + 7 * 86400);

        db()->prepare(
            "INSERT INTO team_invites (id, account_id, email, role, token, invited_by, created_at, expires_at)
             VALUES (?,?,?,?,?,?,?,?)"
        )->execute([generateId(), $req->user['account_id'], $email, $role, $token, $req->user['id'], nowDb(), $expires]);

        AuditLog::fromRequest($req, 'team.invite', $email);

        $inviteUrl = rtrim(getenv('APP_URL'), '/') . '/dashboard.html#/dashboard/accept-invite?token=' . $token;
        try {
            Mailer::send($email, $email, "You've been invited to Mediview", 'email-invite', [
                'inviter'    => $req->user['name'] ?? 'Your team',
                'role'       => $role,
                'invite_url' => $inviteUrl,
                'expires'    => '7 days',
            ]);
        } catch (\Throwable $e) { error_log('[Team/invite] Email failed: ' . $e->getMessage()); }

        Response::json(['message' => 'Invite sent'], 201);
    }

    public function accept(Request $req): void {
        $body  = $req->body();
        $token = trim($body['token'] ?? '');
        if (!$token) Response::error('Token required', 400);

        $stmt = db()->prepare(
            "SELECT * FROM team_invites WHERE token = ? AND used_at IS NULL AND expires_at > NOW()"
        );
        $stmt->execute([$token]);
        $invite = $stmt->fetch();
        if (!$invite) Response::error('Invite not found or expired', 404);

        $uStmt = db()->prepare("SELECT id FROM users WHERE email = ?");
        $uStmt->execute([$invite['email']]);
        $user = $uStmt->fetch();

        if ($user) {
            db()->prepare("UPDATE users SET account_id = ?, role = ? WHERE id = ?")
                ->execute([$invite['account_id'], $invite['role'], $user['id']]);
        } else {
            // Return invite details so frontend shows registration form
            Response::json(['needs_registration' => true, 'email' => $invite['email'], 'role' => $invite['role'], 'token' => $token]);
        }

        db()->prepare("UPDATE team_invites SET used_at = ? WHERE id = ?")->execute([nowDb(), $invite['id']]);
        AuditLog::log('team.invite.accept', $invite['email'], [], $invite['account_id'], $user['id'] ?? null, $invite['email'], $req->clientIp());
        Response::ok(['message' => 'Invite accepted']);
    }

    public function remove(Request $req): void {
        $memberId = $req->param('id');
        if ($memberId === $req->user['id']) Response::error('Cannot remove yourself', 400);

        $stmt = db()->prepare("SELECT id, name FROM users WHERE id = ? AND account_id = ?");
        $stmt->execute([$memberId, $req->user['account_id']]);
        $member = $stmt->fetch();
        if (!$member) Response::error('Member not found', 404);

        db()->prepare("DELETE FROM users WHERE id = ?")->execute([$memberId]);
        AuditLog::fromRequest($req, 'team.remove', $member['name']);
        Response::ok();
    }

    public function updateRole(Request $req): void {
        $memberId = $req->param('id');
        $body     = $req->body();
        $role     = $body['role'] ?? '';

        if (!in_array($role, ['admin','member'], true)) Response::error('Invalid role', 400);
        if ($memberId === $req->user['id']) Response::error('Cannot change your own role', 400);

        $stmt = db()->prepare("SELECT id, name FROM users WHERE id = ? AND account_id = ?");
        $stmt->execute([$memberId, $req->user['account_id']]);
        $member = $stmt->fetch();
        if (!$member) Response::error('Member not found', 404);

        db()->prepare("UPDATE users SET role = ? WHERE id = ?")->execute([$role, $memberId]);
        AuditLog::fromRequest($req, 'team.updateRole', "{$member['name']} → $role");
        Response::ok();
    }
}
