// node gallery.mjs <run-dir>: writes <run-dir>/gallery.html from <run-dir>/judging.json.
import { readFileSync, writeFileSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { escapeHtml as esc, isMain } from './lib.mjs';
import { GALLERY_CSS } from './gallery-style.mjs';
import { validateJudging, computeRanking, JudgingError } from './gallery-validate.mjs';

const PNG_SIGNATURE = '89504e470d0a1a0a';
const FALLBACK_SIZE = { desktop: [1440, 900], phone: [390, 844] };

// './' keeps a scheme-like first segment relative; each segment is encoded so ':', '#', '?' stay literal.
const href = (p) => esc('./' + p.split(/[\\/]/).map(encodeURIComponent).join('/'));

// Real size from the PNG header so width/height attributes reserve the right space.
function pngSize(file, kind) {
  const buf = Buffer.alloc(24);
  const fd = openSync(file, 'r');
  try { readSync(fd, buf, 0, 24, 0); } finally { closeSync(fd); }
  return buf.subarray(0, 8).toString('hex') === PNG_SIGNATURE ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : FALLBACK_SIZE[kind];
}

function figure(runDir, d, kind, label, lazy) {
  const [w, h] = pngSize(join(runDir, d.screenshots[kind]), kind);
  const src = href(d.screenshots[kind]);
  return `<figure class="${kind}"><a href="${href(d.comp)}"><img src="${src}" alt="${esc(`${label} screenshot of direction ${d.stance}`)}" width="${w}" height="${h}"${lazy ? ' loading="lazy"' : ''}></a>`
    + `<figcaption>${esc(label)}, ${w}×${h}</figcaption></figure>`;
}

function reasonsFor(d, j, names) {
  const items = j.comparisons.filter((c) => c.pair.includes(d.id)).map((c) => {
    const other = c.pair.find((id) => id !== d.id);
    const verdict = c.winner === d.id ? 'won against' : 'lost to';
    return `<li><strong>${esc(names.get(d.id))} ${verdict} ${esc(names.get(other))}.</strong> ${esc(c.reasons)}</li>`;
  });
  return items.length ? `<ul class="reasons" aria-label="Judges' reasons">${items.join('')}</ul>` : '';
}

const plural = (n, word) => (n === 1 ? word : `${word}s`);

function rankLine(r, tie, total) {
  if (tie && r.rank === 1) return `Tied at the top, ${r.wins} ${plural(r.wins, 'win')}`;
  return `${r.rank === 1 ? 'Preferred by the judges' : `Place ${r.rank} of ${total}`}, ${r.wins} ${plural(r.wins, 'win')}`;
}

function section(runDir, d, ctx, index) {
  const { j, names, byId, tie } = ctx;
  const r = byId.get(d.id);
  const lead = index === 0 && !tie;
  const status = d.check.pass
    ? `Check passed, ${d.check.findings} ${plural(d.check.findings, 'finding')} remaining`
    : `Check failed, ${d.check.findings} ${plural(d.check.findings, 'finding')} remaining`;
  return `<section class="direction${lead ? ' lead' : ''}" aria-labelledby="d-${index}">
<p class="rank">${esc(rankLine(r, tie, j.directions.length))}</p>
<h2 id="d-${index}">${esc(d.stance)}</h2>
<p class="summary">${esc(d.summary)}</p>
<p class="status ${d.check.pass ? 'pass' : 'fail'}">${esc(status)}</p>
<div class="shots">${figure(runDir, d, 'desktop', 'Desktop', index > 0)}${figure(runDir, d, 'phone', 'Phone', index > 0)}</div>
<a class="open" href="${href(d.comp)}">Open the live comp &rarr;</a>
${reasonsFor(d, j, names)}
</section>`;
}

export function renderGallery(j, runDir, computed) {
  const byId = new Map(computed.ranking.map((r) => [r.id, r]));
  const names = new Map(j.directions.map((d) => [d.id, d.stance]));
  // Stable sort: directions with equal rank keep the submitted order, so no order is invented among ties.
  const ordered = [...j.directions].sort((a, b) => byId.get(a.id).rank - byId.get(b.id).rank);
  const top = computed.ranking.filter((r) => r.rank === 1);
  const tieNote = computed.tie
    ? `<p class="tie">No clear winner: ${top.map((r) => esc(names.get(r.id))).join(' and ')} are tied with ${top[0].wins} ${top[0].wins === 1 ? 'win' : 'wins'} each. The tied directions are shown in the order they were submitted, not ranked against each other.</p>`
    : '';
  const ctx = { j, names, byId, tie: computed.tie };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design directions</title>
<style>${GALLERY_CSS}</style>
</head>
<body>
<header><h1>Design directions</h1><p class="brief">${esc(j.brief)}</p>${tieNote}</header>
<main>
${ordered.map((d, i) => section(runDir, d, ctx, i)).join('\n')}
</main>
<footer><p>Reply in the conversation with the direction you pick, and anything you want borrowed from the others.</p></footer>
</body>
</html>
`;
}

function loadJudging(runDir) {
  const file = join(runDir, 'judging.json');
  if (!existsSync(file)) throw new JudgingError(`judging.json not found in ${runDir}`);
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
    throw new JudgingError(`judging.json is not valid JSON: ${e.message}`);
  }
}

function main(argv) {
  if (!argv[0]) {
    process.stderr.write('usage: node gallery.mjs <run-dir>\n');
    return 2;
  }
  const runDir = resolve(argv[0]);
  try {
    const j = loadJudging(runDir);
    validateJudging(j, runDir);
    const computed = computeRanking(j);
    writeFileSync(join(runDir, 'gallery.html'), renderGallery(j, runDir, computed));
    process.stdout.write(JSON.stringify(computed) + '\n');
    return 0;
  } catch (e) {
    if (!(e instanceof JudgingError)) throw e;
    process.stderr.write(`gallery: ${e.message}\n`);
    return 1;
  }
}

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
