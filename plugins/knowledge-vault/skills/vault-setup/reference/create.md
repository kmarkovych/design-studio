# Creating a new vault

## 1. Gather the facts first

Before asking anything, find out yourself:

- the current code repository's root, its origin URL (`git -C <code> remote get-url origin`) and its main branch (`git -C <code> symbolic-ref --short refs/remotes/origin/HEAD`, minus `origin/`; if that ref is missing, read it from `git -C <code> ls-remote --symref origin HEAD`, which changes nothing)
- the git host of that URL: `github.com` or a GitLab host (gitlab.com or self-hosted)
- whether `gh` or `glab` is installed and logged in to that host (`gh auth status`, `glab auth status`)
- whether `~/Claude/Projects/<Product>/` already exists and is not empty

## 2. Ask one round

Ask every question below in one message, numbered, each with your recommended answer, worded so "yes" accepts it. Fill the recommendations from the facts above. Wait for the answers.

```
❓ **Q1 - Product name**: The vault describes one product, which may span several code repositories. I suggest "<Name from the code repository's name>". It names the vault folder and the vault repository.

➡️ <Name>

---

❓ **Q2 - Vault language**: Chosen once, at creation: folder names (`10-Продукт/…` or `10-Product/…`), note names and the notes themselves follow it. Ukrainian (uk) or English (en)?

➡️ Ukrainian

---

❓ **Q3 - Location**: Where the vault lives on this machine.

➡️ ~/Claude/Projects/<Name>/

---

❓ **Q4 - Vault repository**: The vault gets its own private git repository. I can create "<name>-vault" on <host> under <owner or group> with <gh|glab> (same host and owner as the code repository), or you give me the URL of an existing empty private repository.

➡️ Create <host>/<owner>/<name>-vault, private, with <gh|glab>

---

❓ **Q5 - Code repositories**: Which code repositories belong to this product? Each gets an id and its main branch.

➡️ This one only: id "<kebab name>", branch "<main>". Others can be linked later.

---

❓ **Q6 - Vault sync every 15 minutes**: Besides session start and end, a LaunchAgent (macOS) can sync every registered vault every 15 minutes, with no agent and no usage cost. Install it now?

➡️ Yes, install it

---

❓ **Q7 - Bootstrap pass**: After setup, one bounded documentation pass fills the vault from the existing code: an architecture overview, up to nine feature notes and a glossary. Run it now?

➡️ Yes, now
```

Drop Q4's create option when neither `gh` nor `glab` is logged in to the host, and ask for a URL instead. On Linux or WSL, Q6 is about printing a crontab line for the user. If the location already holds files, stop: that is an adoption, `adopt.md`.

## 3. Create the vault repository

Skip when the user gave a URL. Otherwise, with `<name>` from Q4 (lower case, hyphens):

- GitHub: `gh repo create <owner>/<name> --private --description "<Product> vault"`
- GitLab: `glab repo create <group>/<name> --private --description "<Product> vault"`. For a self-hosted GitLab, run it with `GITLAB_HOST=<host>` in the environment.

Build the URL in the same scheme as the code repository's origin, so the same credentials work: `git@<host>:<owner>/<name>.git` or `https://<host>/<owner>/<name>.git`.

For a URL the user gave, check visibility when the host's CLI can see it (`gh repo view <owner>/<name> --json visibility`, `glab repo view <group>/<name>`). Public: stop and ask the user to make it private first.

Complete when `git ls-remote <url>` exits 0 (an empty repository prints nothing).

## 4. Init

`node <skill-dir>/scripts/setup.mjs init <vault> --product "<Name>" --language <uk|en> --remote <url>`

It copies the vault templates of the chosen language, writes `.knowledge-vault.json`, makes the vault a git repository with one commit and `origin` set, and registers it in `<home>/config.json` with sync `"plugin"`. It pushes nothing; its last line names the push command, which is step 5. Check: `git -C <vault> remote get-url origin` prints the URL, and `node <skill-dir>/scripts/registry.mjs show <vault>` prints the product and sections.

## 5. First push

`node <skill-dir>/scripts/sync.mjs <vault> push`. It commits whatever init left uncommitted and pushes. Use it rather than `git push`: it checks the outgoing commits for secrets first.

- Exit 0: check `git -C <vault> ls-remote --heads origin` lists a branch.
- Exit 3: read the problem in `<home>/status.json` and follow `troubleshooting.md`.
- Exit 1: show the message; usually credentials or network. Fix, then push again.

## 6. Open it once in Obsidian

So Obsidian knows the vault and the user sees it: on macOS, `open "obsidian://open?path=<URL-encoded absolute vault path>"`. Elsewhere, or if that does nothing, tell the user: Obsidian → "Open folder as vault" → `<vault>`. If preflight reported no Obsidian app, skip this and say the vault opens whenever they install it. Obsidian's per-machine files (`workspace*.json`, `cache`) are ignored by git.

## 7. Link, schedule, bootstrap

1. For each code repository from Q5: `link.md`.
2. Q6 yes: `schedule.md` with `--apply`. Q6 no: `schedule.md` without it, and give the user the printed command.
3. Q7 yes: run the vault-document skill from the code repository; it sees "bootstrap needed" and runs the bootstrap pass. Q7 no: tell the user the next session in that code repository will offer it.

Complete when the vault is pushed, every chosen code repository is linked, and the schedule answer has been carried out.
