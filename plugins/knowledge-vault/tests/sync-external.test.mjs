import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, git, run, write, commit, readJson, vaultPair } from './helpers.mjs';

const problems = (sb) => (existsSync(join(sb.kv, 'status.json')) ? readJson(join(sb.kv, 'status.json')).problems : []);

// An external vault has its own sync: sync.mjs acts only on the path given and never commits files the pass did not commit.
test('external vault: push sends the pass\'s own commit and never commits the owner\'s uncommitted edits', () => {
  const sb = sandbox();
  const v = vaultPair(sb, { sync: 'external' });
  write(v.a, 'note.md', '# Note\n\nowner edit in progress\n');
  write(v.a, 'owner-draft.md', '# Draft\n');
  write(v.a, '10-Продукт/Журнал-змін/entry.md', '# Entry\n');
  git(sb, v.a, ['add', '--', '10-Продукт/Журнал-змін/entry.md']);
  git(sb, v.a, ['commit', '-q', '-m', 'docs(vault): app 1111111..2222222', '-m', 'Vault-Agent: knowledge-vault']);
  const r = run(sb, 'sync.mjs', [v.a, 'push']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /pushed 1 commit/);
  assert.equal(git(sb, v.remote, ['log', '-1', '--format=%s', 'main']), 'docs(vault): app 1111111..2222222');
  const status = git(sb, v.a, ['status', '--porcelain']);
  assert.match(status, /M note\.md/);
  assert.match(status, /\?\? owner-draft\.md/);
});

test('external vault: pull skips with a reason while the owner has uncommitted edits, and rebases once the tree is clean', () => {
  const sb = sandbox();
  const v = vaultPair(sb, { sync: 'external' });
  commit(sb, v.b, 'from-b.md', '# B\n', 'B adds');
  git(sb, v.b, ['push', '-q']);
  write(v.a, 'note.md', 'owner edit\n');
  const skipped = run(sb, 'sync.mjs', [v.a, 'pull']);
  assert.equal(skipped.code, 0, skipped.stderr + skipped.stdout);
  assert.match(skipped.stdout, /uncommitted/);
  assert.ok(!existsSync(join(v.a, 'from-b.md')));
  assert.equal(readFileSync(join(v.a, 'note.md'), 'utf8'), 'owner edit\n');
  assert.equal(git(sb, v.a, ['rev-list', '--count', 'HEAD']), '1', 'nothing was committed');
  assert.deepEqual(problems(sb), []);
  git(sb, v.a, ['checkout', '--', 'note.md']);
  const pulled = run(sb, 'sync.mjs', [v.a, 'pull']);
  assert.equal(pulled.code, 0, pulled.stderr + pulled.stdout);
  assert.match(pulled.stdout, /received 1 commit/);
  assert.ok(existsSync(join(v.a, 'from-b.md')));
});

test('pull and push always say what happened, also when there was nothing to do', () => {
  const sb = sandbox();
  const v = vaultPair(sb);
  const pulled = run(sb, 'sync.mjs', [v.a, 'pull']);
  assert.equal(pulled.code, 0, pulled.stderr);
  assert.match(pulled.stdout, /already up to date/);
  assert.match(run(sb, 'sync.mjs', [v.a, 'push']).stdout, /already up to date/);
});
