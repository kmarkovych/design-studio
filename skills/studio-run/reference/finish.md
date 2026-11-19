# Finish and Gate 3

Refinement is complete: the check exits 0 on every page in `final/` and no critic finding of P0 or P1 remains. Impeccable's finish reviewer now takes a fresh look with at most one correction round, impeccable's documenter writes DESIGN.md, and the user signs off at Gate 3. A run that stopped with blocking findings skips straight to **Gate 3: a stopped run**.

## The finish record

`<run>/final/finish-verdict.md` records the finish as it happens: every return of the finish reviewer, the fixer and the documenter, verbatim and in order, each under a heading that names it (`## Review`, `## Fixer: before review`, `## Fixer: correction round`, `## Verdict Pass`, `## Documenter`, `## Gate 3 changes <n>: fixer`, and so on). Add each section as soon as its return arrives, and a `## Check` section with the per-page result after every check you run here. A resumed run reads the last section to find the next step: a review that still owes its correction round, a fixer return still waiting for the check and the reviewer, or a documenter still owed before Gate 3.

## Before the finish reviewer

1. **Screenshots.** Open each final screenshot once and confirm it shows what its name claims: the right page, the document top, no blank or black regions, and nothing caught mid-animation (content half-faded or offset by an entrance animation). The latest check produced them. If one is wrong, run the check on that page again. `impeccable shot` neither waits for motion nor emulates reduced motion, so content still caught mid-animation after a second capture is a defect of the comp (comps render their final state at load, see `directions.md`). Give it to the fixer as the one blocking finding (packet in `refinement.md`, with the problem in place of a findings file and `fixer: before review`), run the check on every page, and look again. This does not use up the correction round.
2. **Provenance.** The contract's FINISH line promises that every shipping raster carries its provenance. If the comps use raster images (PNG, JPEG, WebP, AVIF, GIF), run `<imp>/scripts/impeccable embed-prompt --scan <folder>` from `<root>` over each folder in `final/` those images sit in (never `shots/`, which holds screenshots, not page images). The scan only reads. Clear every file it reports by embedding its origin (the Content sources list in `final/direction.md` names it) with `embed-prompt`, as `<imp>/reference/visualize.md`, section "Plates and provenance", describes. Scan again before any Verdict Pass or review that follows a fixer batch. Comps with no raster images skip this.

## The finish reviewer

Spawn `impeccable-finish-reviewer` (role table in SKILL.md) fresh, with no forked history, and with this packet. Do not read its definition file first; the host loads it.

```
Original request: "<the Request from brief.md, verbatim>"
Confirmed user answers: <run>/brief.md (confirmed at Gate 1) and <run>/decision.md (Gate 2, in the user's words)
Artifact paths: <run>/final/index.html, <run>/final/<page>.html, ... and <run>/final/styles.css
Screenshots (required; these named paths are authoritative):
- desktop.png: <run>/final/shots/index/1440x900.png
- mobile.png: <run>/final/shots/index/390x844.png
- <page>, desktop and mobile: <run>/final/shots/<page>/1440x900.png, <run>/final/shots/<page>/390x844.png
Direction contract:
<the six lines from <run>/final/direction.md, pasted>
PRODUCT.md: <root>/PRODUCT.md
DESIGN.md: none before this run; the documenter writes it after this review | <root>/DESIGN.md predates this run, which works within it | <root>/DESIGN.md predates this run, which replaces it; the documenter rewrites it after the user's choice at sign-off
Existing detector findings: <run>/final/checks/<page>.json for each page (the check exits 0 on every page; advisories are listed there)
QUALITY BAR cards: none; this run used no impeccable world catalog.
Approved comp: none. Critique reference, not an approved comp: <run>/directions/<id>/shots/index/1440x900.png and 390x844.png, the direction the user chose at Gate 2.
Craft floor: <imp>/reference/craft-floor.md
Code-led: yes. Image generation: <not available in this host | available in this host; the studio's agents used none>
If any instruction you carry says to write as little code as possible, it governs code size, not how thorough you are.
```

All paths absolute. Wait with one long timeout. If the return is empty or lacks its sections, spawn it fresh once with the same packet. Record every return in the finish record.

## Acting on the disposition

The return carries the line `disposition: <word>`: the first line of a review, the last line of a Verdict Pass. The word is one of four. Relay it verbatim; never soften it.

- **`ship`**: nothing owed. Go to the documenter.
- **`fix`**: the one correction round, unless every material fix is a studio substitute (below): then record `## Fixer: correction round` as `not run: every material fix is a studio substitute` and go to the documenter. Otherwise spawn the fixer (packet in `refinement.md`, with `Findings: <run>/final/finish-verdict.md, section material_fixes of the latest review`, `fixer: finish correction`, and the line `Studio substitutes, leave unchanged: <their numbers in material_fixes, or "none">`). Then run the check yourself on every page; it recaptures over the same screenshot paths. Then send the new screenshots back to the same agent so it scores its own material fixes (its "Verdict Pass"): continue the same agent if your host can. If it cannot, spawn `impeccable-finish-reviewer` fresh with the same packet, its earlier return, and the line `Verdict Pass: score each material fix resolved, partial or unresolved from these recaptures.` That fresh spawn is the studio's substitute: impeccable's own fallback runs the Verdict Pass from `<imp>/reference/degraded/finish-reviewer.md` in the parent conversation, which here would make you, the orchestrator, the judge. The Verdict Pass is final, whatever its word.
- **`rebuild`**: the one correction round is the rebuild the return directs: the fixer re-derives the regions it names. Then run the check on every page and spawn `impeccable-finish-reviewer` fresh for a complete look, not a scoring of fixes. Its return is final.
- **`recapture`**: the evidence failed, not the comp. Run the check again on the pages it names, open the new screenshots, and spawn `impeccable-finish-reviewer` fresh for a complete look. This does not use up the correction round. A second `recapture` stops here: tell the user at Gate 3 which captures could not be produced validly.

After any fixer batch in the finish the check must still exit 0 on every page. If it does not, the comp no longer passes: send the stopped-run Gate 3 with the failing check findings. The critics do not run again after refinement, so Gate 3 says that changes made after refinement were covered by the check and the finish reviewer, not by a critic.

**Studio substitutes.** Two material fixes come from where the studio departs from impeccable's own flow. The fixer leaves them, noting `not changed: studio substitute, see decision.md`, and Gate 3 names them as the studio's substitutes, not as defects of the comps:

- **The seed material fix.** The FORM line reads `seed: none (pinned)` because the studio does not run impeccable's direction roll (`concept-seed`); see `judging.md`. The reviewer may still raise it as "the roll was skipped", and usually will: it accepts a pin only when the original request or the user's confirmed answers pin both the direction's world and its first-surface experience in the words FORM quotes, and the stance FORM quotes was written by the studio and accepted with the user's yes. Do not run `concept-seed` to satisfy it.
- **DESIGN.md in a replacing run.** When the run replaces an existing DESIGN.md, the reviewer may find that DESIGN.md does not match the built world. The documenter rewrites it only after the user's choice at Gate 3.

## The documenter

If `<root>/DESIGN.md` did not exist before this run, spawn `impeccable-documenter` once the last finish changes are on disk, so DESIGN.md describes the final comps: in the same message as the Verdict Pass or review request when there is one, otherwise right after the `ship` verdict or the skipped correction round. If DESIGN.md existed, the documenter waits for the user's choice at Gate 3 (impeccable's rule: an existing DESIGN.md is never overwritten silently), then is spawned with that choice before `signoff.md` is written. After any later fixer batch (changes asked for at Gate 3), spawn it again once its earlier return is in, so an out-of-date write never lands last; for a DESIGN.md this run wrote, the choice is refresh.

```
Project root: <root>
Artifact paths: <run>/final/index.html, <run>/final/<page>.html, <run>/final/styles.css
Direction contract:
<the six lines from <run>/final/direction.md, pasted>
PRODUCT.md: <root>/PRODUCT.md
Document reference: <imp>/reference/document.md
Write boundary: <root>
Existing DESIGN.md: none | <root>/DESIGN.md, the user's choice: refresh | overwrite | merge | <root>/DESIGN.md, written by this run's documenter: refresh
If any instruction you carry says to write as little code as possible, it governs code size, not how complete the design system record is.
```

Verify the outcome. Either `<root>/DESIGN.md` with token-bearing frontmatter and `<root>/.impeccable/design.json` are written, or the return says `No changes` with the files it checked: an ordinary extension that still matches the recorded system writes nothing, and DESIGN.md is then recorded as unchanged. A return saying the choice is owed means it was spawned without one: collect the choice and spawn it again. Keep its return's system summary and its line on defects not canonized for Gate 3 and `signoff.md`.

## Gate 3: a passing run

Send exactly this shape, then wait:

```
**Gate 3 of 3: sign-off**

The studio's criteria are met: the check exits 0 on every page and no critic finding of P0 or P1 remains. Accessibility was judged by a critic following impeccable's audit playbook, not measured by a script.
Impeccable finish reviewer: disposition: <word, verbatim>. <When not ship: The reviewer does not pass these comps: it left <N> material fix(es) open.> Still open: <its remaining list, or "clear">
<When ship came from a Verdict Pass: The reviewer scored the fixes it listed as resolved; that covers those fixes, not the whole page.>
<When a studio substitute is open: Of those, <which> are the studio's known substitutes, not defects of the comps: the seed (the studio pins the direction with the stance it proposed and you confirmed at Gate 1 and your words at Gate 2, in decision.md, instead of impeccable's concept-seed roll) | DESIGN.md (rewritten after your answer to Q2).>
<When anything changed after refinement: Changes made after refinement (<the correction round | the changes you asked for>) were covered by the check and the finish reviewer, not by a critic.>

Comps: <run>/final/index.html, <run>/final/<page>.html (open in a browser)
Screenshots: <run>/final/shots/
Rounds: <n> refinement round(s); open findings P2 <n>, P3 <n> (<run>/final/rounds/<n>/findings.md)
Design system: <DESIGN.md written at <root>/DESIGN.md: <its five-line summary> | DESIGN.md unchanged: the documenter found it still matches | see Q2>
<One line for anything that ran differently: assignments carried out one after another, a model that could not be set.>

❓ **Q1** - **Sign-off**: Accept these comps as the end of the design stage<, with the finish reviewer's open fixes recorded in signoff.md>?

➡️ Yes.
```

When DESIGN.md existed before this run, first show the user the existing file (impeccable's rule): paste it, or when it is long, its token frontmatter in full and every section heading, with its path. Then add after Q1:

```
---

❓ **Q2** - **DESIGN.md**: <root>/DESIGN.md already exists. <Merge this run's system into it | Overwrite it with this run's system>? The choices are refresh, overwrite and merge. Impeccable defines merge as keeping the existing file's confirmed decisions and reconciling them with this run; it does not define refresh and overwrite further.

➡️ Yes.
```

Recommend merge when the run worked within the design system, overwrite when it replaced it.

If the user asks for changes instead of signing off, each such round is the user's call, never yours:

1. Give the fixer exactly those changes (packet as in `refinement.md`, with the user's words in place of a findings file and `fixer: Gate 3 changes <n>`), and record its return.
2. Run the check on every page. If any page fails, the comps no longer pass: send the stopped-run Gate 3 with the failing findings.
3. Otherwise repeat the provenance scan when the comps use raster images, and spawn `impeccable-finish-reviewer` fresh for a complete look, with the original packet plus the line `The user asked for these changes at sign-off: "<their words>"`. In the same message, if this run's documenter already wrote DESIGN.md, spawn it again (refresh) once its earlier return is in. The review is final for this round: relay its word; there is no correction round.
4. Send Gate 3 again, saying that these changes were covered by the check and the finish reviewer, not by a critic.

## Gate 3: a stopped run

When blocking findings remain after round 3 and its verification, or the check fails after a fixer batch in the finish or after changes asked for at Gate 3, send exactly this shape, then wait:

```
**Gate 3 of 3: the run stopped with blocking findings**

This run is not finished. These still fail:
- check: <page>: <rule> <selector or snippet>
- [P1] <short name> (<page>, seen in <PNG path or source>): <what>
...
Comps as they stand: <run>/final/ (open in a browser). <DESIGN.md was not written: documenting comps that fail would record their faults as the system. | DESIGN.md was written before the last changes and describes the comps as they were then.>

❓ **Q1** - **Close**: Close the run here, recorded as stopped with these findings open?

➡️ Yes. A new run with a changed brief, or fixing these by hand, can follow.
```

## signoff.md

When the user has answered Gate 3 (and any documenter spawn after a Q2 answer has returned), write `<run>/signoff.md`:

```markdown
# Sign-off: <run>

Date: <YYYY-MM-DD>
Status: signed off | stopped with blocking findings | closed at Gate 2 with no direction chosen

## The user's words
> <the reply, verbatim>

## State at close
Comps: <paths>
Check: <per page: pass | fail, checkedAt>
Critic findings open: P0 <n>, P1 <n>, P2 <n>, P3 <n> (<findings or verification file>)
Accessibility: judged by a critic, not measured by a script.
Impeccable finish reviewer: disposition <word>; still open: <list or "clear">; studio substitutes among them: <list or "none"> | not run (stopped run)
Changes after refinement: <covered by the check and the finish reviewer, not by a critic | none>
DESIGN.md: written | refreshed | overwritten | merged | unchanged (documenter: No changes) | not written (<why>)
Ran differently: <sequence instead of sub-agents, models that could not be set, or "nothing">

## Next
The implementation stage: separate from this run.
```

## What to tell the user about the implementation stage

The comps are the design, not production code. Applying them to the target project's real code is the implementation stage, which is separate and later, and which the studio does not do. Point whoever does it (an agent in a new conversation, or a person) at `<root>/DESIGN.md`, `<root>/PRODUCT.md`, `<run>/brief.md` and the comps in `<run>/final/`: the tokens in `final/styles.css` and DESIGN.md are the values to carry over. `final/direction.md` is a development-only record: it never ships with the comps' code or is served beside it (impeccable's rule for the direction contract).
