import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { SCRIPTS, tmp, makeSkill } from './helpers.mjs';

const lib = await import(SCRIPTS + 'lib.mjs');

test('parseSkillVersion reads top-level and metadata-nested versions', () => {
  assert.equal(lib.parseSkillVersion('---\nname: x\nversion: 4.10.0\n---\n'), '4.10.0');
  assert.equal(lib.parseSkillVersion('---\nname: x\nmetadata:\n  version: "4.9.1"\n---\n'), '4.9.1');
  assert.equal(lib.parseSkillVersion('---\nname: x\n---\nversion: 9.9.9\n'), null);
  assert.equal(lib.parseSkillVersion('no frontmatter'), null);
});

test('compareVersions orders numerically, not lexically', () => {
  assert.equal(lib.compareVersions('4.10.0', '4.9.0'), 1);
  assert.equal(lib.compareVersions('4.9.9', '4.10.0'), -1);
  assert.equal(lib.compareVersions('4.10', '4.10.0'), 0);
  assert.equal(lib.MIN_IMPECCABLE_VERSION, '4.10.0');
});

test('escapeHtml neutralises markup characters', () => {
  assert.equal(lib.escapeHtml(`<a href="x">&'</a>`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(lib.escapeHtml(5), '5');
});

test('findImpeccable follows the documented search order', () => {
  const cwd = tmp(), home = tmp(), cfg = tmp(), envDir = tmp();
  const places = [
    envDir,
    join(cwd, '.claude/skills/impeccable'),
    join(cwd, '.agents/skills/impeccable'),
    join(cfg, 'skills/impeccable'),
    join(home, '.agents/skills/impeccable'),
  ];
  places.forEach((p, i) => makeSkill(p, { version: `4.10.${i}` }));
  const env = { IMPECCABLE_SKILL_DIR: envDir, CLAUDE_CONFIG_DIR: cfg };
  places.forEach((p, i) => {
    const found = lib.findImpeccable({ cwd, env, home, platform: 'linux' });
    assert.equal(found.skillDir, p);
    assert.equal(found.version, `4.10.${i}`);
    assert.equal(found.launcher, join(p, 'scripts', 'impeccable'));
    rmSync(p, { recursive: true });
  });
  assert.equal(lib.findImpeccable({ cwd, env, home, platform: 'linux' }), null);
});

test('findImpeccable defaults config dir to home/.claude and honours platform launcher', () => {
  const cwd = tmp(), home = tmp();
  const dir = join(home, '.claude/skills/impeccable');
  makeSkill(dir);
  assert.equal(lib.findImpeccable({ cwd, env: {}, home, platform: 'linux' }).skillDir, dir);
  assert.equal(lib.findImpeccable({ cwd, env: {}, home, platform: 'win32' }), null);
  makeSkill(dir, { windows: true });
  assert.ok(lib.findImpeccable({ cwd, env: {}, home, platform: 'win32' }).launcher.endsWith('impeccable.cmd'));
});

test('findImpeccable skips candidates without SKILL.md or launcher', () => {
  const cwd = tmp(), home = tmp(), bad = tmp();
  mkdirSync(join(bad, 'scripts'), { recursive: true });
  writeFileSync(join(bad, 'SKILL.md'), '---\nversion: 4.10.0\n---\n');
  assert.equal(lib.findImpeccable({ cwd, env: { IMPECCABLE_SKILL_DIR: bad }, home, platform: 'linux' }), null);
});

test('findSkill searches direct locations and plugin cache to depth 7', () => {
  const cwd = tmp(), home = tmp(), cfg = tmp();
  const env = { CLAUDE_CONFIG_DIR: cfg };
  assert.equal(lib.findSkill('grilling', { cwd, env, home }), null);
  const direct = join(cwd, '.agents/skills/grilling');
  mkdirSync(direct, { recursive: true });
  writeFileSync(join(direct, 'SKILL.md'), 'x');
  assert.equal(lib.findSkill('grilling', { cwd, env, home }), direct);

  const deep = join(cfg, 'plugins/cache/a/b/c/d/e/f/frontend-design');
  mkdirSync(deep, { recursive: true });
  writeFileSync(join(deep, 'SKILL.md'), 'x');
  assert.equal(lib.findSkill('frontend-design', { cwd, env, home }), deep);

  const tooDeep = join(cfg, 'plugins/cache/a/b/c/d/e/f/g/other');
  mkdirSync(tooDeep, { recursive: true });
  writeFileSync(join(tooDeep, 'SKILL.md'), 'x');
  assert.equal(lib.findSkill('other', { cwd, env, home }), null);
});

test('findSkill ignores a folder of that name without SKILL.md', () => {
  const cwd = tmp(), home = tmp();
  mkdirSync(join(cwd, '.claude/skills/grilling'), { recursive: true });
  assert.equal(lib.findSkill('grilling', { cwd, env: {}, home }), null);
});

test('runImpeccable returns output and exit code', () => {
  const dir = tmp();
  const launcher = makeSkill(join(dir, 's'));
  const r = lib.runImpeccable(launcher, ['bogus'], { cwd: dir, timeoutMs: 5000 });
  assert.equal(r.code, 9);
  assert.match(r.stderr, /unexpected verb/);
});

test('runImpeccable reports spawn errors and timeouts as failures', () => {
  const dir = tmp();
  const missing = lib.runImpeccable(join(dir, 'nope'), [], { cwd: dir, timeoutMs: 1000 });
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /nope|ENOENT/);
  const slow = join(dir, 'slow');
  writeFileSync(slow, '#!/bin/sh\nsleep 5\n');
  chmodSync(slow, 0o755);
  const t = lib.runImpeccable(slow, [], { cwd: dir, timeoutMs: 200 });
  assert.notEqual(t.code, 0);
  assert.match(t.stderr, /timed out/);
});
