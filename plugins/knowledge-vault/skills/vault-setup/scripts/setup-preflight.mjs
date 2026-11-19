// Preflight checks for vault-setup (run through "setup.mjs preflight"). Reads only; changes nothing.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { which } from './lib.mjs';

const MIN_NODE_MAJOR = 18;
const MAX_WALK_DEPTH = 7;
const OBSIDIAN_SKILLS_INSTALL = '/plugin marketplace add obsidianmd/obsidian-skills, then /plugin install obsidian@obsidian-skills';
const DOC_BLOCK = /documentation file creation|random \.md files/i;

function walk(dir, depth, visit) {
  if (depth > MAX_WALK_DEPTH) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    visit(path, entry);
    if (entry.isDirectory()) walk(path, depth + 1, visit);
  }
}

function nodeCheck() {
  const major = Number(process.versions.node.split('.')[0]);
  return major >= MIN_NODE_MAJOR
    ? { id: 'node', status: 'ok', detail: `node ${process.versions.node}` }
    : { id: 'node', status: 'fail', detail: `node ${process.versions.node} is older than ${MIN_NODE_MAJOR}`, fix: 'Install Node 18 or newer (nodejs.org, or brew install node)' };
}

function gitCheck() {
  const r = spawnSync('git', ['--version'], { encoding: 'utf8' });
  return r.status === 0
    ? { id: 'git', status: 'ok', detail: r.stdout.trim() }
    : { id: 'git', status: 'fail', detail: 'git was not found', fix: 'Install git (macOS: xcode-select --install or brew install git; Linux: your package manager)' };
}

function obsidianSkillsCheck(config, home) {
  const found = [];
  const isSkill = (path, entry) => entry.isDirectory() && entry.name.startsWith('obsidian') && existsSync(join(path, 'SKILL.md'));
  walk(join(config, 'plugins', 'cache'), 1, (path, entry) => { if (isSkill(path, entry)) found.push(path); });
  for (const root of [join(home, '.agents', 'skills'), join(config, 'skills')]) {
    walk(root, MAX_WALK_DEPTH, (path, entry) => { if (isSkill(path, entry)) found.push(path); });
  }
  if (found.length) return { id: 'obsidian-skills', status: 'ok', detail: `found ${found[0]}` };
  return {
    id: 'obsidian-skills', status: 'warn',
    detail: 'obsidianmd/obsidian-skills (Obsidian syntax knowledge for the agent) was not found in the plugin cache or ~/.agents/skills; '
      + 'it may be installed somewhere this check cannot see',
    fix: `In Claude Code: ${OBSIDIAN_SKILLS_INSTALL}`,
  };
}

function toolInfo(id, command, why) {
  const path = which(command);
  return { id, status: 'info', detail: path ? `found ${path}` : `not found; ${why}` };
}

function obsidianAppCheck(home, platform) {
  if (platform !== 'darwin') return { id: 'obsidian-app', status: 'info', detail: 'not checked on this platform; the Obsidian app is optional' };
  const app = ['/Applications/Obsidian.app', join(home, 'Applications', 'Obsidian.app')].find((p) => existsSync(p));
  return { id: 'obsidian-app', status: 'info', detail: app ? `found ${app}` : 'not found; optional, for reading the vault' };
}

// The PreToolUse Write hooks in a hooks.json or settings.json that block new .md files, as JSON text.
function docBlocks(file) {
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { return []; }
  const blocks = data?.hooks?.PreToolUse;
  if (!Array.isArray(blocks)) return [];
  return blocks.filter((b) => /Write|\*/.test(String(b.matcher ?? '*'))).map((b) => JSON.stringify(b)).filter((text) => DOC_BLOCK.test(text));
}

const RELOAD = 'Hook edits take effect only after /reload-plugins or a new session: a session started before the edit still runs the old hook';

// The cache copy is the installed one; the marketplace copy is what a plugin update reinstalls. Each is reported.
function eccHookCheck(config) {
  const files = [join(config, 'settings.json')];
  for (const root of ['cache', 'marketplaces']) {
    walk(join(config, 'plugins', root), 1, (path, entry) => { if (entry.isFile() && entry.name === 'hooks.json') files.push(path); });
  }
  const found = files.map((file) => ({ file, blocks: docBlocks(file) })).filter((x) => x.blocks.length);
  const missing = found.filter((x) => x.blocks.some((text) => !text.includes('.obsidian'))).map((x) => x.file);
  const seen = found.map((x) => `${x.file}: ${missing.includes(x.file) ? 'NO .obsidian exemption' : 'exempts vaults'}`);
  if (!missing.length) {
    return { id: 'ecc-doc-hook', status: 'ok', detail: `${seen.length ? seen.join('; ') : 'no Write hook that refuses vault notes was found'}. ${RELOAD}` };
  }
  return {
    id: 'ecc-doc-hook', status: 'warn',
    detail: `a PreToolUse Write hook that blocks new .md files ("Block creation of random .md files", from everything-claude-code) will refuse writes into vaults. ${seen.join('; ')}. ${RELOAD}`,
    fix: 'In every copy marked NO, edit that hook\'s command so it allows a path when one of its parent folders contains .obsidian (walk up from the file path), or disable the hook; '
      + 'then run /reload-plugins or start a new session. A plugin update may restore the original hooks.json, so check again after updating',
  };
}

export function preflight({ env = process.env, home = homedir(), platform = process.platform } = {}) {
  const config = env.CLAUDE_CONFIG_DIR || join(home, '.claude');
  const checks = [
    nodeCheck(),
    gitCheck(),
    obsidianSkillsCheck(config, home),
    toolInfo('gh', 'gh', 'needed only to create a vault repository on GitHub (gh repo create --private); an existing remote URL works without it'),
    toolInfo('glab', 'glab', 'needed only to create a vault repository on GitLab (glab repo create --private); an existing remote URL works without it'),
    obsidianAppCheck(home, platform),
    toolInfo('obsidian-cli', 'obsidian', 'the Obsidian CLI is optional; it is used only to check for unresolved links and orphans, and works only while the app runs'),
    eccHookCheck(config),
  ];
  return { ok: !checks.some((c) => c.status === 'fail'), checks };
}

export function formatPreflight(result) {
  const lines = result.checks.map((c) => `[${c.status}] ${c.id.padEnd(16)} ${c.detail}${c.fix ? `\n        fix: ${c.fix}` : ''}`);
  lines.push(result.ok ? 'preflight: ready' : 'preflight: fix the failed checks above first');
  return `${lines.join('\n')}\n`;
}
