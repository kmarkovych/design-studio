// Shared helpers for the knowledge-vault scripts. Node 18+, no dependencies.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REGISTRY_FILE = '.knowledge-vault.json';
export const LINK_FILE = '.knowledge-vault-link.json';
export const SECTION_KEYS = ['architecture', 'features', 'featureIndex', 'decisions', 'glossary', 'changeLog'];
export const PROBLEM_KINDS = ['conflict', 'error', 'secret-refused', 'stale-lock'];
const GIT_TIMEOUT_MS = 120000;

// Thrown for wrong command-line arguments: the CLI prints the usage line and exits 2.
export class UsageError extends Error {}

// True when the module is the process entry point, also when started through a symlink.
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl)); } catch { return false; }
}

export const kvHome = (env = process.env) => env.KNOWLEDGE_VAULT_HOME || join(homedir(), '.knowledge-vault');

export function realPath(path) {
  try { return realpathSync(path); } catch { return path; }
}

export function readJson(file, fallback) {
  if (!existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`${file} does not exist`);
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file} is not valid JSON (${e.message}); fix it by hand or delete it`);
  }
}

// Write through a temporary file and rename, so a reader never sees half a file.
export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, file);
}

export function loadConfig(home = kvHome()) {
  const file = join(home, 'config.json');
  const config = readJson(file, { version: 1, vaults: [], codeRepos: [] });
  if (!config || !Array.isArray(config.vaults) || !Array.isArray(config.codeRepos)) {
    throw new Error(`${file} must hold {"version":1,"vaults":[],"codeRepos":[]}; fix it by hand or delete it and run vault-setup again`);
  }
  return config;
}

export const saveConfig = (config, home = kvHome()) => writeJson(join(home, 'config.json'), config);

export function loadRegistry(vault) {
  const file = join(vault, REGISTRY_FILE);
  if (!existsSync(file)) throw new Error(`${vault} has no ${REGISTRY_FILE}; create or adopt the vault first (setup.mjs init or adopt)`);
  const reg = readJson(file);
  if (!reg || !Array.isArray(reg.codeRepos) || typeof reg.sections !== 'object') throw new Error(`${file} is malformed: it needs "sections" and "codeRepos"`);
  return reg;
}

export const saveRegistry = (vault, reg) => writeJson(join(vault, REGISTRY_FILE), reg);

export function findRepoEntry(reg, repoId) {
  const entry = reg.codeRepos.find((r) => r.id === repoId);
  if (!entry) throw new Error(`the vault has no code repository "${repoId}"; known ids: ${reg.codeRepos.map((r) => r.id).join(', ') || 'none'}`);
  return entry;
}

// Same repository whatever the URL form: scheme, user, port, "host:path" vs "host/path", ".git" and trailing slashes are ignored.
export function normalizeRemote(url) {
  if (!url) return '';
  return String(url).trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@/]+@/, '')
    .replace(/^([^/:]+):\d+\//, '$1/')
    .replace(/^([^/:]+):/, '$1/')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .toLowerCase();
}

export const sameRemote = (a, b) => Boolean(a) && Boolean(b) && normalizeRemote(a) === normalizeRemote(b);

const gitEnv = () => ({
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || 'ssh -o BatchMode=yes -o ConnectTimeout=8',
});

// Never throws: a spawn error or timeout comes back as code -1 with the reason in stderr.
export function git(cwd, args, { timeoutMs = GIT_TIMEOUT_MS } = {}) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd, env: gitEnv(), encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) {
    const timedOut = r.error.code === 'ETIMEDOUT';
    const why = timedOut ? `timed out after ${Math.round(timeoutMs / 1000)} s` : r.error.message;
    return { code: -1, stdout: r.stdout || '', stderr: `git ${args[0]} ${why}`, timedOut };
  }
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr || '', timedOut: false };
}

export function gitOk(cwd, args, opts) {
  const r = git(cwd, args, opts);
  if (r.code !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${r.stderr.trim() || `exit ${r.code}`}`);
  return r.stdout.trim();
}

export function revParse(repo, rev) {
  const r = git(repo, ['rev-parse', '-q', '--verify', rev]);
  return r.code === 0 ? r.stdout.trim() : null;
}

export const isAncestor = (repo, a, b) => git(repo, ['merge-base', '--is-ancestor', a, b]).code === 0;

export function originUrl(repo) {
  const r = git(repo, ['remote', 'get-url', 'origin']);
  return r.code === 0 ? r.stdout.trim() : null;
}

export function toplevel(dir) {
  if (!existsSync(dir)) return null;
  const r = git(dir, ['rev-parse', '--show-toplevel']);
  return r.code === 0 ? realPath(r.stdout.trim()) : null;
}

// Uses the repository's own identity when it has one, a neutral one otherwise.
export function identityArgs(repo) {
  const name = git(repo, ['config', 'user.name']).stdout.trim();
  const email = git(repo, ['config', 'user.email']).stdout.trim();
  return [
    ...(name ? [] : ['-c', 'user.name=knowledge-vault']),
    ...(email ? [] : ['-c', 'user.email=knowledge-vault@localhost']),
  ];
}

export function which(name, env = process.env) {
  for (const dir of (env.PATH || '').split(delimiter)) {
    const file = join(dir, name);
    try { if (statSync(file).isFile()) return file; } catch { /* not here */ }
  }
  return null;
}

export function localDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A status.json that cannot be read is set aside once, with a note on stderr, so problem reporting keeps working.
export function loadStatus(home = kvHome()) {
  const file = join(home, 'status.json');
  let status;
  try {
    status = readJson(file, { problems: [] });
  } catch (e) {
    const aside = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    try { renameSync(file, aside); } catch { /* another run already moved it */ }
    process.stderr.write(`knowledge-vault: ${e.message.split(';')[0]}; moved it to ${aside} and started a new one\n`);
    return { problems: [] };
  }
  return Array.isArray(status?.problems) ? status : { problems: [] };
}

// Replaces one vault's problems with this run's: a clean run passes [] and so clears them.
// shortcut: two processes writing status.json at the same instant can lose one write; add a lock if that shows up.
export function setVaultProblems(home, vault, problems) {
  const others = loadStatus(home).problems.filter((p) => p.vault !== vault);
  writeJson(join(home, 'status.json'), { problems: [...others, ...problems] });
}

export const makeProblem = (vault, kind, detail) => ({ vault, when: new Date().toISOString(), kind, detail });

export function formatProblems(problems) {
  return problems.map((p) => `- [${p.kind}] ${p.vault} (${p.when}): ${p.detail}`).join('\n');
}

export const isInside = (path, dir) => path === dir || path.startsWith(dir.endsWith(sep) ? dir : dir + sep);

// From a folder inside a code repository: its link file and the vault it names on this machine.
export function locate(cwd, home = kvHome()) {
  const codeRepo = toplevel(cwd);
  if (!codeRepo) return { ok: false, missing: `${cwd} is not inside a git repository` };
  const linkFile = join(codeRepo, LINK_FILE);
  if (!existsSync(linkFile)) {
    return { ok: false, codeRepo, missing: `${codeRepo} has no ${LINK_FILE}, so it is not linked to a vault; link it with setup.mjs link` };
  }
  const link = readJson(linkFile);
  const vault = loadConfig(home).vaults.find((v) => sameRemote(v.remote, link.vaultRemote));
  if (!vault || !existsSync(vault.path)) {
    return { ok: false, codeRepo, link, missing: `the vault of ${link.product} (${link.vaultRemote}) is not set up on this machine; clone it and run vault-setup` };
  }
  return { ok: true, codeRepo, link, vault: vault.path, sync: vault.sync };
}

export function printUsage(usage) {
  process.stderr.write(`usage: ${usage}\n`);
  process.exit(2);
}

// Runs a CLI body: usage errors exit 2, other errors print their message and exit 1.
export function runCli(usage, body) {
  try {
    const code = body();
    process.exit(code ?? 0);
  } catch (e) {
    if (e instanceof UsageError) {
      if (e.message) process.stderr.write(`${e.message}\n`);
      printUsage(usage);
    }
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}

// Minimal flag parser: returns { positional, flags } and throws UsageError on unknown flags or missing values.
export function parseArgs(argv, { booleans = [], values = [] } = {}) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const name = a.slice(2);
    if (booleans.includes(name)) { flags[name] = true; continue; }
    if (!values.includes(name) || i + 1 >= argv.length) throw new UsageError(`unknown or incomplete option ${a}`);
    flags[name] = argv[++i];
  }
  return { positional, flags };
}
