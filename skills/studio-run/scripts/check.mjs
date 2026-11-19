// node check.mjs <page.html> [--json]
// Scripted pass/fail test of one rendered comp page. Exit 0 pass, 2 primary findings, 1 operational failure.
import { existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findImpeccable, runImpeccable, isMain } from './lib.mjs';

const DESKTOP = '1440x900';
const PHONE = '390x844';
const SHOT_TIMEOUT_MS = 90000;
const DETECT_TIMEOUT_MS = 90000;

function takeShots(impeccable, page, dir, errors) {
  // Clear old captures so only files written by this run can satisfy the check.
  rmSync(dir, { recursive: true, force: true });
  const paths = [];
  // Viewport captures show what a visitor sees first; full-page captures let critics see the rest.
  for (const [flags, suffix] of [[[], ''], [['--full'], '-full']]) {
    const r = runImpeccable(impeccable.launcher, ['shot', page, '--viewport', `${DESKTOP},${PHONE}`, ...flags, '--out', dir], { timeoutMs: SHOT_TIMEOUT_MS });
    if (r.code !== 0) {
      errors.push(`screenshot step (impeccable shot${suffix && ' --full'}) failed with exit ${r.code}: ${r.stderr.trim() || 'no message'}`);
      continue;
    }
    const expected = [DESKTOP, PHONE].map((v) => join(dir, `${v}${suffix}.png`));
    const missing = expected.filter((p) => !existsSync(p));
    if (missing.length) errors.push(`screenshot step reported success but did not write: ${missing.join(', ')}`);
    paths.push(...expected.filter((p) => existsSync(p)));
  }
  return paths;
}

// Returns the raw findings array, or null after pushing an error.
function scan(impeccable, label, target, viewport, errors) {
  const args = ['detect', '--json', ...(viewport ? ['--viewport', viewport] : []), target];
  const r = runImpeccable(impeccable.launcher, args, { timeoutMs: DETECT_TIMEOUT_MS });
  if (r.code !== 0 && r.code !== 2) {
    errors.push(`${label} scan could not run (exit ${r.code}): ${r.stderr.trim() || 'no message'}`);
    return null;
  }
  let parsed;
  try { parsed = JSON.parse(r.stdout); } catch (e) {
    errors.push(`${label} scan: could not parse detector output as JSON (${e.message})`);
    return null;
  }
  if (!Array.isArray(parsed)) {
    errors.push(`${label} scan: detector output is not a JSON array`);
    return null;
  }
  const bad = parsed.findIndex((f) => !isFinding(f));
  if (bad !== -1) {
    errors.push(`${label} scan: detector output item ${bad} is malformed (needs a rule id and a severity of error, warning or advisory)`);
    return null;
  }
  if (r.code === 2 && !parsed.some(isPrimary)) {
    errors.push(`${label} scan: detector exited 2 but reported no primary findings`);
    return null;
  }
  return parsed;
}

const SEVERITIES = ['error', 'warning', 'advisory'];
const isFinding = (f) => f !== null && typeof f === 'object' && typeof f.antipattern === 'string' && SEVERITIES.includes(f.severity);
const isAdvisory = (f) => f.advisory === true || f.severity === 'advisory';
const isPrimary = (f) => !isAdvisory(f);

function mergeFindings(runs) {
  const byKey = new Map();
  for (const { label, findings } of runs) {
    for (const f of findings) {
      const key = JSON.stringify([f.antipattern, f.snippet, f.selector ?? null]);
      const existing = byKey.get(key);
      if (existing) {
        existing.scans.push(label);
        continue;
      }
      byKey.set(key, {
        rule: f.antipattern, name: f.name, severity: f.severity, description: f.description,
        snippet: f.snippet, selector: f.selector ?? null, line: f.line ?? 0, scans: [label],
        advisory: isAdvisory(f),
      });
    }
  }
  return [...byKey.values()];
}

export function runCheck(pageArg, { cwd = process.cwd(), env = process.env } = {}) {
  const page = resolve(pageArg);
  if (!existsSync(page) || !statSync(page).isFile()) {
    // Drop any earlier result so a stale pass cannot outlive the page.
    rmSync(join(dirname(page), 'checks', `${basename(page, extname(page))}.json`), { force: true });
    return { fatal: `page not found: ${page}` };
  }
  const dir = dirname(page);
  const name = basename(page, extname(page));
  const errors = [];
  const impeccable = findImpeccable({ cwd, env });
  let screenshots = [];
  const runs = [];
  if (!impeccable) {
    errors.push('impeccable skill not found; install it with "npx impeccable install"');
  } else {
    screenshots = takeShots(impeccable, page, join(dir, 'shots', name), errors);
    const url = pathToFileURL(page).href;
    const plan = [['static', page, null], [`rendered-${DESKTOP}`, url, DESKTOP], [`rendered-${PHONE}`, url, PHONE]];
    for (const [label, target, viewport] of plan) {
      const findings = scan(impeccable, label, target, viewport, errors);
      if (findings) runs.push({ label, findings });
    }
  }
  const merged = mergeFindings(runs);
  const strip = ({ advisory, ...rest }) => rest;
  const findings = merged.filter((f) => !f.advisory).map(strip);
  const out = {
    page, pass: findings.length === 0 && errors.length === 0, screenshots, findings,
    advisories: merged.filter((f) => f.advisory).map(strip), errors,
    impeccableVersion: impeccable?.version ?? null, checkedAt: new Date().toISOString(),
  };
  mkdirSync(join(dir, 'checks'), { recursive: true });
  writeFileSync(join(dir, 'checks', `${name}.json`), JSON.stringify(out, null, 2));
  return { out };
}

function formatHuman(out) {
  const lines = [`${out.pass ? 'PASS' : 'FAIL'} ${out.page}`,
    `${out.findings.length} primary finding(s), ${out.advisories.length} advisory, ${out.errors.length} error(s)`];
  for (const f of out.findings) {
    lines.push(`  [${f.severity}] ${f.rule}${f.selector ? ` ${f.selector}` : ''}: ${f.snippet} (${f.scans.join(', ')})`);
  }
  for (const e of out.errors) lines.push(`  error: ${e}`);
  return lines.join('\n');
}

function main(argv) {
  const json = argv.includes('--json');
  const pageArg = argv.find((a) => !a.startsWith('--'));
  if (!pageArg) {
    process.stderr.write('usage: node check.mjs <page.html> [--json]\n');
    return 1;
  }
  const { out, fatal } = runCheck(pageArg);
  if (fatal) {
    process.stderr.write(`check: ${fatal}\n`);
    return 1;
  }
  process.stdout.write((json ? JSON.stringify(out, null, 2) : formatHuman(out)) + '\n');
  if (out.errors.length) return 1;
  return out.findings.length ? 2 : 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
