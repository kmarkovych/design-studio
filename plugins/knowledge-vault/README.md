# knowledge-vault

knowledge-vault is a Claude Code plugin that keeps one Obsidian vault per product, stored in its own private git repository, and brings it up to date whenever the product's functionality changes. People and agents can then learn how a product works now, and how it got there, without reading its code or its commit history.

It is the second plugin in the design-studio marketplace. The two plugins are independent: neither requires the other.

## What it does

Four words carry the whole plugin:

- A **product** is the thing a vault describes. It may span several code repositories.
- A **vault** is one product's Obsidian vault: folders of linked Markdown notes. It lives in a **vault repository**: a private git repository that holds the vault and nothing else.
- A **functionality change** is a commit that reaches the main branch of a code repository.
- The **described commit** is, for each code repository, the latest commit whose functionality changes the vault already reflects.

The plugin does two separate kinds of work:

- **Vault sync** moves commits between the vault on your machine and its vault repository: it commits local edits, fetches, rebases and pushes. It is a plain script with no agent, so it costs no usage. It runs when a Claude Code session starts and ends, and every 15 minutes if you allow it.
- A **documentation pass** is agent work. The agent reads the functionality changes after the described commit, rewrites the vault's notes to match them, moves the described commit forward, commits the vault and pushes it. Passes run only inside sessions you have open (see "How the vault stays current").

### The two layers of notes

- **Current-state notes** say how part of the product works now: the architecture, one note per feature or module, the glossary, and the hub notes that list them. When something stops being true, the note is rewritten, not appended to.
- **Change log entries** are written once per documentation pass and never edited afterwards. Each lists every commit the pass covered, which notes it changed, and what it left for later. Commits that changed no behaviour, architecture, decision or term (merges with no changes of their own, tests only, formatting) share one line that lists their short shas.

### Agent notes and owner notes

- An **agent note** carries `agent: knowledge-vault` in its properties. The agent wrote it and may rewrite it from the code at any time.
- An **owner note** is every other note: one a person wrote. The agent never rewrites it. The only edit it may make is to append a link. If you want to take over an agent note, delete its `agent: knowledge-vault` line, and it becomes yours.

### What it never does

- It never changes a code repository. It runs `git fetch` there and reads commits from `origin/<main branch>`. It never pulls, checks out, commits, pushes or stashes. The one file it adds is the link file, during setup, and you commit that yourself.
- It never writes secrets into a vault (see "Secrets").
- It never resolves a conflict in an owner note.
- It never runs a vault's own scripts, such as a sync script its `CLAUDE.md` documents: such a script may act on another path or change files outside the vault. The plugin pulls and pushes a vault only with its own `sync.mjs <vault> pull|push`, which acts only on the path it is given.

## Requirements

| Dependency | Needed for | Install |
|---|---|---|
| Claude Code | The tested host: skills and hooks | `curl -fsSL https://claude.ai/install.sh \| bash` (other methods: [Claude Code docs](https://code.claude.com/docs)) |
| Node 18 or newer | All scripts | [nodejs.org](https://nodejs.org), or `brew install node` on macOS |
| git | Everything | macOS: `xcode-select --install` or `brew install git`; Linux: your package manager |
| obsidianmd/obsidian-skills (recommended) | Gives the agent Obsidian syntax knowledge (wikilinks, properties, callouts) | `/plugin marketplace add obsidianmd/obsidian-skills`, then `/plugin install obsidian@obsidian-skills` |
| `gh` (optional) | Creating a vault repository on GitHub from the skill | `brew install gh`, then `gh auth login` |
| `glab` (optional) | Creating a vault repository on GitLab, including a self-hosted one | `brew install glab`, then `glab auth login` (for self-hosted: `glab auth login --hostname <host>`) |
| Obsidian (optional) | Reading the vault | [obsidian.md](https://obsidian.md), or `brew install --cask obsidian` |
| Obsidian CLI (optional) | Checking the vault for unresolved links and orphan notes | Bundled with the desktop application; enable it in Obsidian's settings. It works only while Obsidian is running |

The plugin has no npm dependencies and copies no dependency into itself. Without `gh` or `glab`, you create an empty private repository on your git host yourself and give the skill its URL. Without obsidian-skills, the agent follows only the plugin's own note rules.

## Installing

### Claude Code

```
/plugin marketplace add kmarkovych/design-studio
/plugin install knowledge-vault@design-studio
```

The same from a shell:

```
claude plugin marketplace add kmarkovych/design-studio
claude plugin install knowledge-vault@design-studio
```

Start a new session afterwards: hooks load when a session starts.

The marketplace repository is private for now. Claude Code fetches it with the git credentials already on your machine, so you need read access to it. These install commands have not yet been run against the published repository.

Once installed, the two skills are:

- `/knowledge-vault:vault-setup`: create or adopt a vault, link a code repository, set up a second machine, schedule vault sync, run preflight.
- `/knowledge-vault:vault-document`: run a documentation pass, including the bootstrap pass for a new vault.

You can also ask in plain words ("set up a knowledge vault for this product", "document the new commits in the vault"). Whether Claude Code picks the right skill on its own from such wording has not been tested; the slash command always works.

### Other agents (designed for, not yet tested)

The skills are plain Agent Skills, written so that OpenAI Codex CLI, OpenClaw and similar agents can run them. None has been tested.

```
npx skills add kmarkovych/design-studio --skill vault-setup --skill vault-document -g
```

The marketplace also holds the design-studio skill; `--skill` names the two this plugin needs, so design-studio is not installed with them. `-g` installs them for your user, not into the code repository you run it from: vault-setup carries the vault templates (an `AGENTS.md`, a `CLAUDE.md`, a `.gitignore`), and a project install would copy them into that code repository, where the link file should be the plugin's only file. How `npx skills` handles a private repository is not documented.

Outside Claude Code the plugin's hooks do not run. Vault sync then relies on the 15-minute schedule, and you start each documentation pass yourself by asking for the vault-document skill.

### Where the plugin's files are

Claude Code keeps installed plugins under `~/.claude/plugins/cache/`. This one is expected at `~/.claude/plugins/cache/design-studio/knowledge-vault/0.1.0/`, but that location has not been checked after a real install. This finds it:

```
find ~/.claude/plugins/cache -path '*/knowledge-vault/*/skills/vault-setup/scripts/setup.mjs'
```

Below, `<plugin>` stands for that folder and `<scripts>` for `<plugin>/skills/vault-setup/scripts`. You rarely need either: the skills run the scripts for you.

## Checking the install: preflight

The vault-setup skill starts with preflight. To run it yourself:

```
node <scripts>/setup.mjs preflight
```

Real output, on a machine with everything except obsidian-skills and the Obsidian CLI:

```
[ok] node             node 24.22.1
[ok] git              git version 2.50.1 (Apple Git-155)
[warn] obsidian-skills  obsidianmd/obsidian-skills (Obsidian syntax knowledge for the agent) was not found in the plugin cache or ~/.agents/skills; it may be installed somewhere this check cannot see
        fix: In Claude Code: /plugin marketplace add obsidianmd/obsidian-skills, then /plugin install obsidian@obsidian-skills
[info] gh               found /opt/homebrew/bin/gh
[info] glab             found /opt/homebrew/bin/glab
[info] obsidian-app     found /Applications/Obsidian.app
[info] obsidian-cli     not found; the Obsidian CLI is optional; it is used only to check for unresolved links and orphans, and works only while the app runs
[ok] ecc-doc-hook     no Write hook that refuses vault notes was found. Hook edits take effect only after /reload-plugins or a new session: a session started before the edit still runs the old hook
preflight: ready
```

`fail` stops setup, `warn` means something will work with a gap, and `info` is for the record. Preflight exits 0 when nothing failed and 1 when something did. Add `--json` for machine-readable output. Each line is explained under "Troubleshooting".

## Creating a vault

Open Claude Code in a code repository of the product and run `/knowledge-vault:vault-setup`. The skill looks up the facts itself (the code repository's origin URL and main branch, its git host, whether `gh` or `glab` is logged in), then asks you everything in one round, with a recommended answer under each question:

1. **Product name.** It names the vault folder and the vault repository.
2. **Vault language.** Chosen once, at creation. Ukrainian (`uk`) is the default; English (`en`) gives `10-Product/…`, `90-Meta/…` and English notes.
3. **Location.** Default `~/Claude/Projects/<Product>/`.
4. **Vault repository.** The skill can create `<product>-vault` with `gh repo create --private` or `glab repo create --private` on the same host and owner as the code repository, or you give it the URL of an existing empty private repository. It refuses a repository it can see is public.
5. **Code repositories** that belong to the product, each with an id and its main branch.
6. **Vault sync every 15 minutes.** Install the LaunchAgent now? (On Linux and WSL: print the crontab line for you.)
7. **Bootstrap pass.** Fill the vault from the existing code now?

Then it creates the vault repository, creates the vault, pushes it once, opens it in Obsidian, links the code repositories, carries out your schedule answer and, if you said yes, runs the bootstrap pass.

### The same steps by hand

`install-bin` copies the scripts to `~/.knowledge-vault/bin/` and the templates to `~/.knowledge-vault/templates/`, so every command below also runs from that stable copy.

```
node <scripts>/setup.mjs install-bin
node ~/.knowledge-vault/bin/setup.mjs init ~/Claude/Projects/Shop --product Shop --remote git@gitlab.example.com:shop/shop-vault.git
node ~/.knowledge-vault/bin/sync.mjs ~/Claude/Projects/Shop push
```

Real output from a test setup in which a local bare repository, shown as `~/remotes/shop-vault.git`, stands in for the vault repository:

```
$ node <scripts>/setup.mjs install-bin
Copied the scripts to ~/.knowledge-vault/bin

$ node ~/.knowledge-vault/bin/setup.mjs init ~/Claude/Projects/Shop --product Shop --remote ~/remotes/shop-vault.git
Created the Shop vault at ~/Claude/Projects/Shop (one commit). Nothing was pushed yet. Push it once with: node "~/.knowledge-vault/bin/sync.mjs" "~/Claude/Projects/Shop" push

$ node ~/.knowledge-vault/bin/sync.mjs ~/Claude/Projects/Shop push
vault sync: pushed 1 commit(s) to the vault repository
```

Push with the sync command rather than `git push`: it checks the outgoing commits for secrets first.

`init` refuses a folder that exists and is not empty (`... already exists and is not empty; choose an empty folder, or adopt an existing vault with setup.mjs adopt`). Without `--remote`, the vault has no vault repository yet: add one with `git -C <vault> remote add origin <url>` before you link a code repository.

### What a new vault holds

```
~/Claude/Projects/Shop/
├── AGENTS.md                      the rules for any agent that writes here (canonical)
├── CLAUDE.md                      "@AGENTS.md" and one sentence: Claude Code reads AGENTS.md through it
├── Домашня.md                     the home note
├── 00-Вхідні/                     inbox for anything not yet sorted
├── 10-Продукт/                    product knowledge, the sections the plugin manages
│   ├── Архітектура/Архітектура.md      architecture hub
│   ├── Фічі/Функціональність.md        feature index
│   ├── Рішення/Реєстр-рішень.md        decision register
│   ├── Журнал-змін/Журнал-змін.md      change log hub
│   └── Глосарій.md                     glossary
├── 90-Мета/
│   ├── Схема-бази.md              the schema note: folders, properties, the fixed list of "type" values
│   └── Шаблони/                   templates: feature, architecture note, decision, change log entry
├── .obsidian/app.json             newLinkFormat shortest, useMarkdownLinks false
├── .gitattributes                 eol=lf for *.md; merge=union for the change log folder
├── .gitignore                     workspace*.json, .obsidian/cache, .trash, .DS_Store, Ключі/, .env, key files
└── .knowledge-vault.json          the registry (see "What the files are")
```

Notes use `[[wikilinks]]` by shortest path, YAML properties with Latin keys, a `type` from the fixed list in the schema note (`hub`, `architecture`, `feature`, `decision`, `glossary`, `change-log`, `reference`, `note`), and end with a `Пов'язане:` line linking related notes. `init` makes one commit: `docs(vault): scaffold the Shop vault`.

An English vault (`--language en`) has the same layout in English: `Home.md`, `00-Inbox/`, `10-Product/` with `Architecture/Architecture.md`, `Features/Functionality.md`, `Decisions/Decision-register.md`, `Change-log/Change-log.md` and `Glossary.md`, and `90-Meta/` with `Vault-schema.md` and `Templates/`. Its notes end with a `Related:` line.

## Adopting an existing vault

If you already keep an Obsidian vault for the product in its own git repository, the plugin can work inside it instead of creating a new one. Run `/knowledge-vault:vault-setup` and say you want to adopt it.

The skill first inspects the vault without writing anything: its git origin and whether it is private (it asks you when no CLI can see the host), its folders and numbering, its schema note and `type` values, its `CLAUDE.md` and `AGENTS.md`, its `.gitattributes` and `.gitignore`, the code repositories you want linked, and anything that already syncs it (hooks in Claude Code settings, a sync script, a LaunchAgent, a cron line, the Obsidian Git plugin). It reads your sync script to see which path it acts on, and never runs it. Then it asks, in one round:

1. **Section mapping.** Which folder or note in your vault plays each of the six sections: `architecture` (folder), `features` (folder), `featureIndex` (note), `decisions` (folder), `glossary` (note), `changeLog` (folder). You may map only some of them. The plugin writes only inside what you map. The feature index is always a new agent hub; a note of yours that already describes what the product does stays yours, even if it says it is filled from code, and the new hub links it.
2. **Sync.** If something already syncs the vault, it is registered with sync `external`: the plugin's hooks and schedule leave it alone, and no second sync is installed. Otherwise the plugin can sync it.
3. **Agent rules.** The rules for its sections go into `AGENTS.md` at the vault root, for the mapped sections only. If your `CLAUDE.md` has a rule that contradicts them, you see both and say which wins; rules that agree are not a conflict. Your `CLAUDE.md` stays untouched; if you want Claude Code to read `AGENTS.md`, add an `@AGENTS.md` line to it yourself.
4. **Change log merge rule.** Whether to add `<changeLog folder>/*.md merge=union` to `.gitattributes`.
5. **Starting point**, for each code repository, when the vault already describes the product: from the current head of its main branch (recommended: only later changes are described), or from an earlier commit you name. A vault that does not describe the product yet gets the bootstrap pass instead.
6. **A type value of its own**, only when your schema's closest value means something else (for example, `feature` meaning a backlog item): the value is added to your schema's type list only with your yes.

Registering by hand (real output, paths shortened):

```
$ node <scripts>/setup.mjs adopt ~/Claude/Projects/Shop --product Shop --language uk --external --sections '{"architecture":"10-Проєкт/Архітектура","features":"10-Проєкт/Функціональність","featureIndex":"10-Проєкт/Функціональність/Функціональність.md","decisions":"10-Проєкт/Рішення","changeLog":"10-Проєкт/Журнал-змін"}'
Adopted ~/Claude/Projects/Shop: the plugin manages only architecture, features, featureIndex, decisions, changeLog. Sync: external. Nothing was committed.
Files written: .knowledge-vault.json, 10-Проєкт/Архітектура/Архітектура.md, 10-Проєкт/Функціональність/Функціональність.md, 10-Проєкт/Рішення/Реєстр-рішень.md, 10-Проєкт/Журнал-змін/Журнал-змін.md
```

`--language` is required. Section paths are relative to the vault root. An unknown section name or a path that leaves the vault is refused with exit 2. Adopting a vault that already has `.knowledge-vault.json` is refused. Besides the registry, `adopt` creates each missing mapped folder and the missing hubs (architecture, feature index, decision register, change log) from the templates in the vault's language, as agent notes whose last line links only the mapped hubs that exist. It never overwrites a file and creates nothing else.

Adoption then puts exactly the files it wrote (the registry, the hubs, `AGENTS.md`, the `.gitattributes` line) in one commit, `docs(vault): adopt the <Product> vault for knowledge-vault` with the trailer `Vault-Agent: knowledge-vault`, shows you the list, and pushes it with `sync.mjs <vault> push` after your yes. For a vault with sync `external`, `sync.mjs` pushes commits already made and commits nothing; if you have uncommitted edits while the vault repository has new commits, it pulls and pushes nothing and says so, and your own sync carries the commit later.

In an adopted vault the plugin leaves alone: `CLAUDE.md`; every folder outside the mapped sections, apart from appending links; owner notes inside the mapped sections, apart from appending links; the schema note (apart from a type value you approved), templates, `.obsidian/` settings and plugins; your sync scripts, hooks, LaunchAgents and cron lines, which it never runs; `.gitignore`; and `.gitattributes` beyond the one line you approved. Its notes use the `type` values agreed at adoption, otherwise the closest your schema lists.

## Linking code repositories

A product may span several code repositories. Each one is linked to the vault: it gets an entry in the vault's registry and a link file, `.knowledge-vault-link.json`, at its root. Hooks and documentation passes find the vault through that file.

The vault-setup skill links the code repository you are in during creation; ask it again to link another. By hand:

```
$ node <scripts>/setup.mjs link ~/Claude/Projects/Shop ~/code/shop-web --id shop-web
Linked ~/code/shop-web to the Shop vault as "shop-web" (main branch main).
Commit .knowledge-vault-link.json in ~/code/shop-web yourself: this plugin never commits in a code repository.
```

- `--id` is a kebab-case name, unique in the vault, such as `shop-web`. It appears in every note's `sources` as `shop-web:src/cart.js`, so keep it stable.
- The main branch is read from `origin/HEAD`, or `main` or `master` if that is missing. Pass `--branch <name>` otherwise.
- The code repository needs an `origin`, and the vault needs its vault repository set as `origin`, before linking.
- A code repository is linked to one vault only. Linking it again under another id is refused (`... is already linked to this vault as "shop-web"`).

**Commit the link file yourself.** Other machines and other sessions find the vault through it:

```
git -C ~/code/shop-web add .knowledge-vault-link.json && git -C ~/code/shop-web commit -m "chore: link knowledge vault"
```

It holds the product name, the vault repository URL and the id, and no secrets. Anyone who can read the code repository sees the vault repository's URL, not its contents.

A newly linked code repository has no described commit, so the skill asks where to start. For a vault that already describes the product (an adopted one), the recommended answer is the current head of the main branch: `registry.mjs describe <vault> <id> <sha>` sets it, and only later changes are described. You may name an earlier commit instead. For a vault that does not describe the product yet, the first documentation pass is its bootstrap pass. The skill commits the registry change (`docs(vault): link <id>`) and pushes it with `sync.mjs`.

### On a second machine

The vault repository and the committed link files already exist; the new machine has neither the vault nor `~/.knowledge-vault/`. Run `/knowledge-vault:vault-setup` and say it is a second machine. The skill clones the vault repository, registers it on this machine with `setup.mjs register <vault>` (with `--external` when the vault has its own sync there, as an adopted vault may), and links each code repository of the product found on this machine with the id from its link file. Registering alone is enough on a machine that holds the vault but none of its code repositories. Linking keeps the sync value registered. The described commit stays as the vault holds it. Until then, a session in that code repository says (real output):

```
knowledge-vault: the vault of Shop (~/remotes/shop-vault.git) is not set up on this machine; clone it and run vault-setup
```

## How the vault stays current

### Hooks (Claude Code)

| When | What the plugin does |
|---|---|
| A session starts (also on resume and `/clear`, not after `/compact`) | Refreshes the stable copy in `~/.knowledge-vault/` when one is installed. Prints any recorded vault sync problems first. Runs vault sync (pull) for the vault linked to the code repository the session is in, when its sync is `plugin`. Counts the undescribed commits on `origin/<main branch>`, after a `git fetch` limited to 10 seconds; if the fetch fails or times out, it counts against the existing local `origin/<main branch>` and says so. If any are undescribed, or no bootstrap pass has run, it tells the agent to run vault-document. It remembers the head it saw. |
| Claude finishes a turn | When `origin/<main branch>` has moved since the session started (new commits reached the main branch during the session) and its head is not described, it stops Claude from finishing once and asks for a documentation pass. It stays quiet while a background sub-agent is running, and when the described commit is no longer on the main branch (history rewritten; session start explains that). It does not fetch. It reminds once per session for each head. |
| A session ends | Starts vault sync (push) for the linked vault in a background process and returns at once, when its sync is `plugin`. Claude Code gives these hooks about 1.5 seconds and discards their messages, so problems from that push go to `status.json` and a macOS notification, like a scheduled sync's. |

Hooks never fail a session: an error becomes at most one message, and the hook exits 0.

What the agent receives at session start, when two commits are undescribed (real output):

```
knowledge-vault: the Shop vault (~/Claude/Projects/Shop) does not yet describe 2 functionality changes on origin/main of code repository shop-web (described commit 00406ce10327, head 62b5a4a94093). Run the vault-document skill as a background sub-agent now. If you cannot start sub-agents, mention this to the user once and run vault-document at the end of the session.
```

And when a turn ends after a new commit reached the main branch during the session (real output):

```
knowledge-vault: 1 functionality change on origin/main of shop-web (head 5284ae7f3ff7) is not yet described in the Shop vault. Run the vault-document skill now, then finish; skip this if a vault-document pass for this code repository is already running in this session. This reminder is given once per session for this head.
```

### Documentation passes

A pass runs only in a session you have open:

- **At the end of a session** in which new commits reached the main branch: the turn-end reminder above.
- **At the start of a session** that finds undescribed commits: the agent runs the pass as a background sub-agent, or, where it cannot start sub-agents, mentions it once and runs it at the end of the session. A background sub-agent cannot ask you anything, so on a conflict with an owner note, a refused secret or an error it stops without pushing and reports.
- **Whenever you ask**: `/knowledge-vault:vault-document`.

A commit made outside any session stays undescribed until the next session in that product starts. `docs/adr/0001-agents-document-only-inside-attended-sessions.md` records why.

One pass covers one code repository. It brings the vault up to date with `sync.mjs <vault> pull`, also for a vault with sync `external` (where it commits nothing; the vault's own scripts are never run), lists the undescribed commits, reads each one, and the code as it is at the newest commit it describes, from git objects (never from your working tree, which may be on another branch), rewrites the current-state notes that stopped being true, writes one change log entry, moves the described commit to the newest covered commit, commits only its own files, and pushes. More than 50 undescribed commits are done in batches of 50, each a full pass with its own change log entry. Agent commits in the vault have the subject prefix `docs(vault):` and the trailer `Vault-Agent: knowledge-vault`.

The **bootstrap pass** is the one bounded pass that fills a vault from a code repository's existing code. It describes the code as it is at the head of the main branch, without walking its commit history, and writes at most 15 notes: one architecture overview, up to four more architecture notes, up to nine feature notes, and the glossary. Whatever does not fit is listed in its change log entry under "Лишилось на потім" (left for later). Each code repository of a product gets its own bootstrap pass. In an adopted vault, it links to owner notes that already cover a subject instead of writing rival notes. An adopted vault that already describes the product needs no bootstrap pass: a starting point set with `describe` replaces it, and from then on the hooks never ask for one.

A pass describes behaviour precisely, with the conditions and limits the code has. When a note describes behaviour that the code at the described commit does not have and no commit of the pass removed it (the vault is ahead of the code repository, or the note is wrong), the pass changes it in neither direction and tells you. It never writes that it checked something without naming what it compared.

The scripts the passes use can be run by hand (real output):

```
$ node ~/.knowledge-vault/bin/registry.mjs undescribed ~/Claude/Projects/Shop shop-web
bootstrap needed: shop-web has no described commit; origin/main is at 00406ce10327a24871ab3c81b637b87476559a89

$ node ~/.knowledge-vault/bin/registry.mjs describe ~/Claude/Projects/Shop shop-web 00406ce10327a24871ab3c81b637b87476559a89
described commit of shop-web is now 00406ce10327a24871ab3c81b637b87476559a89

$ node ~/.knowledge-vault/bin/registry.mjs undescribed ~/Claude/Projects/Shop shop-web
shop-web: 2 undescribed commit(s) on origin/main after 00406ce10327 (head 62b5a4a94093)
abe99684098c496313f1ac88be25dfbfc675eecf 2026-11-19T21:12:43Z feat: checkout
    src/checkout.js
62b5a4a94093845211777cbc7e5d9db0142efbe1 2026-11-19T21:12:43Z docs: readme
    README.md
```

`undescribed` fetches first. `--limit N` shows the first N, `--json` gives machine-readable output. A renamed or moved file is listed as `old -> new`. `describe` accepts only a commit on `origin/<main branch>` that is not behind the current described commit: the described commit only moves forward. With no described commit yet, any commit on `origin/<main branch>` becomes the starting point. The one exception is a rewritten history: when a force-push removed the described commit from `origin/<main branch>`, `undescribed` stops with `... was its history rewritten?`, and `describe` then accepts any commit on `origin/<main branch>` and says it reset the described commit.

While a pass writes, it holds the vault (`sync.mjs <vault> hold`, later `release`), so no vault sync commits its half-written notes under the mechanical subject. A sync that finds the vault held skips it quietly. A hold that is never released lapses after two hours.

### The 15-minute vault sync

Besides session start and end, one scheduled job per machine can run vault sync every 15 minutes for every vault registered with sync `plugin` (pull, then push). It is a plain script with no agent and no usage cost. Vaults with sync `external` are skipped.

The schedule runs the stable copy of the scripts in `~/.knowledge-vault/bin/`, not the plugin's own folder, whose path changes with every plugin version. `install-bin` refreshes that copy.

When no vault on the machine has sync `plugin`, there is nothing to schedule, and `schedule` says so (real output):

```
Nothing to schedule: no vault on this machine is registered with sync "plugin". A vault with sync "external" has its own sync, and the scheduled run (sync.mjs --all) skips it. Nothing was installed.
```

Otherwise, preview what would be installed; this changes nothing:

```
node <scripts>/setup.mjs schedule
```

On macOS it prints the LaunchAgent (real output, paths shortened, `PATH` value cut):

```
Not installed. With --apply this is written to ~/Library/LaunchAgents/com.knowledge-vault.sync.plist and loaded:
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.knowledge-vault.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>~/.nvm/versions/node/v24.22.1/bin/node</string>
    <string>~/.knowledge-vault/bin/sync.mjs</string>
    <string>--all</string>
    <string>--hook</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:...:/usr/bin:/bin</string>
  </dict>
  <key>StartInterval</key>
  <integer>900</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>~/.knowledge-vault/sync.log</string>
  <key>StandardErrorPath</key>
  <string>~/.knowledge-vault/sync.log</string>
</dict>
</plist>
```

In the real file every path is absolute. The plist records the `node` found first on your `PATH` and your shell's `PATH`.

Install it, only when you want it:

```
node <scripts>/setup.mjs schedule --apply
launchctl list | grep com.knowledge-vault.sync
```

The vault-setup skill installs it only after your explicit yes in the conversation; otherwise it gives you this command. `--interval-minutes <n>` (1 to 1440) changes the interval.

On Linux and WSL, `schedule` prints a crontab line instead, and the plugin never edits your crontab. Add it with `crontab -e`. Its form (this one generated on macOS with the same function, paths shortened):

```
*/15 * * * * '~/.nvm/versions/node/v24.22.1/bin/node' '~/.knowledge-vault/bin/sync.mjs' --all --hook >> '~/.knowledge-vault/sync.log' 2>&1
```

With cron, the interval must be under 60 minutes or a whole number of hours. Native Windows is not supported.

### The nightly documentation pass (opt-in, not installed)

If you also want commits made outside any session documented overnight, you can schedule a headless Claude Code run yourself. The plugin never installs it. Before you do, know that it spends usage every night with nobody watching, runs under whatever account is logged in on that machine, and never resolves a conflict: it stops and leaves the problem for your next session.

The command, for one code repository, with `<code>` and `<vault>` as absolute paths:

```sh
cd "<code>" && claude -p "Run the vault-document skill for this code repository: one documentation pass. Nobody can answer you: on any conflict, refused secret or error, stop without pushing and report." \
  --add-dir "<vault>" \
  --allowedTools "Skill,Read,Glob,Grep,Edit(/<vault>/**),Write(/<vault>/**),Bash(node $HOME/.knowledge-vault/bin/registry.mjs:*),Bash(node $HOME/.knowledge-vault/bin/sync.mjs:*),Bash(git -C <code> show:*),Bash(git -C <code> log:*),Bash(git -C <code> diff:*),Bash(git -C <code> grep:*),Bash(git -C <code> ls-tree:*),Bash(git -C <vault> status:*),Bash(git -C <vault> diff:*),Bash(git -C <vault> add:*),Bash(git -C <vault> commit:*)"
```

In `Edit(/<vault>/**)` and `Write(/<vault>/**)` the vault path keeps its own leading slash, so the rule starts with two slashes, for example `Edit(//Users/me/Claude/Projects/Shop/**)`: that is how Claude Code permission rules mark an absolute path. The list lets the pass read the code repository, write only inside the vault, and commit and push only through the vault and the sync script.

To run it at 03:00 with cron, using the absolute path from `command -v claude`:

```
0 3 * * * cd "<code>" && "<path to claude>" -p "…same prompt…" --add-dir "<vault>" --allowedTools "…same list…" >> "$HOME/.knowledge-vault/nightly.log" 2>&1
```

This command has not been run by the plugin's tests. Remove it with `crontab -e`.

## What the files are

### On each machine: `~/.knowledge-vault/`

Set `KNOWLEDGE_VAULT_HOME` to use another folder.

| File | Holds |
|---|---|
| `config.json` | The vaults on this machine (vault repository URL, path, sync `plugin` or `external`) and the linked code repositories (URL, path) |
| `bin/`, `templates/` | The stable copy of the scripts and the vault templates, written by `setup.mjs install-bin` and refreshed by each session start. The schedule and vault-document use it |
| `status.json` | Recorded vault sync problems: `vault`, `when`, `kind`, `detail` |
| `state/` | Small files per session: the head each session started with, and markers so the turn-end reminder is given once per session per head. Files older than seven days are removed |
| `sync.log` | Output of the scheduled vault sync |

`config.json` after creating one vault and linking one code repository (real, paths shortened):

```json
{
  "version": 1,
  "vaults": [
    { "remote": "~/remotes/shop-vault.git", "path": "~/Claude/Projects/Shop", "sync": "plugin" }
  ],
  "codeRepos": [
    { "remote": "~/remotes/shop-web.git", "path": "~/code/shop-web" }
  ]
}
```

Nothing in this folder is committed anywhere.

### In each vault: `.knowledge-vault.json` (the registry)

The product, the vault language, the paths of the six sections, and for each linked code repository its id, URL, main branch, described commit and when it was described. It is a dotfile, so Obsidian does not show it. It is committed with the vault, so every machine shares the described commits. Print it with `node ~/.knowledge-vault/bin/registry.mjs show <vault>`. Its `codeRepos` part, after the first describe (real):

```json
"codeRepos": [
  {
    "id": "shop-web",
    "remote": "~/remotes/shop-web.git",
    "mainBranch": "main",
    "describedCommit": "00406ce10327a24871ab3c81b637b87476559a89",
    "describedAt": "2026-11-19T21:12:43.077Z"
  }
]
```

### In each code repository: `.knowledge-vault-link.json` (the link file)

```json
{
  "version": 1,
  "product": "Shop",
  "vaultRemote": "~/remotes/shop-vault.git",
  "repoId": "shop-web"
}
```

URLs are compared after normalising, so `git@host:group/repo.git` and `https://host/group/repo` count as the same repository.

To see what a code repository resolves to, run `node ~/.knowledge-vault/bin/registry.mjs locate` from inside it. It prints the link file, the vault path and its sync value as JSON and exits 0, or says what is missing and exits 1.

## Conflicts and the status messages

Vault sync never resolves a conflict. When the vault repository and your machine both changed the same file, it aborts the rebase, pushes nothing, and records the problem. The vault is left clean, with your local commit still in place. Real output:

```
$ node ~/.knowledge-vault/bin/sync.mjs ~/Claude/Projects/Shop push
vault sync problem [conflict] ~/Claude/Projects/Shop: this machine and the vault repository both changed 00-Вхідні/README.md; nothing was merged or pushed. Resolve by hand without losing either side: git -C "~/Claude/Projects/Shop" pull --rebase origin main, fix the files, git add them, git rebase --continue. Agent notes in conflict may instead be regenerated by the vault-document skill
```

Files still in conflict from something else (a `git stash pop`, a merge) are never committed either: sync records a `conflict` naming them and stops before committing anything. The same goes for a cherry-pick or revert left unfinished.

Every recorded problem:

- goes into `~/.knowledge-vault/status.json`;
- shows a macOS notification when the run was `sync.mjs` itself, scheduled, by hand or started by the session-end hook, not a session-start pull (skipped where `osascript` is unavailable; `KNOWLEDGE_VAULT_NOTIFY=off` turns it off);
- is printed first by the next session start, as a short message to you and in full to the agent;
- is cleared by the next clean vault sync of that vault.

| kind | Meaning | What to do |
|---|---|---|
| `conflict` | The same file changed on both sides | See below |
| `secret-refused` | A file to be committed, or a local commit to be pushed, looks like it holds a secret. Nothing was committed, pulled or pushed | Delete the value from the file, or the file from the vault (an untracked file may move into the ignored keys folder instead). For a local commit, rewrite it as the detail says. Until you do, every sync of that vault stops the same way; the first clean sync after that clears the problem |
| `stale-lock` | A sync lock older than 10 minutes was found and removed; a previous run was probably killed. Nothing was synced that time | Nothing. The next run syncs normally. If it keeps happening, read `~/.knowledge-vault/sync.log` |
| `error` | Anything else, with nothing committed or pushed: an unfinished rebase, merge, cherry-pick or revert in the vault; a detached HEAD; the vault on another branch than its vault repository's main branch; a `.knowledge-vault.json` that is not valid JSON; a vault repository that is gone, renamed or refuses access; a failed push | Read the detail. An unfinished rebase is yours to finish: `git -C <vault> status` |

A vault repository that cannot be reached because of the network (host not found, connection refused or timed out, a VPN down) is not recorded as a problem. Sync says `could not reach the vault repository (...); sync skipped, local commits are kept for next time` and exits 0. Any other fetch failure is an `error`, so a deleted or renamed vault repository or a revoked key gets a notification (real output, paths shortened):

```
vault sync problem [error] ~/Claude/Projects/Shop: git fetch from the vault repository failed: fatal: '~/remotes/renamed.git' does not appear to be a git repository. Nothing was pulled or pushed; local commits are kept. Check its URL (git -C "~/Claude/Projects/Shop" remote -v) and your access to it
```

A `status.json` that is not valid JSON is moved aside to `status.json.corrupt-<time>` with one line on stderr, and a new one is started.

### Resolving a conflict

If every conflicted file is an agent note, a documentation pass in a session may rebase, regenerate those notes from the code, and continue. Ask for `/knowledge-vault:vault-document`. If any conflicted file is an owner note, or `.knowledge-vault.json`, nothing is resolved or pushed: the agent shows you both versions and stops.

To resolve by hand, rebase onto the vault repository, keep both sides' content, and continue:

```
git -C <vault> pull --rebase origin main
# edit each conflicted file, keeping what both sides wrote
git -C <vault> add <file>
git -C <vault> rebase --continue
node ~/.knowledge-vault/bin/sync.mjs <vault> push
```

Name the branch as above: sync pushes without setting an upstream branch, so a bare `pull --rebase` answers `There is no tracking information for the current branch.`

For `.knowledge-vault.json`, the right described commit for each code repository is whichever of the two is a descendant of the other on `origin/<main branch>`.

While the rebase is unfinished, every vault sync stops with `[error] ... an unfinished rebase or merge is in the vault; finish or abort it by hand`. Once you finish it, the next sync pushes and clears the problem.

## Secrets

Nothing of the following goes into a vault, even when the agent sees it in code, a test fixture, a log or a commit: values from `.env` or any config file, API keys and tokens, private keys and certificates, passwords, connection strings with credentials, webhook URLs that carry a token, customer personal data, or production data. A note may name a variable and say what it controls (`STRIPE_SECRET_KEY`, set in `.env`), never its value. The agent checks its own staged changes for these before every commit.

Vault sync is the last line of defence. It refuses to commit, and refuses to push local commits (the agent's own included) that add:

- files named `.env`, `.env.<anything>` or `<anything>.env`, and anything inside a `keys/`, `Keys/` or `Ключі/` folder;
- lines with a private key block, a GitLab token (`glpat-`), an AWS access key id (`AKIA`), a GitHub token (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), a `"private_key":` field, an OpenAI or Anthropic key (`sk-`, `sk-proj-`, `sk-ant-`), a Stripe live key (`sk_live_`, `rk_live_`), a Slack token (`xoxb-` and similar), a Google API key (`AIza`), a URL that carries a password (`postgres://user:pass@host`), or `password:`, `secret=`, `token:`, `api_key:` or `пароль:` followed by a value that mixes letters and digits.

When anything is refused, nothing is committed, pulled or pushed in that run, as in the owner's own sync script: the index is reset and your files stay as they are. Removing a secret is never refused. The new vault's `.gitignore` also ignores the keys folder, `.env`, `.env.*`, `*.pem`, `*.key` and `*.p12`.

Real output (paths shortened):

```
$ node ~/.knowledge-vault/bin/sync.mjs ~/Claude/Projects/Shop push
vault sync problem [secret-refused] ~/Claude/Projects/Shop: these files look like secrets: 00-Вхідні/Нотатка.md. Nothing was committed, pulled or pushed until they are fixed. Keys, tokens, passwords, connection strings and .env files never belong in a vault: delete the value (or the file) from the vault folder
```

These patterns catch only common forms. A password in plain words or a customer's address is not detected by the script.

## Troubleshooting

### Preflight results

| Line | Meaning | Fix |
|---|---|---|
| `[fail] node` | Node is older than 18 | Install Node 18 or newer |
| `[fail] git` | git was not found | Install git |
| `[warn] obsidian-skills` | obsidian-skills was not found under `~/.claude/plugins/cache`, `~/.claude/skills` or `~/.agents/skills` | `/plugin marketplace add obsidianmd/obsidian-skills`, then `/plugin install obsidian@obsidian-skills`. If you installed it somewhere else, the warning may be wrong: check your own skill list. The plugin works without it |
| `[info] gh`, `[info] glab` | Found or not | Needed only to create a vault repository from the skill. Without them, create an empty private repository yourself and give its URL |
| `[info] obsidian-app` | Looked for in `/Applications` and `~/Applications` (macOS only) | Needed only to read the vault |
| `[info] obsidian-cli` | `obsidian` on your `PATH`, or not | Optional. Used only to look for unresolved links and orphan notes, and only while Obsidian runs |
| `[warn] ecc-doc-hook` | A hook blocks new Markdown files; see the next section | Fix it before you create or adopt a vault |

### A hook refuses to write notes into the vault

The everything-claude-code plugin installs a `PreToolUse` hook on `Write`, described as "Block creation of random .md files - keeps docs consolidated". It refuses any new `.md` file outside a short list of names such as `README.md` and `CLAUDE.md`. With it active, every new note a documentation pass writes is refused with `[Hook] BLOCKED: Unnecessary documentation file creation`.

The hook has two copies on disk: the installed one under `~/.claude/plugins/cache/` and the marketplace one, `~/.claude/plugins/marketplaces/everything-claude-code/hooks/hooks.json`, which an update installs again. Preflight checks both, names each copy it found and whether it exempts vaults, and warns when one has no `.obsidian` exemption (real output, paths shortened):

```
[warn] ecc-doc-hook     a PreToolUse Write hook that blocks new .md files ("Block creation of random .md files", from everything-claude-code) will refuse writes into vaults. ~/.claude/plugins/marketplaces/everything-claude-code/hooks/hooks.json: NO .obsidian exemption. Hook edits take effect only after /reload-plugins or a new session: a session started before the edit still runs the old hook
        fix: In every copy marked NO, edit that hook's command so it allows a path when one of its parent folders contains .obsidian (walk up from the file path), or disable the hook; then run /reload-plugins or start a new session. A plugin update may restore the original hooks.json, so check again after updating
```

Two fixes, yours to choose:

1. **Exempt every Obsidian vault.** In the command of each copy marked `NO`, the file path is in a variable `p`, followed by a chain of `&&!/.../.test(p)` conditions. Add this condition to the chain, inside the same string:

   ```
   &&!(()=>{const fs=require('fs'),P=require('path');let d=P.dirname(p);while(d!==P.dirname(d)){if(fs.existsSync(P.join(d,'.obsidian')))return true;d=P.dirname(d)}return false})()
   ```

   It lets a path through when any folder above it contains `.obsidian`. It has no backslashes or double quotes, so it needs no extra escaping inside `hooks.json`. Then check that the hook still blocks a stray `notes.md` in a code repository: a hook whose command no longer parses blocks nothing.
2. **Turn the hook off**, or that plugin's hooks altogether.

Either way, run `/reload-plugins` or start a new session afterwards: Claude Code loads hooks when a session starts, so a running session keeps the old hook, and preflight, which reads the files on disk, cannot see that. If a write into a vault is still refused while preflight says ok, the agent stops and asks you to reload; it never writes notes through the shell to get around your hook.

An update of everything-claude-code may undo the edit. Run preflight again after each update. The `init` and `adopt` scripts write their files directly and are not affected; only the agent's own Write tool is.

### A sync lock

Each vault sync takes a lock, a folder at `<vault>/.git/knowledge-vault-sync.lock`, and removes it when done. A documentation pass holds the same lock while it writes. A second sync that finds the lock skips quietly (`another sync or a documentation pass holds <vault>; skipped`, exit 0). A sync's lock older than 10 minutes, or a pass's hold older than two hours, is treated as abandoned: it is removed, nothing is synced that time, and a `stale-lock` problem is recorded. The next run syncs normally. You never need to delete the lock yourself unless you are sure nothing is running and cannot wait; `node ~/.knowledge-vault/bin/sync.mjs <vault> release` removes a pass's hold.

### A conflict in an owner note

The plugin never resolves it. Follow "Resolving a conflict" above, keeping both sides. If you prefer one side's version of an agent note, a documentation pass can regenerate it from the code afterwards.

### The vault does not appear in Obsidian

- Obsidian shows only vaults it has opened. The skill opens a new vault once with `open "obsidian://open?path=<vault path>"` on macOS. If that did nothing, or on another machine: Obsidian, "Open folder as vault", then choose the vault folder.
- On a second machine the vault exists only after it is cloned (see "On a second machine").
- Notes written by a pass reach another machine only after vault sync has pushed them on one machine and pulled them on the other. Run `node ~/.knowledge-vault/bin/sync.mjs <vault> pull` to fetch them now.
- `.knowledge-vault.json` and `.obsidian/` are dotfiles: Obsidian does not show them, by design.

### Hooks seem silent

- Hooks load when a session starts. A session started before the install has none: start a new one, or check `/hooks`.
- The session-start hook needs a linked code repository whose vault is registered on this machine. Run `node ~/.knowledge-vault/bin/registry.mjs locate` from the code repository to see what is missing.
- Hooks report errors as at most one message. Run vault sync by hand to see the full output: `node ~/.knowledge-vault/bin/sync.mjs <vault> pull`.
- A vault with sync `external` is not synced by the plugin's hooks at all.

### Exit codes

`sync.mjs` always prints what it did (received, pushed, already up to date, or why it skipped). Exit codes: 0 clean or nothing to do, 3 a problem was recorded, 1 an operational error (for example, the path is not a git repository). With `--hook` it always exits 0 and prints any warning as `{"systemMessage":"..."}`. Every script prints a usage line and exits 2 on wrong arguments.

## Updating and uninstalling

### Updating

```
/plugin marketplace update design-studio
```

Then open `/plugin`, go to Installed, and choose Update now. From a shell: `claude plugin update knowledge-vault@design-studio`. Restart Claude Code afterwards. An update arrives only when the plugin's `version` in `.claude-plugin/plugin.json` has changed.

The first session start after the update refreshes the stable copy in `~/.knowledge-vault/` that the schedule and documentation passes use. Outside Claude Code, where no hooks run, refresh it yourself:

```
node <scripts>/setup.mjs install-bin
```

If you upgrade Node in a way that moves the `node` binary (nvm installs each version in its own folder), run `setup.mjs schedule --apply` again so the LaunchAgent points at the new one.

### Uninstalling

1. Remove the schedule first, while the scripts are still there:

   ```
   node ~/.knowledge-vault/bin/setup.mjs unschedule
   ```

   It unloads and removes `~/Library/LaunchAgents/com.knowledge-vault.sync.plist`, or says `No LaunchAgent at ...; nothing to remove.` On Linux and WSL, delete the line containing `knowledge-vault/bin/sync.mjs` with `crontab -e`. Remove any nightly line you added the same way.
2. Uninstall the plugin:

   ```
   /plugin uninstall knowledge-vault@design-studio
   ```

   or `claude plugin uninstall knowledge-vault@design-studio`. In other agents (designed for, not yet tested): `npx skills remove vault-setup` and `npx skills remove vault-document`.
3. Optionally delete `~/.knowledge-vault/`.

Uninstalling leaves your vaults and vault repositories alone. If you no longer want them tied to the plugin, delete `.knowledge-vault.json` from the vault and `.knowledge-vault-link.json` from each code repository, and commit those deletions yourself. Agent notes stay as ordinary notes; delete their `agent: knowledge-vault` lines if you want them treated as your own.

## Known limits

- **No unattended documentation by default.** Passes run only in sessions you have open. A commit made outside any session stays undescribed until the next session in that product. The nightly pass is opt-in and not installed by the plugin.
- **Native Windows is not supported.** macOS uses launchd; Linux and WSL use a crontab line you add yourself.
- **Claude Code is the only tested host.** Codex, OpenClaw and other agents are designed for, not yet tested. They get no hooks.
- **The Obsidian CLI needs Obsidian running.** Without it, the check for unresolved links and orphan notes is skipped.
- **The secret check is pattern-based.** It catches common key and token formats and `.env` files, not every secret.
- **Two vault syncs on one machine writing `status.json` at the same instant can lose one record.** The next sync records it again.
- **Rules for writing notes are followed by the agent, not enforced by code.** The scripts enforce the described commit, the read-only code repository commands they run, the lock and the pass's hold, and the secret check; which notes a pass rewrites is the agent's job.
- If you run a plugin that tells every agent to write as little code as possible: each skill states that this governs code volume, not how complete the documentation is.

## Developing

```
plugins/knowledge-vault/
├── .claude-plugin/plugin.json
├── hooks/hooks.json                     SessionStart, Stop, SessionEnd -> hook.mjs
├── skills/vault-setup/SKILL.md          create, adopt, link, schedule, preflight
├── skills/vault-setup/reference/        create.md, adopt.md, link.md, schedule.md, troubleshooting.md
├── skills/vault-setup/scripts/          setup.mjs, sync.mjs, registry.mjs, hook.mjs, secrets.mjs and helpers
├── skills/vault-setup/templates/        the files a new vault starts from: uk/ and en/
├── skills/vault-document/SKILL.md       the documentation pass
├── skills/vault-document/reference/     pass.md, bootstrap.md, notes.md
├── tests/                               tests for the scripts
├── docs/adr/                            decisions
├── GLOSSARY.md                          the plugin's vocabulary
└── LICENSE
```

Run the tests (Node's built-in test runner, no dependencies) from `plugins/knowledge-vault/`:

```
npm test
```

The current suite has 79 tests, all passing. Tests point `KNOWLEDGE_VAULT_HOME` at a temporary folder and use local bare repositories; they never touch a real git host or `~/Library/LaunchAgents`.

Check the manifest from the repository root with `claude plugin validate plugins/knowledge-vault`; it ends with `✔ Validation passed`.

Every release must change `version` in `.claude-plugin/plugin.json`, or installed copies never receive it. Use the terms in `GLOSSARY.md` exactly when you write for this plugin.
