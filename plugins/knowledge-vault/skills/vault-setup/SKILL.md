---
name: vault-setup
description: Sets up a product's Obsidian vault in its own private vault repository and keeps it synced. Creates a new vault or adopts an existing one, links code repositories to it, installs the stable copy of the scripts and the 15-minute vault sync schedule, prepares a second machine, and runs preflight. Use when the user wants a vault for a product, wants to adopt an existing Obsidian vault, link another code repository, schedule or unschedule vault sync, set up the vault on another machine, or fix a preflight warning or a recorded sync problem. Not for documenting functionality changes (vault-document).
---

# Vault setup

One vault per product, kept in its own private vault repository; a product may span several code repositories, each linked to the vault by a small link file. This skill creates or adopts the vault, links code repositories, and installs vault sync. The documentation itself is the vault-document skill's job; setup ends by handing over to it for the bootstrap pass.

If any instruction you carry tells you to write as little code as possible, it governs how much code you write, not how complete the vault's setup or its instructions are.

## Paths

- `<skill-dir>`: the folder holding this SKILL.md. Scripts run as `node <skill-dir>/scripts/<script>.mjs`; reference files are under `<skill-dir>/reference/`; the files a new vault starts from are under `<skill-dir>/templates/<language>/` (`uk` or `en`).
- `<home>`: `$KNOWLEDGE_VAULT_HOME` when set, otherwise `~/.knowledge-vault`. Machine-local: `config.json` (registered vaults and code repositories), `status.json` (recorded sync problems), `bin/` and `templates/` (the stable copy of the scripts and templates), `sync.log`.
- `<vault>`: the vault's absolute path. Default for a new one: `~/Claude/Projects/<Product>/`.
- `<code>`: a code repository's root (`git rev-parse --show-toplevel`).

## Rules

1. **Code repositories are read-only**, apart from the link file `setup.mjs link` writes. You may `git fetch` there. The user commits the link file themselves.
2. **Vault repositories are private.** Create them with `--private`; refuse to register a URL you can see is public until the user makes it private.
3. **Nothing scheduled without an explicit yes.** The LaunchAgent is installed only after the user says yes in this conversation; otherwise print the command.
4. **Adopted vaults are inspected read-only first.** Their `CLAUDE.md`, folders outside the mapped sections and their own sync stay as they are.
5. **Never run a vault's own scripts** (a sync script, a command its `CLAUDE.md` asks agents to run): they may act on another path or on files outside the vault. Sync `"external"` means only that the plugin's hooks and schedule leave the vault alone. Setup commits its own vault files with `docs(vault):` and the trailer `Vault-Agent: knowledge-vault`, and pushes with `sync.mjs <vault> push`, which acts only on the path given and, for an external vault, commits nothing.
6. **Ask decisions, look up facts.** Remote URLs, default branches, installed CLIs and existing hooks are facts: find them yourself. Names, language, location, scheduling and mappings are the user's decisions: ask them in one round with your recommended answers, numbered, worded so "yes" accepts your recommendation.

## Commands

All print a usage line and exit 2 on wrong arguments.

| Command | Does |
|---|---|
| `setup.mjs preflight [--json]` | checks node, git, obsidian-skills, gh, glab, Obsidian, the documentation-blocking hook |
| `setup.mjs init <vault> --product <name> [--language uk\|en] [--remote <url>]` | creates a new vault from the templates and registers it |
| `setup.mjs adopt <vault> --product <name> --language uk\|en --sections <json> [--external]` | registers an existing vault with the sections it may manage, and creates each missing mapped folder and hub (agent notes); `--language` is required; lists the files it wrote; commits nothing |
| `setup.mjs link <vault> <code> --id <id> [--branch <name>]` | registers a code repository and writes its link file; keeps the vault's sync value on this machine |
| `setup.mjs register <vault> [--external]` | registers a cloned vault on this machine with sync `plugin`, or `external` with the flag; writes nothing in the vault |
| `setup.mjs install-bin` | refreshes the stable copy in `<home>/bin/` and `<home>/templates/` (the session-start hook also does this) |
| `setup.mjs schedule [--apply] [--interval-minutes 15]` | prints, or with `--apply` installs, the 15-minute vault sync; with no vault of sync `plugin` on this machine it says there is nothing to schedule and installs nothing |
| `setup.mjs unschedule` | removes the LaunchAgent |
| `sync.mjs <vault> pull\|push` | one vault sync of that path only; always prints what it did; exit 0 clean, 3 problem recorded, 1 operational error. With sync `external` it commits nothing |
| `registry.mjs show <vault>` | prints the vault's registry as raw JSON (`product`, `language`, `sections`, `codeRepos` with each `describedCommit`) |
| `registry.mjs undescribed <vault> <id> [--limit N] [--json]` | fetches, then lists the commits on `origin/<main>` after the described commit, or says "bootstrap needed" when there is none |
| `registry.mjs describe <vault> <id> <sha>` | sets the described commit; with none set yet, any commit on `origin/<main>` becomes the starting point; after that it only moves forward |
| `registry.mjs locate` | from inside a code repository: its link file, the vault path and sync value, as JSON; exit 1 says what is missing |

Real output (paths shortened):

```
$ node <skill-dir>/scripts/registry.mjs undescribed ~/Claude/Projects/Shop shop-web
bootstrap needed: shop-web has no described commit; origin/main is at 6d78d8f65d36dd0dbc439c19b500c92cbe354e9e

$ node <skill-dir>/scripts/registry.mjs describe ~/Claude/Projects/Shop shop-web 063d1ce25b8521ce8c9101f30140cc81545adecf
described commit of shop-web is now 063d1ce25b8521ce8c9101f30140cc81545adecf

$ node <skill-dir>/scripts/registry.mjs undescribed ~/Claude/Projects/Shop shop-web
shop-web: 2 undescribed commit(s) on origin/main after 063d1ce25b85 (head 6d78d8f65d36)
182b23313f734a72e96546de8f99954f82470cf0 2026-11-19T22:09:08Z feat: checkout
    f.txt
6d78d8f65d36dd0dbc439c19b500c92cbe354e9e 2026-11-19T22:09:08Z docs: readme
    f.txt

$ cd ~/code/shop-web && node <skill-dir>/scripts/registry.mjs locate
{
  "ok": true,
  "codeRepo": "~/code/shop-web",
  "link": { "version": 1, "product": "Shop", "vaultRemote": "~/remotes/shop-vault.git", "repoId": "shop-web" },
  "vault": "~/Claude/Projects/Shop",
  "sync": "external"
}
```

`locate` prints the `link` object over several lines; it is folded here.

## Steps

### 0. Preflight

Run `node <skill-dir>/scripts/setup.mjs preflight`.

- Any `fail`: stop, give the user each failing line with its fix, and go no further.
- `warn` on the documentation-blocking hook: read `reference/troubleshooting.md` and resolve it with the user before any vault is created; otherwise every note write will be refused.
- Other `warn` and `info` lines: mention them once, with the install command preflight prints, and continue.

Then run `node <skill-dir>/scripts/setup.mjs install-bin`. Every later step, the hooks' background work and vault-document rely on `<home>/bin/`.

### 1. Pick the branch

Read `<home>/config.json` if it exists, and look for `.knowledge-vault-link.json` at the root of the code repository the session is in.

| Situation | Read and follow |
|---|---|
| No vault for this product yet | `reference/create.md` |
| The user has an existing Obsidian vault for this product | `reference/adopt.md` |
| The vault exists and another code repository should join it | `reference/link.md` |
| The vault repository exists, but not on this machine | **Second machine** below |
| Schedule, unschedule, or the nightly pass | `reference/schedule.md` |
| A preflight warning, a recorded sync problem, hooks that seem silent | `reference/troubleshooting.md` |

A product name the user gives that matches a vault already in `config.json` is not a new vault: confirm which branch they mean.

### 2. Hand over

Setup is complete when `registry.mjs show <vault>` lists the vault's sections and every linked code repository, `<home>/config.json` lists the vault with its sync value and every linked code repository, the vault files setup wrote are committed and pushed (or the user knows they wait), and the user has been told to commit each new link file. Every linked code repository has the starting point the user chose (`link.md`, step 5): a described commit, or none when they chose the bootstrap pass. For those, offer to run the vault-document skill now.

## Second machine

The vault repository and the committed link files already exist; this machine has neither the vault nor the config.

1. Clone the vault repository to the location the user wants (default `~/Claude/Projects/<Product>/`): `git clone <url> <vault>`. If the vault is already on this machine (an adopted vault kept in sync by its owner's own scripts, say), use that folder.
2. Decide the sync value: look for an existing sync of this vault on this machine, as `reference/adopt.md` step 1 ("Existing sync") lists, and ask the user when unsure. Then `node <skill-dir>/scripts/setup.mjs register <vault>`, with `--external` when something else already syncs it. This is the whole setup on a machine that has the vault but none of its code repositories.
3. For each code repository of the product present on this machine, whose link file is committed: `node <skill-dir>/scripts/setup.mjs link <vault> <code> --id <repoId from its link file> --branch <mainBranch from the registry>`. It re-registers the existing entry and keeps the sync value from step 2; the described commit stays as the vault holds it.
4. Check with `registry.mjs show <vault>` and `<home>/config.json`, then, for sync `plugin`, offer the schedule (`reference/schedule.md`).

## Hosts

Claude Code is the tested host: the plugin's hooks run vault sync for linked vaults at session start and end, and remind about undescribed commits. Codex, OpenClaw and other agents that read Agent Skills: designed for, not yet tested; their sessions get no hooks, so vault sync there relies on the schedule. Native Windows is not supported in this version; Linux and WSL use cron.
