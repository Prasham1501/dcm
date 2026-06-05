<?php
/** DICOM UID helpers: build organisation-rooted Study Instance UIDs. */
class RisUid
{
    /** Join an org root with numeric parts: join('1.2.3',[20260602,5]) => '1.2.3.20260602.5'. */
    public static function join(string $root, array $parts): string
    {
        $clean = array_values(array_filter(
            array_map(fn($p) => (string) $p, $parts),
            fn($p) => $p !== ''
        ));
        return $root . (count($clean) ? '.' . implode('.', $clean) : '');
    }

    /** A unique, valid StudyInstanceUID rooted at $root (time + sequence suffix). */
    public static function studyUid(string $root, int $seq): string
    {
        return self::join($root, [gmdate('YmdHis'), $seq]);
    }

    /** Validate a DICOM UID: dotted decimal, no leading-zero components, <= 64 chars. */
    public static function isValid(string $uid): bool
    {
        if ($uid === '' || strlen($uid) > 64) {
            return false;
        }
        return (bool) preg_match('/^[0-2](\.(0|[1-9][0-9]*))+$/', $uid);
    }
}
