<?php
declare(strict_types=1);

class Validator {
    private array $errors = [];

    private function __construct(private array $data, private array $rules) {
        $this->run();
    }

    public static function make(array $data, array $rules): self {
        return new self($data, $rules);
    }

    public function throwIfFails(): void {
        if ($this->errors) {
            Response::error('Validation failed', 422, ['fields' => $this->errors]);
        }
    }

    public function passes(): bool {
        return empty($this->errors);
    }

    public function errors(): array {
        return $this->errors;
    }

    private function run(): void {
        foreach ($this->rules as $field => $ruleStr) {
            $value = $this->data[$field] ?? null;
            $rules = explode('|', $ruleStr);

            foreach ($rules as $rule) {
                [$ruleName, $param] = array_pad(explode(':', $rule, 2), 2, null);

                $error = match($ruleName) {
                    'required' => ($value === null || $value === '') ? "$field is required" : null,
                    'email'    => ($value && !filter_var($value, FILTER_VALIDATE_EMAIL)) ? "$field must be a valid email" : null,
                    'min'      => ($value !== null && strlen((string)$value) < (int)$param) ? "$field must be at least $param characters" : null,
                    'max'      => ($value !== null && strlen((string)$value) > (int)$param) ? "$field must be at most $param characters" : null,
                    'numeric'  => ($value !== null && !is_numeric($value)) ? "$field must be numeric" : null,
                    'in'       => ($value !== null && !in_array($value, explode(',', $param ?? ''), true)) ? "$field must be one of: $param" : null,
                    'password' => ($value && (!preg_match('/[A-Za-z]/', (string)$value) || !preg_match('/\d/', (string)$value) || strlen((string)$value) < 8))
                                  ? "$field must be at least 8 characters with a letter and a number" : null,
                    default    => null,
                };

                if ($error) {
                    $this->errors[$field] = $error;
                    break; // first error per field only
                }
            }
        }
    }
}
