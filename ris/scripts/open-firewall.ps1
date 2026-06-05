# Opens the Windows Firewall ports needed for the One Clickz RIS ecosystem so
# that other PCs/consoles and DICOM modalities on the clinic LAN can connect.
# Run once on the SERVER PC, elevated (Run as Administrator).
#
#   App / web UI (browser clients)        : 8080/tcp
#   Orthanc DICOM SCP (C-STORE + MWL)     : 3458/tcp
#   Orthanc REST / DICOMweb               : 8042/tcp
param(
    [int]$AppPort        = 8080,
    [int]$OrthancDicom   = 3458,
    [int]$OrthancRest    = 8042
)
$ErrorActionPreference = "Stop"

function Open-Port($name, $port) {
    $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
    if ($existing) { Remove-NetFirewallRule -DisplayName $name }
    New-NetFirewallRule -DisplayName $name -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $port -Profile Domain,Private | Out-Null
    Write-Host "Opened $name (TCP $port)"
}

Open-Port "OneClickz App ($AppPort)"          $AppPort
Open-Port "OneClickz Orthanc DICOM ($OrthancDicom)" $OrthancDicom
Open-Port "OneClickz Orthanc REST ($OrthancRest)"   $OrthancRest

Write-Host "`nDone. Clients can now reach http://<this-PC-IP>:$AppPort"
Write-Host "Modalities: point DICOM to <this-PC-IP> AE 'ORTHANC' port $OrthancDicom"
