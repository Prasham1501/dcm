/**
 * Register the bridge to launch at Windows login (minimized to tray).
 * Uses Electron's app.setLoginItemSettings which writes HKCU\...\Run.
 */

function registerStartup(app, enable = true) {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true,
    path: process.execPath,
    args: ['--hidden'],
  });
}

function getStartupStatus(app) {
  if (process.platform !== 'win32') return { openAtLogin: false };
  return app.getLoginItemSettings({ path: process.execPath, args: ['--hidden'] });
}

module.exports = { registerStartup, getStartupStatus };
