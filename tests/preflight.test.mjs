import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SCRIPTS, tmp, makeSkill } from './helpers.mjs';

function run(skillDir, extraEnv = {}, args = ['--json']) {
  const cwd = tmp(), home = tmp();
  const env = { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: join(home, '.claude'), ...extraEnv };
  if (skillDir) env.IMPECCABLE_SKILL_DIR = skillDir; else delete env.IMPECCABLE_SKILL_DIR;
  const r = spawnSync(process.execPath, [SCRIPTS + 'preflight.mjs', ...args, '--project', cwd], { env, encoding: 'utf8' });
  return { ...r, json: args.includes('--json') ? JSON.parse(r.stdout) : null };
}
const status = (json, id) => json.checks.find((c) => c.id === id).status;

test('all good: ok overall, skill warnings allowed, exit 0', () => {
  const dir = tmp();
  makeSkill(dir);
  const r = run(dir);
  assert.equal(r.status, 0);
  assert.equal(r.json.ok, true);
  assert.equal(status(r.json, 'node'), 'ok');
  assert.equal(status(r.json, 'impeccable'), 'ok');
  assert.equal(status(r.json, 'impeccable-version'), 'ok');
  assert.equal(status(r.json, 'capture'), 'ok');
  assert.equal(status(r.json, 'grilling'), 'warn');
  assert.equal(status(r.json, 'frontend-design'), 'warn');
  assert.match(r.json.checks.find((c) => c.id === 'grilling').fix, /mattpocock-skills@claude-plugins-official/);
  assert.equal(r.json.impeccable.version, '4.10.0');
});

test('missing impeccable fails and dependent checks are skipped', () => {
  const r = run(null);
  assert.equal(r.status, 1);
  assert.equal(r.json.ok, false);
  assert.equal(status(r.json, 'impeccable'), 'fail');
  assert.match(r.json.checks.find((c) => c.id === 'impeccable').fix, /npx impeccable install/);
  assert.equal(status(r.json, 'impeccable-version'), 'skipped');
  assert.equal(status(r.json, 'capture'), 'skipped');
  assert.equal(r.json.impeccable, null);
});

test('too-old impeccable fails with update fix and skips capture', () => {
  const dir = tmp();
  makeSkill(dir, { version: '4.9.0' });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.equal(status(r.json, 'impeccable-version'), 'fail');
  assert.match(r.json.checks.find((c) => c.id === 'impeccable-version').fix, /npx impeccable update/);
  assert.equal(status(r.json, 'capture'), 'skipped');
});

test('failing shot fails capture with a browser fix', () => {
  const dir = tmp();
  makeSkill(dir);
  const r = run(dir, { FAKE_SHOT_FAIL: '1' });
  assert.equal(r.status, 1);
  assert.equal(status(r.json, 'capture'), 'fail');
  assert.match(r.json.checks.find((c) => c.id === 'capture').fix, /Google Chrome.*IMPECCABLE_BROWSER/);
});

test('shot that writes only one PNG fails capture', () => {
  const dir = tmp();
  makeSkill(dir);
  assert.equal(status(run(dir, { FAKE_SHOT_ONE: '1' }).json, 'capture'), 'fail');
});

test('capture probe cleans up its temp directory', () => {
  const dir = tmp(), log = join(tmp(), 'log');
  makeSkill(dir);
  run(dir, { FAKE_LOG: log });
  const out = spawnSync('cat', [log], { encoding: 'utf8' }).stdout;
  const probeDir = out.match(/--out (\S+)/)[1];
  assert.equal(existsSync(probeDir), false);
});

test('human output has one line per check and the skill-list caveat', () => {
  const dir = tmp();
  makeSkill(dir);
  const r = run(dir, {}, []);
  const lines = r.stdout.split('\n').filter((l) => /^(ok|warn|FAIL|skip)/.test(l));
  assert.equal(lines.length, 6);
  assert.match(r.stdout, /^warn\s+grilling/m);
  assert.match(r.stdout, /own skill list/);
  assert.match(r.stdout, /^ok\s+node/m);
});

test('human output marks failures with FAIL and the fix', () => {
  const r = run(null, {}, []);
  assert.match(r.stdout, /^FAIL\s+impeccable/m);
  assert.match(r.stdout, /npx impeccable install/);
  assert.equal(r.status, 1);
});
