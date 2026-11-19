// The 15-minute background vault sync (run through "setup.mjs schedule|unschedule").
// macOS: one launchd LaunchAgent per machine. Linux and WSL: a crontab line the user adds; this never edits crontab.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { UsageError, which } from './lib.mjs';

export const LABEL = 'com.knowledge-vault.sync';
const MAX_INTERVAL_MINUTES = 1440;

export const plistPath = () => join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

// A PATH entry such as /opt/homebrew/bin/node survives node upgrades; process.execPath often names a versioned folder.
const nodePath = () => which('node') || process.execPath;
const xml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const shellQuote = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

export function parseInterval(text = '15') {
  const minutes = Number(text);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_INTERVAL_MINUTES) {
    throw new UsageError(`--interval-minutes must be a whole number from 1 to ${MAX_INTERVAL_MINUTES}`);
  }
  return minutes;
}

export function plist(home, minutes, env = process.env) {
  const args = [nodePath(), join(home, 'bin', 'sync.mjs'), '--all', '--hook'];
  const vars = { PATH: env.PATH || '/usr/bin:/bin', ...(env.KNOWLEDGE_VAULT_HOME ? { KNOWLEDGE_VAULT_HOME: env.KNOWLEDGE_VAULT_HOME } : {}) };
  const log = xml(join(home, 'sync.log'));
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((a) => `    <string>${xml(a)}</string>`).join('\n')}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(vars).map(([k, v]) => `    <key>${k}</key>\n    <string>${xml(v)}</string>`).join('\n')}
  </dict>
  <key>StartInterval</key>
  <integer>${minutes * 60}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${log}</string>
  <key>StandardErrorPath</key>
  <string>${log}</string>
</dict>
</plist>
`;
}

export function cronLine(home, minutes) {
  let when;
  if (minutes < 60) when = `*/${minutes} * * * *`;
  else if (minutes % 60 === 0) when = `0 */${minutes / 60} * * *`;
  else throw new UsageError('with cron, --interval-minutes must be under 60 or a whole number of hours');
  return `${when} ${shellQuote(nodePath())} ${shellQuote(join(home, 'bin', 'sync.mjs'))} --all --hook >> ${shellQuote(join(home, 'sync.log'))} 2>&1`;
}

function launchctl(args) {
  const r = spawnSync('launchctl', args, { encoding: 'utf8', timeout: 15000 });
  return { ok: r.status === 0, why: (r.stderr || r.error?.message || '').trim() };
}

// Returns the text to print. With apply on macOS it writes and loads the LaunchAgent (the caller refreshes bin/ first).
export function schedule({ apply = false, minutes, home, platform = process.platform }) {
  if (platform === 'win32') throw new Error('native Windows is not supported in this version; run vault sync from WSL, where the cron line works');
  if (platform !== 'darwin') {
    const lead = apply ? 'This plugin never edits your crontab. ' : '';
    return `${lead}Add this line with "crontab -e" to sync every ${minutes} minutes the vaults whose sync is "plugin":\n${cronLine(home, minutes)}\n`;
  }
  const text = plist(home, minutes);
  const file = plistPath();
  if (!apply) return `Not installed. With --apply this is written to ${file} and loaded:\n${text}`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  const domain = `gui/${process.getuid()}`;
  launchctl(['bootout', domain, file]); // fails harmlessly when the agent was not loaded yet
  const loaded = launchctl(['bootstrap', domain, file]);
  if (!loaded.ok) throw new Error(`wrote ${file} but launchctl could not load it (${loaded.why}); load it by hand: launchctl bootstrap ${domain} "${file}"`);
  return `Installed ${file}: every ${minutes} minutes it syncs the vaults whose sync is "plugin". Log: ${join(home, 'sync.log')}\n`;
}

export function unschedule({ platform = process.platform } = {}) {
  if (platform !== 'darwin') return 'Remove the line containing knowledge-vault/bin/sync.mjs with "crontab -e"; this plugin never edits your crontab.\n';
  const file = plistPath();
  if (!existsSync(file)) return `No LaunchAgent at ${file}; nothing to remove.\n`;
  launchctl(['bootout', `gui/${process.getuid()}`, file]);
  rmSync(file, { force: true });
  return `Unloaded and removed ${file}.\n`;
}
