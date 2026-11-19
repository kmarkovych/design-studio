---
type: reference
updated: {{date}}
tags:
  - meta
---

# Schema of the {{product}} vault

## Folders
| Folder | What it holds | Who writes |
|---|---|---|
| `00-Inbox` | raw, not yet sorted: drafts, ideas, pasted pieces. Sort down to zero | people; an agent only when it does not know where something goes, and says so |
| `10-Product/Architecture` | how the product is built now: code repositories, modules, data flows, integrations. Hub: [[Architecture]] | the knowledge-vault agent |
| `10-Product/Features` | one feature, one note: what it does and how. Hub and index: [[Functionality]] | the knowledge-vault agent |
| `10-Product/Decisions` | one decision, one note `YYYY-MM-DD-Name`. Hub: [[Decision-register]] | the agent and people |
| `10-Product/Glossary.md` | the product's terms, one meaning per term: [[Glossary]] | the knowledge-vault agent |
| `10-Product/Change-log` | one entry per documentation pass, `YYYY-MM-DD-repoId-sha7`. Hub: [[Change-log]] | the knowledge-vault agent |
| `90-Meta` | this schema and the templates in `Templates/`. Nothing machine-only | people |

New top-level folders get a two-digit number (`20-…`, `30-…`); 10 and 90 are taken.

## Agent notes and owner notes
- An **agent note** has `agent: knowledge-vault` in its properties. The agent keeps it and may rewrite it from code at any time.
- An **owner note** is any note without that line. The agent never rewrites it; it may only append a link to another note to its "Related:" line or to a list of links.
- To keep your own edits in an agent note, delete its `agent: knowledge-vault` line: from then on it is yours.

## Properties (Latin keys, values in English)
| Key | Where | Value |
|---|---|---|
| `type` | everywhere | one from the list below |
| `agent` | agent notes | always `knowledge-vault` |
| `updated` | everywhere except the change log hub | date of the last change, `YYYY-MM-DD` |
| `sources` | agent notes | list of `repoId:path`, the code files the note was written from |
| `status` | `feature`, `decision` | feature: `active` / `removed`; decision: `in-force` / `superseded` |
| `area` | `feature`, `architecture` | the product area, briefly |
| `date` | `decision`, `change-log` | date of the decision or the pass |
| `repo`, `from`, `to` | `change-log` | code repository id, previous and new described commit |
| `tags` | everywhere | topics, lower case |

## Note types (`type`)
The list is closed: use no other values.

`hub`: entry point to a topic · `architecture`: one part of how the product is built · `feature`: a feature, as it works now · `decision`: a decision and why · `glossary`: the glossary · `change-log`: a change log entry · `reference`: reference for people (like this schema) · `note`: an ordinary note

## Rules
1. **One subject, one note.** A feature, a module, a decision: separate files.
2. **Connections through `[[wikilinks]]`** by shortest path, without the `.md` extension. At the end of a note, a "Related:" line with links separated by ` · `.
3. **Absolute dates:** `2026-11-19`, never "last week".
4. **File names** in English, words joined by hyphens, no dates except for decisions and change log entries.
5. **Decisions are not edited after the fact:** a new decision is a new file, the old one gets `status: superseded`.
6. **No secrets:** no values from `.env`, keys, tokens, passwords, connection strings, customer personal data or production data. A variable's name is fine, its value is not.

## Sync
The vault is its own private git repository. The knowledge-vault plugin's script syncs it: at the start and end of a Claude Code session, and every 15 minutes if the schedule is installed. It never merges a conflict itself: it aborts the rebase and warns.

## Obsidian
- Links: *Settings → Files and links*: "Shortest path when possible", Wikilinks on (already in `.obsidian/app.json`).
- Templates: *Settings → Core plugins → Templates*, template folder `90-Meta/Templates`. Insert: `Cmd+P` → *Insert template*.

Related: [[Home]] · [[AGENTS]]
