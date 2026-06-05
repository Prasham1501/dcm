# Phase 1 acceptance: parallel registrations must never collide on accession numbers.
# Spawns N independent PHP processes that each draw one accession concurrently,
# then asserts every value is unique (proves RisCounters FOR UPDATE locking works).
param([int]$N = 20)

$php    = "C:\xampp\php\php.exe"
$worker = Join-Path $PSScriptRoot "concurrency-accession.php"

$jobs = 1..$N | ForEach-Object {
    Start-Job -ScriptBlock { param($p, $w) & $p $w } -ArgumentList $php, $worker
}
$jobs | Wait-Job | Out-Null
$results = $jobs | ForEach-Object { ([string](Receive-Job $_)).Trim() }
$jobs | Remove-Job

$nonEmpty = @($results | Where-Object { $_ -ne "" })
$distinct = @($nonEmpty | Sort-Object -Unique)
Write-Host ("[concurrency] {0} processes -> {1} accessions, {2} distinct" -f $N, $nonEmpty.Count, $distinct.Count)

if ($nonEmpty.Count -eq $N -and $distinct.Count -eq $N) {
    Write-Host "[concurrency] PASS - no duplicate accession numbers"
    exit 0
} else {
    Write-Host "[concurrency] FAIL - duplicate or missing accession numbers"
    Write-Host ($results -join ", ")
    exit 1
}
