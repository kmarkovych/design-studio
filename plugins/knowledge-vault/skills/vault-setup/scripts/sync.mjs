#!/usr/bin/env node
// Vault sync: commits local changes, fetches, rebases onto the vault repository and pushes. No agent.
// Never resolves a conflict: it aborts the rebase, pushes nothing and records the problem.
// Any problem (conflict, error, refused secret, stale lock) means nothing is pushed in that run.
import { existsSync, mkdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { join } from 'node:path';
import {
  REGISTRY_FILE, UsageError, git, gitOk, identityArgs, isMain, kvHome, loadConfig, loadRegistry, makeProblem,
  readJson, realPath, revParse, runCli, setVaultProblems,
} from './lib.mjs';
import { findSecrets } from './secrets.mjs';

const USAGE = 'sync.mjs <vault-path> pull|push|hold|release [--hook]  |  sync.mjs --all [--hook]';
const LOCK_NAME = 'knowledge-vault-sync.lock';
const HOLD_FILE = 'held-by-documentation-pass';
const STALE_LOCK_MS = 10 * 60 * 1000;
const STALE_HOLD_MS = 2 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 60000;
// Never let the user's git config stash or move refs during the sync's own rebase.
const REBASE_CONFIG = ['-c', 'rebase.autoStash=false', '-c', 'rebase.updateRefs=false'];
const NETWORK_ERROR = /could not resolve|connection (refused|timed out|reset|closed)|timed out|network is unreachable|no route to host|temporary failure|failed to connect|couldn't connect/i;

const lockOf = (vault) => join(vault, '.git', LOCK_NAME);
const staleAfter = (lock) => (existsSync(join(lock, HOLD_FILE)) ? STALE_HOLD_MS : STALE_LOCK_MS);

const lockStat = (lock) => { try { return statSync(lock); } catch { return null; } };

// 'ok', 'busy' (a fresh lock is held) or 'stale' (an abandoned lock was taken over; this run now holds it).
function acquireLock(lock) {
  try { mkdirSync(lock); return 'ok'; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  const seen = lockStat(lock);
  if (!seen || Date.now() - seen.mtimeMs <= staleAfter(lock)) return 'busy';
  // Of two runs that both saw the lock as stale, only one rename succeeds.
  const aside = `${lock}.stale-${process.pid}-${Date.now()}`;
  try { renameSync(lock, aside); } catch { return 'busy'; }
  if (lockStat(aside)?.ino !== seen.ino) { // another run had already replaced it with a fresh lock: give that back
    try { renameSync(aside, lock); } catch { rmSync(aside, { recursive: true, force: true }); }
    return 'busy';
  }
  rmSync(aside, { recursive: true, force: true });
  try { mkdirSync(lock); return 'stale'; } catch { return 'busy'; }
}

function language(vault) {
  try { return readJson(join(vault, REGISTRY_FILE), {}).language === 'en' ? 'en' : 'uk'; } catch { return 'uk'; }
}

const syncMessage = (lang, n) => {
  const host = hostname().split('.')[0];
  return lang === 'en' ? `vault: sync (${host}, ${n} files)` : `vault: автосинхронізація (${host}, ${n} файл.)`;
};

const stagedNames = (vault) => gitOk(vault, ['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);

// A rebase, merge, cherry-pick or revert left unfinished, or files still in conflict: never commit over them.
function unfinished(vault) {
  const op = ['rebase-merge', 'rebase-apply', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'sequencer'].find((f) => existsSync(join(vault, '.git', f)));
  if (op) return makeProblem(vault, 'error', `an unfinished rebase, merge, cherry-pick or revert is in the vault (.git/${op}); nothing was committed or pushed. Finish or abort it by hand (git -C "${vault}" status)`);
  const conflicted = [...new Set(git(vault, ['ls-files', '-u', '-z']).stdout.split('\0').filter(Boolean).map((l) => l.split('\t')[1]))];
  if (!conflicted.length) return null;
  return makeProblem(vault, 'conflict', `files are still in conflict in the vault: ${conflicted.join(', ')}; nothing was committed or pushed. `
    + `Resolve them by hand, keeping both sides, then git -C "${vault}" add them`);
}

// The vault repository's main branch as last fetched: origin/HEAD, else main or master; null before the first push.
function knownMainBranch(vault) {
  const head = git(vault, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']).stdout.trim();
  if (head) return head.replace(/^origin\//, '');
  return ['main', 'master'].find((b) => revParse(vault, `refs/remotes/origin/${b}`)) ?? null;
}

// The branch to sync, or a problem when HEAD is detached or on another branch than the vault repository's main branch.
function syncBranch(vault) {
  const branch = git(vault, ['symbolic-ref', '-q', '--short', 'HEAD']).stdout.trim();
  if (!branch) return { problem: makeProblem(vault, 'error', `the vault is on a detached HEAD; nothing was committed or pushed. Check out its main branch (git -C "${vault}" switch main)`) };
  const main = knownMainBranch(vault);
  if (main && main !== branch) {
    return { problem: makeProblem(vault, 'error', `the vault is on branch "${branch}", but its vault repository's main branch is "${main}"; nothing was committed or pushed. `
      + `Switch back with git -C "${vault}" switch ${main}, merging "${branch}" into it first if it holds notes you want to keep`) };
  }
  return { branch };
}

function registryError(vault) {
  try { loadRegistry(vault); return null; } catch (e) { return e.message; }
}

// Commits everything, unless something staged looks like a secret or the registry is broken: then nothing is committed.
function commitLocal(vault) {
  gitOk(vault, ['add', '-A']);
  if (git(vault, ['diff', '--cached', '--quiet']).code === 0) return [];
  const refused = findSecrets(vault, { staged: true });
  const broken = stagedNames(vault).includes(REGISTRY_FILE) ? registryError(vault) : null;
  if (refused.length || broken) {
    gitOk(vault, revParse(vault, 'HEAD') ? ['reset', '-q'] : ['read-tree', '--empty']);
    return [
      ...(refused.length ? [makeProblem(vault, 'secret-refused', `these files look like secrets: ${refused.join(', ')}. Nothing was committed, pulled or pushed until they are fixed. `
        + 'Keys, tokens, passwords, connection strings and .env files never belong in a vault: delete the value (or the file) from the vault folder')] : []),
      ...(broken ? [makeProblem(vault, 'error', `${broken}. Nothing was committed, pulled or pushed until it is fixed`)] : []),
    ];
  }
  gitOk(vault, [...identityArgs(vault), 'commit', '-q', '-m', syncMessage(language(vault), stagedNames(vault).length)]);
  return [];
}

// null when fetched; { offline: text } for a network failure; { problem } for anything else (a gone repository, no access).
function fetchVault(vault, timeoutMs) {
  const r = git(vault, ['fetch', '-q', 'origin'], { timeoutMs });
  if (r.code === 0) return null;
  const lines = r.stderr.split('\n').map((l) => l.trim()).filter(Boolean);
  const network = lines.find((l) => NETWORK_ERROR.test(l));
  if (r.timedOut || network) return { offline: network || lines[0] || 'timed out' };
  const why = lines.find((l) => /^(fatal|error|remote):|denied|not found|does not (appear|exist)/i.test(l)) || lines[0] || `exit ${r.code}`;
  return { problem: makeProblem(vault, 'error', `git fetch from the vault repository failed: ${why}. Nothing was pulled or pushed; local commits are kept. `
    + `Check its URL (git -C "${vault}" remote -v) and your access to it`) };
}

// { ok, received }, { ok, skipped: reason } or { ok: false, problem }.
function rebaseOnRemote(vault, branch, external) {
  const remoteRef = `refs/remotes/origin/${branch}`;
  if (!revParse(vault, remoteRef)) return { ok: true, received: 0 };
  const received = Number(gitOk(vault, ['rev-list', '--count', `HEAD..${remoteRef}`]));
  if (!received) return { ok: true, received: 0 };
  // An external vault's uncommitted edits belong to its owner or its own sync: never commit or stash them to rebase.
  if (external && git(vault, ['status', '--porcelain', '--untracked-files=no']).stdout.trim()) {
    return { ok: true, skipped: `${vault} has uncommitted changes, which this plugin never commits in a vault with its own sync; `
      + `the vault repository's ${received} new commit(s) were not pulled and nothing was pushed. Work on the local copy; the vault's own sync carries both` };
  }
  const r = git(vault, [...identityArgs(vault), ...REBASE_CONFIG, 'rebase', '-q', remoteRef]);
  if (r.code === 0) return { ok: true, received };
  const files = git(vault, ['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);
  git(vault, ['rebase', '--abort']);
  if (!files.length) return { ok: false, problem: makeProblem(vault, 'error', `rebase onto origin/${branch} failed and was aborted: ${r.stderr.trim()}`) };
  return { ok: false, problem: makeProblem(vault, 'conflict', `this machine and the vault repository both changed ${files.join(', ')}; `
    + `nothing was merged or pushed. Resolve by hand without losing either side: git -C "${vault}" pull --rebase origin ${branch}, `
    + 'fix the files, git add them, git rebase --continue. Agent notes in conflict may instead be regenerated by the vault-document skill') };
}

// Pushes the local commits, unless one of them adds something that looks like a secret.
function pushIfAhead(vault, branch) {
  const remoteRef = `refs/remotes/origin/${branch}`;
  const known = revParse(vault, remoteRef);
  const ahead = known ? Number(gitOk(vault, ['rev-list', '--count', `${remoteRef}..HEAD`])) : 1;
  if (!ahead) return { pushed: 0 };
  const refused = findSecrets(vault, { range: known ? `${remoteRef}..HEAD` : 'HEAD' });
  if (refused.length) {
    return { problem: makeProblem(vault, 'secret-refused', `the local commits not yet in the vault repository add what looks like a secret in: ${refused.join(', ')}; nothing was pushed. `
      + `Remove the value from each file, then rewrite the unpushed commits so none keeps it: git -C "${vault}" reset --soft ${known ? `origin/${branch}` : '<first commit>'}, then commit again`) };
  }
  const r = git(vault, ['push', '-q', 'origin', `HEAD:refs/heads/${branch}`], { timeoutMs: FETCH_TIMEOUT_MS });
  if (r.code !== 0) return { problem: makeProblem(vault, 'error', `git push failed: ${r.stderr.trim()}`) };
  return { pushed: ahead };
}

// external: the vault has its own sync, so only commits already made (the pass's own) are exchanged; nothing is committed here.
function exchange(vault, modes, fetchTimeoutMs, external) {
  const stop = (problems) => ({ outcome: 'problem', messages: [], problems });
  const busy = unfinished(vault);
  if (busy) return stop([busy]);
  const { branch, problem } = syncBranch(vault);
  if (problem) return stop([problem]);
  const refused = external ? [] : commitLocal(vault);
  if (refused.length) return stop(refused);
  const fetched = fetchVault(vault, fetchTimeoutMs);
  if (fetched?.problem) return stop([fetched.problem]);
  if (fetched?.offline) {
    return { outcome: 'offline', messages: [`could not reach the vault repository (${fetched.offline}); sync skipped, local commits are kept for next time`], problems: [] };
  }
  const messages = [];
  const rebased = rebaseOnRemote(vault, branch, external);
  if (!rebased.ok) return stop([rebased.problem]);
  if (rebased.skipped) return { outcome: 'skipped', messages: [rebased.skipped], problems: [] };
  if (rebased.received) messages.push(`received ${rebased.received} commit(s) from the vault repository`);
  if (!modes.includes('push')) return { outcome: 'clean', messages, problems: [] };
  const p = pushIfAhead(vault, branch);
  if (p.problem) return { outcome: 'problem', messages, problems: [p.problem] };
  if (p.pushed) messages.push(`pushed ${p.pushed} commit(s) to the vault repository`);
  return { outcome: 'clean', messages, problems: [] };
}

function requireRepo(vault) {
  if (!existsSync(join(vault, '.git'))) throw new Error(`${vault} is not a git repository; nothing to sync`);
}

const isExternal = (vault, home) => loadConfig(home).vaults.some((v) => v.sync === 'external' && realPath(v.path) === realPath(vault));

// Syncs one vault and records its problems in status.json. Throws only when the path is not a git repository.
export function syncVault(vault, modes, { home = kvHome(), fetchTimeoutMs = FETCH_TIMEOUT_MS } = {}) {
  requireRepo(vault);
  const external = isExternal(vault, home);
  if (git(vault, ['remote', 'get-url', 'origin']).code !== 0) {
    return { outcome: 'skipped', messages: [`${vault} has no origin remote yet; nothing to sync`], problems: [] };
  }
  const lock = lockOf(vault);
  const got = acquireLock(lock);
  if (got === 'busy') return { outcome: 'skipped', messages: [`another sync or a documentation pass holds ${vault}; skipped`], problems: [] };
  try {
    const result = got === 'stale'
      ? { outcome: 'problem', messages: [], problems: [makeProblem(vault, 'stale-lock', `removed an abandoned sync lock (${lock}); `
        + 'a previous sync or documentation pass was probably killed. Nothing was synced this time; the next sync runs normally')] }
      : exchange(vault, modes, fetchTimeoutMs, external);
    if (result.outcome === 'clean' || result.problems.length) setVaultProblems(home, vault, result.problems);
    return result;
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

// A documentation pass holds the lock for its whole run, so no vault sync commits its half-written notes.
export function hold(vault) {
  requireRepo(vault);
  const lock = lockOf(vault);
  const marker = join(lock, HOLD_FILE);
  if (existsSync(marker)) {
    const now = new Date();
    utimesSync(lock, now, now);
    return `still held for a documentation pass: ${lock}`;
  }
  if (acquireLock(lock) === 'busy') throw new Error(`a vault sync of ${vault} is running; run hold again in a minute`);
  writeFileSync(marker, `${new Date().toISOString()} pid ${process.ppid}\n`);
  return `held for a documentation pass until release (or ${STALE_HOLD_MS / 3600000} hours): ${lock}`;
}

export function release(vault) {
  requireRepo(vault);
  const lock = lockOf(vault);
  if (!existsSync(join(lock, HOLD_FILE))) return existsSync(lock) ? `the lock belongs to a running vault sync, not to a pass; left alone` : 'nothing was held';
  rmSync(lock, { recursive: true, force: true });
  return `released ${lock}`;
}

function notify(text) {
  if (process.platform !== 'darwin' || process.env.KNOWLEDGE_VAULT_NOTIFY === 'off') return;
  spawnSync('osascript', ['-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title "knowledge-vault"', '-e', 'end run', text], { timeout: 5000 });
}

function syncAll(home) {
  const results = [];
  for (const v of loadConfig(home).vaults.filter((x) => x.sync === 'plugin')) {
    try {
      results.push(syncVault(v.path, ['pull', 'push'], { home }));
    } catch (e) {
      const problem = makeProblem(v.path, 'error', e.message);
      setVaultProblems(home, v.path, [problem]);
      results.push({ outcome: 'problem', messages: [], problems: [problem] });
    }
  }
  return results;
}

function report(results, hookMode) {
  const problems = results.flatMap((r) => r.problems);
  const messages = results.flatMap((r) => r.messages);
  if (problems.length) notify(problems.map((p) => `${p.kind}: ${p.vault}`).join('; '));
  if (hookMode) {
    const warnings = [...problems.map((p) => `[${p.kind}] ${p.vault}: ${p.detail}`), ...results.filter((r) => r.outcome === 'offline').flatMap((r) => r.messages)];
    if (warnings.length) process.stdout.write(`${JSON.stringify({ systemMessage: `knowledge-vault sync: ${warnings.join(' | ')}` })}\n`);
    return 0;
  }
  for (const m of messages) process.stdout.write(`vault sync: ${m}\n`);
  if (!messages.length && !problems.length) process.stdout.write('vault sync: already up to date with the vault repository\n');
  for (const p of problems) process.stderr.write(`vault sync problem [${p.kind}] ${p.vault}: ${p.detail}\n`);
  return problems.length ? 3 : 0;
}

function main(argv) {
  const hookMode = argv.includes('--hook');
  const args = argv.filter((a) => a !== '--hook');
  const home = kvHome();
  const [target, mode] = args;
  if (args.length === 2 && !target.startsWith('--') && (mode === 'hold' || mode === 'release')) {
    process.stdout.write(`${(mode === 'hold' ? hold : release)(target)}\n`);
    return 0;
  }
  let results;
  try {
    if (args.length === 1 && target === '--all') results = syncAll(home);
    else if (args.length === 2 && ['pull', 'push'].includes(mode) && !target.startsWith('--')) results = [syncVault(target, [mode], { home })];
    else throw new UsageError();
  } catch (e) {
    if (e instanceof UsageError || !hookMode) throw e;
    process.stdout.write(`${JSON.stringify({ systemMessage: `knowledge-vault sync: ${e.message}` })}\n`);
    return 0;
  }
  return report(results, hookMode);
}

if (isMain(import.meta.url)) runCli(USAGE, () => main(process.argv.slice(2)));
