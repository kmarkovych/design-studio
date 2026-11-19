// Shared helpers for the studio-run scripts. Node 18+, no dependencies.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const MIN_IMPECCABLE_VERSION = '4.10.0';
const MAX_CACHE_DEPTH = 7;

// True when the module is the process entry point, also when started through a symlink.
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl)); } catch { return false; }
}

export function parseSkillVersion(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const line = /^[ \t]*version:[ \t]*["']?([^\s"']+)/m.exec(match[1]);
  return line ? line[1] : null;
}

export function compareVersions(a, b) {
  const parts = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parts(a), pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function skillRoots({ cwd, env, home }) {
  const config = env.CLAUDE_CONFIG_DIR || join(home, '.claude');
  return [
    join(cwd, '.claude', 'skills'),
    join(cwd, '.agents', 'skills'),
    join(config, 'skills'),
    join(home, '.agents', 'skills'),
  ];
}

export function findImpeccable({ cwd = process.cwd(), env = process.env, home = homedir(), platform = process.platform } = {}) {
  const launcherName = platform === 'win32' ? 'impeccable.cmd' : 'impeccable';
  const candidates = [
    ...(env.IMPECCABLE_SKILL_DIR ? [env.IMPECCABLE_SKILL_DIR] : []),
    ...skillRoots({ cwd, env, home }).map((root) => join(root, 'impeccable')),
  ];
  for (const skillDir of candidates) {
    const launcher = join(skillDir, 'scripts', launcherName);
    const skillMd = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMd) || !existsSync(launcher)) continue;
    let version = null;
    try { version = parseSkillVersion(readFileSync(skillMd, 'utf8')); } catch { /* unreadable: version unknown */ }
    return { skillDir, launcher, version };
  }
  return null;
}

function walkForSkill(dir, name, depth) {
  if (depth > MAX_CACHE_DEPTH) return null;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = join(dir, entry.name);
    if (entry.name === name && existsSync(join(child, 'SKILL.md'))) return child;
    const found = walkForSkill(child, name, depth + 1);
    if (found) return found;
  }
  return null;
}

export function findSkill(name, { cwd = process.cwd(), env = process.env, home = homedir() } = {}) {
  for (const root of skillRoots({ cwd, env, home })) {
    if (existsSync(join(root, name, 'SKILL.md'))) return join(root, name);
  }
  const config = env.CLAUDE_CONFIG_DIR || join(home, '.claude');
  return walkForSkill(join(config, 'plugins', 'cache'), name, 1);
}

// Never throws: a spawn error or timeout comes back as code -1 with the reason in stderr.
export function runImpeccable(launcher, args, { cwd = process.cwd(), timeoutMs = 60000 } = {}) {
  // .cmd files cannot be spawned directly on Windows; cmd.exe receives the arguments as an array.
  const [file, argv] = launcher.endsWith('.cmd') ? ['cmd.exe', ['/d', '/c', launcher, ...args]] : [launcher, args];
  const r = spawnSync(file, argv, { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    const why = r.error.code === 'ETIMEDOUT' ? `timed out after ${timeoutMs} ms` : r.error.message;
    return { code: -1, stdout: r.stdout || '', stderr: `impeccable ${args[0] ?? ''} failed: ${why}` };
  }
  if (r.status === null) {
    return { code: -1, stdout: r.stdout || '', stderr: `impeccable ${args[0] ?? ''} was killed by signal ${r.signal}` };
  }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
