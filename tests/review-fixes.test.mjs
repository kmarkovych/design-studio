import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { SCRIPTS, tmp, makeSkill, writeJson } from './helpers.mjs';
import { GALLERY_CSS } from '../skills/studio-run/scripts/gallery-style.mjs';

const node = (args, opts) => spawnSync(process.execPath, args, { encoding: 'utf8', ...opts });

test('scripts run when started through a symlinked directory', () => {
  const root = tmp();
  const link = join(root, 'link');
  symlinkSync(SCRIPTS.replace(/[\\/]$/, ''), link);
  const c = node([join(link, 'check.mjs'), join(root, 'nope.html')]);
  assert.equal(c.status, 1);
  assert.match(c.stderr, /page not found/);
  assert.equal(node([join(link, 'gallery.mjs')]).status, 2);
  const skill = join(root, 'skill'); makeSkill(skill);
  const p = node([join(link, 'preflight.mjs'), '--json', '--project', root], { env: { ...process.env, IMPECCABLE_SKILL_DIR: skill } });
  assert.ok(JSON.parse(p.stdout).checks.length > 0);
});

function checkSetup(detect, env = {}) {
  const root = tmp(), skill = join(root, 'skill');
  makeSkill(skill);
  const page = join(root, 'index.html');
  writeFileSync(page, '<!doctype html><title>t</title><p>x</p>');
  const d = writeJson(join(root, 'd.json'), detect ?? []);
  const base = { ...process.env, IMPECCABLE_SKILL_DIR: skill, FAKE_DETECT_OUT: d };
  const run = (extra = {}) => node([SCRIPTS + 'check.mjs', page, '--json'], { cwd: root, env: { ...base, ...extra } });
  return { root, page, run, result: () => JSON.parse(readFileSync(join(root, 'checks', 'index.json'), 'utf8')), ...{ env } };
}

test('stale screenshots from an earlier run do not satisfy the check', () => {
  const s = checkSetup([]);
  assert.equal(s.run().status, 0);
  const r = s.run({ FAKE_SHOT_NOWRITE: '1' });
  assert.equal(r.status, 1);
  assert.equal(s.result().pass, false);
});

for (const bad of ['[null]', '[1]', '[{}]', '[{"antipattern":"x","severity":"info"}]']) {
  test(`malformed detector item ${bad} is an operational failure and overwrites old result`, () => {
    const s = checkSetup([]);
    assert.equal(s.run().status, 0);
    writeJson(join(s.root, 'd.json'), bad);
    const r = s.run({ FAKE_DETECT_CODE: '2' });
    assert.equal(r.status, 1, r.stderr);
    assert.equal(s.result().pass, false);
    assert.match(s.result().errors.join(' '), /malformed/);
  });
}

test('missing page invalidates an earlier passing result', () => {
  const s = checkSetup([]);
  assert.equal(s.run().status, 0);
  writeFileSync(join(s.root, 'index.html'), 'x');
  const moved = join(s.root, 'index.html');
  copyFileSync(moved, join(s.root, 'x.html'));
  node(['-e', `require('fs').rmSync(${JSON.stringify(moved)})`]);
  assert.equal(s.run().status, 1);
  assert.equal(existsSync(join(s.root, 'checks', 'index.json')) ? s.result().pass : false, false);
});

function touch(root, rel) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), 'x'); }
function dir(root, id, comp = `directions/${id}/index.html`, check = { pass: true, findings: 0 }) {
  const shots = { desktop: `directions/${id}/d.png`, phone: `directions/${id}/p.png` };
  [comp, shots.desktop, shots.phone].forEach((p) => touch(root, p));
  return { id, stance: `Stance ${id}`, summary: 's', comp, screenshots: shots, check };
}
function gallery(build) {
  const root = tmp();
  writeJson(join(root, 'judging.json'), build(root));
  const r = node([SCRIPTS + 'gallery.mjs', root]);
  return { r, html: existsSync(join(root, 'gallery.html')) ? readFileSync(join(root, 'gallery.html'), 'utf8') : '' };
}
const cmp = (a, b, w) => ({ pair: [a, b], winner: w, reasons: `${w} beat` });

test('partial tie: top places tied, lower places stay in rank order and are not labelled tied', () => {
  const { r, html } = gallery((root) => ({
    brief: 'b', directions: ['d', 'c', 'a', 'b'].map((i) => dir(root, i)),
    comparisons: [cmp('a', 'c', 'a'), cmp('b', 'c', 'b'), cmp('a', 'd', 'a'), cmp('b', 'd', 'b'), cmp('c', 'd', 'c')],
  }));
  assert.equal(r.status, 0, r.stderr);
  const at = (s) => html.indexOf(`>Stance ${s}<`);
  assert.ok(at('a') < at('b') && at('b') < at('c') && at('c') < at('d'));
  assert.equal(html.match(/Tied at the top/g).length, 2);
});

test('links with a scheme-like first segment or # in names are neutralised', () => {
  const { r, html } = gallery((root) => ({
    brief: 'b', directions: [dir(root, 'a', 'javascript:alert(1)/x.html'), dir(root, 'b', 'directions/b/v#2.html')],
    comparisons: [],
  }));
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(html, /(?:href|src)="javascript:/);
  assert.match(html, /href="\.\/javascript%3Aalert\(1\)\/x\.html"/);
  assert.match(html, /v%232\.html/);
});

test('singular finding count on a passing check', () => {
  const { html } = gallery((root) => ({ brief: 'b', directions: [dir(root, 'a', undefined, { pass: true, findings: 1 }), dir(root, 'b')], comparisons: [] }));
  assert.match(html, /1 finding remaining/);
  assert.doesNotMatch(html, /1 findings/);
});

test('gallery stylesheet wraps long words, rings image links, keeps a readable measure', () => {
  assert.match(GALLERY_CSS, /overflow-wrap:\s*anywhere/);
  assert.match(GALLERY_CSS, /\.shots a\s*\{[^}]*display:\s*block/);
  assert.match(GALLERY_CSS, /--measure:\s*(5\d|4\d)ch/);
  assert.match(GALLERY_CSS, /clamp\(15rem/);
});

test('preflight rejects a missing --project directory with exit 1', () => {
  const skill = tmp(); makeSkill(skill);
  const env = { ...process.env, IMPECCABLE_SKILL_DIR: skill };
  const a = node([SCRIPTS + 'preflight.mjs', '--project', '/does/not/exist'], { env });
  assert.equal(a.status, 1);
  assert.match(a.stderr, /does not exist/);
  assert.equal(node([SCRIPTS + 'preflight.mjs', '--project'], { env }).status, 1);
});
