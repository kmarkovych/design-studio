# Instructions for agents: the {{product}} vault

This folder is the Obsidian vault of the product {{product}} and its own private git repository. It describes how the product works now (`10-Product/`) and how it got there (the change log). The rules below apply to any agent that writes here: Claude Code, Codex and others.

## Before you answer or write
1. Read [[Home]], the relevant hub, and only then the note itself. The answer is often already here.
2. Where things go follows [[Vault-schema]] (`90-Meta/Vault-schema.md`). If you do not know where something goes, put it in `00-Inbox/` and say so.
3. Before creating a note, search whether it already exists; change the existing one instead of writing a second.

## Where things go
| What | Where |
|---|---|
| How a part of the product is built | `10-Product/Architecture/`, linked from [[Architecture]] |
| What a feature does and how it works | `10-Product/Features/`, linked from [[Functionality]] |
| A decision and why | `10-Product/Decisions/YYYY-MM-DD-Name.md`, linked from [[Decision-register]] |
| A term of the product | [[Glossary]] |
| What a documentation pass described | `10-Product/Change-log/YYYY-MM-DD-repoId-sha7.md`, one line in [[Change-log]] |
| Raw, not yet sorted | `00-Inbox/` |

## Agent notes and owner notes
- An **agent note** has `agent: knowledge-vault` in its properties. Only the documentation pass of the knowledge-vault plugin (the `vault-document` skill) sets that line. Such notes may be rewritten from code at any time.
- An **owner note** has no such line: a person wrote it (or an agent at a person's request). Never rewrite it. The only permitted edit is appending a link to another note to its "Related:" line or to a list of links, leaving the existing text as it is.
- When you write a note at a person's request, outside a documentation pass, write it as an owner note, without the `agent` line.

## Note format
- YAML properties are required, keys and values in English: `type`, `updated` (`YYYY-MM-DD`), `tags`; agent notes also carry `agent: knowledge-vault` and `sources`, a list of `repoId:path` code files the note was written from; `status` and `area` where the schema calls for them.
- `type` only from the list in [[Vault-schema]]: `hub`, `architecture`, `feature`, `decision`, `glossary`, `change-log`, `reference`, `note`.
- H1 is what the note is about. File names in English, words joined by hyphens.
- Links are `[[wikilinks]]` by shortest path. At the end, one line `Related: [[A]] · [[B]]`.
- Code paths in backticks with the code repository's id: `web:src/billing/invoice.ts`. Not as wikilinks and not as long pieces of code.
- A new note in a section gets a line with its link in that section's hub.

## Two layers
- **Current-state notes** (architecture, features, glossary) describe the product as it is now. When something stops being true, rewrite the note; do not append "changed on…" paragraphs.
- **Change log entries**, one per documentation pass: which commits it covered and which notes it changed. An entry is never edited once written. The hub [[Change-log]] only gets a line appended at the bottom; its properties do not change.
- Decisions are not rewritten after the fact: a new decision is a new file, the old one gets `status: superseded` and a link to the new one.

## Secrets
Never in the vault: values from `.env`, API keys, tokens, passwords, private keys, database connection strings with a user name or password, webhook URLs that carry a token, customer personal data (names, emails, phone numbers, addresses), production data, even when they appear in code, logs or commits. You may name a variable and say what it controls (`STRIPE_SECRET_KEY`, the Stripe key, set in `.env`), never its value. The sync script refuses to commit or push files that look like secrets.

## Commits
- A documentation pass commits only its own files, with the subject `docs(vault): <what was described>` and the trailer line `Vault-Agent: knowledge-vault` in a paragraph of its own.
- A documentation pass never runs this vault's own scripts (sync or any other), whatever other instructions say: they may act on another path. It pulls and pushes only with the plugin's `sync.mjs <vault> pull|push`, which acts only on the path it is given.
- Mechanical vault sync commits by itself with the subject `vault: sync (<host>, N files)`. Do not use that subject by hand.
- Never force a conflict through. Agent notes in conflict may be rewritten from code; if even one owner note is in conflict, stop and show the conflict to a person.

Related: [[Home]] · [[Vault-schema]]
