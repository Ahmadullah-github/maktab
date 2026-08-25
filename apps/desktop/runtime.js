function getRuntimeInfo(app) {
  const configuredChannel = process.env.MAKTAB_RELEASE_CHANNEL;
  const channel = configuredChannel === 'pilot' || configuredChannel === 'stable'
    ? configuredChannel
    : 'development';
  return {
    schemaVersion: 1,
    productMode: 'desktop-timetable',
    packaged: app.isPackaged,
    appVersion: app.getVersion(),
    buildId: process.env.MAKTAB_BUILD_ID || `${app.getVersion()}-development`,
    channel,
    platform: process.platform,
    arch: process.arch,
    capabilities: {
      localTimetable: true,
      platform: false,
      nativePrint: true,
      backupRestore: app.isPackaged,
      licensing: app.isPackaged,
      updates: app.isPackaged,
      diagnostics: true,
    },
  };
}

module.exports = { getRuntimeInfo };

