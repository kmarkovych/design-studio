// Shared fixtures: an isolated HOME and knowledge-vault home, bare repositories standing in for remotes, clones for machines.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS = fileURLToPath(new URL('../skills/vault-setup/scripts/', import.meta.url));

export const tmp = () => realpathSync(mkdtempSync(join(tmpdir(), 'kv-test-')));

// Never touches the real ~/.knowledge-vault, ~/Library/LaunchAgents, ~/.gitconfig or desktop notifications.
export function sandbox() {
  const root = tmp();
  const home = join(root, 'home');
  const kv = join(home, '.knowledge-vault');
  mkdirSync(home, { recursive: true });
  const gitConfig = join(root, 'gitconfig');
  writeFileSync(gitConfig, '');
  const env = {
    ...process.env, HOME: home, USERPROFILE: home, KNOWLEDGE_VAULT_HOME: kv, KNOWLEDGE_VAULT_NOTIFY: 'off',
    GIT_CONFIG_GLOBAL: gitConfig, GIT_CONFIG_NOSYSTEM: '1', CLAUDE_CONFIG_DIR: join(home, '.claude'),
  };
  delete env.KNOWLEDGE_VAULT_TEMPLATES;
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return { root, home, kv, env };
}

export function git(sb, cwd, args) {
  const r = spawnSync('git', args, { cwd, env: sb.env, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}

export function run(sb, script, args = [], { cwd = sb.root, input = '', env = {} } = {}) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { cwd, input, env: { ...sb.env, ...env }, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

export function bare(sb, name) {
  const dir = join(sb.root, 'remotes', `${name}.git`);
  mkdirSync(dir, { recursive: true });
  git(sb, dir, ['init', '-q', '--bare', '-b', 'main']);
  return dir;
}

export function clone(sb, remote, dest) {
  const dir = join(sb.root, dest);
  git(sb, sb.root, ['clone', '-q', remote, dir]);
  git(sb, dir, ['config', 'user.name', 'Tester']);
  git(sb, dir, ['config', 'user.email', 'tester@example.com']);
  return dir;
}

export function write(dir, rel, content) {
  const file = join(dir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

export function commit(sb, repo, rel, content, message = `edit ${rel}`) {
  write(repo, rel, content);
  git(sb, repo, ['add', '-A']);
  git(sb, repo, ['commit', '-q', '-m', message]);
  return git(sb, repo, ['rev-parse', 'HEAD']);
}

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  return file;
}

export function registry(product = 'Demo', language = 'uk', codeRepos = []) {
  return {
    version: 1, product, language,
    sections: { architecture: '10-Продукт/Архітектура', features: '10-Продукт/Фічі', featureIndex: '10-Продукт/Функціональність.md',
      decisions: '10-Продукт/Рішення', glossary: '10-Продукт/Глосарій.md', changeLog: '10-Продукт/Журнал-змін' },
    codeRepos,
  };
}

// A vault repository with an initial commit, cloned on two machines A and B; A is registered in config.json.
export function vaultPair(sb, { language = 'uk', sync = 'plugin' } = {}) {
  const remote = bare(sb, 'vault');
  const a = clone(sb, remote, 'machine-a/vault');
  writeJson(join(a, '.knowledge-vault.json'), registry('Demo', language));
  commit(sb, a, 'note.md', '# Note\n\nline one\nline two\n', 'initial');
  git(sb, a, ['push', '-q', '-u', 'origin', 'main']);
  const b = clone(sb, remote, 'machine-b/vault');
  addConfigVault(sb, { remote, path: a, sync });
  return { remote, a, b };
}

export function addConfigVault(sb, vault) {
  const file = join(sb.kv, 'config.json');
  const config = existsSync(file) ? readJson(file) : { version: 1, vaults: [], codeRepos: [] };
  writeJson(file, { ...config, vaults: [...config.vaults, vault] });
}

export function addConfigCodeRepo(sb, codeRepo) {
  const file = join(sb.kv, 'config.json');
  const config = existsSync(file) ? readJson(file) : { version: 1, vaults: [], codeRepos: [] };
  writeJson(file, { ...config, codeRepos: [...config.codeRepos, codeRepo] });
}

// A code repository with its own bare origin and three commits on main; returns the clone and the shas oldest first.
export function codeRepo(sb, name = 'app') {
  const remote = bare(sb, name);
  const dir = clone(sb, remote, `code/${name}`);
  const shas = [
    commit(sb, dir, 'src/a.js', 'a\n', 'feat: first'),
    commit(sb, dir, 'src/b.js', 'b\n', 'feat: second'),
    commit(sb, dir, 'src/c.js', 'c\n', 'fix: third'),
  ];
  git(sb, dir, ['push', '-q', '-u', 'origin', 'main']);
  return { remote, dir, shas };
}

// A vault on machine A linked to a code repository by hand-written registry, config and link file.
export function linkedSetup(sb, { describedCommit = null } = {}) {
  const vault = vaultPair(sb);
  const code = codeRepo(sb);
  const reg = readJson(join(vault.a, '.knowledge-vault.json'));
  const entry = { id: 'app', remote: code.remote, mainBranch: 'main', describedCommit, describedAt: describedCommit ? '2026-01-01T00:00:00.000Z' : null };
  writeJson(join(vault.a, '.knowledge-vault.json'), { ...reg, codeRepos: [entry] });
  git(sb, vault.a, ['commit', '-q', '-am', 'link app']);
  git(sb, vault.a, ['push', '-q']);
  writeJson(join(code.dir, '.knowledge-vault-link.json'), { version: 1, product: 'Demo', vaultRemote: vault.remote, repoId: 'app' });
  addConfigCodeRepo(sb, { remote: code.remote, path: code.dir });
  return { vault, code };
}

// Polls a condition without timers that keep the test alive: true as soon as it holds, false after ms.
export function waitFor(check, ms = 15000) {
  const end = Date.now() + ms;
  const cell = new Int32Array(new SharedArrayBuffer(4));
  while (Date.now() < end) {
    if (check()) return true;
    Atomics.wait(cell, 0, 0, 100);
  }
  return check();
}
