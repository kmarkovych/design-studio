import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, git, run, commit, clone, readJson, linkedSetup } from './helpers.mjs';

const regOf = (vault) => readJson(join(vault, '.knowledge-vault.json'));
const entryOf = (vault) => regOf(vault).codeRepos.find((r) => r.id === 'app');

test('undescribed reports bootstrap needed and the head sha when there is no described commit', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  const r = run(sb, 'registry.mjs', ['undescribed', vault.a, 'app', '--json']);
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.bootstrapNeeded, true);
  assert.equal(out.head, code.shas[2]);
  const text = run(sb, 'registry.mjs', ['undescribed', vault.a, 'app']);
  assert.match(text.stdout, /bootstrap needed/);
  assert.match(text.stdout, new RegExp(code.shas[2]));
});

test('undescribed lists commits after the described commit, oldest first, with dates, subjects and files', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb, { describedCommit: null });
  assert.equal(run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[0]]).code, 0);
  const out = JSON.parse(run(sb, 'registry.mjs', ['undescribed', vault.a, 'app', '--json']).stdout);
  assert.equal(out.bootstrapNeeded, false);
  assert.equal(out.total, 2);
  assert.deepEqual(out.commits.map((c) => c.sha), [code.shas[1], code.shas[2]]);
  assert.deepEqual(out.commits.map((c) => c.subject), ['feat: second', 'fix: third']);
  assert.deepEqual(out.commits[0].files, ['src/b.js']);
  assert.ok(!Number.isNaN(Date.parse(out.commits[0].date)));
  const limited = JSON.parse(run(sb, 'registry.mjs', ['undescribed', vault.a, 'app', '--json', '--limit', '1']).stdout);
  assert.equal(limited.total, 2);
  assert.deepEqual(limited.commits.map((c) => c.sha), [code.shas[1]]);
  const text = run(sb, 'registry.mjs', ['undescribed', vault.a, 'app']).stdout;
  assert.match(text, /2 undescribed/);
  assert.match(text, /feat: second/);
});

test('undescribed fetches first, so commits pushed from elsewhere are seen; the code repository is not changed', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb, { describedCommit: null });
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[2]]);
  const other = clone(sb, code.remote, 'code/other');
  const sha = commit(sb, other, 'src/d.js', 'd\n', 'feat: fourth');
  git(sb, other, ['push', '-q']);
  const headBefore = git(sb, code.dir, ['rev-parse', 'HEAD']);
  const out = JSON.parse(run(sb, 'registry.mjs', ['undescribed', vault.a, 'app', '--json']).stdout);
  assert.deepEqual(out.commits.map((c) => c.sha), [sha]);
  assert.equal(git(sb, code.dir, ['rev-parse', 'HEAD']), headBefore);
});

test('describe moves the described commit forward and records when', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  const r = run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[1].slice(0, 10)]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(entryOf(vault.a).describedCommit, code.shas[1]);
  assert.ok(!Number.isNaN(Date.parse(entryOf(vault.a).describedAt)));
});

test('describe rejects a sha that is not on origin/main', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  git(sb, code.dir, ['switch', '-q', '-c', 'topic']);
  const sha = commit(sb, code.dir, 'src/x.js', 'x\n', 'wip');
  const r = run(sb, 'registry.mjs', ['describe', vault.a, 'app', sha]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /not on origin\/main/);
  assert.equal(entryOf(vault.a).describedCommit, null);
});

test('describe rejects a sha behind the described commit', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb, { describedCommit: null });
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[2]]);
  const r = run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[0]]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /behind/);
  assert.equal(entryOf(vault.a).describedCommit, code.shas[2]);
});

test('after a force-push, describe accepts a commit on main and says it resets the described commit', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[2]]);
  git(sb, code.dir, ['reset', '-q', '--hard', code.shas[1]]);
  const sha = commit(sb, code.dir, 'src/z.js', 'z\n', 'feat: rewritten');
  git(sb, code.dir, ['push', '-q', '-f']);
  const listed = run(sb, 'registry.mjs', ['undescribed', vault.a, 'app']);
  assert.equal(listed.code, 1);
  assert.match(listed.stderr, /rewritten/);
  const r = run(sb, 'registry.mjs', ['describe', vault.a, 'app', sha]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /reset/);
  assert.equal(entryOf(vault.a).describedCommit, sha);
});

test('undescribed shows a renamed file as old -> new', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[2]]);
  git(sb, code.dir, ['mv', 'src/c.js', 'src/payment.js']);
  git(sb, code.dir, ['commit', '-q', '-m', 'refactor: rename']);
  git(sb, code.dir, ['push', '-q']);
  const out = JSON.parse(run(sb, 'registry.mjs', ['undescribed', vault.a, 'app', '--json']).stdout);
  assert.deepEqual(out.commits[0].files, ['src/c.js -> src/payment.js']);
});

test('describe rejects an unknown repository id and an unknown sha', () => {
  const sb = sandbox();
  const { vault } = linkedSetup(sb);
  assert.match(run(sb, 'registry.mjs', ['describe', vault.a, 'nope', 'abc']).stderr, /no code repository "nope"/);
  assert.equal(run(sb, 'registry.mjs', ['describe', vault.a, 'app', 'deadbeef']).code, 1);
});

test('locate finds the link file and the vault from a subfolder of the code repository', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  mkdirSync(join(code.dir, 'src', 'deep'), { recursive: true });
  const r = run(sb, 'registry.mjs', ['locate'], { cwd: join(code.dir, 'src', 'deep') });
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.codeRepo, code.dir);
  assert.equal(out.vault, vault.a);
  assert.equal(out.link.repoId, 'app');
  assert.equal(out.sync, 'plugin');
});

test('locate without a link file explains what is missing', () => {
  const sb = sandbox();
  const { code } = linkedSetup(sb);
  rmSync(join(code.dir, '.knowledge-vault-link.json'));
  const r = run(sb, 'registry.mjs', ['locate'], { cwd: code.dir });
  assert.equal(r.code, 1);
  assert.match(JSON.parse(r.stdout).missing, /not linked/);
  const outside = run(sb, 'registry.mjs', ['locate'], { cwd: sb.home });
  assert.equal(outside.code, 1);
  assert.match(JSON.parse(outside.stdout).missing, /not inside a git repository/);
});

test('locate with a link file whose vault is not on this machine says so', () => {
  const sb = sandbox();
  const { code } = linkedSetup(sb);
  rmSync(join(sb.kv, 'config.json'));
  const r = run(sb, 'registry.mjs', ['locate'], { cwd: code.dir });
  assert.equal(r.code, 1);
  assert.match(JSON.parse(r.stdout).missing, /not set up on this machine/);
});

test('show prints the registry; wrong arguments exit 2', () => {
  const sb = sandbox();
  const { vault } = linkedSetup(sb);
  const r = run(sb, 'registry.mjs', ['show', vault.a]);
  assert.equal(r.code, 0);
  assert.equal(JSON.parse(r.stdout).product, 'Demo');
  for (const args of [[], ['show'], ['describe', vault.a, 'app'], ['undescribed', vault.a, 'app', '--limit', 'x'], ['bogus']]) {
    const bad = run(sb, 'registry.mjs', args);
    assert.equal(bad.code, 2, args.join(' '));
    assert.match(bad.stderr, /usage: registry\.mjs/);
  }
});
