import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SCRIPTS, tmp, makeSkill, writeJson } from './helpers.mjs';
import { decodePng } from '../skills/studio-run/scripts/png.mjs';

const finding = (over = {}) => ({
  antipattern: 'low-contrast', name: 'Low contrast', description: 'too pale',
  severity: 'warning', category: 'a11y', file: 'p.html', line: 3, snippet: '<p>x</p>', ...over,
});

function setup(detect, { code = 0, env = {}, withSkill = true } = {}) {
  const root = tmp();
  const skill = join(root, 'skill');
  makeSkill(skill);
  const page = join(root, 'comps', 'index.html');
  mkdirSync(join(root, 'comps'));
  writeFileSync(page, '<!doctype html><title>t</title><p>x</p>');
  const detectFile = join(root, 'detect.json');
  if (detect !== undefined) writeJson(detectFile, detect);
  const log = join(root, 'log');
  const full = { ...process.env, FAKE_DETECT_OUT: detectFile, FAKE_DETECT_CODE: String(code), FAKE_LOG: log, ...env };
  if (withSkill) full.IMPECCABLE_SKILL_DIR = skill; else {
    delete full.IMPECCABLE_SKILL_DIR; full.HOME = root; full.CLAUDE_CONFIG_DIR = join(root, 'nocfg');
  }
  const r = spawnSync(process.execPath, [SCRIPTS + 'check.mjs', page, '--json'], { cwd: root, env: full, encoding: 'utf8' });
  const resultFile = join(root, 'comps', 'checks', 'index.json');
  const written = existsSync(resultFile) ? JSON.parse(readFileSync(resultFile, 'utf8')) : null;
  return { r, root, page, written, log };
}

test('clean page passes, exit 0, screenshots and result written', () => {
  const { r, written, page, root } = setup([]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(written.pass, true);
  assert.deepEqual(written.errors, []);
  assert.equal(written.page, page);
  assert.equal(written.impeccableVersion, '4.10.0');
  assert.ok(!Number.isNaN(Date.parse(written.checkedAt)));
  const shots = join(root, 'comps', 'shots', 'index');
  assert.deepEqual([...written.screenshots].sort(), ['1440x900.png', '390x844.png', '1440x900-full.png', '390x844-full.png'].map((f) => join(shots, f)).sort());
  assert.deepEqual(JSON.parse(r.stdout), written);
});

test('whole-page captures are cut into numbered, overlapping slices', () => {
  const { r, written, root } = setup([]);
  assert.equal(r.status, 0, r.stderr);
  const shots = join(root, 'comps', 'shots', 'index');
  const names = ['1440x900-full-1', '1440x900-full-2', '1440x900-full-3', '390x844-full-1', '390x844-full-2', '390x844-full-3'];
  assert.deepEqual(written.slices, names.map((n) => join(shots, `${n}.png`)));
  const dims = written.slices.map((f) => { const i = decodePng(readFileSync(f)); return [i.width, i.height, i.pixels[0]]; });
  // desktop 3000 rows: tops 0, 1300, 2600; phone 4000 rows: tops 0, 1500, 3000
  assert.deepEqual(dims, [[1440, 1400, 0], [1440, 1400, 1300 & 255], [1440, 400, 2600 & 255], [390, 1600, 0], [390, 1600, 1500 & 255], [390, 1000, 3000 & 255]]);
});

test('a capture that cannot be sliced is an operational failure', () => {
  const { r, written } = setup([], { env: { FAKE_PNG_BAD: '1' } });
  assert.equal(r.status, 1);
  assert.equal(written.pass, false);
  assert.match(written.errors.join(' '), /slice/i);
});

test('findings keep the detector file and count repeats within one scan', () => {
  const f = finding({ selector: undefined, line: 0, file: '/x/index.html' });
  const { written } = setup([f, f, f, finding({ snippet: 'other', file: '/x/index.html' })], { code: 2 });
  const rep = written.findings.find((x) => x.snippet === '<p>x</p>');
  assert.equal(rep.occurrences, 3);
  assert.equal(rep.file, '/x/index.html');
  assert.deepEqual(rep.scans, ['static', 'rendered-1440x900', 'rendered-390x844']);
  assert.equal(written.findings.find((x) => x.snippet === 'other').occurrences, 1);
  assert.equal(setup([finding({ file: undefined })], { code: 2 }).written.findings[0].file, null);
});

test('occurrences count the same rule and snippet in one scan, whatever the selector', () => {
  const { written } = setup([finding({ selector: 'p.a' }), finding({ selector: 'p.b' })], { code: 2 });
  assert.deepEqual(written.findings.map((x) => [x.selector, x.occurrences]), [['p.a', 2], ['p.b', 2]]);
});

test('a file:// URL from a rendered scan is recorded as a path', () => {
  const { written } = setup([finding({ file: 'file:///x/my%20page.html' })], { code: 2 });
  assert.equal(written.findings[0].file, '/x/my page.html');
});

test('runs one static and two rendered scans with viewports', () => {
  const { log, page } = setup([]);
  const detects = readFileSync(log, 'utf8').split('\n').filter((l) => l.startsWith('detect'));
  assert.equal(detects.length, 3);
  assert.ok(detects.some((l) => l.includes(page) && !l.includes('--viewport')));
  assert.ok(detects.some((l) => l.includes('--viewport 1440x900') && l.includes('file://')));
  assert.ok(detects.some((l) => l.includes('--viewport 390x844') && l.includes('file://')));
});

test('primary findings fail with exit 2 and are merged across scans', () => {
  const { r, written } = setup([finding({ selector: 'p.cap' })], { code: 2 });
  assert.equal(r.status, 2);
  assert.equal(written.pass, false);
  assert.equal(written.findings.length, 1);
  const f = written.findings[0];
  assert.equal(f.rule, 'low-contrast');
  assert.equal(f.selector, 'p.cap');
  assert.equal(f.line, 3);
  assert.equal(f.scans.length, 3);
  assert.deepEqual(written.advisories, []);
});

test('advisory-only findings pass', () => {
  const { r, written } = setup([finding({ severity: 'advisory', advisory: true })], { code: 0 });
  assert.equal(r.status, 0);
  assert.equal(written.pass, true);
  assert.equal(written.findings.length, 0);
  assert.equal(written.advisories.length, 1);
});

test('detect exit 1 is an operational failure and wins over findings', () => {
  const { r, written } = setup([finding()], { code: 1 });
  assert.equal(r.status, 1);
  assert.equal(written.pass, false);
  assert.ok(written.errors.length >= 1);
});

test('garbage detector output is an operational failure, never a pass', () => {
  const { r, written } = setup('this is not json', { code: 0 });
  assert.equal(r.status, 1);
  assert.equal(written.pass, false);
  assert.match(written.errors.join(' '), /parse|JSON/i);
});

test('non-array JSON is an operational failure', () => {
  assert.equal(setup({ nope: 1 }, { code: 0 }).r.status, 1);
});

test('exit 2 with no findings is an inconsistency, reported as failure', () => {
  assert.equal(setup([], { code: 2 }).r.status, 1);
});

test('failing shot is an operational failure', () => {
  const { r, written } = setup([], { env: { FAKE_SHOT_FAIL: '1' } });
  assert.equal(r.status, 1);
  assert.equal(written.pass, false);
  assert.match(written.errors.join(' '), /screenshot|shot/i);
});

test('missing second PNG is an operational failure', () => {
  assert.equal(setup([], { env: { FAKE_SHOT_ONE: '1' } }).r.status, 1);
});

test('impeccable not installed exits 1 with install hint', () => {
  const { r } = setup([], { withSkill: false });
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /npx impeccable install/);
});

test('missing page exits 1 with a message', () => {
  const r = spawnSync(process.execPath, [SCRIPTS + 'check.mjs', '/nonexistent/x.html'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not found|does not exist/i);
});

test('human output shows PASS or FAIL and one line per primary finding', () => {
  const { root, page } = setup([finding()], { code: 2 });
  const env = { ...process.env, IMPECCABLE_SKILL_DIR: join(root, 'skill'), FAKE_DETECT_OUT: join(root, 'detect.json'), FAKE_DETECT_CODE: '2' };
  const r = spawnSync(process.execPath, [SCRIPTS + 'check.mjs', page], { cwd: root, env, encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /^FAIL/m);
  assert.match(r.stdout, /low-contrast/);
  assert.match(r.stdout, / at p\.html:3 \(/);
});

test('human output leaves out a line number of 0', () => {
  const { root, page } = setup([finding({ line: 0 })], { code: 2 });
  const env = { ...process.env, IMPECCABLE_SKILL_DIR: join(root, 'skill'), FAKE_DETECT_OUT: join(root, 'detect.json'), FAKE_DETECT_CODE: '2' };
  const r = spawnSync(process.execPath, [SCRIPTS + 'check.mjs', page], { cwd: root, env, encoding: 'utf8' });
  assert.match(r.stdout, / at p\.html \(/);
});

const REAL = join(homedir(), '.claude', 'skills', 'impeccable');
const realTest = existsSync(join(REAL, 'SKILL.md')) ? test : test.skip;

function realRun(html) {
  const root = tmp();
  const page = join(root, 'page.html');
  writeFileSync(page, html);
  const env = { ...process.env, IMPECCABLE_SKILL_DIR: REAL };
  const r = spawnSync(process.execPath, [SCRIPTS + 'check.mjs', page, '--json'], { cwd: root, env, encoding: 'utf8', timeout: 120000 });
  return { r, root, out: r.stdout ? JSON.parse(r.stdout) : null };
}

realTest('real impeccable: low-contrast caption exits 2 with rule low-contrast', () => {
  const { r, out } = realRun(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title></head>
<body style="background:#fff;font-family:Georgia,serif"><main><h1>Harbour notes</h1>
<p style="color:#ccc;font-size:14px">A caption nobody can read.</p></main></body></html>`);
  assert.equal(r.status, 2, r.stderr + r.stdout);
  assert.ok(out.findings.some((f) => f.rule === 'low-contrast'));
});

realTest('real impeccable: clean page writes both screenshots', () => {
  const { r, root, out } = realRun(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title></head>
<body style="background:#fff;color:#111;font-family:Georgia,serif"><main><h1>Harbour notes</h1>
<p>Plain readable text.</p></main></body></html>`);
  assert.ok([0, 2].includes(r.status), r.stderr + r.stdout);
  assert.deepEqual(out.errors, []);
  assert.ok(existsSync(join(root, 'shots', 'page', '1440x900.png')));
  assert.ok(existsSync(join(root, 'shots', 'page', '390x844.png')));
  assert.ok(existsSync(join(root, 'shots', 'page', '1440x900-full.png')));
  assert.ok(existsSync(join(root, 'shots', 'page', '390x844-full.png')));
});
