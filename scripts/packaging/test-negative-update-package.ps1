$ErrorActionPreference = 'Stop'
if (-not $env:GITHUB_ACTIONS) { throw 'Negative package mutation is restricted to disposable CI runners' }
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$source = Join-Path $projectRoot 'dist-electron'
$testRoot = Join-Path $env:RUNNER_TEMP "maktab-negative-$([Guid]::NewGuid())"

function Assert-NodeCommandFails {
  param(
    [Parameter(Mandatory)] [string] $ScriptPath,
    [Parameter(Mandatory)] [string[]] $NodeArguments,
    [Parameter(Mandatory)] [string] $UnexpectedSuccessMessage
  )

  $node = (Get-Command node -CommandType Application -ErrorAction Stop).Source
  $captureId = [Guid]::NewGuid().ToString('N')
  $stdoutPath = Join-Path $env:RUNNER_TEMP "maktab-negative-$captureId.stdout.log"
  $stderrPath = Join-Path $env:RUNNER_TEMP "maktab-negative-$captureId.stderr.log"
  try {
    $process = Start-Process -FilePath $node `
      -ArgumentList (@($ScriptPath) + $NodeArguments) `
      -WorkingDirectory $projectRoot `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -eq 0) { throw $UnexpectedSuccessMessage }
  } finally {
    Remove-Item -Force -ErrorAction SilentlyContinue $stdoutPath, $stderrPath
  }
}

try {
  Copy-Item -Recurse $source $testRoot
  $descriptor = Get-Content (Join-Path $testRoot 'release-descriptor.json') | ConvertFrom-Json
  $artifact = Join-Path $testRoot $descriptor.artifact.filename
  $bytes = [IO.File]::ReadAllBytes($artifact)
  $bytes[$bytes.Length - 1] = 255 - $bytes[$bytes.Length - 1]
  [IO.File]::WriteAllBytes($artifact, $bytes)
  Assert-NodeCommandFails `
    -ScriptPath (Join-Path $projectRoot 'scripts\packaging\check-update-bundle.js') `
    -NodeArguments @($testRoot) `
    -UnexpectedSuccessMessage 'Tampered artifact unexpectedly passed bundle verification'

  Remove-Item -Recurse -Force $testRoot
  Copy-Item -Recurse $source $testRoot
  $artifact = Join-Path $testRoot $descriptor.artifact.filename
  $signTool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $signTool) { throw 'SignTool was not found' }
  & $signTool.FullName remove /s $artifact
  if ($LASTEXITCODE -ne 0) { throw 'Could not remove the expected test signature' }
  & $signTool.FullName sign /fd SHA256 /f $env:MAKTAB_WRONG_PUBLISHER_PFX `
    /p $env:CSC_KEY_PASSWORD /tr http://timestamp.acs.microsoft.com /td SHA256 $artifact
  if ($LASTEXITCODE -ne 0) { throw 'Could not sign the wrong-publisher fixture' }
  Assert-NodeCommandFails `
    -ScriptPath (Join-Path $projectRoot 'scripts\packaging\check-windows-signatures.js') `
    -NodeArguments @($testRoot) `
    -UnexpectedSuccessMessage 'Wrong-publisher artifact unexpectedly passed signature verification'
  Write-Host 'Tampered and wrong-publisher update packages were rejected.'
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $testRoot
}
