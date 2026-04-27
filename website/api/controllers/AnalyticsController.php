<?php
declare(strict_types=1);

class AnalyticsController {

    public function index(Request $req): void {
        $range = $req->query('range', '30d');
        $days  = match($range) {
            '7d'  => 7,
            '90d' => 90,
            default => 30,
        };
        $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);
        $accountId = $req->user['account_id'];

        // Studies (analytics events)
        $sStmt = db()->prepare("SELECT COUNT(*) FROM analytics_events WHERE account_id=? AND event='study.open' AND created_at >= ?");
        $sStmt->execute([$accountId, $since]);
        $studies = (int)$sStmt->fetchColumn();

        // AI calls
        $aStmt = db()->prepare("SELECT COUNT(*) FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE account_id=?) AND role='model' AND created_at >= ?");
        $aStmt->execute([$accountId, $since]);
        $aiCalls = (int)$aStmt->fetchColumn();

        // Print spend
        $pStmt = db()->prepare("SELECT COALESCE(SUM(ABS(credits_delta)),0) FROM transactions WHERE account_id=? AND wallet_type='print' AND kind='spend' AND created_at >= ?");
        $pStmt->execute([$accountId, $since]);
        $printed = (int)$pStmt->fetchColumn();

        // By modality (from analytics events meta)
        $mStmt = db()->prepare(
            "SELECT JSON_UNQUOTE(JSON_EXTRACT(meta,'$.modality')) as modality, COUNT(*) as cnt
             FROM analytics_events WHERE account_id=? AND event='study.open' AND created_at >= ? AND meta IS NOT NULL
             GROUP BY modality ORDER BY cnt DESC LIMIT 10"
        );
        $mStmt->execute([$accountId, $since]);
        $byModality = $mStmt->fetchAll() ?: [];

        // Daily trend (wallet spend as proxy for activity)
        $dStmt = db()->prepare(
            "SELECT DATE(created_at) as d, COUNT(*) as v
             FROM analytics_events WHERE account_id=? AND created_at >= ?
             GROUP BY DATE(created_at) ORDER BY d ASC"
        );
        $dStmt->execute([$accountId, $since]);
        $daily = $dStmt->fetchAll() ?: [];

        Response::json([
            'studies_' . $days . 'd'  => $studies,
            'ai_calls_' . $days . 'd' => $aiCalls,
            'pages_printed_' . $days . 'd' => $printed,
            'by_modality'             => array_map(fn($r) => ['name' => $r['modality'] ?: 'Unknown', 'value' => (int)$r['cnt']], $byModality),
            'daily'                   => $daily,
        ]);
    }
}
