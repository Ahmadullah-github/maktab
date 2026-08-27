using namespace System.Net
using namespace System.Security.Cryptography
using namespace System.Security.Cryptography.X509Certificates

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function New-IssuedCertificate {
  param(
    [Parameter(Mandatory)] [string] $Subject,
    [Parameter(Mandatory)] [X509Certificate2] $Issuer,
    [Parameter(Mandatory)] [ValidateSet('CodeSigning', 'Tls')] [string] $Purpose,
    [Parameter(Mandatory)] [int] $KeyLength,
    [Parameter(Mandatory)] [DateTimeOffset] $NotBefore,
    [Parameter(Mandatory)] [DateTimeOffset] $NotAfter
  )

  $key = [RSA]::Create($KeyLength)
  $request = [CertificateRequest]::new(
    $Subject,
    $key,
    [HashAlgorithmName]::SHA256,
    [RSASignaturePadding]::Pkcs1
  )
  [void] $request.CertificateExtensions.Add(
    [X509BasicConstraintsExtension]::new($false, $false, 0, $true)
  )

  $enhancedKeyUsages = [OidCollection]::new()
  if ($Purpose -eq 'CodeSigning') {
    [void] $request.CertificateExtensions.Add(
      [X509KeyUsageExtension]::new([X509KeyUsageFlags]::DigitalSignature, $true)
    )
    [void] $enhancedKeyUsages.Add([Oid]::new('1.3.6.1.5.5.7.3.3'))
  } else {
    $tlsUsage = [X509KeyUsageFlags]::DigitalSignature -bor [X509KeyUsageFlags]::KeyEncipherment
    [void] $request.CertificateExtensions.Add([X509KeyUsageExtension]::new($tlsUsage, $true))
    [void] $enhancedKeyUsages.Add([Oid]::new('1.3.6.1.5.5.7.3.1'))
    $san = [SubjectAlternativeNameBuilder]::new()
    $san.AddDnsName('updates.internal.maktab.test')
    $san.AddDnsName('localhost')
    $san.AddIpAddress([IPAddress]::Parse('127.0.0.1'))
    [void] $request.CertificateExtensions.Add($san.Build())
  }
  [void] $request.CertificateExtensions.Add(
    [X509EnhancedKeyUsageExtension]::new($enhancedKeyUsages, $false)
  )
  [void] $request.CertificateExtensions.Add(
    [X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
  )

  $serial = [byte[]]::new(16)
  [RandomNumberGenerator]::Fill($serial)
  $serial[0] = $serial[0] -band 0x7f
  if (($serial | Where-Object { $_ -ne 0 }).Count -eq 0) { $serial[0] = 1 }

  $publicCertificate = $request.Create($Issuer, $NotBefore, $NotAfter, $serial)
  try {
    $certificate = [RSACertificateExtensions]::CopyWithPrivateKey($publicCertificate, $key)
  } finally {
    $publicCertificate.Dispose()
  }
  return [pscustomobject]@{ Certificate = $certificate; Key = $key }
}

function Add-ToCurrentUserStore {
  param(
    [Parameter(Mandatory)] [X509Certificate2] $Certificate,
    [Parameter(Mandatory)] [StoreName] $StoreName
  )

  $publicCertificate = [X509Certificate2]::new($Certificate.Export([X509ContentType]::Cert))
  $store = [X509Store]::new($StoreName, [StoreLocation]::CurrentUser)
  try {
    $store.Open([OpenFlags]::ReadWrite)
    $store.Add($publicCertificate)
  } finally {
    $store.Dispose()
    $publicCertificate.Dispose()
  }
}

Write-Host 'Generating disposable internal certificate authority'
$passwordText = [Convert]::ToBase64String([RandomNumberGenerator]::GetBytes(32))
$notBefore = [DateTimeOffset]::UtcNow.AddMinutes(-5)
$notAfter = $notBefore.AddDays(7)
$caKey = [RSA]::Create(3072)
$caRequest = [CertificateRequest]::new(
  'CN=Maktab Internal Test CA',
  $caKey,
  [HashAlgorithmName]::SHA256,
  [RSASignaturePadding]::Pkcs1
)
[void] $caRequest.CertificateExtensions.Add(
  [X509BasicConstraintsExtension]::new($true, $true, 0, $true)
)
$caUsage = [X509KeyUsageFlags]::KeyCertSign -bor [X509KeyUsageFlags]::CrlSign -bor [X509KeyUsageFlags]::DigitalSignature
[void] $caRequest.CertificateExtensions.Add([X509KeyUsageExtension]::new($caUsage, $true))
[void] $caRequest.CertificateExtensions.Add(
  [X509SubjectKeyIdentifierExtension]::new($caRequest.PublicKey, $false)
)
$ca = $caRequest.CreateSelfSigned($notBefore, $notAfter)

Write-Host 'Generating disposable publisher and TLS certificates'
$signingResult = New-IssuedCertificate `
  -Subject 'CN=Maktab Internal Test' `
  -Issuer $ca `
  -Purpose CodeSigning `
  -KeyLength 3072 `
  -NotBefore $notBefore `
  -NotAfter $notAfter
$wrongSigningResult = New-IssuedCertificate `
  -Subject 'CN=Maktab Wrong Publisher Test' `
  -Issuer $ca `
  -Purpose CodeSigning `
  -KeyLength 3072 `
  -NotBefore $notBefore `
  -NotAfter $notAfter
$tlsResult = New-IssuedCertificate `
  -Subject 'CN=updates.internal.maktab.test' `
  -Issuer $ca `
  -Purpose Tls `
  -KeyLength 2048 `
  -NotBefore $notBefore `
  -NotAfter $notAfter

$directory = Join-Path $env:RUNNER_TEMP 'maktab-internal-signing'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$pfxPath = Join-Path $directory 'internal-signing.pfx'
$wrongPfxPath = Join-Path $directory 'wrong-publisher.pfx'
$cerPath = Join-Path $directory 'internal-signing.cer'
$caCerPath = Join-Path $directory 'internal-test-ca.cer'
$tlsPfxPath = Join-Path $directory 'internal-tls.pfx'
$tlsCerPath = Join-Path $directory 'internal-tls.cer'

Write-Host 'Exporting disposable trust material'
[IO.File]::WriteAllBytes(
  $pfxPath,
  $signingResult.Certificate.Export([X509ContentType]::Pfx, $passwordText)
)
[IO.File]::WriteAllBytes(
  $wrongPfxPath,
  $wrongSigningResult.Certificate.Export([X509ContentType]::Pfx, $passwordText)
)
[IO.File]::WriteAllBytes($cerPath, $signingResult.Certificate.Export([X509ContentType]::Cert))
[IO.File]::WriteAllBytes($caCerPath, $ca.Export([X509ContentType]::Cert))
[IO.File]::WriteAllBytes(
  $tlsPfxPath,
  $tlsResult.Certificate.Export([X509ContentType]::Pfx, $passwordText)
)
[IO.File]::WriteAllBytes($tlsCerPath, $tlsResult.Certificate.Export([X509ContentType]::Cert))

Write-Host 'Trusting the disposable CA and expected publisher for this CI user'
Add-ToCurrentUserStore -Certificate $ca -StoreName Root
Add-ToCurrentUserStore -Certificate $signingResult.Certificate -StoreName TrustedPublisher

if (-not $env:GITHUB_ENV) { throw 'GITHUB_ENV is required for disposable CI signing' }
@(
  "CSC_LINK=$pfxPath"
  "CSC_KEY_PASSWORD=$passwordText"
  'MAKTAB_SIGNING_MODE=pfx'
  'MAKTAB_DISTRIBUTION=internal'
  'MAKTAB_AUTHENTICODE_PUBLISHER=Maktab Internal Test'
  "MAKTAB_WRONG_PUBLISHER_PFX=$wrongPfxPath"
  "MAKTAB_INTERNAL_CERTIFICATE=$cerPath"
  "MAKTAB_INTERNAL_CA_CERTIFICATE=$caCerPath"
  "MAKTAB_INTERNAL_TLS_PFX=$tlsPfxPath"
  "MAKTAB_INTERNAL_TLS_CERTIFICATE=$tlsCerPath"
  "MAKTAB_INTERNAL_TLS_PASSWORD=$passwordText"
) | Add-Content -Path $env:GITHUB_ENV

Write-Host "Prepared disposable signing certificate $($signingResult.Certificate.Thumbprint)"

$tlsResult.Certificate.Dispose()
$tlsResult.Key.Dispose()
$wrongSigningResult.Certificate.Dispose()
$wrongSigningResult.Key.Dispose()
$signingResult.Certificate.Dispose()
$signingResult.Key.Dispose()
$ca.Dispose()
$caKey.Dispose()
