#!/usr/bin/env node
// Claude Code hooks: vault sync at session start and end, and the reminders that start documentation passes.
// Never fails a session: any error becomes at most one systemMessage, and the exit code is 0.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatProblems, git, isAncestor, isInside, isMain, kvHome, loadConfig, loadRegistry, loadStatus, locate, realPath, revParse } from './lib.mjs';
import { syncVault } from './sync.mjs';
import { undescribed } from './registry.mjs';
import { installBin } from './setup.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));

const USAGE = 'hook.mjs session-start|stop|session-end   (reads the hook JSON from stdin)';
const CODE_FETCH_TIMEOUT_MS = 10000;
const VAULT_FETCH_TIMEOUT_MS = 20000;
const MARKER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const RUN_SKILL = 'Run the vault-document skill as a background sub-agent now. '
  + 'If you cannot start sub-agents, mention this to the user once and run vault-document at the end of the session.';

function readInput() {
  try {
    const text = readFileSync(0, 'utf8');
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const sessionKey = (input) => String(input.session_id || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);
const startHeadFile = (home, input) => join(home, 'state', `start-${sessionKey(input)}`);

function readStartHead(home, input) {
  try { return readFileSync(startHeadFile(home, input), 'utf8').trim(); } catch { return null; }
}

// Keeps <home>/bin (used by the schedule and vault-document) in step with the plugin version the hooks run from.
function refreshBin(home) {
  if (!existsSync(join(home, 'bin'))) return;
  try { installBin(home); } catch { /* the next session start tries again */ }
}

// Vaults with sync "plugin" that belong to this session: the one linked to the cwd's code repository, or the one the cwd is in.
function sessionVaults(cwd, here, home) {
  return loadConfig(home).vaults
    .filter((v) => v.sync === 'plugin')
    .filter((v) => (here.ok && v.path === here.vault) || isInside(cwd, realPath(v.path)));
}

function syncQuietly(vault, modes, home) {
  try {
    return syncVault(vault, modes, { home, fetchTimeoutMs: VAULT_FETCH_TIMEOUT_MS });
  } catch (e) {
    return { outcome: 'error', messages: [`sync of ${vault} failed: ${e.message}`], problems: [] };
  }
}

function documentationHint(here, home) {
  let out;
  try {
    out = undescribed(here.vault, here.link.repoId, { home, fetchTimeoutMs: CODE_FETCH_TIMEOUT_MS });
  } catch (e) {
    return `knowledge-vault: could not count undescribed commits in ${here.codeRepo}: ${e.message}`;
  }
  const warning = out.fetchWarning ? ` (Note: ${out.fetchWarning}.)` : '';
  if (out.bootstrapNeeded) {
    return `knowledge-vault: the ${out.product} vault (${here.vault}) has had no bootstrap pass for code repository ${out.repoId} yet. ${RUN_SKILL}${warning}`;
  }
  if (!out.total) return null;
  return `knowledge-vault: the ${out.product} vault (${here.vault}) does not yet describe ${plural(out.total, 'functionality change')} `
    + `on origin/${out.mainBranch} of code repository ${out.repoId} (described commit ${out.describedCommit.slice(0, 12)}, head ${out.head.slice(0, 12)}). ${RUN_SKILL}${warning}`;
}

// Remembers origin/<main> as the session found it, so the Stop hook can tell which commits reached main during the session.
function recordStartHead(here, home, input) {
  try {
    const entry = loadRegistry(here.vault).codeRepos.find((r) => r.id === here.link.repoId);
    const head = entry && revParse(here.codeRepo, `refs/remotes/origin/${entry.mainBranch}^{commit}`);
    mkdirSync(join(home, 'state'), { recursive: true });
    pruneMarkers(join(home, 'state'));
    writeFileSync(startHeadFile(home, input), `${head || ''}\n`);
  } catch { /* without the file, Stop falls back to reminding once */ }
}

function sessionStart(input, cwd, home) {
  refreshBin(home);
  const here = locate(cwd, home);
  const notes = sessionVaults(cwd, here, home).flatMap((v) => syncQuietly(v.path, ['pull'], home).messages.map((m) => `knowledge-vault sync: ${m}`));
  const problems = loadStatus(home).problems;
  const context = [];
  if (problems.length) context.push(`knowledge-vault: vault sync problems on this machine (listed until a clean sync of that vault):\n${formatProblems(problems)}`);
  context.push(...notes);
  const hint = here.ok ? documentationHint(here, home) : here.link && `knowledge-vault: ${here.missing}`;
  if (hint) context.push(hint);
  if (here.ok) recordStartHead(here, home, input);
  if (!context.length) return null;
  const summary = problems.map((p) => `[${p.kind}] ${p.vault}`).join('; ');
  return {
    ...(problems.length ? { systemMessage: `knowledge-vault: ${plural(problems.length, 'vault sync problem')}: ${summary}` } : {}),
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context.join('\n\n') },
  };
}

function pruneMarkers(dir) {
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  for (const name of names) {
    const file = join(dir, name);
    try { if (Date.now() - statSync(file).mtimeMs > MARKER_MAX_AGE_MS) rmSync(file, { force: true }); } catch { /* already gone */ }
  }
}

const subagentRunning = (input) => Array.isArray(input.background_tasks)
  && input.background_tasks.some((t) => t?.type === 'subagent' && !/^(completed|failed|killed|stopped|cancelled)$/i.test(String(t.status ?? '')));

// Blocks the end of a turn once per session per head of origin/<main>, when commits reached main during the session
// and that head is not described. The commits the session started with are the session-start hint's job.
function stop(input, cwd, home) {
  if (subagentRunning(input)) return null; // perhaps the pass the session-start hint asked for; ask again at the next stop
  const here = locate(cwd, home);
  if (!here.ok) return null;
  const reg = loadRegistry(here.vault);
  const entry = reg.codeRepos.find((r) => r.id === here.link.repoId);
  if (!entry) return null;
  const head = revParse(here.codeRepo, `refs/remotes/origin/${entry.mainBranch}^{commit}`);
  if (!head || head === entry.describedCommit || head === readStartHead(home, input)) return null;
  // A described commit no longer on main means a rewritten history; session start and undescribed explain it.
  if (entry.describedCommit && !isAncestor(here.codeRepo, entry.describedCommit, head)) return null;
  const count = entry.describedCommit
    ? Number(git(here.codeRepo, ['rev-list', '--count', `${entry.describedCommit}..${head}`]).stdout.trim() || 0)
    : null;
  if (count === 0) return null;
  const stateDir = join(home, 'state');
  const marker = join(stateDir, `stop-${sessionKey(input)}-${head}`);
  if (existsSync(marker)) return null;
  pruneMarkers(stateDir);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(marker, `${new Date().toISOString()}\n`);
  const what = count === null
    ? `the ${reg.product} vault has had no bootstrap pass for code repository ${entry.id} yet`
    : `${plural(count, 'functionality change')} on origin/${entry.mainBranch} of ${entry.id} (head ${head.slice(0, 12)}) ${count === 1 ? 'is' : 'are'} not yet described in the ${reg.product} vault`;
  return { decision: 'block', reason: `knowledge-vault: ${what}. Run the vault-document skill now, then finish; `
    + 'skip this if a vault-document pass for this code repository is already running in this session. This reminder is given once per session for this head.' };
}

// Claude Code gives SessionEnd hooks about 1.5 seconds and discards their output, so the push runs in a detached process.
// Its problems are recorded in status.json and shown as a notification, like a scheduled sync's.
function sessionEnd(input, cwd, home) {
  const here = locate(cwd, home);
  for (const v of sessionVaults(cwd, here, home)) {
    const child = spawn(process.execPath, [join(SCRIPTS_DIR, 'sync.mjs'), v.path, 'push', '--hook'], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  }
  return null;
}

const HANDLERS = { 'session-start': sessionStart, stop, 'session-end': sessionEnd };

function main(argv) {
  const event = argv[0];
  if (argv.length !== 1 || !Object.hasOwn(HANDLERS, event)) {
    process.stderr.write(`usage: ${USAGE}\n`);
    return 2;
  }
  let out;
  try {
    const input = readInput();
    out = HANDLERS[event](input, realPath(input.cwd || process.cwd()), kvHome());
  } catch (e) {
    out = { systemMessage: `knowledge-vault ${event} hook: ${e.message}` };
  }
  if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
  return 0;
}

if (isMain(import.meta.url)) {
  let code = 0;
  try { code = main(process.argv.slice(2)); } catch { code = 0; }
  process.exit(code);
}
