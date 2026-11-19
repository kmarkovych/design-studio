#!/usr/bin/env node
// vault-setup: preflight, create (init) or adopt a vault, link a code repository, install the stable script copy and the schedule.
// In a code repository it only writes the link file; it never commits, pulls or pushes there.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LINK_FILE, REGISTRY_FILE, SECTION_KEYS, UsageError, git, gitOk, identityArgs, isMain, kvHome, loadConfig, loadRegistry,
  localDate, originUrl, parseArgs, readJson, realPath, revParse, runCli, sameRemote, saveConfig, saveRegistry, toplevel, writeJson,
} from './lib.mjs';
import { formatPreflight, preflight } from './setup-preflight.mjs';
import { parseInterval, schedule, unschedule } from './setup-schedule.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const USAGE = [
  'setup.mjs preflight [--json]',
  '  | init <vault-path> --product <name> [--language uk|en] [--remote <url>]',
  '  | adopt <vault-path> --product <name> --sections <json> [--external] [--language uk|en]',
  '  | link <vault-path> <code-repo-path> --id <id> [--branch <name>]',
  '  | register <vault-path> [--external]',
  '  | install-bin | schedule [--apply] [--interval-minutes 15] | unschedule',
].join('\n');

const DEFAULT_SECTIONS = {
  uk: { architecture: '10-Продукт/Архітектура', features: '10-Продукт/Фічі', featureIndex: '10-Продукт/Фічі/Функціональність.md',
    decisions: '10-Продукт/Рішення', glossary: '10-Продукт/Глосарій.md', changeLog: '10-Продукт/Журнал-змін' },
  en: { architecture: '10-Product/Architecture', features: '10-Product/Features', featureIndex: '10-Product/Features/Functionality.md',
    decisions: '10-Product/Decisions', glossary: '10-Product/Glossary.md', changeLog: '10-Product/Change-log' },
};
const KEYS_FOLDER = { uk: 'Ключі/', en: 'Keys/' };

function requireProduct(flags) {
  if (!flags.product || !flags.product.trim()) throw new UsageError('--product <name> is required');
  return flags.product.trim();
}

// adopt requires it: an existing vault's language is a fact to state, not a default to guess.
function requireLanguage(flags, { required = false } = {}) {
  if (required && flags.language === undefined) throw new UsageError('--language uk|en is required: the language the vault is written in');
  const language = flags.language ?? 'uk';
  if (!['uk', 'en'].includes(language)) throw new UsageError('--language must be uk or en');
  return language;
}

function parseSections(text) {
  if (text === undefined) throw new UsageError('--sections <json> is required');
  let sections;
  try { sections = JSON.parse(text); } catch { throw new UsageError('--sections must be JSON, for example {"features":"10-Проєкт/Фічі"}'); }
  if (!sections || typeof sections !== 'object' || Array.isArray(sections) || !Object.keys(sections).length) {
    throw new UsageError(`--sections must map at least one of ${SECTION_KEYS.join(', ')} to a path in the vault`);
  }
  for (const [key, value] of Object.entries(sections)) {
    if (!SECTION_KEYS.includes(key)) throw new UsageError(`unknown section "${key}"; sections are ${SECTION_KEYS.join(', ')}`);
    if (typeof value !== 'string' || !value.trim() || isAbsolute(value) || value.split(/[\\/]/).includes('..')) {
      throw new UsageError(`section ${key} must be a relative path inside the vault, not ${JSON.stringify(value)}`);
    }
  }
  return sections;
}

function upsertVault(home, vault) {
  const config = loadConfig(home);
  const existing = config.vaults.find((v) => v.path === vault.path);
  const entry = { remote: vault.remote ?? existing?.remote ?? null, path: vault.path, sync: vault.sync ?? existing?.sync ?? 'plugin' };
  saveConfig({ ...config, vaults: [...config.vaults.filter((v) => v.path !== vault.path), entry] }, home);
}

function upsertCodeRepo(home, repo) {
  const config = loadConfig(home);
  const others = config.codeRepos.filter((c) => !sameRemote(c.remote, repo.remote) && c.path !== repo.path);
  saveConfig({ ...config, codeRepos: [...others, repo] }, home);
}

// The plugin keeps templates/<language>/ next to scripts/; install-bin copies them next to bin/ the same way.
const TEMPLATES_DIR = join(SCRIPTS_DIR, '..', 'templates');

// The templates folder, or its uk/ or en/ subfolder when it keeps one per language.
function templatesFor(language) {
  const root = process.env.KNOWLEDGE_VAULT_TEMPLATES || TEMPLATES_DIR;
  const perLanguage = join(root, language);
  const dir = existsSync(perLanguage) && statSync(perLanguage).isDirectory() ? perLanguage : root;
  if (!existsSync(dir)) throw new Error(`the templates folder ${dir} does not exist; reinstall the plugin or set KNOWLEDGE_VAULT_TEMPLATES`);
  return dir;
}

const fill = (text, vars) => text.replace(/\{\{(product|date)\}\}/g, (_, key) => vars[key]);

function copyTree(src, dest, vars) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, fill(entry.name, vars));
    if (entry.isDirectory()) {
      mkdirSync(to, { recursive: true });
      copyTree(from, to, vars);
    } else if (entry.name.endsWith('.md')) {
      writeFileSync(to, fill(readFileSync(from, 'utf8'), vars));
    } else {
      copyFileSync(from, to);
    }
  }
}

function writeIfMissing(file, text) {
  if (existsSync(file)) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// The files vault sync depends on; templates may ship their own, which win.
function writeGitFiles(vault, sections, language) {
  writeIfMissing(join(vault, '.gitattributes'), ['# Notes are always LF', '*.md text eol=lf', '',
    '# Append-only change log: when two machines write at once, keep the lines of both', `${sections.changeLog}/*.md merge=union`, ''].join('\n'));
  writeIfMissing(join(vault, '.gitignore'), ['# Secrets never go into git; move them between machines separately', KEYS_FOLDER[language], '',
    '# macOS', '.DS_Store', '._*', '', '# Obsidian: state of one machine', '.obsidian/workspace*.json', '.obsidian/cache', '.trash/', ''].join('\n'));
  writeIfMissing(join(vault, '.obsidian', 'app.json'), `${JSON.stringify({ newLinkFormat: 'shortest', useMarkdownLinks: false, alwaysUpdateLinks: true }, null, 2)}\n`);
}

function initRepo(vault, remote, product) {
  gitOk(vault, ['init', '-q', '-b', 'main']);
  for (const [key, value] of [['core.quotepath', 'false'], ['core.autocrlf', 'false'], ['pull.rebase', 'true']]) gitOk(vault, ['config', key, value]);
  if (remote) gitOk(vault, ['remote', 'add', 'origin', remote]);
  gitOk(vault, ['add', '-A']);
  gitOk(vault, [...identityArgs(vault), 'commit', '-q', '-m', `docs(vault): scaffold the ${product} vault`, '-m', 'Vault-Agent: knowledge-vault']);
}

function init(vaultArg, flags, home) {
  const product = requireProduct(flags);
  const language = requireLanguage(flags);
  const target = resolve(vaultArg);
  if (existsSync(target) && readdirSync(target).length) {
    throw new Error(`${target} already exists and is not empty; choose an empty folder, or adopt an existing vault with setup.mjs adopt`);
  }
  const templates = templatesFor(language);
  mkdirSync(target, { recursive: true });
  const vault = realPath(target);
  copyTree(templates, vault, { product, date: localDate() });
  const shipped = readJson(join(vault, REGISTRY_FILE), null);
  const sections = shipped?.sections ? parseSections(JSON.stringify(shipped.sections)) : DEFAULT_SECTIONS[language];
  writeGitFiles(vault, sections, language);
  saveRegistry(vault, { version: 1, product, language, sections, codeRepos: [] });
  initRepo(vault, flags.remote, product);
  upsertVault(home, { remote: flags.remote ?? null, path: vault, sync: 'plugin' });
  const next = flags.remote ? `Nothing was pushed yet. Push it once with: node "${join(SCRIPTS_DIR, 'sync.mjs')}" "${vault}" push` : 'It has no remote yet: add one with git remote add origin <url> before linking a code repository.';
  process.stdout.write(`Created the ${product} vault at ${vault} (one commit). ${next}\n`);
}

// The hub file of each folder section, as the templates name it; the feature index is the features hub itself.
const HUB_FILES = {
  uk: { architecture: 'Архітектура.md', decisions: 'Реєстр-рішень.md', changeLog: 'Журнал-змін.md' },
  en: { architecture: 'Architecture.md', decisions: 'Decision-register.md', changeLog: 'Change-log.md' },
};
const FOOTER = { uk: "Пов'язане:", en: 'Related:' };
const ADOPTED_LINE = { uk: ['vault створено', 'vault підключено до knowledge-vault'], en: ['vault created', 'vault adopted by knowledge-vault'] };

// [template path, vault path] of each mapped hub, in footer order.
function hubPlan(sections, language) {
  const defaults = DEFAULT_SECTIONS[language];
  return ['architecture', 'featureIndex', 'decisions', 'changeLog'].filter((key) => sections[key]).map((key) => (key === 'featureIndex'
    ? [defaults.featureIndex, sections.featureIndex]
    : [join(defaults[key], HUB_FILES[language][key]), join(sections[key], HUB_FILES[language][key])]));
}

// Creates each missing mapped folder and hub from the templates as an agent hub. An existing file is never overwritten;
// the footer links only the mapped hubs and glossary that exist, since an adopted vault has its own home note.
function createHubs(vault, sections, language, product) {
  const templates = templatesFor(language);
  for (const key of ['architecture', 'features', 'decisions', 'changeLog']) if (sections[key]) mkdirSync(join(vault, sections[key]), { recursive: true });
  const toCreate = hubPlan(sections, language).filter(([from, to]) => !existsSync(join(vault, to)) && existsSync(join(templates, from)));
  const present = [...hubPlan(sections, language).map(([, to]) => to), sections.glossary].filter((p) => p && (existsSync(join(vault, p)) || toCreate.some(([, to]) => to === p)));
  for (const [from, to] of toCreate) {
    const links = present.filter((p) => p !== to).map((p) => `[[${basename(p, '.md')}]]`).join(' · ');
    const text = fill(readFileSync(join(templates, from), 'utf8'), { product, date: localDate() })
      .replace(...ADOPTED_LINE[language])
      .replace(/^(?:Пов'язане|Related):.*$/m, links ? `${FOOTER[language]} ${links}` : '');
    mkdirSync(dirname(join(vault, to)), { recursive: true }); // the feature index may sit outside every mapped folder
    writeFileSync(join(vault, to), text);
  }
  return toCreate.map(([, to]) => to);
}

function adopt(vaultArg, flags, home) {
  const product = requireProduct(flags);
  const sections = parseSections(flags.sections);
  const language = requireLanguage(flags, { required: true });
  const vault = realPath(resolve(vaultArg));
  if (!existsSync(join(vault, '.git'))) throw new Error(`${vault} is not a git repository; adopt expects an existing vault in its vault repository (for a new one use setup.mjs init)`);
  if (existsSync(join(vault, REGISTRY_FILE))) throw new Error(`${vault} already has ${REGISTRY_FILE}; see it with registry.mjs show "${vault}"`);
  const created = createHubs(vault, sections, language, product);
  saveRegistry(vault, { version: 1, product, language, sections, codeRepos: [] });
  const sync = flags.external ? 'external' : 'plugin';
  upsertVault(home, { remote: originUrl(vault), path: vault, sync });
  process.stdout.write(`Adopted ${vault}: the plugin manages only ${Object.keys(sections).join(', ')}. Sync: ${sync}. Nothing was committed.\n`
    + `Files written: ${[REGISTRY_FILE, ...created].join(', ')}\n`);
}

function detectMainBranch(codeRepo) {
  const r = git(codeRepo, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']);
  if (r.code === 0 && r.stdout.trim()) return r.stdout.trim().replace(/^origin\//, '');
  const found = ['main', 'master'].find((b) => revParse(codeRepo, `refs/remotes/origin/${b}`));
  if (!found) throw new Error(`could not tell the main branch of ${codeRepo}; pass --branch <name>`);
  return found;
}

function linkEntry(reg, id, remote, mainBranch) {
  const same = reg.codeRepos.find((r) => r.id === id);
  if (same && !sameRemote(same.remote, remote)) throw new Error(`the id "${id}" already names ${same.remote} in this vault; choose another --id`);
  const other = reg.codeRepos.find((r) => r.id !== id && sameRemote(r.remote, remote));
  if (other) throw new Error(`${remote} is already linked to this vault as "${other.id}"`);
  return same ? { ...same, remote, mainBranch } : { id, remote, mainBranch, describedCommit: null, describedAt: null };
}

function link(vaultArg, codeArg, flags, home) {
  const id = flags.id;
  if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) throw new UsageError('--id must be a kebab-case id such as web-app');
  const vault = realPath(resolve(vaultArg));
  const reg = loadRegistry(vault);
  const vaultRemote = originUrl(vault);
  if (!vaultRemote) throw new Error(`the vault ${vault} has no origin remote; add its vault repository first (git -C "${vault}" remote add origin <url>), then link again`);
  const codeRepo = toplevel(resolve(codeArg));
  if (!codeRepo) throw new Error(`${codeArg} is not inside a git repository`);
  const codeRemote = originUrl(codeRepo);
  if (!codeRemote) throw new Error(`${codeRepo} has no origin remote; a code repository is read from origin/<main branch>`);
  const mainBranch = flags.branch || detectMainBranch(codeRepo);
  if (!revParse(codeRepo, `refs/remotes/origin/${mainBranch}`)) throw new Error(`origin/${mainBranch} does not exist in ${codeRepo}; run git fetch there, or pass --branch <name>`);
  const entry = linkEntry(reg, id, codeRemote, mainBranch);
  const known = reg.codeRepos.some((r) => r.id === id);
  saveRegistry(vault, { ...reg, codeRepos: known ? reg.codeRepos.map((r) => (r.id === id ? entry : r)) : [...reg.codeRepos, entry] });
  writeJson(join(codeRepo, LINK_FILE), { version: 1, product: reg.product, vaultRemote, repoId: id });
  upsertCodeRepo(home, { remote: codeRemote, path: codeRepo });
  upsertVault(home, { remote: vaultRemote, path: vault });
  process.stdout.write(`Linked ${codeRepo} to the ${reg.product} vault as "${id}" (main branch ${mainBranch}).\n`
    + `Commit ${LINK_FILE} in ${codeRepo} yourself: this plugin never commits in a code repository.\n`);
}

// Copies the scripts to <home>/bin and the templates to <home>/templates: a stable place that survives plugin updates.
export function installBin(home) {
  const bin = join(home, 'bin');
  mkdirSync(bin, { recursive: true });
  if (realPath(bin) === realPath(SCRIPTS_DIR)) return bin;
  for (const file of readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.mjs'))) copyFileSync(join(SCRIPTS_DIR, file), join(bin, file));
  if (existsSync(TEMPLATES_DIR)) {
    rmSync(join(home, 'templates'), { recursive: true, force: true });
    cpSync(TEMPLATES_DIR, join(home, 'templates'), { recursive: true });
  }
  return bin;
}

// Registers a vault cloned on this machine, without touching it: for a second machine, also one with no code repository.
function register(vaultArg, flags, home) {
  const vault = realPath(resolve(vaultArg));
  const reg = loadRegistry(vault);
  const remote = originUrl(vault);
  if (!remote) throw new Error(`${vault} has no origin remote; clone the vault from its vault repository first`);
  const sync = flags.external ? 'external' : 'plugin';
  upsertVault(home, { remote, path: vault, sync });
  process.stdout.write(`Registered the ${reg.product} vault at ${vault} on this machine. Sync: ${sync}.\n`);
}

function main(argv) {
  const { positional: [cmd, ...rest], flags } = parseArgs(argv, {
    booleans: ['json', 'external', 'apply'], values: ['product', 'language', 'remote', 'sections', 'id', 'branch', 'interval-minutes'],
  });
  const home = kvHome();
  const arity = { preflight: 0, init: 1, adopt: 1, link: 2, register: 1, 'install-bin': 0, schedule: 0, unschedule: 0 };
  if (!Object.hasOwn(arity, cmd ?? '') || rest.length !== arity[cmd]) throw new UsageError();
  if (cmd === 'preflight') {
    const result = preflight();
    process.stdout.write(flags.json ? `${JSON.stringify(result, null, 2)}\n` : formatPreflight(result));
    return result.ok ? 0 : 1;
  }
  if (cmd === 'init') init(rest[0], flags, home);
  if (cmd === 'adopt') adopt(rest[0], flags, home);
  if (cmd === 'link') link(rest[0], rest[1], flags, home);
  if (cmd === 'register') register(rest[0], flags, home);
  if (cmd === 'install-bin') process.stdout.write(`Copied the scripts to ${installBin(home)}\n`);
  if (cmd === 'schedule') {
    const minutes = parseInterval(flags['interval-minutes']);
    if (!loadConfig(home).vaults.some((v) => v.sync === 'plugin')) {
      process.stdout.write('Nothing to schedule: no vault on this machine is registered with sync "plugin". '
        + 'A vault with sync "external" has its own sync, and the scheduled run (sync.mjs --all) skips it. Nothing was installed.\n');
      return 0;
    }
    if (flags.apply) installBin(home);
    process.stdout.write(schedule({ apply: Boolean(flags.apply), minutes, home }));
  }
  if (cmd === 'unschedule') process.stdout.write(unschedule());
  return 0;
}

if (isMain(import.meta.url)) runCli(USAGE, () => main(process.argv.slice(2)));
