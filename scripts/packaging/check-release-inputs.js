const { buildReleaseInputs } = require('./release-inputs');

try {
  const { config } = buildReleaseInputs({ write: process.argv.includes('--write') });
  console.log(JSON.stringify({
    version: config.version,
    buildId: config.buildId,
    distribution: config.distribution,
    channel: config.channel,
    commitSha: config.commitSha,
    licenseKeyIds: config.trust.licenseKeyIds,
    updateKeyIds: config.trust.updateKeyIds,
    authenticodePublishers: config.trust.authenticodePublishers,
  }, null, 2));
} catch (error) {
  console.error(`Release input validation failed: ${error.message}`);
  process.exitCode = 1;
}
