import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, git, run, write, commit, writeJson, linkedSetup, waitFor, SCRIPTS } from './helpers.mjs';

const hook = (sb, event, input) => run(sb, 'hook.mjs', [event], { input: JSON.stringify(input) });

test('session-start pulls the linked vault, lists problems first, then tells the agent to run vault-document', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb, { describedCommit: null });
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[0]]);
  git(sb, vault.a, ['commit', '-q', '-am', 'describe']);
  git(sb, vault.a, ['push', '-q']);
  git(sb, vault.b, ['pull', '-q']);
  commit(sb, vault.b, 'from-b.md', '# B\n', 'B adds');
  git(sb, vault.b, ['push', '-q']);
  writeJson(join(sb.kv, 'status.json'), { problems: [{ vault: '/other/vault', when: '2026-11-01T10:00:00.000Z', kind: 'conflict', detail: 'both changed Owner.md' }] });
  const r = hook(sb, 'session-start', { cwd: code.dir, session_id: 's1', hook_event_name: 'SessionStart' });
  assert.equal(r.code, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.ok(ctx.indexOf('Owner.md') >= 0 && ctx.indexOf('Owner.md') < ctx.indexOf('vault-document'), ctx);
  assert.match(ctx, /2 functionality changes/);
  assert.match(ctx, /background sub-agent/);
  assert.match(out.systemMessage, /conflict/);
  assert.ok(existsSync(join(vault.a, 'from-b.md')), 'vault was pulled');
});

test('session-start asks for the bootstrap pass when there is no described commit', () => {
  const sb = sandbox();
  const { code } = linkedSetup(sb);
  const out = JSON.parse(hook(sb, 'session-start', { cwd: code.dir, session_id: 's1' }).stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /bootstrap pass/);
  assert.equal(out.systemMessage, undefined);
});

test('a baseline set with describe on a null described commit ends the bootstrap requests', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  assert.equal(run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[2]]).code, 0);
  assert.equal(hook(sb, 'session-start', { cwd: code.dir, session_id: 's1' }).stdout, '');
  assert.equal(hook(sb, 'stop', { cwd: code.dir, session_id: 's1' }).stdout, '');
  const sb2 = sandbox();
  const two = linkedSetup(sb2);
  assert.equal(run(sb2, 'registry.mjs', ['describe', two.vault.a, 'app', two.code.shas[0]]).code, 0);
  const ctx = JSON.parse(hook(sb2, 'session-start', { cwd: two.code.dir, session_id: 's1' }).stdout).hookSpecificOutput.additionalContext;
  assert.match(ctx, /2 functionality changes/);
  assert.doesNotMatch(ctx, /bootstrap/);
});

test('session-start counts against the existing origin ref when fetch fails, and says so', () => {
  const sb = sandbox();
  const { code } = linkedSetup(sb);
  git(sb, code.dir, ['remote', 'set-url', 'origin', join(sb.root, 'nowhere.git')]);
  const r = hook(sb, 'session-start', { cwd: code.dir, session_id: 's1' });
  assert.equal(r.code, 0);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /could not fetch/);
});

test('session-start outside a linked code repository prints nothing', () => {
  const sb = sandbox();
  const r = hook(sb, 'session-start', { cwd: sb.home, session_id: 's1' });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
});

test('stop blocks once per session per head, and is silent afterwards', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb, { describedCommit: null });
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[0]]);
  const first = hook(sb, 'stop', { cwd: code.dir, session_id: 's1' });
  assert.equal(first.code, 0);
  const out = JSON.parse(first.stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /vault-document/);
  assert.equal(hook(sb, 'stop', { cwd: code.dir, session_id: 's1', stop_hook_active: true }).stdout, '');
  assert.equal(hook(sb, 'stop', { cwd: code.dir, session_id: 's1' }).stdout, '');
  assert.equal(JSON.parse(hook(sb, 'stop', { cwd: code.dir, session_id: 's2' }).stdout).decision, 'block');
  commit(sb, code.dir, 'src/e.js', 'e\n', 'feat: new head');
  git(sb, code.dir, ['push', '-q']);
  assert.equal(JSON.parse(hook(sb, 'stop', { cwd: code.dir, session_id: 's1' }).stdout).decision, 'block');
});

test('stop is silent when the described commit is the head and outside linked repositories', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[2]]);
  assert.equal(hook(sb, 'stop', { cwd: code.dir, session_id: 's1' }).stdout, '');
  const outside = hook(sb, 'stop', { cwd: sb.home, session_id: 's1' });
  assert.equal(outside.code, 0);
  assert.equal(outside.stdout, '');
});

test('session-end returns at once and pushes the linked vault in the background', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  write(vault.a, 'session-note.md', '# Written in session\n');
  const started = Date.now();
  const r = hook(sb, 'session-end', { cwd: code.dir, session_id: 's1' });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, '');
  assert.ok(Date.now() - started < 1500, 'the hook does no network work itself');
  const pushed = () => { try { return git(sb, vault.remote, ['show', 'main:session-note.md']) === '# Written in session'; } catch { return false; } };
  assert.ok(waitFor(pushed), 'the background sync pushed the note');
});

test('stop stays silent when nothing reached main during the session, and blocks once when something did', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[0]]);
  hook(sb, 'session-start', { cwd: code.dir, session_id: 's9', source: 'startup' });
  assert.equal(hook(sb, 'stop', { cwd: code.dir, session_id: 's9' }).stdout, '', 'the session-start hint covers the existing commits');
  commit(sb, code.dir, 'src/e.js', 'e\n', 'feat: in session');
  git(sb, code.dir, ['push', '-q']);
  const out = JSON.parse(hook(sb, 'stop', { cwd: code.dir, session_id: 's9' }).stdout);
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /already running/);
});

test('stop stays silent while a background sub-agent is running', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[0]]);
  const tasks = [{ id: 't1', type: 'subagent', status: 'running', description: 'Run the vault-document skill' }];
  assert.equal(hook(sb, 'stop', { cwd: code.dir, session_id: 's1', background_tasks: tasks }).stdout, '');
  assert.equal(JSON.parse(hook(sb, 'stop', { cwd: code.dir, session_id: 's1', background_tasks: [] }).stdout).decision, 'block', 'no marker was written');
});

test('stop stays silent when the described commit is no longer on main (history rewritten)', () => {
  const sb = sandbox();
  const { vault, code } = linkedSetup(sb);
  run(sb, 'registry.mjs', ['describe', vault.a, 'app', code.shas[2]]);
  git(sb, code.dir, ['reset', '-q', '--hard', code.shas[1]]);
  commit(sb, code.dir, 'src/z.js', 'z\n', 'feat: rewritten');
  git(sb, code.dir, ['push', '-q', '-f']);
  assert.equal(hook(sb, 'stop', { cwd: code.dir, session_id: 's1' }).stdout, '');
});

test('session-start refreshes the stable copy of the scripts when one is installed', () => {
  const sb = sandbox();
  const { code } = linkedSetup(sb);
  write(sb.kv, 'bin/sync.mjs', '// an older version\n');
  hook(sb, 'session-start', { cwd: code.dir, session_id: 's1' });
  assert.equal(readFileSync(join(sb.kv, 'bin', 'sync.mjs'), 'utf8'), readFileSync(join(SCRIPTS, 'sync.mjs'), 'utf8'));
  assert.ok(existsSync(join(sb.kv, 'templates', 'uk', 'AGENTS.md')));
});

test('the hook never exits non-zero, even with a corrupt config or bad stdin', () => {
  const sb = sandbox();
  const { code } = linkedSetup(sb);
  writeJson(join(sb.kv, 'config.json'), '{not json');
  for (const event of ['session-start', 'stop', 'session-end']) {
    const r = hook(sb, event, { cwd: code.dir, session_id: 's1' });
    assert.equal(r.code, 0, `${event}: ${r.stderr}`);
    const lines = r.stdout.trim().split('\n').filter(Boolean);
    assert.ok(lines.length <= 1);
    if (lines.length) assert.match(JSON.parse(lines[0]).systemMessage, /config\.json/);
  }
  const garbage = run(sb, 'hook.mjs', ['stop'], { input: 'not json at all' });
  assert.equal(garbage.code, 0);
});

test('the hook prints a usage line and exits 2 on a wrong event name', () => {
  const sb = sandbox();
  const r = run(sb, 'hook.mjs', ['lunch'], { input: '{}' });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage: hook\.mjs/);
});
