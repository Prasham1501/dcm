<?php
declare(strict_types=1);

class AdminMiddleware {

    public static function handle(Request $req): void {
        if (!$req->user) {
            Response::error('Authentication required', 401);
        }
        if ($req->user['role'] !== 'super_admin') {
            Response::error('Super-admin access required', 403);
        }
    }
}
