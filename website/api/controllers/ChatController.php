<?php
declare(strict_types=1);

class ChatController {

    public function send(Request $req): void {
        if (Settings::get('feature.chat_enabled', '1') !== '1') {
            Response::error('Chat is not enabled', 503);
        }

        RateLimiter::hit('chat:account:' . $req->user['account_id'], 30, 60);

        $body     = $req->body();
        $messages = $body['messages'] ?? [];
        if (!$messages) Response::error('messages required', 400);

        $systemPrompt = Settings::get('gemini.system_prompt',
            'You are a helpful support assistant for Mediview, a professional DICOM medical imaging viewer. Help users with billing, license activation, technical issues, and product questions. Be concise and professional.'
        );

        try {
            $gemini = new GeminiClient();
            $result = $gemini->chat($messages, $systemPrompt);
        } catch (\Throwable $e) {
            error_log('[Chat] ' . $e->getMessage());
            Response::error('AI service temporarily unavailable. Please try again.', 503);
        }

        // Persist conversation
        try {
            $convId = generateId();
            $now    = nowDb();
            db()->prepare("INSERT INTO chat_conversations (id, account_id, user_id, created_at) VALUES (?,?,?,?)")
                ->execute([$convId, $req->user['account_id'], $req->user['id'], $now]);

            // Save last user message + reply
            $lastMsg = end($messages);
            db()->prepare("INSERT INTO chat_messages (id, conversation_id, role, body, created_at) VALUES (?,?,?,?,?)")
                ->execute([generateId(), $convId, 'user', $lastMsg['text'] ?? $lastMsg['content'] ?? '', $now]);
            db()->prepare("INSERT INTO chat_messages (id, conversation_id, role, body, tokens_in, tokens_out, created_at) VALUES (?,?,?,?,?,?,?)")
                ->execute([generateId(), $convId, 'model', $result['reply'], $result['tokens_in'], $result['tokens_out'], $now]);
        } catch (\Throwable) {}

        Response::json(['reply' => $result['reply']]);
    }
}
