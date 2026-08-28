param(
  [Parameter(Mandatory)] [string] $FilePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module Microsoft.PowerShell.Security -ErrorAction Stop

$resolvedPath = [IO.Path]::GetFullPath($FilePath)
if (-not [IO.File]::Exists($resolvedPath)) {
  throw "Authenticode target does not exist: $resolvedPath"
}

$signature = Get-AuthenticodeSignature -FilePath $resolvedPath
if ($null -eq $signature) {
  throw "Get-AuthenticodeSignature returned no result: $resolvedPath"
}
if ($null -eq $signature.SignerCertificate) {
  throw "Authenticode signer certificate is missing: $resolvedPath"
}

[ordered]@{
  Status = $signature.Status.ToString()
  StatusMessage = $signature.StatusMessage
  Subject = $signature.SignerCertificate.Subject
  Thumbprint = $signature.SignerCertificate.Thumbprint
  TimestampThumbprint = if ($null -ne $signature.TimeStamperCertificate) {
    $signature.TimeStamperCertificate.Thumbprint
  } else {
    ''
  }
} | ConvertTo-Json -Compress
