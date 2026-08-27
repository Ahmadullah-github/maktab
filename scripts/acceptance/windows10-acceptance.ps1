param(
  [Parameter(Mandatory = $true)][string]$ArtifactDirectory,
  [Parameter(Mandatory = $true)][string]$EvidenceDirectory
)

$ErrorActionPreference = 'Stop'
$artifactRoot = (Resolve-Path $ArtifactDirectory).Path
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$evidenceRoot = (Resolve-Path $EvidenceDirectory).Path
$descriptorPath = Join-Path $artifactRoot 'release-descriptor.json'
$sumsPath = Join-Path $artifactRoot 'SHA256SUMS'
if (-not (Test-Path $descriptorPath) -or -not (Test-Path $sumsPath)) {
  throw 'The acceptance directory is missing release-descriptor.json or SHA256SUMS'
}

$systemDrive = Get-PSDrive -Name (($env:SystemDrive).TrimEnd(':'))
if ($systemDrive.Free -lt 12GB) { throw 'At least 12 GB of free guest disk space is required' }

$developerTools = @('node.exe', 'python.exe', 'python3.exe', 'sqlite3.exe')
$foundTools = @()
foreach ($tool in $developerTools) {
  if (Get-Command $tool -ErrorAction SilentlyContinue) { $foundTools += $tool }
}
if ($foundTools.Count -gt 0) {
  throw "Acceptance VM contains forbidden developer tools: $($foundTools -join ', ')"
}

$descriptor = Get-Content $descriptorPath -Raw | ConvertFrom-Json
$hashResults = @()
foreach ($line in Get-Content $sumsPath) {
  if (-not $line.Trim()) { continue }
  $parts = $line -split '\s+', 2
  $filePath = Join-Path $artifactRoot $parts[1].Trim()
  if (-not (Test-Path $filePath)) { throw "Evidence file is missing: $filePath" }
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $filePath).Hash.ToLowerInvariant()
  if ($actual -ne $parts[0].ToLowerInvariant()) { throw "SHA-256 mismatch: $filePath" }
  $hashResults += [ordered]@{ file = $parts[1].Trim(); sha256 = $actual }
}

$installerPath = Join-Path $artifactRoot $descriptor.artifact.filename
$signature = Get-AuthenticodeSignature -LiteralPath $installerPath
if ($signature.Status -ne 'Valid') { throw "Installer Authenticode status is $($signature.Status)" }
if (-not $signature.TimeStamperCertificate) { throw 'Installer is missing an Authenticode timestamp' }
if ($signature.SignerCertificate.Subject -notlike "*CN=$($descriptor.artifact.authenticode_publisher)*") {
  throw 'Installer publisher does not match the signed release descriptor'
}

$os = Get-CimInstance Win32_OperatingSystem
$report = [ordered]@{
  schemaVersion = 1
  capturedAt = (Get-Date).ToUniversalTime().ToString('o')
  os = [ordered]@{
    caption = $os.Caption
    version = $os.Version
    buildNumber = $os.BuildNumber
    architecture = $os.OSArchitecture
  }
  guest = [ordered]@{
    processors = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
    memoryBytes = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
    freeSystemDriveBytes = [int64]$systemDrive.Free
    forbiddenDeveloperTools = $foundTools
  }
  release = [ordered]@{
    version = $descriptor.version
    buildId = $descriptor.build_id
    commitSha = ($descriptor.build_id -split '-')[-1]
    installer = $descriptor.artifact.filename
    publisher = $signature.SignerCertificate.Subject
    signerThumbprint = $signature.SignerCertificate.Thumbprint
    timestampThumbprint = $signature.TimeStamperCertificate.Thumbprint
    hashes = $hashResults
  }
  manualResults = [ordered]@{
    installV100 = 'pending'
    qaActivation = 'pending'
    timetableGeneration = 'pending'
    restartPersistence = 'pending'
    updateV100ToV101 = 'pending'
    activationAfterUpdate = 'pending'
    timetableAfterUpdate = 'pending'
    pdfExport = 'pending'
    nativePrint = 'pending'
    tamperedUpdateRejected = 'pending'
    wrongPublisherRejected = 'pending'
    cleanShutdown = 'pending'
  }
  notes = @()
}
$reportPath = Join-Path $evidenceRoot "windows10-acceptance-$($descriptor.build_id).json"
$report | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $reportPath
Write-Host "Preflight passed. Complete the manual results in $reportPath"
Write-Host "Installer: $installerPath"
