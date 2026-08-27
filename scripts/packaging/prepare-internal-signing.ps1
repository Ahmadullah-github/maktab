$ErrorActionPreference = 'Stop'

$passwordText = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
$password = ConvertTo-SecureString -String $passwordText -AsPlainText -Force
$notAfter = (Get-Date).AddDays(7)
$ca = New-SelfSignedCertificate `
  -Type Custom `
  -Subject 'CN=Maktab Internal Test CA' `
  -FriendlyName 'Maktab Internal Test CA - disposable' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage CertSign, CRLSign, DigitalSignature `
  -NotAfter $notAfter `
  -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=0')

$certificate = New-SelfSignedCertificate `
  -Type Custom `
  -Signer $ca `
  -Subject 'CN=Maktab Internal Test' `
  -FriendlyName 'Maktab Internal Test - disposable' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -NotAfter $notAfter `
  -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3')

$wrongCertificate = New-SelfSignedCertificate `
  -Type Custom `
  -Signer $ca `
  -Subject 'CN=Maktab Wrong Publisher Test' `
  -FriendlyName 'Maktab Wrong Publisher - disposable' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -NotAfter $notAfter `
  -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3')

$directory = Join-Path $env:RUNNER_TEMP 'maktab-internal-signing'
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$pfxPath = Join-Path $directory 'internal-signing.pfx'
$wrongPfxPath = Join-Path $directory 'wrong-publisher.pfx'
$cerPath = Join-Path $directory 'internal-signing.cer'
$caCerPath = Join-Path $directory 'internal-test-ca.cer'
$tlsPfxPath = Join-Path $directory 'internal-tls.pfx'
Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $password | Out-Null
Export-PfxCertificate -Cert $wrongCertificate -FilePath $wrongPfxPath -Password $password | Out-Null
Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null
Export-Certificate -Cert $ca -FilePath $caCerPath | Out-Null
Import-Certificate -FilePath $caCerPath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Import-Certificate -FilePath $cerPath -CertStoreLocation 'Cert:\CurrentUser\TrustedPublisher' | Out-Null

$tlsCertificate = New-SelfSignedCertificate `
  -Type Custom `
  -Signer $ca `
  -Subject 'CN=updates.internal.maktab.test' `
  -FriendlyName 'Maktab Internal Update TLS - disposable' `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature, KeyEncipherment `
  -NotAfter $notAfter `
  -TextExtension @(
    '2.5.29.17={text}dns=updates.internal.maktab.test&dns=localhost&ipaddress=127.0.0.1'
    '2.5.29.37={text}1.3.6.1.5.5.7.3.1'
  )
Export-PfxCertificate -Cert $tlsCertificate -FilePath $tlsPfxPath -Password $password | Out-Null
$tlsCerPath = Join-Path $directory 'internal-tls.cer'
Export-Certificate -Cert $tlsCertificate -FilePath $tlsCerPath | Out-Null

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

Write-Host "Prepared disposable signing certificate $($certificate.Thumbprint)"
