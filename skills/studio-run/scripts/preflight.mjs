// node preflight.mjs [--json] [--project <dir>]
import { mkdtempSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { findImpeccable, findSkill, compareVersions, runImpeccable, isMain, MIN_IMPECCABLE_VERSION } from './lib.mjs';

const MIN_NODE_MAJOR = 18;
const PROBE_TIMEOUT_MS = 60000;
const WARN_NOTE = 'This script may simply not see skills installed in a way it does not know; also consult your own skill list.';
const PROBE_PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>probe</title></head><body><p>probe</p></body></html>';

const result = (id, status, detail, fix = '') => ({ id, status, detail, fix });

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  return major >= MIN_NODE_MAJOR
    ? result('node', 'ok', `Node ${process.versions.node}`)
    : result('node', 'fail', `Node ${process.versions.node} is too old`, `Install Node ${MIN_NODE_MAJOR} or newer.`);
}

function checkCapture(found, cwd) {
  const fix = 'Install Google Chrome (or another Chromium-family browser), or set IMPECCABLE_BROWSER to its executable.';
  const dir = mkdtempSync(join(tmpdir(), 'studio-probe-'));
  try {
    const page = join(dir, 'probe.html');
    writeFileSync(page, PROBE_PAGE);
    const r = runImpeccable(found.launcher, ['shot', page, '--out', dir], { cwd: dir, timeoutMs: PROBE_TIMEOUT_MS });
    if (r.code !== 0) return result('capture', 'fail', `shot exited ${r.code}: ${r.stderr.trim() || 'no message'}`, fix);
    const missing = ['1440x900.png', '390x844.png'].filter((f) => !existsSync(join(dir, f)));
    if (missing.length) return result('capture', 'fail', `shot did not write ${missing.join(', ')}`, fix);
    return result('capture', 'ok', 'headless screenshots work (1440x900 and 390x844)');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checkSkill(name, ctx, fix) {
  const dir = findSkill(name, ctx);
  return dir
    ? result(name, 'ok', dir)
    : result(name, 'warn', `skill "${name}" not found. ${WARN_NOTE}`, fix);
}

export function runPreflight({ cwd = process.cwd(), env = process.env, home = homedir(), platform = process.platform } = {}) {
  const checks = [checkNode()];
  const found = findImpeccable({ cwd, env, home, platform });
  const skipped = (id, why) => result(id, 'skipped', `skipped: ${why}`);

  checks.push(found
    ? result('impeccable', 'ok', found.skillDir)
    : result('impeccable', 'fail', 'impeccable skill not found', 'npx impeccable install'));

  if (!found) {
    checks.push(skipped('impeccable-version', 'impeccable not found'), skipped('capture', 'impeccable not found'));
  } else {
    const okVersion = found.version && compareVersions(found.version, MIN_IMPECCABLE_VERSION) >= 0;
    checks.push(okVersion
      ? result('impeccable-version', 'ok', `${found.version} (>= ${MIN_IMPECCABLE_VERSION})`)
      : result('impeccable-version', 'fail', `version ${found.version ?? 'unreadable'}, need >= ${MIN_IMPECCABLE_VERSION}`, 'npx impeccable update'));
    checks.push(okVersion ? checkCapture(found, cwd) : skipped('capture', 'impeccable version check failed'));
  }

  const ctx = { cwd, env, home };
  checks.push(checkSkill('grilling', ctx,
    'Claude Code: /plugin install mattpocock-skills@claude-plugins-official. Other agents: npx skills add mattpocock/skills'));
  checks.push(checkSkill('frontend-design', ctx,
    'Claude Code: /plugin install frontend-design@claude-plugins-official. Other agents: npx skills add anthropics/skills --skill frontend-design'));
  return { ok: !checks.some((c) => c.status === 'fail'), checks, impeccable: found };
}

const LABELS = { ok: 'ok  ', warn: 'warn', fail: 'FAIL', skipped: 'skip' };

function formatHuman(report) {
  return report.checks.map((c) => {
    const fix = c.fix && c.status !== 'ok' ? `\n      fix: ${c.fix}` : '';
    return `${LABELS[c.status]} ${c.id}: ${c.detail}${fix}`;
  }).join('\n');
}

const isDirectory = (p) => existsSync(p) && statSync(p).isDirectory();

function main(argv) {
  const json = argv.includes('--json');
  const i = argv.indexOf('--project');
  if (i !== -1 && !argv[i + 1]) {
    process.stderr.write('preflight: --project needs a directory\n');
    return 1;
  }
  const cwd = i === -1 ? process.cwd() : resolve(argv[i + 1]);
  if (!isDirectory(cwd)) {
    process.stderr.write(`preflight: --project ${cwd} does not exist or is not a directory\n`);
    return 1;
  }
  const report = runPreflight({ cwd });
  process.stdout.write((json ? JSON.stringify(report, null, 2) : formatHuman(report)) + '\n');
  return report.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
