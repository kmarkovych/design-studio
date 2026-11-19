---
name: studio-run
description: Runs the design studio on a browser-rendered page or app screen. An intake grill ends in a confirmed brief and three stances, three direction designers build divergent standalone HTML comps, judges compare them from screenshots, and the chosen direction goes through capped refinement with scripted checks and critics until it is signed off with a documented design system (DESIGN.md). The user decides at three gates and the studio works autonomously in between. Built on the impeccable skill. Use when the user asks to design a page or screen, redesign an existing page, explore visual directions, get comps or a design system for a web product, or run the design studio. Not for a critique on its own (use impeccable's critique), native mobile screens, or applying a design to production code.
---

# Studio run

A run takes one brief from intake grill to sign-off inside the target project: it interviews the user, builds three deliberately different directions for one key screen, and lets judges who built none of them rank the directions from screenshots. The user picks one; the studio builds the remaining screens in that direction and refines them until a scripted check and the critics find nothing blocking, then impeccable's own finish reviewer and documenter agents close it out. A run delivers the design stage only (a confirmed brief, comps and DESIGN.md); applying the design to the target project's real code is the separate implementation stage.

Requests that are not a run: a critique of an existing page with no new design wanted (send the user to impeccable's own `critique`), and screens that are not rendered in a browser (native iOS or Android). Say so in one line and stop.

## Paths

- `<skill-dir>`: the folder that contains this SKILL.md. Claude Code announces it as the base directory when the skill loads; other agents resolve it from where they found this file (designed for, not yet tested).
- Scripts run as `node <skill-dir>/scripts/<name>.mjs`, always with the target project root as the working directory.
- `<root>`: the target project root, the project the user is working in.
- `<imp>`: impeccable's skill folder, printed by preflight on its `impeccable` line. Its launcher is `<imp>/scripts/impeccable`; its playbooks are under `<imp>/reference/`.
- `<run>`: `<root>/design/runs/<YYYY-MM-DD>-<short-name>/`, created during the intake grill (layout below).
- Every packet you hand a sub-agent uses absolute paths.

## Rules for the whole run

1. **Three gates, no other stops.** Gate 1 (brief and stances), Gate 2 (direction), Gate 3 (sign-off). Each gate waits for the user's answer; none is skipped, merged or answered on the user's behalf. Between gates, carry on without asking. A run needs a person at each gate: when no one can answer (a headless call), stop after preflight and say why.
2. **Direction designers and the fixer never judge; judges and critics never build.** A judge or critic gets files and screenshots only, never the conversation in which a comp was made. You, the orchestrator, assemble packets and run scripts; the verdicts come from the check, the judges and the critics.
3. **Judges and critics look at pixels.** They open the PNG screenshots the check produced before they form a view: the two first-viewport captures and every slice of each whole page, never the uncut `-full.png` files. The one exception is a redesign's captures of the existing page, which do not go through the check and so are not sliced: there the critics open the uncut `-full.png` files. A judge or critic that cannot view images says so and stops; a verdict reasoned from source alone does not count.
4. **Delegation.** Delegate each stage's assignments in parallel if you can start sub-agents; otherwise do them one after another, each with a clean slate (re-read only that assignment's packet and reference file, set aside everything from the previous one), and say in the next gate message that you did. Without sub-agents, rule 2 holds only approximately: say that too.
5. **Caps.** Three directions, one key screen each, at desktop (1440x900) and phone (390x844) width. One judge per pair. A direction designer runs the check at most three times, and every invocation counts. At most three refinement rounds on the chosen direction, then one verification by the critics. One correction round after the finish reviewer. These caps and the order of stages are followed by you, not enforced by code; the only enforced verdict is the check's exit code. A full run uses up to about two dozen sub-agents and its cost is unmeasured; published figures for comparable multi-agent systems in which one agent makes and another grades run to the low hundreds of dollars when uncapped, which is why the caps exist.
6. **Honesty.** A comp passes only when `check.mjs` exits 0 on every page and no critic finding of P0 or P1 remains. Accessibility is judged by a critic following impeccable's audit playbook, not measured by a script, and every message that says a comp passes says so. If blocking findings remain after three rounds, the run stops and shows exactly what still fails; it is never presented as finished. Relay impeccable's finish reviewer's disposition word verbatim.
7. **Real content.** Comps use the brief's real copy. Proof appears only when the brief names it as real; a missing one is a visibly marked placeholder, never an invention. Proof means claims about customers or outcomes: testimonials, customer names and logos, customer counts, ratings, press, photographs of real people or places, and performance figures. Not proof: arithmetic on a real figure from the brief (a real price times a number of units), and demonstration data inside a drawn product view or document when visibly labelled as sample data. `directions.md` and `judging.md` use this definition.
8. **Ambition is not code size.** If any instruction you carry tells you to write as little code as possible, it governs how much code you write, not how ambitious or complete the design is. The same sentence goes into every packet.
9. **The run folder is the state.** Write each file at the step that names it, so the run can be resumed from the folder alone.

### Roles

Claude Code is the tested host. Everything in the last column is designed for, not yet tested (OpenAI Codex CLI, OpenClaw and similar agents).

| Role | Claude Code agent | Model | Elsewhere (designed for, not yet tested) |
|---|---|---|---|
| Direction designer | `design-studio:studio-direction-designer` | sonnet | Fresh sub-agent on a mid-tier model, told "You are a direction designer" plus the packet |
| Judge | `design-studio:studio-judge` | opus | Fresh sub-agent on the strongest available model, read-only, "You are a judge" plus the packet |
| Critic | `design-studio:studio-critic` | opus | Fresh sub-agent on the strongest available model, told to write no files, "You are a critic" plus the packet |
| Fixer | `design-studio:studio-fixer` | sonnet | Fresh sub-agent on a mid-tier model, "You are the fixer" plus the packet |
| Finish reviewer | `impeccable-finish-reviewer` | opus, set on the spawn if your agent allows it (its definition says inherit) | Codex: `impeccable_finish_reviewer`. No sub-agents: run `<imp>/reference/degraded/finish-reviewer.md` in this conversation and say so |
| Documenter | `impeccable-documenter` | sonnet, set on the spawn if allowed (its definition says inherit) | Codex: `impeccable_documenter`. No sub-agents: read `<imp>/reference/degraded/documenter.md` and `<imp>/reference/document.md` before writing, and say so |

Never fall back to your own default model silently: when a model cannot be set, say which roles ran on which model in the final message. Spawn every agent fresh, with no forked conversation history.

## Stages

Read each reference file when its stage starts, not before.

### 0. Preflight

Run `node <skill-dir>/scripts/preflight.mjs --project <root>`.

- Exit 0: note `<imp>` from the `impeccable` line and the `frontend-design` folder if found.
- Exit 1: no run starts. Give the user every `FAIL` line with its `fix:` line, and stop.
- `warn grilling`: check your own skill list. If `grilling` is not there either, stop: it is required, and the `fix:` line says how to install it.
- `warn frontend-design`: continue. Direction designers work without it; say so once at Gate 1.

Preflight does not look for agents. If you can start sub-agents, confirm that `impeccable-finish-reviewer` and `impeccable-documenter` are in your agent list (Codex: `impeccable_finish_reviewer` and `impeccable_documenter`, designed for, not yet tested). If either is missing, no run starts: tell the user they are impeccable's shipped agents, that reinstalling impeccable (`npx impeccable install`) is the likely fix, and to check the agent list again afterwards.

Then look in `<root>/design/runs/` for a run without `signoff.md`. If the request continues one, go to **Resuming a run**.

### 1. Intake grill, ending at Gate 1

Read `reference/intake-grill.md` and follow it. The grill runs here in the main conversation, never in a sub-agent.

Complete when: `<root>/PRODUCT.md` holds the confirmed product profile; `<run>/brief.md` holds the brief, three stances and the line `Confirmed at Gate 1: <date>`; for a redesign, `<run>/current/` holds `shots/`, the detector output and `critique.md`. Capturing the existing page for a redesign is the one place the studio runs `impeccable shot` and `detect` directly rather than through `check.mjs`, which takes only a local comp file.

At Gate 1, send the message whose shape `reference/intake-grill.md` gives, then wait.

### 2. Directions

Read `reference/directions.md`. Give three direction designers one stance each and run them in parallel. Then run the check yourself on each comp.

Complete when, for each of `a`, `b` and `c`, `<run>/directions/<id>/` holds `direction.md`, `index.html`, its stylesheet, `shots/index/1440x900.png`, `shots/index/390x844.png` and `checks/index.json` from your own check run, or `dropped.md` when the user chose to go on without that direction. No gate here, unless a direction still fails after its retry (`reference/directions.md`): go straight on.

### 3. Judging, ending at Gate 2

Read `reference/judging.md`. Run one judge per pair, assemble `judging.json`, run `node <skill-dir>/scripts/gallery.mjs <run>`, open `gallery.html` for the user.

Complete when: `judging.json` and `gallery.html` exist and `gallery.mjs` exited 0; the user has answered Gate 2; `decision.md` records the choice in the user's own words.

At Gate 2, send the message whose shape `reference/judging.md` gives, then wait.

### 4. Refinement

Read `reference/refinement.md`. Prepare `final/`, have the remaining screens built, then run refinement rounds (critics, then the fixer, then the check) until nothing blocking remains or round 3 ends.

Complete when either: the latest check exits 0 on every page in `final/` and the latest findings hold no P0 or P1 (go to stage 5); or round 3 and its verification leave blocking findings (go straight to the failing Gate 3 in `reference/finish.md`, skipping the finish reviewer and the documenter).

### 5. Finish, ending at Gate 3

Read `reference/finish.md`. Spawn `impeccable-finish-reviewer` and act on its disposition with at most one correction round. When DESIGN.md did not exist, have `impeccable-documenter` write it before Gate 3; when it did, send Gate 3 first and spawn the documenter with the user's refresh, overwrite or merge choice.

Complete when: `final/finish-verdict.md` records the finish (the reviewer's, fixer's and documenter's returns); the user has answered Gate 3; `impeccable-documenter` has returned, having written DESIGN.md and `.impeccable/design.json` at `<root>` or reported `No changes`; `<run>/signoff.md` is written.

## Run folder

```
<root>/
├── PRODUCT.md                     product profile, impeccable's template
├── DESIGN.md                      written at the finish by impeccable-documenter
├── .impeccable/design.json        its sidecar
└── design/runs/<YYYY-MM-DD>-<short-name>/
    ├── brief.md                   brief, stances, "Confirmed at Gate 1: <date>"
    ├── current/                   redesign only: shots/, detect-*.json, critique.md
    ├── directions/<a|b|c>/
    │   ├── direction.md           direction contract
    │   ├── index.html, styles.css the key-screen comp, plus any local assets
    │   ├── shots/index/           1440x900.png, 390x844.png, their -full.png whole-page versions and
    │   │                          the slices cut from those, -full-1.png, -full-2.png ... (written by check.mjs)
    │   ├── checks/index.json      check result, listing the slices in order (written by check.mjs)
    │   └── dropped.md             only when the user chose to go on without it
    ├── judging.json               pairwise results for gallery.mjs
    ├── gallery.html               written by gallery.mjs
    ├── decision.md                Gate 2 choice in the user's words, borrow notes, FORM line
    ├── final/
    │   ├── direction.md           the chosen contract, FORM line from decision.md
    │   ├── index.html, <screen>.html, styles.css
    │   ├── shots/<page>/, checks/<page>.json
    │   ├── rounds/<n>/            design-critique.md, audit.md, findings.md, fixes.md
    │   │                          (rounds/3/ adds verification.md)
    │   └── finish-verdict.md      the finish record: reviewer, fixer and documenter returns, checks
    └── signoff.md                 Gate 3 answer and the run's final state
```

## Resuming a run

There is no state file: the folder says where the run stopped. Before resuming any stage after directions, run the check again on every page that stage reads, because files may have changed since. Then resume at the first row that matches.

| What the folder shows | Resume at |
|---|---|
| `signoff.md` present | The run is closed: tell the user its state from `signoff.md`. |
| No `brief.md`, or no `Confirmed at Gate 1` line | Intake grill. Reuse PRODUCT.md and any draft brief; ask only what is still open. |
| A direction folder without `dropped.md` missing `direction.md`, `index.html` or `checks/index.json` | Directions, for the missing ones only. |
| No `judging.json` or no `gallery.html` | Judging. |
| No `decision.md` | Gate 2: open `gallery.html` again and ask. |
| No `final/`, or screens named in the brief missing from it | Refinement, preparing `final/`. |
| No `final/rounds/`, or the highest `final/rounds/<n>/` lacks `findings.md` | Round 1, or round n: critics. |
| Highest `findings.md` with blocking findings and no `fixes.md` | Round n, fixer. |
| Highest `fixes.md` present, round below 3 | Round n's check, then round n+1. |
| `rounds/3/fixes.md` present, no `verification.md` | Round 3's check, then the verification. |
| `rounds/3/verification.md` present, with blocking findings or a failing check (its `Check:` line, or the check you just ran) | Gate 3 for a stopped run (`reference/finish.md`). |
| Latest findings or verification hold nothing blocking and the check passes, no `final/finish-verdict.md` | Finish, from the start. |
| `final/finish-verdict.md` whose last section leaves a step owed: a correction round, the check and the reviewer after a fixer return, or the documenter before Gate 3 | Finish, at that step (`reference/finish.md`, "The finish record"). |
| No `signoff.md` | Gate 3. |

Tell the user in one line where the run is resuming and why.

## The final message

After Gate 3, tell the user, in this order:

1. The outcome: signed off, or stopped with blocking findings (never softened).
2. How to open the comps: the paths in `<run>/final/`, and `<run>/gallery.html` for the directions.
3. The check result per page, the open critic findings by severity, impeccable's finish reviewer's disposition word and what it left open, and that accessibility was judged by a critic, not measured.
4. Where DESIGN.md and `signoff.md` are.
5. Anything that ran differently from this skill: assignments carried out one after another instead of by sub-agents, models that could not be set, a frontend-design skill that was missing.
6. The implementation stage, as `reference/finish.md` words it.
