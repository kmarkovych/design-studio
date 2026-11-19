import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { sandbox, git, run, write, commit, readJson, writeJson, vaultPair, addConfigVault, bare, clone, registry } from './helpers.mjs';

const host = hostname().split('.')[0];
const remoteHead = (sb, remote) => git(sb, remote, ['rev-parse', 'main']);
const problems = (sb) => (existsSync(join(sb.kv, 'status.json')) ? readJson(join(sb.kv, 'status.json')).problems : []);
const lockOf = (vault) => join(vault, '.git', 'knowledge-vault-sync.lock');

function conflictOnNote(sb, v) {
  commit(sb, v.b, 'note.md', '# Note\n\nline one from B\nline two\n', 'B edits');
  git(sb, v.b, ['push', '-q']);
  write(v.a, 'note.md', '# Note\n\nline one from A\nline two\n');
}

test('push commits local changes with the Ukrainian message and reaches the vault repository', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  write(v.a, 'new.md', '# New\n');
  write(v.a, 'note.md', '# Note\n\nline one\nline two\nline three\n');
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(git(sb, v.a, ['log', '-1', '--format=%s']), `vault: автосинхронізація (${host}, 2 файл.)`);
  assert.equal(remoteHead(sb, v.remote), git(sb, v.a, ['rev-parse', 'HEAD']));
  assert.equal(git(sb, v.a, ['status', '--porcelain']), '');
});

test('an English vault uses the English sync message', () => {
  const sb = sandbox();
  const v = vaultPair(sb, { language: 'en' });
  write(v.a, 'new.md', '# New\n');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 0);
  assert.equal(git(sb, v.a, ['log', '-1', '--format=%s']), `vault: sync (${host}, 1 files)`);
});

test('pull brings in the other machine\'s commits', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  commit(sb, v.b, 'from-b.md', '# B\n', 'B adds');
  git(sb, v.b, ['push', '-q']);
  const r = run(sb, 'sync.mjs', [v.a, 'pull']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.ok(existsSync(join(v.a, 'from-b.md')));
  assert.match(r.stdout, /received 1 commit/);
});

test('a conflict in an owner note aborts the rebase, pushes nothing and records a problem', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  conflictOnNote(sb, v);
  const before = remoteHead(sb, v.remote);
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 3, r.stderr + r.stdout);
  assert.equal(remoteHead(sb, v.remote), before);
  assert.ok(!existsSync(join(v.a, '.git', 'rebase-merge')) && !existsSync(join(v.a, '.git', 'rebase-apply')));
  assert.equal(git(sb, v.a, ['status', '--porcelain']), '');
  const [p] = problems(sb);
  assert.equal(p.kind, 'conflict');
  assert.equal(p.vault, v.a);
  assert.match(p.detail, /note\.md/);
  assert.match(p.detail, /pull --rebase origin main/);
  assert.ok(!Number.isNaN(Date.parse(p.when)));
  assert.ok(!existsSync(lockOf(v.a)));
});

test('with --hook a conflict exits 0 and prints one systemMessage', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  conflictOnNote(sb, v);
  const r = run(sb, 'sync.mjs', [v.a, 'push', '--hook']);
  assert.equal(r.code, 0);
  const out = JSON.parse(r.stdout);
  assert.match(out.systemMessage, /conflict/);
  assert.equal(problems(sb)[0].kind, 'conflict');
});

test('a clean sync clears that vault\'s problems and keeps other vaults\' problems', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  conflictOnNote(sb, v);
  const other = { vault: '/elsewhere/vault', when: new Date().toISOString(), kind: 'error', detail: 'x' };
  writeJson(join(sb.kv, 'status.json'), { problems: [other] });
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 3);
  assert.equal(problems(sb).length, 2);
  git(sb, v.a, ['reset', '-q', '--hard', 'origin/main']); // the owner resolves it by hand
  const r = run(sb, 'sync.mjs', [v.a, 'pull']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(problems(sb), [other]);
});

test('a second concurrent run skips while the lock is fresh', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  mkdirSync(lockOf(v.a));
  write(v.a, 'new.md', '# New\n');
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /skipped/);
  assert.match(git(sb, v.a, ['status', '--porcelain']), /new\.md/);
  assert.ok(existsSync(lockOf(v.a)));
});

test('a lock older than 10 minutes is removed and recorded as stale-lock; the next run syncs and clears it', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  mkdirSync(lockOf(v.a));
  const old = new Date(Date.now() - 11 * 60 * 1000);
  utimesSync(lockOf(v.a), old, old);
  write(v.a, 'new.md', '# New\n');
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 3, r.stderr + r.stdout);
  assert.ok(!existsSync(lockOf(v.a)));
  assert.equal(problems(sb)[0].kind, 'stale-lock');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 0);
  assert.deepEqual(problems(sb), []);
  assert.equal(git(sb, v.remote, ['show', 'main:new.md']), '# New');
});

test('files that look like secrets are refused: nothing is committed or pushed, and the problem is recorded', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  const before = remoteHead(sb, v.remote);
  // Built at run time so the test source itself never holds a token-shaped string.
  write(v.a, 'key.md', `-----BEGIN OPENSSH ${'PRIVATE'} KEY-----\nabc\n`);
  write(v.a, 'gitlab.md', `token: ${'glpat-'}${'x'.repeat(20)}\n`);
  write(v.a, 'aws.md', `id ${'AKIA'}${'ABCDEFGHIJKLMNOP'}\n`);
  write(v.a, 'github.md', `gh ${'ghp_'}${'a'.repeat(36)}\n`);
  write(v.a, '.env', 'DB_PASSWORD=hunter2\n');
  write(v.a, 'fine.md', '# Fine\n');
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 3, r.stderr + r.stdout);
  assert.equal(remoteHead(sb, v.remote), before, 'nothing was pushed');
  assert.equal(git(sb, v.a, ['rev-parse', 'HEAD']), before, 'nothing was committed');
  assert.equal(git(sb, v.a, ['diff', '--cached', '--name-only']), '', 'the index was reset');
  const [p] = problems(sb);
  assert.equal(p.kind, 'secret-refused');
  for (const f of ['key.md', 'gitlab.md', 'aws.md', 'github.md', '.env']) assert.match(p.detail, new RegExp(f.replace('.', '\\.')));
  assert.doesNotMatch(p.detail, /fine\.md|hunter2/);
});

test('each secret pattern K6 names is refused, one file each; ordinary prose is not', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  const secrets = {
    'conn.md': `db ${'postgres'}://admin:S3cr3tP4ss@db.prod.example.com:5432/app\n`,
    'redis.md': `${'redis'}://:pa55word9@cache.internal:6379\n`,
    'password.md': `${'password'}: hunter2-prod\n`,
    'anthropic.md': `${'sk-ant-'}api03-${'Ab1'.repeat(10)}\n`,
    'openai.md': `${'sk-proj-'}${'Xy9'.repeat(10)}\n`,
    'stripe.md': `${'sk_live_'}51H${'a'.repeat(20)}\n`,
    'slack.md': `${'xoxb-'}1234567890-${'b'.repeat(16)}\n`,
    'google.md': `${'AIza'}${'S'.repeat(35)}\n`,
    '60-Дані/secrets.env': 'X=1\n',
  };
  for (const [file, text] of Object.entries(secrets)) write(v.a, file, text);
  write(v.a, 'prose.md', 'task-management-dashboard-overview-2026\ntoken: обовʼязковий параметр\nhttps://user@git.example.org:2222/team/repo.git\n');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 3);
  const [p] = problems(sb);
  assert.equal(p.kind, 'secret-refused');
  for (const file of Object.keys(secrets)) assert.ok(p.detail.includes(file), `${file} was not refused: ${p.detail}`);
  assert.ok(!p.detail.includes('prose.md'), p.detail);
});

test('a refused secret in a tracked note while the vault repository moved records one problem and pulls nothing', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  commit(sb, v.b, 'b-news.md', '# B\n', 'B adds');
  git(sb, v.b, ['push', '-q']);
  write(v.a, 'note.md', `aws ${'AKIA'}${'ABCDEFGHIJKLMNOP'}\n`);
  write(v.a, 'a-note.md', '# A\n');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 3);
  assert.deepEqual(problems(sb).map((p) => p.kind), ['secret-refused']);
  assert.ok(!existsSync(join(v.a, 'b-news.md')));
  assert.throws(() => git(sb, v.remote, ['show', 'main:a-note.md']));
});

test('an unpushed commit that adds a secret is not pushed', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  const before = remoteHead(sb, v.remote);
  commit(sb, v.a, '10-Продукт/Фічі/Кошик.md', `---\nagent: knowledge-vault\n---\nkey ${'AKIA'}${'ABCDEFGHIJKLMNOP'}\n`, 'docs(vault): app 1..2');
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 3, r.stderr + r.stdout);
  assert.equal(remoteHead(sb, v.remote), before);
  const [p] = problems(sb);
  assert.equal(p.kind, 'secret-refused');
  assert.match(p.detail, /Кошик\.md/);
  assert.match(p.detail, /nothing was pushed/);
});

test('files left in conflict (a stash pop) are never committed or pushed', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  write(v.a, 'note.md', '# Note\n\nline one stashed\nline two\n');
  git(sb, v.a, ['stash', '-q']);
  commit(sb, v.a, 'note.md', '# Note\n\nline one committed\nline two\n', 'owner edit');
  spawnSync('git', ['stash', 'pop', '-q'], { cwd: v.a, env: sb.env });
  assert.match(git(sb, v.a, ['status', '--porcelain']), /^UU note\.md/);
  const before = remoteHead(sb, v.remote);
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 3, r.stderr + r.stdout);
  assert.equal(remoteHead(sb, v.remote), before);
  assert.match(git(sb, v.a, ['status', '--porcelain']), /^UU note\.md/);
  const [p] = problems(sb);
  assert.equal(p.kind, 'conflict');
  assert.match(p.detail, /note\.md/);
});

test('an unfinished cherry-pick stops the sync before anything is committed', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  writeFileSync(join(v.a, '.git', 'CHERRY_PICK_HEAD'), `${git(sb, v.a, ['rev-parse', 'HEAD'])}\n`);
  write(v.a, 'new.md', '# New\n');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 3);
  assert.equal(problems(sb)[0].kind, 'error');
  assert.match(git(sb, v.a, ['status', '--porcelain']), /\?\? new\.md/);
});

test('on a detached HEAD nothing is committed', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  const head = git(sb, v.a, ['rev-parse', 'HEAD']);
  git(sb, v.a, ['switch', '-q', '--detach']);
  write(v.a, 'new.md', '# New\n');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 3);
  assert.equal(git(sb, v.a, ['rev-parse', 'HEAD']), head);
  assert.match(problems(sb)[0].detail, /detached HEAD/);
});

test('a vault on a branch other than its main branch is not synced', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  git(sb, v.a, ['switch', '-q', '-c', 'drafts']);
  write(v.a, 'draft.md', '# Draft\n');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 3);
  assert.equal(git(sb, v.remote, ['branch', '--list']).trim(), '* main');
  assert.match(problems(sb)[0].detail, /drafts.*main/);
});

test('a vault repository that is gone is an error problem, not offline', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  git(sb, v.a, ['remote', 'set-url', 'origin', join(sb.root, 'remotes', 'renamed-or-deleted.git')]);
  const r = run(sb, 'sync.mjs', ['--all']);
  assert.equal(r.code, 3, r.stderr + r.stdout);
  const [p] = problems(sb);
  assert.equal(p.kind, 'error');
  assert.match(p.detail, /does not appear to be a git repository/);
});

test('an unreachable host is offline: exit 0 and no problem', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  git(sb, v.a, ['remote', 'set-url', 'origin', 'ssh://git@127.0.0.1:1/none.git']);
  const r = run(sb, 'sync.mjs', [v.a, 'pull']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /could not reach/);
  assert.deepEqual(problems(sb), []);
});

test('a registry that is not valid JSON is not committed', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  const before = remoteHead(sb, v.remote);
  write(v.a, '.knowledge-vault.json', '{bad');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 3);
  assert.equal(remoteHead(sb, v.remote), before);
  assert.match(problems(sb)[0].detail, /knowledge-vault\.json/);
});

test('a corrupt status.json is set aside, and the sync still works', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  writeJson(join(sb.kv, 'status.json'), '[[');
  write(v.a, 'new.md', '# New\n');
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.match(r.stderr, /status\.json/);
  assert.deepEqual(problems(sb), []);
  assert.ok(readdirSync(sb.kv).some((f) => f.startsWith('status.json.corrupt-')));
});

test('a documentation pass holds the lock: syncs skip until it releases', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  assert.equal(run(sb, 'sync.mjs', [v.a, 'hold']).code, 0);
  write(v.a, '10-Продукт/Фічі/Агентна.md', '---\nagent: knowledge-vault\n---\nhalf\n');
  const r = run(sb, 'sync.mjs', ['--all', '--hook']);
  assert.equal(r.code, 0);
  assert.notEqual(git(sb, v.a, ['status', '--porcelain']), '', 'the half-written note was not committed');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'hold']).code, 0, 'holding again refreshes');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'release']).code, 0);
  assert.ok(!existsSync(lockOf(v.a)));
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 0);
});

test('hold refuses while a vault sync holds the lock, and release leaves that lock alone', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  mkdirSync(lockOf(v.a));
  assert.equal(run(sb, 'sync.mjs', [v.a, 'hold']).code, 1);
  assert.equal(run(sb, 'sync.mjs', [v.a, 'release']).code, 0);
  assert.ok(existsSync(lockOf(v.a)));
});

test('removing a secret line from a tracked note is not refused', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  commit(sb, v.a, 'old.md', `${'AKIA'}${'ABCDEFGHIJKLMNOP'}\n`, 'old mistake');
  git(sb, v.a, ['push', '-q']); // already in the vault repository; only its removal is new
  write(v.a, 'old.md', 'cleaned\n');
  assert.equal(run(sb, 'sync.mjs', [v.a, 'push']).code, 0);
});

test('--all syncs vaults with sync "plugin" and skips "external" ones', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  const extRemote = bare(sb, 'ext');
  const ext = clone(sb, extRemote, 'machine-a/ext');
  writeJson(join(ext, '.knowledge-vault.json'), registry('Ext'));
  commit(sb, ext, 'x.md', 'x\n', 'initial');
  git(sb, ext, ['push', '-q', '-u', 'origin', 'main']);
  addConfigVault(sb, { remote: extRemote, path: ext, sync: 'external' });
  write(v.a, 'new.md', '# New\n');
  write(ext, 'untouched.md', '# Mine\n');
  commit(sb, v.b, 'from-b.md', '# B\n', 'B adds');
  git(sb, v.b, ['push', '-q']);
  const r = run(sb, 'sync.mjs', ['--all']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(git(sb, v.remote, ['show', 'main:new.md']), '# New');
  assert.ok(existsSync(join(v.a, 'from-b.md')));
  assert.match(git(sb, ext, ['status', '--porcelain']), /untouched\.md/);
});

test('--all records a missing vault as an error problem and exits 3', () => {
  const sb = sandbox();
  addConfigVault(sb, { remote: 'git@example.com:x/gone.git', path: join(sb.root, 'gone'), sync: 'plugin' });
  const r = run(sb, 'sync.mjs', ['--all']);
  assert.equal(r.code, 3);
  assert.equal(problems(sb)[0].kind, 'error');
  assert.equal(run(sb, 'sync.mjs', ['--all', '--hook']).code, 0);
});

test('wrong arguments print a usage line and exit 2', () => {
  const sb = sandbox();
  for (const args of [[], ['/x'], ['/x', 'sideways'], ['--all', 'extra'], ['--all', 'hold']]) {
    const r = run(sb, 'sync.mjs', args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.stderr, /usage: sync\.mjs/);
  }
});

test('a path that is not a git repository is an operational error (exit 1)', () => {
  const sb = sandbox();
  const r = run(sb, 'sync.mjs', [sb.root, 'pull']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /not a git repository/);
});
