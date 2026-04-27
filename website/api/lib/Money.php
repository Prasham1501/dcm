<?php
declare(strict_types=1);

class Money {
    public static function toPaise(float|int $rupees): int {
        return (int)round($rupees * 100);
    }
    public static function toRupees(int $paise): float {
        return $paise / 100;
    }
    public static function format(float $rupees): string {
        return '₹' . number_format($rupees, 2);
    }
}
