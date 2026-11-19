# The bootstrap pass

The one bounded documentation pass that fills a vault from a code repository's existing code, run when `registry.mjs undescribed` reports "bootstrap needed" and the head sha. It describes the product as it is at that head; it does not walk the commit history. It runs once per code repository: the second code repository of a product gets its own bootstrap pass, which adds to the notes the first one wrote.

Steps 1 and 2 of `pass.md` (locate, bring the vault up to date, hold it) come first, and its step 9 (commit, release, push) comes last. Read `notes.md` before writing.

## Cap

At most 15 notes written or rewritten in one bootstrap pass, plus the hub lines and the change log entry:

- 1 architecture overview (`Огляд-архітектури` in a Ukrainian vault, `Architecture-overview` in an English one), or a new section in it for the second and later code repositories
- up to 4 more architecture notes, for the parts the overview cannot hold in a paragraph
- up to 9 feature notes, one per major feature or module
- 1 glossary

The cap protects the owner's attention and the session's budget. Whatever does not fit goes to "Лишилось на потім" ("Left for later" in an English vault) in the change log entry; later documentation passes create those notes when a functionality change touches them, or the user asks for one.

## What to read

All from `origin/<main>`, read-only, as `pass.md` step 4 allows. In this order, stopping each item once you can say what it tells you:

1. The file list: `git -C <code> ls-tree -r --name-only <head>`. Note the top-level layout and where code, config, migrations, tests and docs live.
2. `README*`, `CONTRIBUTING*`, `AGENTS.md`, `CLAUDE.md`, any `docs/` folder, ADR files (`docs/adr/`, `adr/`, `decisions/`).
3. Manifests: `package.json`, `composer.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile` and similar: the stack, the entry points, the scripts.
4. Entry points and the map of the outside surface: routes, CLI commands, scheduled jobs, queue consumers, public API definitions.
5. The data model: migrations or schema files, model classes. Names and relations only.
6. Configuration shape: config files and `.env.example` for which settings exist. Names only, never values.
7. For each major feature or module chosen below: its main files, enough to say what it does, its rules and limits.

A major feature or module is one that has its own routes or screens, its own folder or namespace, or that several other parts depend on. Rank candidates by how much of the outside surface they carry and take the top nine.

## Adopted vaults

An adopted vault whose mapped sections already describe the product gets no bootstrap pass: the user sets a starting point instead (`pass.md`, step 3). The bootstrap pass is for a code repository the vault does not describe yet.

Before writing, read the owner notes that already cover the same ground (the feature index, existing feature or architecture notes in the mapped sections). Where an owner note already describes a feature, do not write a rival note: link the owner note from the feature index if it is not there yet, and spend the cap elsewhere. Note in the change log entry which owner notes you relied on.

## Decisions

Write decision notes only for decisions the code repository records itself (ADR files, a decisions document), at most three, each sourced to its file. Decisions you infer from the code go into the relevant architecture note as one sentence, marked as inferred.

## Finish

1. Write the notes, the hub lines and the glossary.
2. Write the change log entry: `from` empty, `to` the head sha; under "Охоплені коміти" one line `sha7 date — початковий опис з коду (bootstrap)` (English vault: "Covered commits", `sha7 date: first description from code (bootstrap)`); every note written; "Лишилось на потім" / "Left for later" with each module or feature left out, one line each.
3. `node <bin>/registry.mjs describe <vault> <repoId> <head sha>`.
4. Commit and push as `pass.md` step 9 says, with the subject `docs(vault): <repoId> bootstrap at <sha7>`.

Complete when the vault's hubs link every note written, the change log entry lists what was left out, and the described commit is the head.
