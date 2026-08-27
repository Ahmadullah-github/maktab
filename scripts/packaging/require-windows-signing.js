if (process.platform !== 'win32') throw new Error('Signed Windows releases must be built on Windows');
const distribution = process.env.MAKTAB_DISTRIBUTION || 'internal';
const mode = process.env.MAKTAB_SIGNING_MODE || 'pfx';
if (mode === 'pfx' && (!process.env.CSC_LINK || !process.env.CSC_KEY_PASSWORD)) {
  throw new Error(`${distribution} PFX signing credentials are missing`);
}
if (mode === 'azure') {
  const required = [
    'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET',
    'MAKTAB_AZURE_SIGNING_ENDPOINT', 'MAKTAB_AZURE_CERTIFICATE_PROFILE',
    'MAKTAB_AZURE_CODE_SIGNING_ACCOUNT', 'MAKTAB_AUTHENTICODE_PUBLISHER',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Azure signing configuration is missing: ${missing.join(', ')}`);
}
if (!['pfx', 'azure'].includes(mode)) throw new Error('MAKTAB_SIGNING_MODE must be pfx or azure');
