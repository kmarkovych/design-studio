import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { SCRIPTS, tmp } from './helpers.mjs';

function touch(root, rel) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), 'x');
}

function direction(root, id, over = {}) {
  const d = {
    id, stance: `Stance ${id}`, summary: `Summary ${id}`, comp: `directions/${id}/index.html`,
    screenshots: { desktop: `directions/${id}/shots/1440x900.png`, phone: `directions/${id}/shots/390x844.png` },
    check: { pass: true, findings: 0 }, ...over,
  };
  [d.comp, d.screenshots.desktop, d.screenshots.phone].forEach((p) => typeof p === 'string' && !p.startsWith('/') && !p.includes('..') && touch(root, p));
  return d;
}

function run(judging, { raw } = {}) {
  const root = tmp();
  const j = typeof judging === 'function' ? judging(root) : judging;
  writeFileSync(join(root, 'judging.json'), raw ?? JSON.stringify(j));
  const r = spawnSync(process.execPath, [SCRIPTS + 'gallery.mjs', root], { encoding: 'utf8' });
  return { r, root, html: existsSync(join(root, 'gallery.html')) ? readFileSync(join(root, 'gallery.html'), 'utf8') : null };
}

const base = (root, over = {}) => ({
  brief: 'A brief', directions: [direction(root, 'a'), direction(root, 'b')],
  comparisons: [{ pair: ['a', 'b'], winner: 'b', reasons: 'b reads better' }], ...over,
});

test('valid run writes gallery and prints ranking with winner first', () => {
  const { r, html } = run((root) => base(root));
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out, { ranking: [{ id: 'b', wins: 1, rank: 1 }, { id: 'a', wins: 0, rank: 2 }], tie: false });
  assert.ok(html.indexOf('Stance b') < html.indexOf('Stance a'));
  assert.match(html, /b reads better/);
  assert.match(html, /<img [^>]*alt="[^"]+"[^>]*width="\d+"[^>]*height="\d+"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.match(html, /reply in the conversation/i);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.match(html, /href="\.\/directions\/b\/index\.html"/);
});

test('tie is reported plainly, with no invented order', () => {
  const { r, html } = run((root) => base(root, {
    directions: [direction(root, 'a'), direction(root, 'b')],
    comparisons: [{ pair: ['a', 'b'], winner: 'a', reasons: 'r' }],
  }));
  assert.equal(JSON.parse(r.stdout).tie, false);
  const t = run((root) => ({
    brief: 'x', directions: ['a', 'b', 'c'].map((i) => direction(root, i)),
    comparisons: [
      { pair: ['a', 'b'], winner: 'a', reasons: 'r' },
      { pair: ['b', 'c'], winner: 'b', reasons: 'r' },
      { pair: ['a', 'c'], winner: 'c', reasons: 'r' },
    ],
  }));
  const out = JSON.parse(t.r.stdout);
  assert.equal(out.tie, true);
  assert.ok(out.ranking.every((x) => x.wins === 1 && x.rank === 1));
  assert.match(t.html, /tie/i);
});

test('hostile text is escaped everywhere', () => {
  const evil = '<script>alert(1)</script>';
  const { r, html } = run((root) => base(root, {
    brief: evil, directions: [direction(root, 'a', { stance: evil, summary: evil }), direction(root, 'b')],
    comparisons: [{ pair: ['a', 'b'], winner: 'a', reasons: evil }],
  }));
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

function fails(mutate, fieldPattern) {
  const { r, html } = run((root) => mutate(base(root), root));
  assert.equal(r.status, 1, `expected failure, got ${r.status}: ${r.stdout}`);
  assert.match(r.stderr, fieldPattern);
  assert.equal(html, null);
}

test('missing or malformed judging.json is reported', () => {
  const r = spawnSync(process.execPath, [SCRIPTS + 'gallery.mjs', tmp()], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /judging\.json/);
  const bad = run(null, { raw: '{nope' });
  assert.equal(bad.r.status, 1);
  assert.match(bad.r.stderr, /judging\.json/);
});

test('validation names the exact wrong field', () => {
  fails((j) => ({ ...j, brief: '' }), /brief/);
  fails((j) => ({ ...j, directions: [j.directions[0]] }), /directions/);
  fails((j, root) => ({ ...j, directions: ['a', 'b', 'c', 'd', 'e'].map((i) => direction(root, i)) }), /directions/);
  fails((j) => { j.directions[1].id = 'a'; return j; }, /directions\[1\]\.id/);
  fails((j) => { j.directions[0].stance = 3; return j; }, /directions\[0\]\.stance/);
  fails((j) => { delete j.directions[0].summary; return j; }, /directions\[0\]\.summary/);
  fails((j) => { j.directions[0].screenshots = {}; return j; }, /directions\[0\]\.screenshots\.desktop/);
  fails((j) => { j.directions[1].check = { pass: 'yes', findings: 0 }; return j; }, /directions\[1\]\.check\.pass/);
  fails((j) => { j.directions[1].check = { pass: true, findings: -1 }; return j; }, /directions\[1\]\.check\.findings/);
  fails((j) => ({ ...j, comparisons: 'x' }), /comparisons/);
  fails((j) => { j.comparisons[0].pair = ['a', 'zzz']; return j; }, /comparisons\[0\]\.pair/);
  fails((j) => { j.comparisons[0].winner = 'zzz'; return j; }, /comparisons\[0\]\.winner/);
  fails((j) => { j.comparisons[0].reasons = ''; return j; }, /comparisons\[0\]\.reasons/);
  fails((j) => ({ ...j, comparisons: [...j.comparisons, { pair: ['b', 'a'], winner: 'a', reasons: 'dup' }] }), /comparisons\[1\]\.pair/);
});

test('paths: absolute, dot-dot and missing files are rejected', () => {
  fails((j) => { j.directions[0].comp = '/etc/passwd'; return j; }, /directions\[0\]\.comp/);
  fails((j) => { j.directions[0].comp = 'C:\\x\\y.html'; return j; }, /directions\[0\]\.comp/);
  fails((j) => { j.directions[0].screenshots.phone = 'directions/../../x.png'; return j; }, /directions\[0\]\.screenshots\.phone/);
  fails((j) => { j.directions[0].screenshots.desktop = 'directions\\..\\x.png'; return j; }, /directions\[0\]\.screenshots\.desktop/);
  fails((j) => { j.directions[1].comp = 'directions/b/missing.html'; return j; }, /directions\[1\]\.comp/);
});
