# Note format

Read this before writing any note. The vault's own `AGENTS.md` and schema note (`90-Мета/Схема-бази.md` in a new Ukrainian vault, `90-Meta/Vault-schema.md` in a new English one) win where they say more about how a note looks; in an adopted vault they are the only authority on types, property values and folder names. Where the pass writes is never theirs to widen: only the mapped sections.

If the obsidian-markdown skill from obsidianmd/obsidian-skills is available (`obsidian:obsidian-markdown` in Claude Code), load it before the first write: it carries Obsidian's syntax (wikilinks, embeds, properties, callouts). This file still decides what goes into a note.

## Where notes go

Paths come from the registry, never from memory: `node <bin>/registry.mjs show <vault>` prints `sections`. A new vault starts with these (Ukrainian / English):

| Section | Path | Hub |
|---|---|---|
| architecture | `10-Продукт/Архітектура/` / `10-Product/Architecture/` | `Архітектура.md` / `Architecture.md` in that folder |
| features | `10-Продукт/Фічі/` / `10-Product/Features/` | the feature index |
| featureIndex | `10-Продукт/Фічі/Функціональність.md` / `10-Product/Features/Functionality.md` | is itself the hub |
| decisions | `10-Продукт/Рішення/` / `10-Product/Decisions/` | `Реєстр-рішень.md` / `Decision-register.md` in that folder |
| glossary | `10-Продукт/Глосарій.md` / `10-Product/Glossary.md` | one note |
| changeLog | `10-Продукт/Журнал-змін/` / `10-Product/Change-log/` | `Журнал-змін.md` / `Change-log.md` in that folder |

The words a note uses for its footer and its sections follow the vault's language: `Пов'язане:` / `Related:`, "Лишилось на потім" / "Left for later", "Вилучено" / "Removed".

Write only inside the mapped sections. Everything else in the vault belongs to its owner. Write in the vault's language (`language` in the registry); file names follow it, words joined by hyphens.

## Agent notes and owner notes

- An **agent note** carries `agent: knowledge-vault` in its properties. You may rewrite it from code at any time.
- An **owner note** is every other note. Your only permitted edit is appending a wikilink to its `Пов'язане:` line or to a list of links, leaving every existing character as it was. When a commit of this batch made an owner note untrue, write the current state in your agent note, link the owner note, and say in the change log entry that the owner note now disagrees with the code. When it disagrees with the code for any other reason (it describes a later commit, or it was wrong), follow `pass.md` step 6, "The vault ahead of the code, or wrong": write nothing that contradicts it and report it.
- Before rewriting any note, read its properties. No `agent: knowledge-vault` line means owner note, even inside a section you manage and even if you created it earlier: the owner took it over by deleting the line.

## Properties

YAML frontmatter, Latin keys, values in the vault's language. Every agent note has:

```yaml
---
agent: knowledge-vault
type: feature
updated: 2026-11-19
sources:
  - web:src/billing/invoice.ts
  - web:src/billing/credit-note.ts
tags:
  - білінг
---
```

- `type`: one value from the schema's fixed list. New vault: `hub`, `architecture`, `feature`, `decision`, `glossary`, `change-log`, `reference`, `note`. In an adopted vault, use the value its `AGENTS.md` assigns, otherwise the closest value its schema already lists (`reference` for architecture or glossary, `log` for a change log entry are typical). Never reuse a value the schema defines as something else: where its `feature` means a backlog item, a current-state feature note is not a `feature`. Then use the distinct value the user chose at adoption (vault-setup's `adopt.md`, Q6). If there is none, ask the user for one; add it to the schema note's type list, one line in the list's own format and nothing else changed, only after their yes, and note it in `AGENTS.md`. A background sub-agent cannot ask: it uses `reference` with an `area` and reports the choice.
- `updated`: today's date when the note's content changed. Leave it alone when nothing changed.
- `sources`: every code file the note was written from, as `<repoId>:<path>`, path relative to the code repository root. Regenerating a note starts from these files.
- `status`: in a new vault, features `діє` or `вилучено` (English: `active` or `removed`); decisions `чинне` or `скасоване` (English: `in-force` or `superseded`). An adopted vault's own status words win: when its features folder is a backlog (statuses such as `ідея`, `в роботі`, `готово`, keys such as `owner` or `mr`), its notes are owner notes about planned work, not current-state notes; write the current-state note beside them and link them, and never set a backlog status yourself.
- `area`: features and architecture notes, a short area name shared by related notes.
- `tags`: lower case, the vault's language.
- Change log entries also carry `date`, `repo` (the repoId), `from` (previous described commit, empty for the bootstrap pass) and `to` (the commit this pass describes), all as values, full 40-character shas.

## Two layers

- A **current-state note** (architecture, feature, glossary, hubs) says how the product works now. When something stops being true, rewrite the sentence; never append "update of <date>" paragraphs. A removed feature keeps its note with `status: вилучено`, one line saying in which commit it went, and moves to the "Вилучено" list of the feature index.
- A **change log entry** is written once per documentation pass and never edited afterwards. File name `YYYY-MM-DD-<repoId>-<sha7>.md`, where sha7 is the first seven characters of `to`. Body: each commit that changed a note on its own line (`sha7` date, subject, which notes it changed); all commits that change no functionality (merges with no changes of their own, tests only, formatting, CI) on one line, `` `sha7`, `sha7`, `sha7` — без змін у функціональності (злиття, тести, форматування) `` (English: `` `sha7`, `sha7`: no functionality change (merges, tests, formatting) ``); then each changed note with one sentence on what is now different; then each note that describes behaviour the code at `to` does not have (`pass.md`, step 6), one line each; then "Лишилось на потім" when the pass left something out. Use the template `90-Мета/Шаблони/Запис-журналу-змін.md` (`90-Meta/Templates/Change-log-entry.md`) when the vault has it, otherwise the same file under `<home>/templates/<language>/`, adding `agent: knowledge-vault`.
- The change log hub (`Журнал-змін.md`, `Change-log.md`) is append-only and merged by union: add one line at the bottom of its list, `- [[<entry name>]] — N комітів, змінено M нотаток` (English: `- [[<entry name>]]: N commits, M notes changed`), directly above the footer line. Do not touch its properties.
- Decisions are never rewritten. A new decision is a new note `YYYY-MM-DD-Назва.md`; the superseded one gets `status: скасоване` and a link to its replacement (when the superseded one is an owner note, only the link is yours to add; tell the user its status is stale).

## Writing the body

- H1 is what the note is about, in one phrase.
- Describe behaviour a reader can rely on: what it does, the rules it follows, its limits, how the parts talk to each other. Name the identifiers (classes, routes, commands, tables, config keys) a reader would search the code for.
- Be exact about conditions: write the condition, the limit and the outcome the code has ("when both lists are empty", "301 to the default locale for any unsupported language"), not a paraphrase that sounds right ("on failure", "redirects as needed").
- Write that something was checked only together with what was compared: the note, the file and the sha.
- Code paths in backticks with the repoId: `web:app/Services/Search/CruiseSearchService.php`. Quote identifiers and short signatures, not bodies; a code block longer than ten lines belongs in the code repository, not here.
- Links: `[[Note name]]` by shortest path, no `.md`, no Markdown links between notes. Link a term to the glossary the first time a note uses it.
- End with one footer line: `Пов'язане: [[Хаб]] · [[Інша нотатка]]`.
- Every new note gets a line in its section's hub (`- [[Назва]] — одне речення`), grouped by `area` in the feature index. Remove the `_Поки порожньо…_` placeholder line when the first link goes in.
- Obsidian comments `%% … %%` in hubs are instructions for you; keep them.

## Secrets (never in a vault)

Nothing below goes into any note, change log entry or commit message, even when it sits in the code, a test fixture, a log or a commit you are reading:

- values from `.env` or any config file: `DB_PASSWORD=…`, `APP_KEY=base64:…`
- API keys and tokens: `sk-…`, `AKIA…`, `glpat-…`, `ghp_…`, `xoxb-…`, JWTs, OAuth client secrets, webhook URLs that carry a token
- private keys and certificates: anything between `-----BEGIN … PRIVATE KEY-----` lines, `.pem`, `.p12`
- connection strings with credentials: `postgres://user:pass@host/db`, `mongodb+srv://…`, `redis://:pass@…`
- customer personal data: names, emails, phones, addresses, passport numbers, from seeds, fixtures, logs or support tickets
- production data: real orders, balances, internal IP addresses and hostnames of production servers, row counts or figures copied from a production database

What may go in: the variable's name and what it controls (`STRIPE_SECRET_KEY` — ключ Stripe, задається в `.env`), that a credential exists and where it is configured, and placeholder values that are obviously fake (`user@example.com`). Before every commit, search your own staged diff for the patterns above (`git -C <vault> diff --cached`). The sync script refuses to commit, and to push, the common forms of keys, tokens, passwords and connection strings, in its own commits and in yours; it is the last line, not the first, and it cannot recognise personal or production data.
