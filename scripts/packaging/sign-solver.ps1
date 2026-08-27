$ErrorActionPreference = 'Stop'

if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') { throw 'Solver signing requires Windows' }
$solver = Join-Path $PSScriptRoot '..\..\services\timetable-solver\dist\solver.exe'
$solver = [IO.Path]::GetFullPath($solver)
if (-not (Test-Path $solver)) { throw "Solver executable is missing: $solver" }

if ($env:MAKTAB_SIGNING_MODE -eq 'azure') {
  Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null
  Install-Module -Name TrustedSigning -MinimumVersion 0.5.0 -Force -Repository PSGallery -Scope CurrentUser
  Invoke-TrustedSigning `
    -Endpoint $env:MAKTAB_AZURE_SIGNING_ENDPOINT `
    -CertificateProfileName $env:MAKTAB_AZURE_CERTIFICATE_PROFILE `
    -CodeSigningAccountName $env:MAKTAB_AZURE_CODE_SIGNING_ACCOUNT `
    -TimestampRfc3161 'http://timestamp.acs.microsoft.com' `
    -TimestampDigest SHA256 `
    -FileDigest SHA256 `
    -Files $solver
  exit
}

if ($env:MAKTAB_SIGNING_MODE -ne 'pfx') { throw 'Unsupported signing mode' }
$pfxPath = $env:CSC_LINK
$temporaryPfx = $null
if (-not (Test-Path $pfxPath)) {
  $encoded = $pfxPath -replace '^data:application/x-pkcs12;base64,', ''
  try { $bytes = [Convert]::FromBase64String($encoded) } catch { throw 'CSC_LINK must be a PFX path or base64 PFX for solver signing' }
  $temporaryPfx = Join-Path $env:TEMP "maktab-signing-$([Guid]::NewGuid()).pfx"
  [IO.File]::WriteAllBytes($temporaryPfx, $bytes)
  $pfxPath = $temporaryPfx
}

try {
  $signTool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $signTool) { throw 'SignTool was not found in the Windows SDK' }
  & $signTool.FullName sign /fd SHA256 /f $pfxPath /p $env:CSC_KEY_PASSWORD `
    /tr http://timestamp.acs.microsoft.com /td SHA256 $solver
  if ($LASTEXITCODE -ne 0) { throw "Solver signing failed ($LASTEXITCODE)" }
} finally {
  if ($temporaryPfx) { Remove-Item -Force $temporaryPfx }
}
