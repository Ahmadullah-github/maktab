const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { canonicalManifest } = require('../../apps/desktop/update-contract');
const { InternalLicenseAuthority } = require('./internal-license-authority');

const targetDirectory = path.resolve(process.argv[2] || 'release-pair/v1.0.1');
const descriptor = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'release-descriptor.json'), 'utf8'));
const metadataName = descriptor.channel === 'stable' ? 'latest.yml' : 'pilot.yml';
const metadata = fs.readFileSync(path.join(targetDirectory, metadataName));
const artifact = fs.readFileSync(path.join(targetDirectory, descriptor.artifact.filename));
const port = Number(process.env.MAKTAB_INTERNAL_UPDATE_PORT || 4443);
const host = process.env.MAKTAB_INTERNAL_UPDATE_HOST || 'updates.internal.maktab.test';
const origin = `https://${host}:${port}`;
const releasePath = `/releases/download/v${descriptor.version}`;
let manifest = {
  schema_version: 2,
  channel: descriptor.channel,
  version: descriptor.version,
  build_id: descriptor.build_id,
  published_at: descriptor.published_at,
  minimum_supported_version: descriptor.minimum_supported_version,
  rollout_percent: 100,
  release_notes: 'Internal update acceptance fixture',
  updater_metadata: {
    url: `${origin}${releasePath}/${metadataName}`,
    sha256: crypto.createHash('sha256').update(metadata).digest('hex'),
  },
  artifacts: [{
    ...descriptor.artifact,
    url: `${origin}${releasePath}/${descriptor.artifact.filename}`,
  }],
  key_id: process.env.MAKTAB_INTERNAL_UPDATE_KEY_ID,
};
const staticManifestPath = path.join(targetDirectory, 'signed-update-manifest.json');
if (fs.existsSync(staticManifestPath)) {
  manifest = JSON.parse(fs.readFileSync(staticManifestPath, 'utf8'));
} else {
  if (!manifest.key_id || !process.env.MAKTAB_INTERNAL_UPDATE_PRIVATE_KEY) {
    throw new Error('Internal update signing key is not configured');
  }
  const privateKey = fs.readFileSync(process.env.MAKTAB_INTERNAL_UPDATE_PRIVATE_KEY);
  manifest.signature = crypto.sign(null, canonicalManifest(manifest), privateKey).toString('base64url');
}
const negativeManifests = {
  'wrong-publisher': JSON.parse(fs.readFileSync(path.join(targetDirectory, 'signed-update-manifest-wrong-publisher.json'), 'utf8')),
  'tampered-manifest': JSON.parse(fs.readFileSync(path.join(targetDirectory, 'signed-update-manifest-tampered.json'), 'utf8')),
};
const scenarioPath = path.join(targetDirectory, 'acceptance-scenario.txt');

function scenario() {
  try { return fs.readFileSync(scenarioPath, 'utf8').trim(); } catch { return 'normal'; }
}

const fixtureDirectory = path.join(path.dirname(targetDirectory), 'acceptance-server');
const tlsPfxPath = process.env.MAKTAB_INTERNAL_TLS_PFX || path.join(fixtureDirectory, 'internal-tls.pfx');
const tlsPassword = process.env.MAKTAB_INTERNAL_TLS_PASSWORD
  || fs.readFileSync(path.join(fixtureDirectory, 'internal-tls-password.txt'), 'utf8').trim();
const serverConfig = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'internal-server-config.json'), 'utf8'));
const licensePrivateKey = fs.readFileSync(path.join(fixtureDirectory, 'internal-license-private.pem'));
const licenseAuthority = new InternalLicenseAuthority({
  keyId: serverConfig.licenseKeyId,
  privateKey: licensePrivateKey,
  qaLicenseKey: serverConfig.qaLicenseKey,
  channel: descriptor.channel,
});

function sendJson(response, statusCode, body) {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(statusCode, {
    'Content-Type': 'application/json', 'Content-Length': bytes.length, 'Cache-Control': 'no-store',
  });
  response.end(bytes);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) request.destroy(new Error('request too large'));
      else chunks.push(chunk);
    });
    request.once('error', reject);
    request.once('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
    });
  });
}

const server = https.createServer({
  pfx: fs.readFileSync(tlsPfxPath),
  passphrase: tlsPassword,
}, async (request, response) => {
  const url = new URL(request.url, origin);
  if (url.pathname === `/v1/updates/windows/x64/${descriptor.channel}/latest`) {
    const selectedManifest = negativeManifests[scenario()] || manifest;
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(selectedManifest)); return;
  }
  if (url.pathname === `${releasePath}/${metadataName}`) {
    response.writeHead(200, { 'Content-Type': 'application/yaml', 'Content-Length': metadata.length });
    response.end(metadata); return;
  }
  if (url.pathname === `${releasePath}/${descriptor.artifact.filename}`) {
    const selectedArtifact = scenario() === 'corrupt-artifact'
      ? Buffer.concat([artifact.subarray(0, -1), Buffer.from([255 - artifact.at(-1)])])
      : artifact;
    response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': selectedArtifact.length });
    response.end(selectedArtifact); return;
  }
  if (request.method === 'POST' && url.pathname.startsWith('/v1/activations')) {
    try {
      const body = await readJson(request);
      const result = licenseAuthority.handle(url.pathname, body);
      return sendJson(response, result.status, result.body);
    } catch {
      return sendJson(response, 400, { error: { code: 'INVALID_REQUEST', message: 'License request is invalid.', retryable: false } });
    }
  }
  sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Not found.', retryable: false } });
});
server.listen(port, process.env.MAKTAB_INTERNAL_UPDATE_BIND || '127.0.0.1', () => {
  console.log(`INTERNAL_UPDATE_SERVER_READY ${origin}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
