$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$pairRoot = Join-Path $projectRoot 'release-pair'
if (-not $env:CSC_LINK -or -not $env:MAKTAB_INTERNAL_UPDATE_KEY_ID) {
  throw 'Run prepare-internal-signing.ps1 and prepare-internal-release-keys.js first'
}

Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $pairRoot
New-Item -ItemType Directory -Path $pairRoot | Out-Null

foreach ($version in @('1.0.0', '1.0.1')) {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue (Join-Path $projectRoot 'dist-electron')
  $env:MAKTAB_RELEASE_VERSION = $version
  $env:MAKTAB_RELEASE_CHANNEL = 'pilot'
  $env:MAKTAB_RELEASE_API_URL = 'https://updates.internal.maktab.test:4443'
  $env:MAKTAB_UPDATE_ALLOWED_ORIGINS = 'https://updates.internal.maktab.test:4443'
  $env:MAKTAB_MINIMUM_SUPPORTED_VERSION = '1.0.0'
  & npm.cmd run dist:win:internal
  if ($LASTEXITCODE -ne 0) { throw "Internal $version build failed" }
  & node scripts/packaging/release-evidence.js
  if ($LASTEXITCODE -ne 0) { throw "Internal $version evidence generation failed" }
  Copy-Item -Recurse (Join-Path $projectRoot 'dist-electron') (Join-Path $pairRoot "v$version")
}

& node scripts/packaging/prepare-vm-update-fixture.js
if ($LASTEXITCODE -ne 0) { throw 'VM update fixture generation failed' }

Remove-Item Env:\MAKTAB_RELEASE_VERSION -ErrorAction SilentlyContinue
Write-Host "Internal update pair is ready at $pairRoot"
