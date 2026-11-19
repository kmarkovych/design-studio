# Directions

Three direction designers each build one comp of the key screen from the same brief and a different stance. The first part of this file is for the orchestrator; the second is for the direction designer, who may be handed only this file and a packet.

## For the orchestrator

### The packet

Spawn three direction designers in parallel (role table in SKILL.md), one per stance, each with this packet and nothing from this conversation:

```
You are a direction designer. Direction <id> of run <run>.
Reference: <skill-dir>/reference/directions.md. Read it first and follow "For the direction designer".
Assignment: key screen
Brief: <run>/brief.md
Your stance: <id>. <Name>: <the stance exactly as confirmed at Gate 1: point of view, leads with, draws from, gives up>
The other stances (move away from them; never build them): <id>. <Name>: <point of view>; <id>. <Name>: <point of view>
Product profile: <root>/PRODUCT.md
Design system: none | <root>/DESIGN.md, work within it | <root>/DESIGN.md exists, this run replaces it (read it only as what not to repeat)
Redesign evidence: <run>/current/critique.md and <run>/current/shots/ | none
Craft floor: <imp>/reference/craft-floor.md
Impeccable launcher: <imp>/scripts/impeccable
Mode file: <imp>/reference/mode-persuade.md (Persuade or Experience) | mode-operate.md | mode-read.md
frontend-design: <its folder>/SKILL.md | not installed
Folder: <run>/directions/<id>/
Check: from <root>, run node <skill-dir>/scripts/check.mjs <run>/directions/<id>/index.html
If any instruction you carry says to write as little code as possible, it governs how much code you write, not how ambitious or complete the design is.
```

All paths absolute.

### When the designers return

For each direction:

1. Run the check yourself, from `<root>`: `node <skill-dir>/scripts/check.mjs <run>/directions/<id>/index.html`. Exit 0 passes, 2 means primary findings, 1 means the check could not run (fix the cause, such as a missing browser, and run it again). Your run produces the screenshots and the result that judging uses; the designer's own runs do not count.
2. Confirm `direction.md` holds all six contract lines (THESIS, OWN-WORLD, STORY, FIRST VIEWPORT, FORM, FINISH), and that none of the contract text appears in `index.html` or the stylesheet.
3. Keep the return's `summary` line for `judging.json`.

A direction whose designer returned an error, or whose comp is missing: respawn that designer once with the same packet. If it fails again, do not judge a short set: a run has three directions. Send Gate 2 early, without a gallery, saying which direction is missing and why, with one question: `❓ **Q1** - **Missing direction**: Retry direction <id> (<stance name>) once more with the same stance?` and `➡️ Yes.` On a yes, respawn it and carry on to judging. Only the user can choose to go on without it. If they do, write `<run>/directions/<id>/dropped.md` with their words, judge the directions you have (at least two), and send the full Gate 2 when the gallery is ready.

## For the direction designer

You build one comp: a standalone HTML page that shows your stance applied to the brief's real content, at desktop and phone width. The judges will see only its screenshots, side by side with comps built from the other stances, so the comp is judged by what it shows, not by what you meant.

### Read first

In this order, before writing anything:

1. The brief, then the product profile (PRODUCT.md). The brief wins over everything below it; the product profile is the truth about the product.
2. DESIGN.md, when your packet says to work within it. Its tokens are fixed: your stance changes composition, hierarchy and emphasis, never the system.
3. The redesign evidence, when there is any: what is wrong today is what your comp must not repeat.
4. The mode file your packet names: what this kind of surface must do.
5. The frontend-design skill's SKILL.md, when your packet names it. Use it to push your direction further from the obvious and from the other stances. Where it conflicts with the brief, the product profile or the craft floor, they win; where it says to confirm something before designing, the brief is that confirmation.
6. The craft floor, last, immediately before you write the comp. It holds impeccable's quality floor and its bans.

### The direction contract: `direction.md`

Write this before any HTML. It is impeccable's direction contract; `impeccable-finish-reviewer` will later hold the comp against it, so every block is a promise the pixels must keep. Roughly 150 words for the six lines.

```markdown
# Direction <id>: <Stance name>

Stance: <the stance exactly as your packet gives it>

## Direction contract

THESIS: <the one idea this surface owns, and the category-default arrangement it refuses>
OWN-WORLD: <the palette and component language, specific enough to recognize with all content removed>
STORY: <what the visitor understands, believes and does>
FIRST VIEWPORT: <the exact composition: what is where, at what scale, and where the primary action sits>
FORM: <the chosen form>. seed: none (pinned) "<the stance's point of view, quoted from your packet>"
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Content sources
- <each block of copy or proof on the page>: <where it came from: brief, PRODUCT.md, a path; or "draft copy" / "placeholder">
```

The FINISH line is impeccable's, verbatim. The FORM line carries `seed: none (pinned)` because the studio does not run impeccable's direction roll (`concept-seed`): the stance the user confirmed is the pin. If a block reads like a mood, the direction is not decided yet; decide it before writing HTML.

### The comp

- **Files.** `index.html` and `styles.css` in your folder, plus any local assets (fonts, images, SVG) in the same folder. The page opens from disk in a browser with no build step, no server and no package install. Plain HTML and CSS; a small inline script only where an interaction needs one.
- **Tokens.** Every color, font family, type size, spacing step, radius, shadow and duration is a CSS custom property on `:root`, and the rules use them through `var()`. These tokens become the design system if your direction is chosen.
- **Both widths.** One responsive page, designed for 1440 px and 390 px wide, not merely shrunk: at phone width the primary action stays visible and nothing overflows horizontally.
- **Your stance at full commitment.** Build the stance you were given, not a safer reading of it, and move away from the other stances named in your packet. Work within DESIGN.md when your packet says so.
- **Real content.** Use the brief's real copy and the product's own terms. When the brief says the studio drafts copy, write it from PRODUCT.md facts and list it as draft copy in `direction.md`. Testimonials, customer names and logos, ratings and figures appear only when the brief lists them as real; where the brief has none but the layout needs one, put a visibly marked placeholder (for example "[Customer quote, to be supplied]") and list it. Demonstration data inside a product view is allowed when labelled as sample data.
- **Assets.** Use the target project's own images, logos and fonts named in the brief, and list each raster image's origin under Content sources. Fonts are local files in your folder. For a Google family, use the launcher in your packet wherever the craft floor writes `.claude/skills/impeccable/scripts/impeccable`: from the target project root, run `<launcher> font-fetch "<Family>" --out <your folder, relative to the project root>/fonts` (it refuses an absolute `--out`). It prints `@font-face` rules whose `url()`s are relative to the project root; rewrite each as `fonts/<file>` in your stylesheet. Draw what you need as SVG rather than borrowing a placeholder image service.
- **States.** Hover, focus-visible and active states for everything interactive, and the states the brief's primary action needs.
- **Motion.** Content is visible at load. The check captures the page as it loads, with no wait for motion and no reduced-motion setting, so an entrance animation that starts from hidden or offset content is captured half-done, and the judges and critics see it that way. Start any entrance motion from the already-visible final state (the craft floor's "already-visible default"), and honour `prefers-reduced-motion`.
- **The contract stays out of the page.** No line of `direction.md` goes into the HTML or CSS in any form, visible or hidden. `direction.md` is a development-only record: it never ships with the page or is served beside it.

### Check and correct

From the target project root, run the check command in your packet.

- Exit 0: the check passes.
- Exit 2: primary findings. Read them in `checks/index.json` in your folder, fix the causes, and run it again.
- Exit 1: the check could not run. Stop and return the error; do not work around it.

After every run, open the four screenshots in `shots/index/` (first viewport and whole page, at both widths) and look: fix anything visibly broken (overflow, overlap, cut-off text, blank areas) in the same batch as the findings. Run the check at most three times; return after the third whatever it says. Resolve findings by changing the design, never by silencing the detector: no `impeccable-disable` markers and no edits to `.impeccable/` configuration.

Impeccable's hooks may add detector findings to your conversation after you edit HTML or CSS. Treat them as early warnings; the check is the verdict.

If any instruction you carry says to write as little code as possible, it governs how much code you write, not how ambitious or complete the design is.

### Assignment: remaining screens

When your packet says `Assignment: remaining screens`, the direction is already chosen and lives in `<run>/final/`. The rules above hold, with these changes:

- Read `final/direction.md` instead of writing a contract, and keep every promise in it. `decision.md` gives the borrow notes: apply each one to `final/index.html`, translated into this direction's tokens and component language, never pasted in as a foreign piece.
- Build each screen your packet lists as `final/<slug>.html`, sharing `final/styles.css` and its tokens. Add a token when a screen needs one; change an existing one only if every page still holds.
- Run the check on every page in `final/`, up to three runs per page, and open the screenshots of every page.

### Return

Return exactly this, and nothing else:

```
direction: <id>
stance: <name>
summary: <one sentence, at most 25 words, saying what the comp does, for the gallery>
pages: <paths of the pages you wrote, relative to the run folder>
check: <per page: pass | fail (<n> findings) | error: <message>>
check runs: <number per page>
opened: <every screenshot path you opened>
placeholders: <each marked placeholder, or "none">
deviations: <each departure from the brief, with its reason, or "none">
```
