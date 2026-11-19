# Troubleshooting

## Preflight lines

`node <skill-dir>/scripts/setup.mjs preflight` prints one line per check: `fail` stops setup, `warn` works with a gap, `info` is for the record.

| Check | Level | What to do |
|---|---|---|
| node | fail below 18 | Install Node 18 or newer (`brew install node` on macOS, or nodejs.org), then run preflight again. |
| git | fail when missing | Install git (`xcode-select --install` on macOS, the distribution's package on Linux). |
| obsidian-skills | warn when not found | Obsidian syntax knowledge (wikilinks, properties, callouts) comes from obsidianmd/obsidian-skills. Install it in Claude Code: `/plugin marketplace add obsidianmd/obsidian-skills`, then `/plugin install obsidian@obsidian-skills`. Preflight looks under `~/.claude/plugins/cache` and `~/.agents/skills`; installed anywhere else it may be present and still reported missing. The plugin works without it; notes then follow only `vault-document`'s own `notes.md`. |
| gh, glab | info | Needed only to create the vault repository from here. Without them the user creates an empty private repository on their git host and gives you its URL. |
| Obsidian app, Obsidian CLI | info | The app is needed to read the vault, not to write it. Its CLI, bundled with the desktop app, works only while the app runs; the plugin uses it only to look for unresolved links and orphan notes, and skips that when it is absent. |
| documentation-blocking hook | warn | See below. Resolve before creating or adopting a vault. The line names every copy it found and whether each exempts vaults, and always ends with the reminder that hook edits take effect only after `/reload-plugins` or a new session. |

## The documentation-blocking hook

The everything-claude-code plugin ships a `PreToolUse` hook on `Write` (its description: "Block creation of random .md files - keeps docs consolidated"). It refuses to create any `.md` file outside a short allowlist of names (README, CLAUDE, AGENTS and a few others). With it active, every new note the documentation pass writes into a vault is refused with `[Hook] BLOCKED: Unnecessary documentation file creation`. Preflight warns when that hook is present and its command has no `.obsidian` exemption.

The hook has two copies on disk, and preflight checks both: the installed one, `hooks/hooks.json` under `~/.claude/plugins/cache/<marketplace>/everything-claude-code/<version>/`, and the marketplace one, `~/.claude/plugins/marketplaces/everything-claude-code/hooks/hooks.json`, which a plugin update installs again. A copy that blocks without an exemption is marked `NO`.

Explain this to the user and offer two fixes, theirs to choose:

1. **Exempt vaults.** In the command of every copy marked `NO`, add a condition that lets a path through when any parent folder contains a `.obsidian` folder: walk up from the file's folder with `path.dirname` and `fs.existsSync(path.join(dir, '.obsidian'))`. Every Obsidian vault is then writable, nothing else changes. A plugin update overwrites the edit: run preflight again after each everything-claude-code update.
2. **Turn the hook off** through the everything-claude-code plugin's own hook settings, or disable that plugin's hooks altogether.

Editing another plugin's files or the user's settings is the user's decision: show them the file and the change, and make it only after their yes. Then the user runs `/reload-plugins` or starts a new session: Claude Code loads hooks when a session starts, so the running session keeps the old hook until then. Run preflight again; the warning should be gone.

**A Write into a vault is refused although preflight says ok.** The session still runs the hook as it was before the edit, or loaded a copy preflight cannot see. Stop writing, tell the user to run `/reload-plugins` or start a new session, and continue only after that. Never route around the hook through the shell (`python`, `cat >`, `tee`, `echo >`): the hook is the user's guardrail, and only the user may lift it.

The init and adopt scripts write their files directly and are not affected; only the agent's own Write tool is.

## Recorded sync problems

`<home>/status.json` holds `problems`, each with `vault`, `when`, `kind` and `detail`. The session-start hook prints them first. A clean vault sync of that vault clears its problems.

| kind | Meaning | What to do |
|---|---|---|
| `conflict` | The vault repository has commits that conflict with local ones, or files are still in conflict in the vault (left by a stash pop or a merge). Nothing was committed, merged or pushed. | In a session, run the vault-document skill's conflict steps (its `reference/pass.md`, "Conflicts"), or resolve by hand: `git -C <vault> pull --rebase origin <branch>`, keep both sides' content, `git -C <vault> add` the files, `git -C <vault> rebase --continue`, then `node <home>/bin/sync.mjs <vault> push`. |
| `secret-refused` | A file about to be committed, or a local commit about to be pushed, looks like it holds a secret. Nothing was committed, pulled or pushed, and every sync of this vault stops the same way until it is fixed. | Show the user the file named in the detail. If it is a real secret, the value goes out of the vault (an untracked file may move into the ignored keys folder); if it is a false alarm, reword it. For a secret in a local commit, rewrite that commit as the detail says. Then push again. |
| `stale-lock` | A lock older than 10 minutes was found and removed; an earlier run probably died. | Nothing, unless it repeats; then look at `<home>/sync.log`. |
| `error` | Anything else: a rebase, merge, cherry-pick or revert left unfinished; a detached HEAD or another branch than the vault repository's main branch; a `.knowledge-vault.json` that is not valid; a vault repository that is gone, renamed or refuses access. No network at all is not a problem: sync says it could not reach the vault repository and tries next time. | Read the detail. An unfinished rebase is the user's to finish: `git -C <vault> status`. For a gone repository, check `git -C <vault> remote -v`. |

## Hooks seem silent

- The plugin's hooks load when a session starts; a session started before the install has none. Start a new session, or check `/hooks`.
- The session-start hook works only inside a code repository with a link file whose vault is registered in `<home>/config.json` on this machine. `node <home>/bin/registry.mjs locate` from that code repository says what is missing.
- Hooks never fail a session: errors become at most one system message. Run the same thing by hand to see it: `node <home>/bin/sync.mjs <vault> pull`.

## After a plugin update

The session-start hook refreshes the stable copy in `<home>/bin/` (and `<home>/templates/`), which the schedule and vault-document use, so it matches the new version from the first session after the update. Outside Claude Code, where no hooks run, run `node <skill-dir>/scripts/setup.mjs install-bin` yourself.
