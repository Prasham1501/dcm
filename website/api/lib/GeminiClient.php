<?php
declare(strict_types=1);

class GeminiClient {

    private string $apiKey;
    private string $model;

    public function __construct() {
        $this->apiKey = Settings::get('gemini.api_key');
        $this->model  = Settings::get('gemini.model', 'gemini-1.5-flash');

        if (!$this->apiKey) {
            Response::error('AI chat is not configured. Contact support.', 503);
        }
    }

    /**
     * Send messages to Gemini and get a reply.
     * $messages = [['role'=>'user'|'model', 'text'=>'...'], ...]
     */
    public function chat(array $messages, string $systemPrompt = ''): array {
        $contents = [];

        if ($systemPrompt) {
            $contents[] = ['role' => 'user', 'parts' => [['text' => $systemPrompt]]];
            $contents[] = ['role' => 'model', 'parts' => [['text' => 'Understood. I will follow those instructions.']]];
        }

        foreach ($messages as $msg) {
            $contents[] = [
                'role'  => $msg['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => $msg['text'] ?? $msg['content'] ?? '']],
            ];
        }

        $payload = json_encode([
            'contents'         => $contents,
            'generationConfig' => [
                'temperature'     => 0.4,
                'maxOutputTokens' => 800,
            ],
        ]);

        $url  = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}";
        $ch   = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT        => 30,
        ]);
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$resp) throw new \RuntimeException('Gemini API timeout');

        $data = json_decode($resp, true);

        if ($code !== 200 || isset($data['error'])) {
            throw new \RuntimeException('Gemini error: ' . ($data['error']['message'] ?? 'unknown'));
        }

        $reply     = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $tokensIn  = $data['usageMetadata']['promptTokenCount']     ?? 0;
        $tokensOut = $data['usageMetadata']['candidatesTokenCount'] ?? 0;

        return ['reply' => $reply, 'tokens_in' => $tokensIn, 'tokens_out' => $tokensOut];
    }
}
