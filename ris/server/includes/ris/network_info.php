<?php
/**
 * Pure helper that formats the "how to connect" payload for the setup wizard:
 * the URLs other PCs/consoles open, and the DICOM settings to enter into each
 * modality so it talks to this server's bundled Orthanc.
 */

/**
 * @param array $opts {
 *   lan_ips: string[]            // detected IPv4s, non-loopback first
 *   php_port: int                // app/web server port (default 8080)
 *   orthanc_rest_port: int       // Orthanc REST/DICOMweb port
 *   orthanc_dicom_port: int      // Orthanc DICOM SCP port (for C-STORE/MWL)
 *   orthanc_aet: string          // Orthanc AE title
 * }
 */
function ris_build_network_info(array $opts): array
{
    $lanIps = array_values($opts['lan_ips'] ?? []);
    $phpPort = (int) ($opts['php_port'] ?? 8090);

    // Rank IPs so the real clinic LAN address wins over virtual adapters
    // (WSL/Hyper-V/Docker tend to use 172.x). Lower rank = preferred.
    usort($lanIps, fn($a, $b) => ris_ip_rank($a) <=> ris_ip_rank($b));

    // Advertise the best non-loopback IP; fall back to loopback if that's all we have.
    $serverIp = '127.0.0.1';
    foreach ($lanIps as $ip) {
        if ($ip !== '127.0.0.1' && strpos($ip, '169.254.') !== 0) {
            $serverIp = $ip;
            break;
        }
    }

    $clientUrls = array_map(fn($ip) => "http://{$ip}:{$phpPort}", $lanIps);

    return [
        'lan_ips'     => $lanIps,
        'php_port'    => $phpPort,
        'client_urls' => $clientUrls,
        'modality'    => [
            'server_ip'  => $serverIp,
            'ae_title'   => (string) ($opts['orthanc_aet'] ?? 'ORTHANC'),
            'dicom_port' => (int) ($opts['orthanc_dicom_port'] ?? 3458),
            'rest_port'  => (int) ($opts['orthanc_rest_port'] ?? 8042),
        ],
    ];
}

/** Preference rank for an IPv4 (lower = more likely the real clinic LAN). */
function ris_ip_rank(string $ip): int
{
    if ($ip === '127.0.0.1') return 100;
    if (strpos($ip, '169.254.') === 0) return 90;            // APIPA
    if (strpos($ip, '192.168.') === 0) return 0;             // typical home/clinic LAN
    if (strpos($ip, '10.') === 0) return 1;                  // common office LAN
    if (preg_match('/^172\.(1[6-9]|2[0-9]|3[0-1])\./', $ip)) return 2; // 172.16/12 (often WSL/Docker)
    return 3;                                                // other routable
}

/** Detect IPv4 addresses of this host (non-loopback first). CLI + server safe. */
function ris_detect_lan_ips(): array
{
    $ips = [];
    $host = gethostname();
    if ($host) {
        $resolved = @gethostbynamel($host) ?: [];
        foreach ($resolved as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
                $ips[] = $ip;
            }
        }
    }
    // Non-loopback first, dedupe, loopback last as fallback.
    $ips = array_values(array_unique($ips));
    usort($ips, fn($a, $b) => ($a === '127.0.0.1') <=> ($b === '127.0.0.1'));
    if (!in_array('127.0.0.1', $ips, true)) {
        $ips[] = '127.0.0.1';
    }
    return $ips;
}
