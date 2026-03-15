<?php
/**
 * Detect System Printers API
 *
 * This endpoint detects available printers on the Windows system
 * using PowerShell Get-Printer command.
 */

require_once __DIR__ . '/../../includes/config.php';
require_once __DIR__ . '/../../auth/session.php';

// Require admin authentication
requireLogin();

if ($_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Admin access required'
    ]);
    exit;
}

header('Content-Type: application/json');

try {
    $printers = [];

    // Detect OS
    $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';

    if ($isWindows) {
        // Use PowerShell to get printers on Windows
        $command = 'powershell.exe -Command "Get-Printer | Select-Object Name, DriverName, PortName, Shared, Published, Type | ConvertTo-Json"';

        $output = shell_exec($command);

        if ($output) {
            $printersData = json_decode($output, true);

            // Handle single printer (not an array)
            if (isset($printersData['Name'])) {
                $printersData = [$printersData];
            }

            if (is_array($printersData)) {
                foreach ($printersData as $printer) {
                    $printers[] = [
                        'name' => $printer['Name'] ?? 'Unknown',
                        'driver' => $printer['DriverName'] ?? 'Unknown',
                        'port' => $printer['PortName'] ?? 'Unknown',
                        'shared' => $printer['Shared'] ?? false,
                        'type' => $printer['Type'] ?? 'Unknown',
                        'status' => 'detected'
                    ];
                }
            }
        }

        // Alternative method using wmic if PowerShell fails
        if (empty($printers)) {
            $command = 'wmic printer get name,portname,drivername /format:csv';
            $output = shell_exec($command);

            if ($output) {
                $lines = explode("\n", trim($output));

                // Skip header lines
                $headerFound = false;
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (empty($line)) continue;

                    if (!$headerFound) {
                        // Look for the header line
                        if (stripos($line, 'DriverName') !== false) {
                            $headerFound = true;
                        }
                        continue;
                    }

                    $parts = array_map('trim', explode(',', $line));
                    if (count($parts) >= 3) {
                        $printers[] = [
                            'name' => $parts[1] ?? 'Unknown',
                            'driver' => $parts[0] ?? 'Unknown',
                            'port' => $parts[2] ?? 'Unknown',
                            'shared' => false,
                            'type' => 'Local',
                            'status' => 'detected'
                        ];
                    }
                }
            }
        }

    } elseif (stripos(PHP_OS, 'LINUX') !== false) {
        // Use lpstat on Linux
        $command = 'lpstat -p -d 2>/dev/null';
        $output = shell_exec($command);

        if ($output) {
            $lines = explode("\n", trim($output));
            foreach ($lines as $line) {
                if (preg_match('/^printer (.+) is/', $line, $matches)) {
                    $printers[] = [
                        'name' => $matches[1],
                        'driver' => 'Unknown',
                        'port' => 'Unknown',
                        'shared' => false,
                        'type' => 'Local',
                        'status' => 'detected'
                    ];
                }
            }
        }

    } elseif (stripos(PHP_OS, 'DARWIN') !== false) {
        // Use lpstat on macOS
        $command = 'lpstat -p -d 2>/dev/null';
        $output = shell_exec($command);

        if ($output) {
            $lines = explode("\n", trim($output));
            foreach ($lines as $line) {
                if (preg_match('/^printer (.+) is/', $line, $matches)) {
                    $printers[] = [
                        'name' => $matches[1],
                        'driver' => 'Unknown',
                        'port' => 'Unknown',
                        'shared' => false,
                        'type' => 'Local',
                        'status' => 'detected'
                    ];
                }
            }
        }
    }

    // If no printers detected, provide a helpful message
    if (empty($printers)) {
        echo json_encode([
            'success' => true,
            'printers' => [],
            'message' => 'No printers detected on this system. Please ensure printers are installed and the system has appropriate permissions.'
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'printers' => $printers,
            'message' => count($printers) . ' printer(s) detected successfully'
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}