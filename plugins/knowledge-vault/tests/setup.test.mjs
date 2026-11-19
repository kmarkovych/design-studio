import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sandbox, git, run, write, commit, bare, clone, readJson, codeRepo, addConfigVault, SCRIPTS } from './helpers.mjs';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function templates(sb) {
  const dir = join(sb.root, 'templates');
  write(dir, 'AGENTS.md', '# {{product}}\n\nCreated {{date}}.\n');
  write(dir, 'CLAUDE.md', '@AGENTS.md\nRead AGENTS.md first.\n');
  write(dir, '90-Мета/Схема-бази.md', '---\nupdated: {{date}}\n---\n# Схема {{product}}\n');
  write(dir, '90-Мета/Шаблони/Фіча.md', '---\ntype: feature\n---\n');
  write(dir, '00-Вхідні/.gitkeep', '');
  write(dir, 'data.json', '{"keep":"{{product}}"}\n');
  return dir;
}

const initVault = (sb, args = []) => run(sb, 'setup.mjs', ['init', join(sb.root, 'Demo-vault'), '--product', 'Demo', ...args], { env: { KNOWLEDGE_VAULT_TEMPLATES: templates(sb) } });
const config = (sb) => readJson(join(sb.kv, 'config.json'));

test('init scaffolds the templates, the registry and the git files, makes one commit and pushes nothing', () => {
  const sb = sandbox();
  const r = initVault(sb);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const v = join(sb.root, 'Demo-vault');
  assert.equal(readFileSync(join(v, 'AGENTS.md'), 'utf8'), `# Demo\n\nCreated ${today()}.\n`);
  assert.match(readFileSync(join(v, '90-Мета/Схема-бази.md'), 'utf8'), /Схема Demo/);
  assert.equal(readFileSync(join(v, 'data.json'), 'utf8'), '{"keep":"{{product}}"}\n', 'only .md files get placeholders');
  assert.ok(existsSync(join(v, '90-Мета/Шаблони/Фіча.md')));
  assert.ok(existsSync(join(v, '00-Вхідні/.gitkeep')));
  const reg = readJson(join(v, '.knowledge-vault.json'));
  assert.equal(reg.product, 'Demo');
  assert.equal(reg.language, 'uk');
  assert.deepEqual(reg.codeRepos, []);
  assert.ok(reg.sections.changeLog);
  assert.match(readFileSync(join(v, '.gitattributes'), 'utf8'), /\*\.md text eol=lf/);
  assert.match(readFileSync(join(v, '.gitattributes'), 'utf8'), new RegExp(`${reg.sections.changeLog}/\\*\\.md merge=union`));
  assert.match(readFileSync(join(v, '.gitignore'), 'utf8'), /\.obsidian\/cache/);
  assert.deepEqual(readJson(join(v, '.obsidian/app.json')), { newLinkFormat: 'shortest', useMarkdownLinks: false, alwaysUpdateLinks: true });
  assert.equal(git(sb, v, ['rev-list', '--count', 'HEAD']), '1');
  assert.equal(git(sb, v, ['status', '--porcelain']), '');
  assert.equal(git(sb, v, ['remote']), '');
  assert.deepEqual(config(sb).vaults, [{ remote: null, path: v, sync: 'plugin' }]);
});

test('init with --remote adds origin but never pushes', () => {
  const sb = sandbox();
  const remote = bare(sb, 'demo-vault');
  assert.equal(initVault(sb, ['--remote', remote, '--language', 'en']).code, 0);
  const v = join(sb.root, 'Demo-vault');
  assert.equal(git(sb, v, ['remote', 'get-url', 'origin']), remote);
  assert.equal(git(sb, remote, ['for-each-ref']), '');
  assert.equal(readJson(join(v, '.knowledge-vault.json')).language, 'en');
  assert.equal(config(sb).vaults[0].remote, remote);
});

test('init refuses a folder that is not empty, and a missing templates folder', () => {
  const sb = sandbox();
  write(sb.root, 'Demo-vault/keep.md', 'x');
  assert.equal(initVault(sb).code, 1);
  const missing = run(sb, 'setup.mjs', ['init', join(sb.root, 'other'), '--product', 'X'], { env: { KNOWLEDGE_VAULT_TEMPLATES: join(sb.root, 'none') } });
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /templates/);
});

for (const language of ['uk', 'en']) {
  test(`init --language ${language} with the shipped templates: every registry section exists and the first push is clean`, () => {
    const sb = sandbox();
    const remote = bare(sb, 'shop-vault');
    const v = join(sb.root, 'Shop');
    const r = run(sb, 'setup.mjs', ['init', v, '--product', 'Shop', '--language', language, '--remote', remote]);
    assert.equal(r.code, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /sync\.mjs/);
    const reg = readJson(join(v, '.knowledge-vault.json'));
    for (const [key, path] of Object.entries(reg.sections)) assert.ok(existsSync(join(v, path)), `${key}: ${path} is missing`);
    assert.ok(!existsSync(join(v, 'uk')) && !existsSync(join(v, 'en')), 'only one language was copied');
    assert.match(readFileSync(join(v, '.gitattributes'), 'utf8'), new RegExp(`^${reg.sections.changeLog}/\\*\\.md merge=union$`, 'm'));
    const push = run(sb, 'sync.mjs', [v, 'push']);
    assert.equal(push.code, 0, push.stderr + push.stdout);
  });
}

test('init runs from the stable copy, which install-bin gives the templates too', () => {
  const sb = sandbox();
  assert.equal(run(sb, 'setup.mjs', ['install-bin']).code, 0);
  const r = spawnSync(process.execPath, [join(sb.kv, 'bin', 'setup.mjs'), 'init', join(sb.root, 'Shop'), '--product', 'Shop'], { env: sb.env, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(sb.root, 'Shop', 'AGENTS.md')));
});

test('register adds a cloned vault to this machine; with --external link keeps it external', () => {
  const sb = sandbox();
  const remote = bare(sb, 'demo-vault');
  initVault(sb, ['--remote', remote]);
  const v = join(sb.root, 'Demo-vault');
  git(sb, v, ['push', '-q', 'origin', 'main']);
  const clone2 = clone(sb, remote, 'machine-2/Demo');
  const home2 = { KNOWLEDGE_VAULT_HOME: join(sb.root, 'kvhome2') };
  const r = run(sb, 'setup.mjs', ['register', clone2, '--external'], { env: home2 });
  assert.equal(r.code, 0, r.stderr + r.stdout);
  const code = codeRepo(sb);
  assert.equal(run(sb, 'setup.mjs', ['link', clone2, code.dir, '--id', 'app'], { env: home2 }).code, 0);
  assert.deepEqual(readJson(join(sb.root, 'kvhome2', 'config.json')).vaults, [{ remote, path: clone2, sync: 'external' }]);
  assert.equal(run(sb, 'setup.mjs', ['register', clone2], { env: home2 }).code, 0);
  assert.equal(readJson(join(sb.root, 'kvhome2', 'config.json')).vaults[0].sync, 'plugin');
  assert.equal(run(sb, 'setup.mjs', ['register', sb.root], { env: home2 }).code, 1, 'not a vault');
});

function existingVault(sb) {
  const remote = bare(sb, 'owner-vault');
  const v = clone(sb, remote, 'Owner');
  commit(sb, v, 'CLAUDE.md', '# Owner rules\n', 'initial');
  write(v, 'draft.md', 'uncommitted owner work\n');
  return { remote, v };
}

const SECTIONS = JSON.stringify({ features: '10-Проєкт/Функціональність', featureIndex: '10-Проєкт/Функціональність/Функціональність.md', changeLog: '10-Проєкт/Журнал-змін' });

const quiet = ['-c', 'core.quotepath=false'];
const untracked = (sb, v) => git(sb, v, [...quiet, 'status', '--porcelain', '-uall']).split('\n').sort();

test('adopt writes the registry and the missing hubs only, and registers sync "plugin"', () => {
  const sb = sandbox();
  const { remote, v } = existingVault(sb);
  const r = run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', '--language', 'uk', '--sections', SECTIONS]);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.deepEqual(untracked(sb, v), ['?? .knowledge-vault.json', '?? 10-Проєкт/Журнал-змін/Журнал-змін.md', '?? 10-Проєкт/Функціональність/Функціональність.md', '?? draft.md']);
  assert.equal(git(sb, v, ['rev-list', '--count', 'HEAD']), '1');
  const reg = readJson(join(v, '.knowledge-vault.json'));
  assert.deepEqual(reg.sections, JSON.parse(SECTIONS));
  assert.equal(reg.product, 'Owner');
  assert.deepEqual(config(sb).vaults, [{ remote, path: v, sync: 'plugin' }]);
});

const FULL = { architecture: '10-Проєкт/Архітектура', features: '10-Проєкт/Фічі-зараз', featureIndex: '10-Проєкт/Фічі-зараз/Функціональність.md',
  decisions: '10-Проєкт/Рішення', glossary: '10-Проєкт/Глосарій.md', changeLog: '10-Проєкт/Журнал-змін' };

test('adopt creates each missing mapped folder and hub as an agent hub in the vault language, and never overwrites', () => {
  const sb = sandbox();
  const { v } = existingVault(sb);
  write(v, '10-Проєкт/Архітектура/Архітектура.md', 'owner hub\n');
  write(v, '10-Проєкт/Рішення/2026-01-01-Owner.md', '# Owner decision\n');
  git(sb, v, ['add', '--', '10-Проєкт']);
  git(sb, v, ['commit', '-q', '-m', 'owner notes']);
  const r = run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', '--language', 'uk', '--sections', JSON.stringify(FULL)]);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.equal(readFileSync(join(v, '10-Проєкт/Архітектура/Архітектура.md'), 'utf8'), 'owner hub\n');
  const created = ['10-Проєкт/Журнал-змін/Журнал-змін.md', '10-Проєкт/Рішення/Реєстр-рішень.md', '10-Проєкт/Фічі-зараз/Функціональність.md'];
  assert.deepEqual(untracked(sb, v), ['?? .knowledge-vault.json', ...created.map((f) => `?? ${f}`), '?? draft.md'].sort());
  for (const f of created) {
    const text = readFileSync(join(v, f), 'utf8');
    assert.match(text, /^---\nagent: knowledge-vault\ntype: hub\n/, f);
    assert.match(text, /Owner/, f);
    assert.doesNotMatch(text, /\{\{|vault створено|\[\[Домашня\]\]|\[\[Глосарій\]\]/, f);
    assert.ok(r.stdout.includes(f), r.stdout);
  }
  assert.match(readFileSync(join(v, FULL.featureIndex), 'utf8'), /\nПов'язане: \[\[Архітектура\]\] · \[\[Реєстр-рішень\]\] · \[\[Журнал-змін\]\]\n$/);
  assert.ok(!existsSync(join(v, FULL.glossary)), 'the glossary is a note, not a hub: the first pass that needs it creates it');
});

test('adopt creates the folder of a feature index that sits outside every mapped folder', () => {
  const sb = sandbox();
  const { v } = existingVault(sb);
  const featureIndex = '10-Проєкт/Індекс/Функціональність.md';
  const r = run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', '--language', 'uk', '--sections', JSON.stringify({ featureIndex })]);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.match(readFileSync(join(v, featureIndex), 'utf8'), /^---\nagent: knowledge-vault\ntype: hub\n/);
});

test('adopt --external registers sync "external"; bad sections and a missing --language are rejected', () => {
  const sb = sandbox();
  const { v } = existingVault(sb);
  const uk = ['--language', 'uk'];
  assert.equal(run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', ...uk, '--sections', '{"nope":"x"}']).code, 2);
  assert.equal(run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', ...uk, '--sections', '{"features":"../out"}']).code, 2);
  assert.equal(run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', ...uk, '--sections', 'not json']).code, 2);
  const noLanguage = run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', '--sections', SECTIONS]);
  assert.equal(noLanguage.code, 2);
  assert.match(noLanguage.stderr, /--language/);
  assert.ok(!existsSync(join(v, '.knowledge-vault.json')));
  assert.equal(run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', ...uk, '--sections', SECTIONS, '--external']).code, 0);
  assert.equal(config(sb).vaults[0].sync, 'external');
  assert.equal(run(sb, 'setup.mjs', ['adopt', v, '--product', 'Owner', ...uk, '--sections', SECTIONS]).code, 1, 'already adopted');
});

test('link writes the link file without committing in the code repository, and updates registry and config', () => {
  const sb = sandbox();
  const remote = bare(sb, 'demo-vault');
  initVault(sb, ['--remote', remote]);
  const v = join(sb.root, 'Demo-vault');
  const code = codeRepo(sb);
  const head = git(sb, code.dir, ['rev-parse', 'HEAD']);
  const r = run(sb, 'setup.mjs', ['link', v, code.dir, '--id', 'web-app']);
  assert.equal(r.code, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /commit/i);
  assert.deepEqual(readJson(join(code.dir, '.knowledge-vault-link.json')), { version: 1, product: 'Demo', vaultRemote: remote, repoId: 'web-app' });
  assert.equal(git(sb, code.dir, ['status', '--porcelain']), '?? .knowledge-vault-link.json');
  assert.equal(git(sb, code.dir, ['rev-parse', 'HEAD']), head);
  const entry = readJson(join(v, '.knowledge-vault.json')).codeRepos[0];
  assert.deepEqual(entry, { id: 'web-app', remote: code.remote, mainBranch: 'main', describedCommit: null, describedAt: null });
  assert.deepEqual(config(sb).codeRepos, [{ remote: code.remote, path: code.dir }]);
  assert.equal(run(sb, 'setup.mjs', ['link', v, code.dir, '--id', 'Bad Id']).code, 2);
  const located = JSON.parse(run(sb, 'registry.mjs', ['locate'], { cwd: code.dir }).stdout);
  assert.equal(located.vault, v);
});

test('link refuses a vault without a remote', () => {
  const sb = sandbox();
  initVault(sb);
  const code = codeRepo(sb);
  const r = run(sb, 'setup.mjs', ['link', join(sb.root, 'Demo-vault'), code.dir, '--id', 'app']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /remote/);
  assert.ok(!existsSync(join(code.dir, '.knowledge-vault-link.json')));
});

test('install-bin copies the scripts into a stable folder that runs on its own', () => {
  const sb = sandbox();
  const r = run(sb, 'setup.mjs', ['install-bin']);
  assert.equal(r.code, 0, r.stderr);
  const expected = readdirSync(SCRIPTS).filter((f) => f.endsWith('.mjs')).sort();
  assert.deepEqual(readdirSync(join(sb.kv, 'bin')).sort(), expected);
  const copied = spawnSync(process.execPath, [join(sb.kv, 'bin', 'registry.mjs'), 'show', sb.root], { env: sb.env, encoding: 'utf8' });
  assert.equal(copied.status, 1, 'the copy loads its own lib.mjs and reports the missing registry');
  assert.match(copied.stderr, /\.knowledge-vault\.json/);
});

test('schedule without --apply prints the job and writes nothing', () => {
  const sb = sandbox();
  addConfigVault(sb, { remote: null, path: join(sb.root, 'Shop'), sync: 'plugin' });
  const r = run(sb, 'setup.mjs', ['schedule', '--interval-minutes', '5']);
  assert.equal(r.code, 0, r.stderr);
  if (process.platform === 'darwin') {
    assert.match(r.stdout, /<plist/);
    assert.match(r.stdout, /com\.knowledge-vault\.sync/);
    assert.match(r.stdout, /<integer>300<\/integer>/);
    assert.match(r.stdout, /bin\/sync\.mjs<\/string>\s*<string>--all<\/string>\s*<string>--hook<\/string>/);
    assert.match(r.stdout, /sync\.log/);
  } else {
    assert.match(r.stdout, /\*\/5 \* \* \* \*/);
  }
  assert.ok(!existsSync(join(sb.home, 'Library')));
  assert.ok(!existsSync(join(sb.kv, 'bin')));
  assert.equal(run(sb, 'setup.mjs', ['schedule', '--interval-minutes', '0']).code, 2);
});

test('schedule says there is nothing to schedule when no vault on this machine has sync "plugin"', () => {
  const sb = sandbox();
  for (const vaults of [[], [{ remote: null, path: join(sb.root, 'Ext'), sync: 'external' }]]) {
    if (vaults.length) addConfigVault(sb, vaults[0]);
    const r = run(sb, 'setup.mjs', ['schedule']);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /nothing to schedule/i);
    assert.doesNotMatch(r.stdout, /<plist|\* \* \*/);
  }
  assert.ok(!existsSync(join(sb.home, 'Library')));
});

test('wrong arguments print a usage line and exit 2', () => {
  const sb = sandbox();
  for (const args of [[], ['bogus'], ['init'], ['init', '/x'], ['adopt', '/x', '--product', 'P'], ['link', '/x', '/y'], ['register'], ['init', '/x', '--product', 'P', '--language', 'de']]) {
    const r = run(sb, 'setup.mjs', args);
    assert.equal(r.code, 2, args.join(' '));
    assert.match(r.stderr, /usage: setup\.mjs/);
  }
});
