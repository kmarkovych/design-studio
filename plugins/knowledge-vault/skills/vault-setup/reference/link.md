# Linking a code repository

A linked code repository has an entry in the vault's registry (`id`, `remote`, `mainBranch`, `describedCommit`) and a link file `.knowledge-vault-link.json` at its root that names the product, the vault repository URL and its id. The hooks and vault-document find the vault through that file.

## 1. Facts

- Root: `git -C <path> rev-parse --show-toplevel`.
- Origin: `git -C <code> remote get-url origin`. No origin: stop; a functionality change is read from `origin/<main>`, so the code repository needs one.
- Main branch: `git -C <code> symbolic-ref --short refs/remotes/origin/HEAD`, minus `origin/`. If that ref is missing, read it from `git -C <code> ls-remote --symref origin HEAD` (read-only, unlike `remote set-head`).
- Ids already used: `node <skill-dir>/scripts/registry.mjs show <vault>`.
- An existing link file at the root naming a different vault repository: stop and show it to the user; a code repository belongs to one product.
- The head of `origin/<main>`: `git -C <code> log -1 --format='%H %cs %s' origin/<main>`.

## 2. Confirm id, branch and starting point

Recommend an id: the repository's folder name in kebab case (`shop-api`), unique within the vault. It appears in every note's `sources` as `<id>:<path>`, so it should stay stable. Ask the user to confirm the id, the main branch and the starting point (step 5) in one message, unless they already answered during `create.md` or `adopt.md`.

## 3. Link

`node <skill-dir>/scripts/setup.mjs link <vault> <code> --id <id> --branch <main>`

It adds the code repository to the vault's registry and to `<home>/config.json`, and writes `<code>/.knowledge-vault-link.json`. It does not commit anything in the code repository; you do not either.

## 4. The user commits the link file

Tell the user, in these words or close:

> I added `.knowledge-vault-link.json` to <code>. Please commit it yourself so other machines and other sessions find the vault, for example:
> `git -C <code> add .knowledge-vault-link.json && git -C <code> commit -m "chore: link knowledge vault"`
> It holds the product name, the vault repository URL and the id; no secrets. Anyone who can read this code repository will see the vault repository's URL, not its contents.

## 5. Starting point

An entry that already has a described commit (a second machine, a relink) keeps it: skip this step. A new entry has none. Ask, with the recommendation that fits:

```
❓ **Starting point for <id>**: From which commit should the vault describe <id>?
- The head of origin/<main> (<sha7>, <date>, "<subject>"): only later changes are described. Recommended when the vault already describes the product (an adopted vault).
- An earlier commit you name: the next pass describes everything after it. Only where the vault's notes match the code at that commit.
- A bootstrap pass: the vault is filled from the code at the head. Recommended for a vault that does not describe the product yet.

➡️ <the recommended one>
```

For a commit: `node <skill-dir>/scripts/registry.mjs describe <vault> <id> <sha>`. With no described commit it accepts any commit on `origin/<main>` and prints `described commit of <id> is now <sha>`. From then on the hooks remind about the commits after it and never ask for a bootstrap pass. For the bootstrap pass: leave the described commit empty and offer the vault-document skill when setup ends.

## 6. Commit and push the registry

The registry change lives in the vault. When `git -C <vault> status --porcelain -- .knowledge-vault.json` shows no change, there is nothing to commit. Otherwise commit only it: `git -C <vault> add -- .knowledge-vault.json`, then `git -C <vault> commit -m "docs(vault): link <id>" -m "Vault-Agent: knowledge-vault"`. Then `node <skill-dir>/scripts/sync.mjs <vault> push`: right away with sync `"plugin"`; with sync `"external"` after the user's yes to pushing that commit. Never the vault's own sync script: `sync.mjs` acts only on the path it is given and, for an external vault, commits nothing. If it says the vault "has uncommitted changes", nothing was pushed: tell the user the commit waits for the vault's own sync.

Complete when `registry.mjs show <vault>` lists the id with its main branch and the chosen described commit (or none, for a bootstrap pass), the link file exists, the registry commit is pushed or reported as waiting, and the user has the commit command for the link file.
