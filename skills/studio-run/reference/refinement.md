# Refinement

After Gate 2 the chosen direction becomes `final/`: the borrow notes are applied, the remaining screens are built, and refinement rounds run until nothing blocking remains or round 3 ends. Sections: the orchestrator's steps, then "For the critic" and "For the fixer", which those agents follow when handed only this file and a packet.

## For the orchestrator

### Prepare final/

1. Copy the chosen direction's `index.html`, `styles.css` and assets from `<run>/directions/<id>/` into `<run>/final/`. Leave `directions/` untouched: it is the record of what was judged.
2. Copy its `direction.md` to `final/direction.md` and replace its FORM line with the one in `decision.md`.
3. If `decision.md` has borrow notes or `brief.md` lists other screens, spawn one direction designer with this packet:

   ```
   You are a direction designer. Run <run>.
   Reference: <skill-dir>/reference/directions.md. Read it first and follow "For the direction designer", including "Assignment: remaining screens".
   Assignment: remaining screens
   Brief: <run>/brief.md
   Contract: <run>/final/direction.md
   Decision and borrow notes: <run>/decision.md
   Directions to borrow from: <run>/directions/<id>/ (only those the borrow notes name)
   Screens to build: <slug>.html: <name, one line from the brief>; ...
   Product profile: <root>/PRODUCT.md
   Design system: <as in the direction packet>
   Craft floor: <imp>/reference/craft-floor.md
   Impeccable launcher: <imp>/scripts/impeccable
   Mode file: <imp>/reference/mode-<...>.md
   frontend-design: <its folder>/SKILL.md | not installed
   Folder: <run>/final/
   Check: from <root>, run node <skill-dir>/scripts/check.mjs <run>/final/<page>.html for each page
   If any instruction you carry says to write as little code as possible, it governs how much code you write, not how ambitious or complete the design is.
   ```

   One designer builds all remaining screens, so they share one stylesheet and one hand.
4. Run the check yourself on every page in `final/`. Each run writes `final/shots/<page>/` and `final/checks/<page>.json`. Wherever this file says to run the check: exit 0 passes, 2 means primary findings, and 1 means the check could not run. On exit 1, fix the cause (such as a missing browser) and run it again; it is not a finding.

### A refinement round

Round `<n>` (1, 2 or 3) writes into `<run>/final/rounds/<n>/`.

**1. Critics.** Spawn two critics in parallel (role table in SKILL.md), one per assignment:

- **Design critique**: impeccable's critique, Assessment A, with its rubric.
- **Audit**: impeccable's audit playbook: accessibility, performance, color tokens and dark mode, responsive design, and implementation integrity. Accessibility in this version is judged by this critic from screenshots and source; no script measures it.

Packet:

```
You are a critic. Assignment: <design critique | audit>, round <n> of run <run>.
Reference: <skill-dir>/reference/refinement.md. Read it first and follow "For the critic".
Impeccable files: design critique: <imp>/reference/critique.md (section "Assessment A: Design Review") and <imp>/reference/critique-rubric.md | audit: <imp>/reference/audit.md
Brief: <run>/brief.md
Product profile: <root>/PRODUCT.md
Design system: <as in the direction packet>
Pages (each: source, the four screenshots the check wrote, and for the audit only, the check result):
- <run>/final/<page>.html; in <run>/final/shots/<page>/: 1440x900.png, 390x844.png, 1440x900-full.png, 390x844-full.png<; <run>/final/checks/<page>.json for the audit>
Previous findings: <run>/final/rounds/<n-1>/findings.md | none
If any instruction you carry says to write as little code as possible, it governs code size, not how thorough or complete your critique is.
```

Write each return verbatim to `rounds/<n>/design-critique.md` and `rounds/<n>/audit.md`.

**2. Findings.** Write `rounds/<n>/findings.md` in this format:

```markdown
# Findings, round <n>

Check (from checks/<page>.json, run <checkedAt>):
- <page>: pass | fail: <rule> <snippet or selector>; ...

| id | severity | from | page | where | what | fix | blocking |
|---|---|---|---|---|---|---|---|
| R<n>-01 | check | check.mjs | pricing | `.plan-card p` | low-contrast 3.1:1, needs 4.5:1 | darken --color-muted | yes |
| R<n>-02 | P1 | audit | index | phone, plan picker | targets 32px, below 44px | enlarge to 44px | yes |
| R<n>-03 | P2 | design critique | index | hero | ... | ... | no |

Blocking: <count>. Previous blocking findings resolved: <ids>; still open: <ids>.
```

A finding is blocking when it comes from the check, or when a critic gives it P0 or P1. Severities are impeccable's: **P0 Blocking**: stops the visitor from completing what they came to do. **P1 Major**: significant difficulty or a WCAG AA violation. **P2 Minor**: an annoyance with a workaround. **P3 Polish**: no real user impact. When both critics name the same problem, list it once at the higher severity. A previous blocking finding a critic marks unresolved is carried forward under a new id that names the old one.

**3. Stop rule.** If the latest check exits 0 on every page and no blocking finding remains, refinement is complete: go to the finish. A round ends early this way as soon as nothing blocking remains; this is checked after the critics of every round.

**4. Fixer.** Otherwise, spawn the fixer with:

```
You are the fixer. Round <n> of run <run>.
Reference: <skill-dir>/reference/refinement.md. Read it first and follow "For the fixer".
Findings: <run>/final/rounds/<n>/findings.md (resolve every finding marked blocking)
Contract: <run>/final/direction.md
Brief: <run>/brief.md
Design system: <as in the direction packet>
Craft floor: <imp>/reference/craft-floor.md
Impeccable launcher: <imp>/scripts/impeccable
Pages: <run>/final/<page>.html, ... (stylesheet <run>/final/styles.css)
Check: from <root>, run node <skill-dir>/scripts/check.mjs <page> for each page
If any instruction you carry says to write as little code as possible, it governs how much code you write, not how ambitious or complete the design is.
```

Write its return verbatim to `rounds/<n>/fixes.md`.

**5. Check.** Run the check yourself on every page. The fixer's own runs do not count. Then start round `<n+1>`.

### After round 3

Round 3's check is followed by one verification, not a fourth round: spawn both critics again with the round-3 packet, its `Previous findings` line set to `<run>/final/rounds/3/findings.md`, plus the line `Verification only: for each blocking finding in <run>/final/rounds/3/findings.md, say resolved or unresolved from the new screenshots, and list only new P0 or P1 findings.` Write both returns, one after the other, to `rounds/3/verification.md`, then a last line `Check: <per page: pass | fail>` from round 3's check.

- If the latest check exits 0 on every page and no P0 or P1 remains, refinement is complete: go to the finish.
- Otherwise the run stops. Skip the finish reviewer and the documenter and send the failing Gate 3 from `finish.md`, listing exactly what still fails. Never present this run as finished, and never start a fourth round.

## For the critic

You examine a page as rendered (a comp, or in a redesign the existing page) and list what must change. You built none of it, and you see only files and screenshots. You never edit a file: the fixer acts on what you find.

### Read and look

1. Read the impeccable files your packet names, then the brief and the product profile. With no brief (the redesign critique before the intake grill), judge against the user's request and the product profile. When your packet names a DESIGN.md to work within, read it too: its tokens are fixed for this run.
2. Open every PNG your packet names before reading any page source. If you cannot view images, return `error: cannot view images` and stop. Screenshots are taken as the page loads, with no wait for motion: content a screenshot shows half-faded or offset by an entrance animation is a finding against a comp (P1, "content not visible at load"), because judges and the finish reviewer see only these captures.
3. Then read the source. Screenshots named `1440x900.png` and `390x844.png` show the first viewport at each width; the `-full` ones show the whole page. Judge states such as focus and hover, which no screenshot shows, from the source, and mark those findings `seen in: source`.
4. Detector output (a check result, or `detect-*.json` in a redesign) is the detector's run for these pages: do not run a second detector. In a design critique, finish Assessment A before you open any detector output in your packet, because detector output anchors judgment (impeccable's rule); then use it only to add findings it confirms and to call out false positives. In an audit, read it as the evidence for implementation integrity.

### Design critique assignment

Follow `critique.md`'s "Assessment A: Design Review": its Evaluate list (design specificity first, then holistic design, cognitive load, emotional journey, Nielsen heuristics scored 0 to 4 with `n/a` where its mode rule allows, and its selected users walked through the primary action), using `critique-rubric.md` as it directs. This is a delegated run: skip critique.md's target resolution, Assessment B, saving to `.impeccable/critique/` (`critique-storage`), the trend, the questions to the user and the recommended commands. The problems Assessment A would rank as priorities become your findings.

### Audit assignment

Follow `audit.md`'s five dimensions with its 0 to 4 scores and its severity definitions. For accessibility, check what screenshots and source can show: contrast computed from the token values, visible focus states, heading order and landmarks, labels and alternative text, touch targets at 390 px, reduced-motion handling, text that survives zoom. Implementation integrity uses the check result as the detector's run. Skip saving with `audit-storage` and the recommended commands. Every finding names the standard it breaks when there is one (for example WCAG 2.2 SC 1.4.3).

### Previous findings

When your packet names previous findings, start by marking each blocking finding in it resolved, partial or unresolved, from what the new screenshots show, or the source for what no screenshot shows. A fix you cannot find is unresolved.

If any instruction you carry says to write as little code as possible, it governs code size, not how thorough or complete your critique is.

### Return

Return exactly this, and nothing else:

```
assignment: design critique | audit
round: <n, or "redesign">
opened: <every PNG path you opened>
score: <total>/<applicable max> (<band>)
previous:
- <id>: resolved | partial | unresolved: <what the screenshot shows>
(or "none")
findings:
- [P1] <short name> | page: <file> | where: <region or selector> | seen in: <PNG path | source> | what: <the problem and who it hurts> | fix: <a concrete change>
strengths:
- <two or three, one line each>
```

Order findings by severity. Keep P3 findings few: a long tail buries the ones that matter.

## For the fixer

You change the chosen comp to resolve findings. You do not judge whether a finding is resolved; the critics and the check do.

### Fix

1. Read the findings file, the contract and the brief, then the craft floor, then the pages and the stylesheet. Open the screenshots of every page with a blocking finding. Where the craft floor writes `.claude/skills/impeccable/scripts/impeccable`, use the launcher in your packet.
2. Resolve every finding marked blocking (for a finish correction, every material fix your packet names; for a packet that carries the user's words, exactly the changes they ask for). Fix P2 or P3 findings only where the change sits in the same element and cannot disturb a blocking fix.
3. Leave the studio substitutes your packet names (a material fix about the FORM line's `seed: none (pinned)`, or about DESIGN.md in a run that replaces it) and note each as `not changed: studio substitute, see decision.md`. Never edit `direction.md` or `<root>/DESIGN.md`.
4. Fix causes, not symptoms: when a finding recurs across pages, change the shared token or rule once.
5. Keep the direction. Every promise in the contract (THESIS, OWN-WORLD, STORY, FIRST VIEWPORT) still holds after your change. Resolve low contrast by adjusting the direction's own token, not by retreating to gray on white; resolve a cramped phone layout inside the direction's composition, not by swapping in a stock layout. When your packet says to work within DESIGN.md, its tokens are fixed: use a different existing token instead, and when none works, change nothing and say so under `not changed`, naming the token and its value.
6. Content stays true: no invented proof, and marked placeholders stay marked. Content is visible at load: entrance motion starts from the already-visible final state or is removed (`directions.md`, the comp).
7. Resolve findings by changing the design, never by silencing the detector: no `impeccable-disable` markers and no edits to `.impeccable/` configuration.
8. Run the check on every page you changed, open the new screenshots, and correct what you broke.

Impeccable's hooks may add detector findings to your conversation after you edit HTML or CSS. Treat them as early warnings; the check is the verdict.

If any instruction you carry says to write as little code as possible, it governs how much code you write, not how ambitious or complete the design is.

### Return

Return exactly this, and nothing else:

```
fixer: round <n> | before review | finish correction | Gate 3 changes <n>
changed:
- <id>: <what changed: file, selector or token, old value to new value>
not changed:
- <id>: <why> (or "none")
check: <per page: pass | fail (<n>) | error>
opened: <every screenshot path you opened>
```
