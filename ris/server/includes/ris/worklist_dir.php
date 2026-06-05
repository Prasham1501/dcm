<?php
/**
 * Resolve the Modality Worklist directory (where .wl files live, watched by the
 * Orthanc Worklists plugin). Single source of truth shared by all worklist code.
 * Priority: OCZ_WORKLIST_DIR env -> hospital_settings.worklist_dir -> default.
 */
function ris_worklist_dir(mysqli $db): string
{
    $env = getenv('OCZ_WORKLIST_DIR');
    if ($env) {
        return $env;
    }
    $res = $db->query("SELECT setting_value FROM hospital_settings WHERE setting_key = 'worklist_dir'");
    if ($res && ($row = $res->fetch_assoc()) && !empty($row['setting_value'])) {
        return $row['setting_value'];
    }
    $appData = getenv('APPDATA');
    if ($appData) {
        return rtrim(str_replace('\\', '/', $appData), '/') . '/one-clickz/orthanc-worklists';
    }
    return 'C:/Orthanc/Worklists';
}
