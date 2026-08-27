function getRuntimeInfo(app, releaseConfig) {
  const channel = app.isPackaged ? releaseConfig.channel : 'development';
  return {
    schemaVersion: 1,
    productMode: 'desktop-timetable',
    packaged: app.isPackaged,
    appVersion: app.getVersion(),
    buildId: app.isPackaged ? releaseConfig.buildId : process.env.MAKTAB_BUILD_ID || `${app.getVersion()}-development`,
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
