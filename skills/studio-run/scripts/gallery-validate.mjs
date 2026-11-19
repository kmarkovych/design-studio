// Validation of judging.json. Every failure names the exact field that is wrong.
import { statSync, realpathSync } from 'node:fs';
import { resolve, sep, isAbsolute } from 'node:path';

const MIN_DIRECTIONS = 2;
const MAX_DIRECTIONS = 4;

export class JudgingError extends Error {}
const fail = (field, why) => { throw new JudgingError(`judging.json: "${field}" ${why}`); };

function text(value, field) {
  if (typeof value !== 'string' || value.trim() === '') fail(field, 'must be a non-empty string');
  return value;
}

function relativeFile(value, field, runDir) {
  text(value, field);
  if (isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.startsWith('\\') || value.startsWith('/')) {
    fail(field, `must be a relative path, got "${value}"`);
  }
  if (value.split(/[\\/]/).includes('..')) fail(field, `must not contain ".." segments, got "${value}"`);
  const full = resolve(runDir, value);
  try {
    if (!statSync(full).isFile()) fail(field, `is not a file: ${value}`);
    const real = realpathSync(full), root = realpathSync(runDir);
    if (real !== root && !real.startsWith(root + sep)) fail(field, `resolves outside the run directory: ${value}`);
  } catch (e) {
    if (e instanceof JudgingError) throw e;
    fail(field, `points to a file that does not exist: ${value}`);
  }
}

function validateDirection(d, i, runDir) {
  const at = `directions[${i}]`;
  if (!d || typeof d !== 'object') fail(at, 'must be an object');
  text(d.id, `${at}.id`);
  text(d.stance, `${at}.stance`);
  text(d.summary, `${at}.summary`);
  relativeFile(d.comp, `${at}.comp`, runDir);
  if (!d.screenshots || typeof d.screenshots !== 'object') fail(`${at}.screenshots`, 'must be an object');
  relativeFile(d.screenshots.desktop, `${at}.screenshots.desktop`, runDir);
  relativeFile(d.screenshots.phone, `${at}.screenshots.phone`, runDir);
  if (!d.check || typeof d.check.pass !== 'boolean') fail(`${at}.check.pass`, 'must be true or false');
  if (!Number.isInteger(d.check.findings) || d.check.findings < 0) fail(`${at}.check.findings`, 'must be a whole number, 0 or more');
}

function validateComparison(c, i, ids, seenPairs) {
  const at = `comparisons[${i}]`;
  if (!c || typeof c !== 'object') fail(at, 'must be an object');
  const ok = Array.isArray(c.pair) && c.pair.length === 2 && c.pair[0] !== c.pair[1] && c.pair.every((id) => ids.has(id));
  if (!ok) fail(`${at}.pair`, 'must be two different known direction ids');
  const key = [...c.pair].sort().join('\u0000');
  if (seenPairs.has(key)) fail(`${at}.pair`, `repeats the pair ${c.pair.join(' vs ')}; each pair may appear once`);
  seenPairs.add(key);
  if (!c.pair.includes(c.winner)) fail(`${at}.winner`, `must be one of the pair (${c.pair.join(', ')})`);
  text(c.reasons, `${at}.reasons`);
}

export function validateJudging(j, runDir) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) fail('(root)', 'must be an object');
  text(j.brief, 'brief');
  if (!Array.isArray(j.directions) || j.directions.length < MIN_DIRECTIONS || j.directions.length > MAX_DIRECTIONS) {
    fail('directions', `must be an array of ${MIN_DIRECTIONS} to ${MAX_DIRECTIONS} directions`);
  }
  const ids = new Set();
  j.directions.forEach((d, i) => {
    validateDirection(d, i, runDir);
    if (ids.has(d.id)) fail(`directions[${i}].id`, `"${d.id}" is used twice; ids must be unique`);
    ids.add(d.id);
  });
  if (!Array.isArray(j.comparisons)) fail('comparisons', 'must be an array (may be empty)');
  const seen = new Set();
  j.comparisons.forEach((c, i) => validateComparison(c, i, ids, seen));
}

// Wins per direction, ordered by wins; ties share a rank. tie is true when the top place is shared.
export function computeRanking(j) {
  const wins = new Map(j.directions.map((d) => [d.id, 0]));
  for (const c of j.comparisons) wins.set(c.winner, wins.get(c.winner) + 1);
  const order = j.directions.map((d) => ({ id: d.id, wins: wins.get(d.id) })).sort((a, b) => b.wins - a.wins);
  const ranking = order.map((r) => ({ ...r, rank: 1 + order.filter((o) => o.wins > r.wins).length }));
  return { ranking, tie: ranking.filter((r) => r.rank === 1).length > 1 };
}
