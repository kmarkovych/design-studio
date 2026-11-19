import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { sandbox, run, write, writeJson } from './helpers.mjs';

const preflight = (sb) => {
  const r = run(sb, 'setup.mjs', ['preflight', '--json']);
  return { ...r, json: JSON.parse(r.stdout) };
};
const check = (json, id) => json.checks.find((c) => c.id === id);

const BLOCKING_HOOK = (exempt) => ({
  hooks: {
    PreToolUse: [{
      matcher: 'Write',
      hooks: [{ type: 'command', command: `node -e "if(/\\.md$/.test(p)${exempt ? "&&!fs.existsSync('.obsidian')" : ''}){console.error('[Hook] BLOCKED: Unnecessary documentation file creation');process.exit(2)}"` }],
      description: 'Block creation of random .md files - keeps docs consolidated',
    }],
  },
});

test('a bare machine: node and git pass, obsidian-skills warns with the install command', () => {
  const sb = sandbox();
  const r = preflight(sb);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.ok, true);
  assert.equal(check(r.json, 'node').status, 'ok');
  assert.equal(check(r.json, 'git').status, 'ok');
  const skills = check(r.json, 'obsidian-skills');
  assert.equal(skills.status, 'warn');
  assert.match(skills.fix, /\/plugin marketplace add obsidianmd\/obsidian-skills/);
  assert.match(skills.fix, /\/plugin install obsidian@obsidian-skills/);
  for (const id of ['gh', 'glab', 'obsidian-app', 'obsidian-cli']) assert.equal(check(r.json, id).status, 'info', id);
  assert.equal(check(r.json, 'ecc-doc-hook').status, 'ok');
});

test('obsidian-skills is found in the plugin cache or in ~/.agents/skills', () => {
  const sb = sandbox();
  write(join(sb.home, '.claude/plugins/cache/obsidian-skills/obsidian/1.0.0/skills/obsidian-markdown'), 'SKILL.md', '---\nname: obsidian-markdown\n---\n');
  assert.equal(check(preflight(sb).json, 'obsidian-skills').status, 'ok');
  const sb2 = sandbox();
  write(join(sb2.home, '.agents/skills/obsidian-markdown'), 'SKILL.md', '---\nname: obsidian-markdown\n---\n');
  assert.equal(check(preflight(sb2).json, 'obsidian-skills').status, 'ok');
});

test('a documentation-blocking Write hook without a .obsidian exemption warns', () => {
  const sb = sandbox();
  writeJson(join(sb.home, '.claude/plugins/cache/everything-claude-code/everything-claude-code/1.4.1/hooks/hooks.json'), BLOCKING_HOOK(false));
  const c = check(preflight(sb).json, 'ecc-doc-hook');
  assert.equal(c.status, 'warn');
  assert.match(c.detail, /hooks\.json/);
  assert.match(c.fix, /\.obsidian/);
  const sb2 = sandbox();
  writeJson(join(sb2.home, '.claude/plugins/cache/everything-claude-code/everything-claude-code/1.4.1/hooks/hooks.json'), BLOCKING_HOOK(true));
  assert.equal(check(preflight(sb2).json, 'ecc-doc-hook').status, 'ok');
  const sb3 = sandbox();
  writeJson(join(sb3.home, '.claude/settings.json'), BLOCKING_HOOK(false));
  assert.equal(check(preflight(sb3).json, 'ecc-doc-hook').status, 'warn');
});

test('the marketplace copy of the hook is checked too, each copy is reported, and a reload is always required', () => {
  const sb = sandbox();
  const cache = join(sb.home, '.claude/plugins/cache/everything-claude-code/everything-claude-code/1.4.1/hooks/hooks.json');
  const market = join(sb.home, '.claude/plugins/marketplaces/everything-claude-code/hooks/hooks.json');
  writeJson(cache, BLOCKING_HOOK(true));
  writeJson(market, BLOCKING_HOOK(false));
  const c = check(preflight(sb).json, 'ecc-doc-hook');
  assert.equal(c.status, 'warn');
  assert.ok(c.detail.includes(market) && c.detail.includes(cache), c.detail);
  assert.match(c.detail, /\/reload-plugins/);
  const sb2 = sandbox();
  const cache2 = join(sb2.home, '.claude/plugins/cache/everything-claude-code/everything-claude-code/1.4.1/hooks/hooks.json');
  writeJson(cache2, BLOCKING_HOOK(true));
  const ok = check(preflight(sb2).json, 'ecc-doc-hook');
  assert.equal(ok.status, 'ok');
  assert.ok(ok.detail.includes(cache2), ok.detail);
  assert.match(ok.detail, /\/reload-plugins/);
  assert.match(check(preflight(sandbox()).json, 'ecc-doc-hook').detail, /\/reload-plugins/);
});

test('preflight prints readable lines without --json', () => {
  const sb = sandbox();
  const r = run(sb, 'setup.mjs', ['preflight']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /\[ok\] +node/);
  assert.match(r.stdout, /\[warn\] +obsidian-skills/);
});
