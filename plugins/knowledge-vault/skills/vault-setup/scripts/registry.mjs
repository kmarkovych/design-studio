#!/usr/bin/env node
// The vault registry: which code repositories a vault describes and up to which commit (the described commit).
// It only fetches in a code repository; it never pulls, checks out, commits, pushes or stashes there.
import { existsSync } from 'node:fs';
import {
  UsageError, findRepoEntry, git, gitOk, isAncestor, isMain, kvHome, loadConfig, loadRegistry,
  locate, parseArgs, realPath, revParse, runCli, sameRemote, saveRegistry,
} from './lib.mjs';

const USAGE = 'registry.mjs show <vault> | undescribed <vault> <repoId> [--limit N] [--json] | describe <vault> <repoId> <sha> | locate';
const FETCH_TIMEOUT_MS = 60000;

// The local clone of a code repository, found through config.json by its remote.
export function codeRepoPath(remote, home = kvHome()) {
  const found = loadConfig(home).codeRepos.find((c) => sameRemote(c.remote, remote));
  if (!found || !existsSync(found.path)) {
    throw new Error(`the code repository ${remote} is not linked on this machine; run setup.mjs link <vault> <code-repo-path> --id <id>`);
  }
  return found.path;
}

function fetchOrWarn(codeRepo, mainBranch, timeoutMs) {
  const r = git(codeRepo, ['fetch', '-q', 'origin'], { timeoutMs });
  if (r.code === 0) return null;
  const why = r.timedOut ? 'git fetch timed out' : `git fetch failed (${r.stderr.trim().split('\n').pop()})`;
  return `could not fetch ${codeRepo}: ${why}; counted against the existing origin/${mainBranch}, which may be out of date`;
}

// A rename or copy reads "old -> new", so a note citing the old path can still be found.
const changedFile = (line) => {
  const [status, a, b] = line.split('\t');
  if (a === undefined) return status;
  return /^[RC]/.test(status) && b !== undefined ? `${a} -> ${b}` : a;
};

function logCommits(codeRepo, from, to) {
  const out = gitOk(codeRepo, ['log', '--reverse', '-M', '--format=%x1e%H%x1f%cI%x1f%s', '--name-status', `${from}..${to}`]);
  return out.split('\x1e').filter((s) => s.trim()).map((chunk) => {
    const [line, ...files] = chunk.split('\n');
    const [sha, date, subject] = line.split('\x1f');
    return { sha, date, subject, files: files.filter(Boolean).map(changedFile) };
  });
}

function mainHead(codeRepo, mainBranch) {
  const head = revParse(codeRepo, `refs/remotes/origin/${mainBranch}^{commit}`);
  if (!head) throw new Error(`origin/${mainBranch} does not exist in ${codeRepo}; run git fetch there, or relink with the right --branch`);
  return head;
}

// The functionality changes after the described commit, oldest first; with no described commit, a bootstrap pass is needed.
export function undescribed(vault, repoId, { home = kvHome(), limit, fetch = true, fetchTimeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const reg = loadRegistry(vault);
  const entry = findRepoEntry(reg, repoId);
  const codeRepo = codeRepoPath(entry.remote, home);
  const fetchWarning = fetch ? fetchOrWarn(codeRepo, entry.mainBranch, fetchTimeoutMs) : null;
  const head = mainHead(codeRepo, entry.mainBranch);
  const base = { product: reg.product, repoId, codeRepo, mainBranch: entry.mainBranch, describedCommit: entry.describedCommit, head, fetchWarning };
  if (!entry.describedCommit) return { ...base, bootstrapNeeded: true, total: null, commits: [] };
  if (!revParse(codeRepo, `${entry.describedCommit}^{commit}`) || !isAncestor(codeRepo, entry.describedCommit, head)) {
    throw new Error(`the described commit ${entry.describedCommit} is not on origin/${entry.mainBranch} of ${codeRepo} (was its history rewritten?); `
      + `compare the vault with the code by hand, then run registry.mjs describe "${vault}" ${repoId} <sha> with the commit on origin/${entry.mainBranch} it now matches; `
      + 'describe accepts it and resets the described commit');
  }
  const commits = logCommits(codeRepo, entry.describedCommit, head);
  return { ...base, bootstrapNeeded: false, total: commits.length, commits: limit ? commits.slice(0, limit) : commits };
}

// Moves the described commit forward to sha, which must be on origin/<main> and not behind the current one.
// After a history rewrite (the current described commit is no longer on origin/<main>) any commit on it resets the described commit.
export function describe(vault, repoId, sha, { home = kvHome() } = {}) {
  const reg = loadRegistry(vault);
  const entry = findRepoEntry(reg, repoId);
  const codeRepo = codeRepoPath(entry.remote, home);
  const full = revParse(codeRepo, `${sha}^{commit}`);
  if (!full) throw new Error(`${sha} is not a commit in ${codeRepo}; run registry.mjs undescribed first, which fetches`);
  const head = mainHead(codeRepo, entry.mainBranch);
  if (!isAncestor(codeRepo, full, head)) throw new Error(`${sha} is not on origin/${entry.mainBranch}; only commits that reached the main branch can be described`);
  const old = entry.describedCommit;
  const rewritten = Boolean(old) && !(revParse(codeRepo, `${old}^{commit}`) && isAncestor(codeRepo, old, head));
  if (old && !rewritten && !isAncestor(codeRepo, old, full)) {
    throw new Error(`${sha} is behind the described commit ${old.slice(0, 12)}; the described commit only moves forward`);
  }
  const updated = { ...entry, describedCommit: full, describedAt: new Date().toISOString() };
  saveRegistry(vault, { ...reg, codeRepos: reg.codeRepos.map((r) => (r.id === repoId ? updated : r)) });
  return { ...updated, resetFrom: rewritten ? old : null };
}

function printUndescribed(out) {
  const lines = [];
  if (out.fetchWarning) lines.push(`warning: ${out.fetchWarning}`);
  if (out.bootstrapNeeded) {
    lines.push(`bootstrap needed: ${out.repoId} has no described commit; origin/${out.mainBranch} is at ${out.head}`);
  } else {
    lines.push(`${out.repoId}: ${out.total} undescribed commit(s) on origin/${out.mainBranch} after ${out.describedCommit.slice(0, 12)} (head ${out.head.slice(0, 12)})`);
    for (const c of out.commits) lines.push(`${c.sha} ${c.date} ${c.subject}`, ...c.files.map((f) => `    ${f}`));
    if (out.commits.length < out.total) lines.push(`... ${out.total - out.commits.length} more`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

function main(argv) {
  const { positional: [cmd, ...rest], flags } = parseArgs(argv, { booleans: ['json'], values: ['limit'] });
  if (cmd === 'show' && rest.length === 1) {
    process.stdout.write(`${JSON.stringify(loadRegistry(realPath(rest[0])), null, 2)}\n`);
    return 0;
  }
  if (cmd === 'undescribed' && rest.length === 2) {
    const limit = flags.limit === undefined ? undefined : Number(flags.limit);
    if (limit !== undefined && !(Number.isInteger(limit) && limit > 0)) throw new UsageError('--limit must be a positive whole number');
    const out = undescribed(realPath(rest[0]), rest[1], { limit });
    if (flags.json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`); else printUndescribed(out);
    return 0;
  }
  if (cmd === 'describe' && rest.length === 3) {
    const e = describe(realPath(rest[0]), rest[1], rest[2]);
    const reset = e.resetFrom ? ` (reset: the previous described commit ${e.resetFrom.slice(0, 12)} is no longer on origin/${e.mainBranch}, so its history was rewritten)` : '';
    process.stdout.write(`described commit of ${e.id} is now ${e.describedCommit}${reset}\n`);
    return 0;
  }
  if (cmd === 'locate' && rest.length === 0) {
    const found = locate(realPath(process.cwd()));
    process.stdout.write(`${JSON.stringify(found, null, 2)}\n`);
    return found.ok ? 0 : 1;
  }
  throw new UsageError();
}

if (isMain(import.meta.url)) runCli(USAGE, () => main(process.argv.slice(2)));
