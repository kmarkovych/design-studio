# design-studio

design-studio is a Claude Code plugin that does the work of a UI/UX designer for interfaces that run in a browser. You call it from inside the project you want designed. It interviews you, builds three different visual directions for one key screen, and has separate agents that built none of them compare the directions from screenshots. It then refines the direction you pick until a scripted check and the critics find nothing blocking, and documents the result as a design system.

It is built on the [impeccable](https://github.com/pbakaus/impeccable) design skill. Impeccable supplies the design knowledge, the screenshot tool, the detector and the finish agents. The studio adds five things: an intake grill, three divergent directions, judging, capped refinement and scripted checks.

## What one run gives you

A run is one pass of the studio on one brief. It produces:

- `PRODUCT.md` at your project root: the product profile (users, purpose, positioning, evidence on hand), written once per project in impeccable's own format.
- A confirmed brief for the screens in this run.
- Three comps of the key screen, one per direction, at desktop (1440x900) and phone (390x844) width, with a gallery page that shows them side by side with the judges' ranking.
- The direction you chose, built out to every screen in the brief and refined.
- `DESIGN.md` at your project root, written by impeccable's documenter from the final comps.
- A sign-off record that states plainly whether the comps passed or the run stopped with findings still open.

Comps are standalone HTML and CSS files. Every colour, font, size, spacing step, radius and duration is a CSS custom property, and the pages open from disk with no build step. They use your real copy. Proof (claims about customers or outcomes: testimonials, customer names and logos, customer counts, ratings, press, photographs of real people or places, performance figures) appears only when you have said it is real; anything missing is a visibly marked placeholder. Arithmetic on a real figure you gave (a price times a number of units) and sample data visibly labelled as such inside a drawn product view are not proof.

A run delivers the design stage only. Putting the design into your project's real code is a separate, later implementation stage, and the studio does not do it.

The studio designs browser-rendered screens only: web pages and web app screens, not native iOS or Android. If all you want is a critique of an existing page, use impeccable's own `critique`. A critique on its own is not a run.

## What you need

| Dependency | Why | Install |
|---|---|---|
| Claude Code | Runs the studio | `curl -fsSL https://claude.ai/install.sh \| bash` (other methods: [Claude Code docs](https://code.claude.com/docs)) |
| Node 18 or newer | Runs the studio's scripts | [nodejs.org](https://nodejs.org), or `brew install node` on macOS |
| A Chromium-family browser | Screenshots and rendered scans | Google Chrome, Chromium, Microsoft Edge or Brave. On macOS: `brew install --cask google-chrome` |
| impeccable 4.10.0 or newer | The design backbone | `npx impeccable install` |
| grilling (required) | Runs the intake grill | `/plugin install mattpocock-skills@claude-plugins-official` |
| frontend-design (optional) | Lets direction designers push further apart | `/plugin install frontend-design@claude-plugins-official` |

Notes on these:

- **impeccable.** Use `npx impeccable install`. The studio also needs two of impeccable's own agents, `impeccable-finish-reviewer` and `impeccable-documenter`. Preflight does not check for them; the skill checks your agent list before a run starts and stops if either is missing. Which install routes add these agents has not been verified. Preflight looks for impeccable in `.claude/skills/` and `.agents/skills/` inside your project, and in `~/.claude/skills/` and `~/.agents/skills/`. It does not look inside Claude Code's plugin cache. If you installed impeccable as a Claude Code plugin instead, set `IMPECCABLE_SKILL_DIR` to the folder that holds impeccable's `SKILL.md`. Preflight's real output below comes from a user-level install in `~/.claude/skills/impeccable`; other install layouts have not been checked.
- **Environment variables** such as `IMPECCABLE_SKILL_DIR` and `IMPECCABLE_BROWSER` are read by the commands Claude Code runs, so set them in the shell before you start `claude`, or under `env` in Claude Code's `settings.json`. Exporting them in another terminal has no effect.
- **grilling** comes from Matt Pocock's skills plugin, `mattpocock-skills`, in the official `claude-plugins-official` marketplace. If Claude Code does not know that marketplace, add it first: `/plugin marketplace add anthropics/claude-plugins-official`. The studio uses the skill by name and does not copy it.
- **frontend-design** is used only by the direction designers, and only when it is installed. Without it the studio still runs, and it tells you so at Gate 1.

The studio never copies a dependency into this repository. When something is missing, preflight names it and prints the install command.

## Installing in Claude Code

```
/plugin marketplace add kmarkovych/design-studio
/plugin install design-studio@design-studio
```

The same from a shell:

```
claude plugin marketplace add kmarkovych/design-studio
claude plugin install design-studio@design-studio
```

`claude plugin install` installs for your user by default. Add `--scope project` to install it for one project only.

The repository is private for now. Claude Code fetches it with the git credentials already on your machine, so you need read access to it. The install commands above have not yet been run against the published repository.

Once it is installed, the skill is `/design-studio:studio-run`. Start a run with that command, or by saying "run the design studio". A plain request such as "design the pricing page" may load impeccable directly instead, because impeccable answers the same kind of request; whether Claude Code picks the studio on its own has not been tested.

## Installing in other agents (designed for, not yet tested)

The skill is a plain Agent Skill, written so that it can also run in OpenAI Codex CLI, OpenClaw and similar agents. None of them has been tested.

```
npx skills add kmarkovych/design-studio
```

There the skill is called `studio-run`. `npx skills` installs into the current project by default. Its documentation does not say how it handles private repositories, so that is unknown until the repository is public or someone tries it.

Outside Claude Code, the studio's four agent definitions are not installed. The skill tells the host agent to start fresh sub-agents with the same instructions instead, on a mid-tier model for building and the strongest available model for judging. If the agent cannot start sub-agents, the skill does each piece of work one after another with a clean slate and says that it did. It also says that the agents that make comps and the agents that judge them were then less well separated.

## Verifying the install

Run preflight from your project root. In Claude Code, the simplest way is to ask: "Run the studio-run preflight for this project." To run it yourself:

```
node <plugin folder>/skills/studio-run/scripts/preflight.mjs --project .
```

Other plugins on the machine this was written on are stored at `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`. That would put this one at `~/.claude/plugins/cache/design-studio/design-studio/0.1.0/`, but that location has not been checked after a real install. If it is not there, this finds it:

```
find ~/.claude/plugins -path '*studio-run/scripts/preflight.mjs'
```

A good result (real output, home folder shown as `~`):

```
ok   node: Node 24.22.1
ok   impeccable: ~/.claude/skills/impeccable
ok   impeccable-version: 4.10.0 (>= 4.10.0)
ok   capture: headless screenshots work (1440x900 and 390x844)
ok   grilling: ~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/productivity/grilling
ok   frontend-design: ~/.claude/plugins/cache/claude-plugins-official/frontend-design/1.1.1/skills/frontend-design
```

It exits 0 when nothing failed and 1 when anything did. `capture` actually takes two screenshots of a test page, so a pass means your browser works. Add `--json` for machine-readable output.

A machine with nothing installed (real output):

```
ok   node: Node 24.22.1
FAIL impeccable: impeccable skill not found
      fix: npx impeccable install
skip impeccable-version: skipped: impeccable not found
skip capture: skipped: impeccable not found
warn grilling: skill "grilling" not found. This script may simply not see skills installed in a way it does not know; also consult your own skill list.
      fix: Claude Code: /plugin install mattpocock-skills@claude-plugins-official. Other agents: npx skills add mattpocock/skills
warn frontend-design: skill "frontend-design" not found. This script may simply not see skills installed in a way it does not know; also consult your own skill list.
      fix: Claude Code: /plugin install frontend-design@claude-plugins-official. Other agents: npx skills add anthropics/skills --skill frontend-design
```

`grilling` is only a warning in the script because a skill can be installed somewhere the script does not look. The run itself treats it as required: if the agent cannot find grilling in its own skill list either, the run stops.

## Your first run

Open Claude Code in the project you want designed and ask for a design. Name the screen, where the real copy is, and what proof you really have. Start with the skill name, as below.

A new design:

```
/design-studio:studio-run Design the pricing page for our clinic scheduling app.
The copy is in docs/pricing-copy.md. We have no customer quotes we can use yet.
```

A redesign of an existing page:

```
/design-studio:studio-run Redesign the signup page, src/pages/signup.html
(it runs at http://localhost:5173/signup). People drop off at the plan step.
```

The run stops for you at exactly three gates and works on its own in between. Each gate asks numbered questions, gives a recommended answer under each one, and words each question so that "yes" accepts the recommendation. You can answer "yes", or answer in your own words.

The plugin grants itself no permissions. Unless you have already allowed them, Claude Code asks you to approve the commands the run uses (`node` running the studio's scripts, impeccable's launcher) and the files it writes under `design/runs/`, `PRODUCT.md` and `DESIGN.md`, for the main conversation and for its sub-agents. Expect these prompts between gates. To work through a run without them, allow those commands and edits for the project when the prompt offers it, or add allow rules with `/permissions`.

### 1. Preflight

The run starts with preflight. If anything fails, you get each failure with its fix, and no run starts. If your request continues an unfinished run in `design/runs/`, the studio resumes it instead of starting a new one (see [Resuming an interrupted run](#resuming-an-interrupted-run)).

### 2. The intake grill, ending at Gate 1

The grill is an interview that follows the grilling skill. It works in rounds and asks every question it can answer at that point in one round. Anything it can look up in your project, it looks up instead of asking: your README, routes, existing copy, brand files, fonts, stylesheets, and any proof such as testimonials, ratings or performance figures. You make the decisions.

For a redesign, it first takes screenshots of the existing page at both widths, runs impeccable's detector on it, and has a critic assess it. The first round then opens with what is wrong today and asks what must survive.

What it asks:

- **The product profile**, only the first time in a project: users, purpose, positioning, operating context, capabilities and constraints, brand commitments, evidence on hand, principles and accessibility. When `PRODUCT.md` already exists, it only asks whether anything in it is out of date. `PRODUCT.md` holds facts, not taste.
- **The design system**, only when `DESIGN.md` exists: does this run work within it or replace it? Within it, the three directions differ in composition, hierarchy and emphasis only. Replacing it, they may differ in everything.
- **The brief** for this run: the key screen all three directions build, any other screens, who arrives and the one action the page exists for, impeccable's mode for the page (Persuade, Operate, Read or Experience), where the copy comes from and which proof is real, constraints, references you like and dislike, and what will decide your pick.

The grill ends by proposing three stances. A stance is a named point of view drawn from your answers, such as "Day sheet" or "Waiting room": what the page believes it is for, what it leads with, and what it gives up.

**Gate 1** shows a summary of the brief and the three stances, and asks two questions:

1. Is the brief right as written in `brief.md`?
2. Build these three stances?

Corrections update the brief and bring Gate 1 back. Only a yes to both, or your explicit go-ahead, moves the run on.

### 3. Directions and judging, ending at Gate 2

Without stopping, three direction designers each build the key screen from the same brief and a different stance. The studio runs the check on each comp. Then one judge per pair compares the comps from their screenshots and the brief only, and `gallery.mjs` turns the pairwise results into a ranking. No agent ranks. If a direction designer fails twice, Gate 2 comes early and asks whether to retry that direction; the studio judges fewer than three directions only if you say so.

**Gate 2** opens `gallery.html` in your browser and asks:

1. Use the top-ranked direction as the base for the remaining screens and refinement? If the judges tied, there is no recommendation and you pick.
2. Borrow nothing from the other directions? To borrow something, name the element and the direction it comes from.

You may pick any direction, whatever its rank or check result. The studio records your answer in your own words in `decision.md`. If you want none of them, the run closes there, and a new run can start from what you said.

### 4. Refinement and finish, ending at Gate 3

Without stopping, the chosen direction is copied to `final/`. One direction designer builds the remaining screens and applies your borrow notes. Then come up to three refinement rounds. In each round, two critics review the pages (a design critique and an accessibility and quality audit, both following impeccable's playbooks), the fixer resolves the blocking findings, and the studio runs the check again. A round ends the refinement early as soon as nothing blocking remains.

After that, impeccable's finish reviewer takes a fresh look, with at most one correction round, and impeccable's documenter writes `DESIGN.md` (when `DESIGN.md` already existed, only after your answer at Gate 3).

**Gate 3** shows the check result per page, the open critic findings by severity, and the finish reviewer's verdict word exactly as it gave it. When that word is not `ship`, Gate 3 says the reviewer does not pass the comps and lists the material fixes it left open, separating out the studio's known substitutes (see the limits below). It asks:

1. Accept these comps as the end of the design stage?
2. Only when `DESIGN.md` already existed: it first shows you the existing file, then asks whether to merge this run's system into it or overwrite it. The choices are refresh, overwrite and merge. Impeccable defines merge as keeping the existing file's confirmed decisions and reconciling them with this run; it does not define refresh and overwrite further. The studio recommends merge when the run worked within the system, and overwrite when it replaced it.

If you ask for changes instead, the fixer makes exactly those and the check runs again. If the check then fails, Gate 3 comes back as a stopped run. Otherwise the finish reviewer takes a fresh full look, the documenter rewrites `DESIGN.md` if it already wrote it in this run, and Gate 3 comes back, saying that your changes were covered by the check and the finish reviewer, not by a critic.

If blocking findings remain after three rounds, Gate 3 instead says the run is not finished and lists exactly what still fails. `DESIGN.md` is not written in that case. You can close the run as stopped, then fix the problems by hand or start a new run with a changed brief.

## What a run leaves in your project

```
<your project>/
├── PRODUCT.md                     product profile, impeccable's format
├── DESIGN.md                      design system, written at the finish
├── .impeccable/design.json        DESIGN.md's companion file
└── design/runs/<YYYY-MM-DD>-<short-name>/
    ├── brief.md                   brief, stances, "Confirmed at Gate 1: <date>"
    ├── current/                   redesign only: screenshots, detector output, critique.md
    ├── directions/<a|b|c>/
    │   ├── direction.md           the direction's contract
    │   ├── index.html, styles.css the key-screen comp and its local files
    │   ├── shots/index/           1440x900.png, 390x844.png, -full.png whole-page versions,
    │   │                          and readable slices of those (-full-1.png, -full-2.png ...)
    │   └── checks/index.json      check result, listing the slices
    ├── judging.json               the judges' pairwise results
    ├── gallery.html               the directions side by side, with the ranking
    ├── decision.md                your Gate 2 choice in your words, borrow notes, FORM line
    ├── final/
    │   ├── direction.md           the chosen contract (a development record, never shipped)
    │   ├── index.html, <screen>.html, styles.css
    │   ├── shots/<page>/, checks/<page>.json
    │   ├── rounds/<n>/            design-critique.md, audit.md, findings.md, fixes.md
    │   │                          (round 3 adds verification.md)
    │   └── finish-verdict.md      the finish record: the finish reviewer's, fixer's and documenter's returns
    └── signoff.md                 your Gate 3 answer and the run's final state
```

To view the comps, open `final/index.html` (and the other pages beside it) in a browser. To see the three directions, open `gallery.html`.

**What to commit:** `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` and the whole run folder. The run folder is the record of what was decided and why, and it is also the only state a resumed run reads. Do not add `.impeccable/` as a whole to `.gitignore`: impeccable keeps files there that belong in version control, and its scratch folders ignore themselves.

Critique and audit results are written into the run folder only. The studio does not use impeccable's critique or audit storage commands, which can upload to an online impeccable account.

## How quality is decided

A comp passes only when both of these hold:

1. **The check exits 0 on every page.** The check is `check.mjs`. It takes screenshots with `impeccable shot` at 1440x900 and 390x844, of the first viewport and of the whole page, then runs `impeccable detect` three times: on the HTML file, and on the rendered page at each width. Any primary finding fails the page; advisories are recorded but do not count. Each finding names the file the detector pointed to (for the check's own scans, the page itself, always as a path), the line in it (`0` when the detector does not know it, which in impeccable 4.10 is always), and how many times the same rule and snippet came up in one scan. It writes the screenshots to `shots/<page>/` and the result to `checks/<page>.json`. It also cuts each whole-page capture into slices a person or model can read (`1440x900-full-1.png`, `1440x900-full-2.png` ... and the same for `390x844`), numbered from the top: at most 1400 px tall on desktop and 1600 px on phone, overlapping by 100 px, listed in order under `slices` in the result. Exit 0 means pass, 2 means findings, and 1 means the check could not run.
2. **No critic finding of severity P0 or P1 remains.** The severities are impeccable's. P0 means the finding stops the visitor from completing what they came to do. P1 means significant difficulty or a WCAG AA violation. P2 and P3 are recorded but do not block.

A critic's opinion can rank and advise, but it cannot pass a comp that fails the check.

Real check output, from copies of two trial comps (folder shortened to `<comps>`):

```
PASS <comps>/a/index.html
0 primary finding(s), 1 advisory, 0 error(s)

FAIL <comps>/b/index.html
1 primary finding(s), 3 advisory, 0 error(s)
  [warning] tight-leading: line-height 1.24x (need >=1.3) at <comps>/b/index.html x5 (static)
```

That finding has no selector, and `1.24` appears nowhere in the comp's CSS: the static scan works out sizes without a browser, and it misjudged the comp's `clamp()` lede size, so the lede's `line-height: 1.4` came out as 1.24 (with a fixed lede size, or a line-height of 1.5, it is not reported). The rendered scans did not report it. The designer has to find such rules by reading the CSS (see "Limits you should know").

Making and judging are kept apart. Direction designers and the fixer never judge. Judges and critics never see the conversation in which a comp was made, only files and screenshots, and they must open the PNG screenshots (the first viewport at each width and every slice of the whole page) rather than reason from the source. Direction designers and the fixer run on a mid-tier model (`sonnet`), and judges and critics on a stronger one (`opus`). The studio never relies on the conversation's default model, and it tells you if a model could not be set.

Judges score each comp from 1 to 5 on design quality, originality, craft, and fit to the brief, weighted to a total out of 50, and name a winner for their pair. Fit includes what your brief says will decide your pick. A comp that shows proof you did not name as real scores 1 on fit; a visibly marked placeholder is not held against it unless the comp's lead depends on content you said does not exist. The gallery's ranking is the count of pairwise wins. When the judges' preferences go round in a circle, the gallery says there is no clear winner, and the studio does not break the tie.

### Limits you should know

- **Accessibility is judged by a model, not measured by a script.** The audit critic follows impeccable's audit playbook from screenshots and source. The detector does catch some problems, such as low contrast, but no script audits accessibility as a whole in this version.
- **The check cannot always say where a finding is.** The detector gives no line numbers, and a static-scan finding often has no selector. Its snippet can be a value the detector computed, such as `line-height 1.24x`, which appears nowhere in the source and can differ from what a browser computes, because the static scan can misjudge a `clamp()` or `calc()` size. The designer or fixer then has to find the rule by reading the CSS.
- **Round caps and stage order are followed by the agent, not enforced by code.** The only verdict that code enforces is the check's exit code. See `docs/adr/0001-skills-are-the-only-orchestration.md` for why.
- Judges and critics see the first viewport at each width and the whole page in slices. Critics also read the source for what no screenshot shows, such as focus states.
- A fixed or sticky element, such as a header or a bottom action bar, is painted partway down the whole-page captures and their slices, over other content. That is a capture artifact: judges and critics judge fixed and sticky elements from the first-viewport captures only.
- Screenshots are taken as the page loads, with no wait for motion and no reduced-motion setting, so comps must show their content at load; content caught mid-animation counts against a comp.
- Changes made after refinement (the finish reviewer's correction round, or changes you ask for at Gate 3) are covered by the check and the finish reviewer, not by another critic round. Gate 3 says so.
- Impeccable's finish reviewer expects the direction contract to name a seed from impeccable's own direction roll (`concept-seed`). The studio does not use that roll. Instead it writes `seed: none (pinned)` and quotes the stance the studio proposed and you confirmed at Gate 1, plus your own words from Gate 2. The reviewer may still list this as a material fix, and usually will, because it accepts a pin only when your own request or answers pin both the direction's world and its first screen. Gate 3 then names it as the studio's known substitute. When it is the reviewer's only material fix, the studio skips the correction round, since there is nothing for the fixer to change.
- For a redesign, the existing page is captured with `impeccable shot` and `impeccable detect` directly, not through `check.mjs`, which takes only a local comp file, so its whole-page captures are not cut into slices. It is the one exception to capturing through the check.
- The critic is told never to change files, but it keeps Bash to inspect evidence, so that rule is followed by the agent, not enforced by its tool list. The judge has no tool that can write.

## Cost

The cost of a full run has not been measured. A run uses many sub-agents: up to about two dozen, a mix of `sonnet` and `opus`. Published figures for comparable systems, in which one agent makes and another grades, run to the low hundreds of dollars when nothing caps them. That is why these caps exist:

- three directions, one key screen each, at two widths;
- one judge per pair;
- at most three check runs per direction designer, every run counted;
- at most three refinement rounds, then one verification by the critics;
- one correction round after the finish reviewer.

The biggest factor you control is the number of other screens in the brief. Each extra screen is another page for the direction designer and for every refinement round. The grill recommends only the screens needed to show the system working.

## Resuming an interrupted run

There is no separate state file. The run folder shows how far the run got. To resume, open Claude Code in the same project and ask to continue the design run. The studio looks in `design/runs/` for a run without `signoff.md`, works out the first unfinished step from the files present, tells you in one line where it is resuming and why, and carries on.

Files may have changed since the run stopped, so before it resumes any stage after the directions, it runs the check again on the pages that stage reads. A run with `signoff.md` is closed: the studio tells you its state instead of reopening it.

## Troubleshooting

### Preflight failures

| Line | Meaning | Fix |
|---|---|---|
| `FAIL node` | Node is older than 18 | Install Node 18 or newer |
| `FAIL impeccable` | impeccable not found where preflight looks | `npx impeccable install`. If it is installed somewhere else, set `IMPECCABLE_SKILL_DIR` to the folder holding its `SKILL.md` |
| `FAIL impeccable-version` | Older than 4.10.0, for example `version 4.9.2, need >= 4.10.0` | `npx impeccable update` |
| `FAIL capture` | impeccable could not take a screenshot, almost always because no browser was found | See the next section |
| `warn grilling` | grilling not found where the script looks | `/plugin install mattpocock-skills@claude-plugins-official`. If your agent already lists grilling, the run continues |
| `warn frontend-design` | Optional skill missing | `/plugin install frontend-design@claude-plugins-official`, or carry on without it |
| `preflight: --project <dir> does not exist or is not a directory` | Wrong project path | Pass your project root |

### No Chromium-family browser

Screenshots and rendered scans need Google Chrome, Chromium, Microsoft Edge or Brave. Install one. If yours is in an unusual place, set `IMPECCABLE_BROWSER` to its executable, in the shell before you start `claude` or under `env` in Claude Code's settings. Without a usable browser, preflight's `capture` line fails, and the check exits 1 with errors such as these (real output):

```
FAIL <project>/design/runs/2026-11-19-pricing-page/directions/a/index.html
0 primary finding(s), 0 advisory, 3 error(s)
  error: screenshot step (impeccable shot) failed with exit 1: shot needs Chrome or Chromium and found none: Browser was not found at the configured executablePath (/nonexistent/browser) from IMPECCABLE_BROWSER
  error: rendered-1440x900 scan could not run (exit 1): Error: Browser was not found at the configured executablePath (/nonexistent/browser) from IMPECCABLE_BROWSER
  error: rendered-390x844 scan could not run (exit 1): Error: Browser was not found at the configured executablePath (/nonexistent/browser) from IMPECCABLE_BROWSER
```

### A hook refuses to write PRODUCT.md, brief.md or other Markdown files

Some plugins install a hook that blocks new `.md` and `.txt` files. The everything-claude-code plugin has one, described as "Block creation of random .md files", in its `hooks/hooks.json`. It allows only names such as `README.md` and `CLAUDE.md`. A run writes many Markdown files under `design/runs/`, plus `PRODUCT.md` and `DESIGN.md` at the project root, so the hook stops the run at its first Markdown file: `PRODUCT.md` in a project that has none, `current/critique.md` for a redesign, or otherwise `brief.md`.

The fix is to exempt those paths. In that hook's command, add `PRODUCT` and `DESIGN` to the list of allowed names, and add a condition that lets through any path containing `/design/runs/`. The command is a string inside `hooks.json`, so every backslash in it is doubled. Insert this text directly after the existing `.claude` test (`&&!/\\/\\.claude\\//.test(p)`), inside the same string:

```
&&!/\\/design\\/runs\\//.test(p)
```

Then check that the hook still works: ask Claude Code to create a stray `notes.md` in your project and confirm that it is still blocked. A hook whose command no longer parses blocks nothing.

The hook file lives in Claude Code's plugin cache, so updating that plugin may undo the edit. Alternatively, turn that one hook off.

### Impeccable asks its own questions

The intake grill owns the interview. It writes `PRODUCT.md` in impeccable's exact format so that impeccable's own product interview is already satisfied, and the studio does not run impeccable's own new-design flow or its direction picker. If impeccable starts its own interview, offers its own direction choices, or asks follow-up questions after a critique, the agent has drifted out of the run. Say "continue the studio run". The only questions you need to answer are the grill's and the three gates'.

Messages from impeccable's design hook are different and expected. After any agent edits HTML or CSS, the hook adds detector findings to that agent's conversation. The studio treats them as early warnings; the check gives the verdict.

### The run stopped with blocking findings

This is the studio working as designed, not a crash. Gate 3 lists each finding that still fails: check findings by page and rule, and critic findings by severity, with where they were seen. The comps stay in `final/` as they are, and `DESIGN.md` is not written, because documenting failing comps would record their faults as the system. You can fix the listed problems by hand, or start a new run with a changed brief, for example with fewer screens or a looser constraint.

### A judge or critic says it cannot view images

Judges and critics must open the PNG screenshots. A model that cannot view images returns `error: cannot view images`, and its verdict does not count. Use a model that accepts images for those roles.

## Updating and uninstalling

In Claude Code:

```
/plugin marketplace update design-studio
```

Then open `/plugin`, go to Installed, and choose Update now. From a shell:

```
claude plugin update design-studio@design-studio
```

Restart Claude Code for an update to take effect. An update arrives only when the plugin's `version` in `.claude-plugin/plugin.json` has changed: Claude Code keeps you on the installed version until it does.

To uninstall:

```
/plugin uninstall design-studio@design-studio
```

or

```
claude plugin uninstall design-studio@design-studio --scope user
claude plugin marketplace remove design-studio
```

In other agents (designed for, not yet tested): `npx skills update studio-run` and `npx skills remove studio-run`.

Uninstalling leaves your projects alone: `PRODUCT.md`, `DESIGN.md` and every `design/runs/` folder stay where they are.

## Status and known limits

- Version 0.1.0. The repository is private.
- Claude Code is the primary host. The scripts and the manifest are tested there; a complete run of the skill has not yet been carried out in any agent. Codex CLI, OpenClaw and similar agents are designed for, not yet tested.
- The scripts (preflight, check, gallery) have automated tests, and the plugin manifest passes `claude plugin validate`. The install, update and uninstall commands above have not yet been run against the published repository.
- Accessibility is judged by a model, not measured.
- Round caps and stage order are followed by the agent, not enforced by code.
- The cost of a run has not been measured.
- The studio covers the design stage only. It does not write production code.

No licence has been chosen yet.

## Developing the studio

```
skills/studio-run/SKILL.md          the skill: the whole run, as plain instructions
skills/studio-run/reference/        one file per stage, read when that stage starts
skills/studio-run/scripts/          preflight.mjs, check.mjs, gallery.mjs and helpers
agents/                             studio-direction-designer, studio-judge, studio-critic, studio-fixer
tests/                              tests for the scripts
.claude-plugin/                     plugin.json and marketplace.json
```

Run the tests (Node's built-in test runner, no dependencies):

```
npm test
```

The current suite has 51 tests, all passing.

Check the plugin manifests:

```
claude plugin validate .
```

It ends with `✔ Validation passed`. Before that, it prints the rules the public plugin directory would apply to a submission. These currently name a missing licence and a missing icon. They do not change the result, and they matter only for a directory submission.

Load your working copy without installing it:

```
claude --plugin-dir .
```

After editing files, run `/reload-plugins` in that conversation.

Every release must change `version` in `.claude-plugin/plugin.json`. A set version keeps installed copies on that version until it changes, so a release pushed without a new version never reaches anyone who has the plugin installed.

The orchestration is plain skill prose, with no workflow scripts, so that one description works in every agent. `docs/adr/0001-skills-are-the-only-orchestration.md` records that decision. The project's vocabulary is defined in `GLOSSARY.md`: use its terms exactly when you write for the studio.
