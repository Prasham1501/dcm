/**
 * Multi-port firewall rule helper.
 * Adapted from dcm/main.js addFirewallRule() (lines 2420-2453).
 * One rule named "Accurate Bridge - <port>" per slot port; UAC-elevates if needed.
 */

const { execSync, exec } = require('child_process');

function ruleName(port) { return `Accurate Bridge - ${port}`; }

function ruleExists(port) {
  try {
    const out = execSync(`netsh advfirewall firewall show rule name="${ruleName(port)}"`, {
      encoding: 'utf8', timeout: 5000, windowsHide: true,
    });
    return out.includes(ruleName(port));
  } catch (_) { return false; }
}

function tryAddDirect(port) {
  try {
    execSync(
      `netsh advfirewall firewall add rule name="${ruleName(port)}" dir=in action=allow protocol=TCP localport=${port} profile=any`,
      { timeout: 10000, windowsHide: true }
    );
    return true;
  } catch (_) { return false; }
}

function elevateAdd(port, logger) {
  const cmd = `Start-Process -FilePath 'netsh' -ArgumentList 'advfirewall firewall add rule name=\\"${ruleName(port)}\\" dir=in action=allow protocol=TCP localport=${port} profile=any' -Verb RunAs -WindowStyle Hidden -Wait`;
  exec(`powershell -NoProfile -Command "${cmd}"`, { timeout: 30000, windowsHide: true }, (err) => {
    if (err) logger.warn(`[Firewall] rule for ${port} not added (UAC declined?): ${err.message}`);
    else logger.info(`[Firewall] rule for ${port} added via elevation`);
  });
}

function ensureFirewallRules(ports, logger) {
  if (process.platform !== 'win32') return;
  for (const port of ports) {
    try {
      if (ruleExists(port)) { logger.debug(`[Firewall] rule exists for ${port}`); continue; }
      if (tryAddDirect(port)) { logger.info(`[Firewall] added rule for ${port}`); continue; }
      logger.info(`[Firewall] elevating to add rule for ${port}...`);
      elevateAdd(port, logger);
    } catch (e) {
      logger.warn(`[Firewall] could not add rule for ${port}: ${e.message}`);
    }
  }
}

module.exports = { ensureFirewallRules };
