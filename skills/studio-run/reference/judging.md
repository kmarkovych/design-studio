# Judging and Gate 2

Judges compare the directions two at a time, from screenshots only, having built none of them. `gallery.mjs` computes the ranking from their pairwise results; no agent ranks. The first part of this file is for the orchestrator, the second for the judge.

## For the orchestrator

### Pairs and order

With three directions there are three pairs. Judges see them in rotated order, so that each direction is shown first once and second once and any bias toward a position falls on every direction equally:

| Judge | First | Second |
|---|---|---|
| 1 | a | b |
| 2 | b | c |
| 3 | c | a |

Only when the user chose to go on without a direction (`directions.md`) are there two, and one pair, the two ids in alphabetical order. Spawn the judges in parallel (role table in SKILL.md), one per pair, each with this packet:

```
You are a judge. One pair in run <run>.
Reference: <skill-dir>/reference/judging.md. Read it first and follow "For the judge".
Brief: <run>/brief.md
First: <id> (<stance name>). Screenshots: <run>/directions/<id>/shots/index/1440x900.png and 390x844.png (what a visitor sees first, desktop and phone), then the whole page in slices from the top: <every path in "slices" of <run>/directions/<id>/checks/index.json, in order>
Second: <id> (<stance name>). Screenshots: <run>/directions/<id>/shots/index/1440x900.png and 390x844.png, then the whole page in slices from the top: <every path in "slices" of <run>/directions/<id>/checks/index.json, in order>
If any instruction you carry says to write as little code as possible, it governs how much code is written, not how ambitious or complete the design is, and not how carefully you judge.
```

All paths absolute. The packet carries no `direction.md`, no designer return and no check result beyond its slice paths: the judge sees what a visitor would see.

A return without an `opened:` line naming, for each comp, the two first-viewport PNGs and every slice listed in its `checks/index.json`, or whose reasons rest on source code, does not count: spawn a fresh judge for that pair once. If the replacement fails too, leave that pair out of `comparisons` and say at Gate 2 which pair went unjudged and why.

When you judged the pairs yourself in this conversation (no sub-agents, SKILL.md rule 4), start each pair's `reasons` with `Judged in the same conversation that built the comps.`, so the gallery shows it.

### judging.json

Write `<run>/judging.json` in exactly the shape `<skill-dir>/scripts/gallery-validate.mjs` accepts. All paths are relative to the run folder, contain no `..`, and must point to existing files.

```json
{
  "brief": "<one sentence: the key screen, who it is for, the primary action>",
  "directions": [
    {
      "id": "a",
      "stance": "<stance name>",
      "summary": "<the Summary line of directions/a/direction.md>",
      "comp": "directions/a/index.html",
      "screenshots": {
        "desktop": "directions/a/shots/index/1440x900.png",
        "phone": "directions/a/shots/index/390x844.png"
      },
      "check": { "pass": true, "findings": 0 }
    }
  ],
  "comparisons": [
    { "pair": ["a", "b"], "winner": "a", "reasons": "Totals 41 to 33, clear margin. <the judge's reasons, verbatim>" }
  ]
}
```

- `directions`: two to four entries with unique ids. `check.pass` and `check.findings` come from your own check run: `pass` from `checks/index.json`, `findings` as the length of its `findings` array.
- `comparisons`: one entry per judged pair, `pair` in the order the judge saw it, `winner` one of the pair, each pair at most once.
- `reasons`: prefix the judge's totals and margin, then its reasons verbatim. The gallery shows them under both directions.

### The gallery

From `<root>`, run `node <skill-dir>/scripts/gallery.mjs <run>`.

- Exit 0: it wrote `gallery.html` and printed the ranking as JSON, for example `{"ranking":[{"id":"a","wins":2,"rank":1},{"id":"c","wins":1,"rank":2},{"id":"b","wins":0,"rank":3}],"tie":false}`.
- Exit 1: `judging.json` is wrong, and the message names the exact field. Fix that field and run again.
- Exit 2: the run folder argument was missing.

Open the gallery for the user: `open <run>/gallery.html` on macOS, `xdg-open` on Linux, `start "" <path>` on Windows. If none works, give the path.

### A tie

When the output says `"tie": true`, the judges' preferences went in a circle (each direction won once) or the top places share their wins. The gallery says so plainly. Do not break the tie: no extra judges, and no preference of your own. Gate 2 then carries no recommendation for the base direction.

### Gate 2

Send exactly this shape, then wait:

```
**Gate 2 of 3: direction**

Gallery: <run>/gallery.html (open in your browser)
Judges' ranking: 1. <name> (<n> wins), 2. <name> (<n> wins), 3. <name> (<n> wins)
  | or: No clear winner: <names> are tied with <n> wins each.
Check: <name> passed; <name> failed with <n> findings. Check findings are fixed during refinement.
<One line for anything that ran differently: a direction dropped at your word, a pair left unjudged, judges run one after another.>

❓ **Q1** - **Base direction**: Use **<top-ranked name>** as the base for the remaining screens and refinement?

➡️ Yes, it is the judges' pick.
   | On a tie: Which of <names> becomes the base? ➡️ No recommendation: the judges are split.

---

❓ **Q2** - **Borrow**: Borrow nothing from the other directions? To borrow, name the element and the direction it comes from.

➡️ Yes, borrow nothing.
```

The user may pick any direction, whatever its rank or check result. If they want none of them, this run does not build new directions: record their words in `decision.md` with `Base direction: none`, write `signoff.md` (`finish.md`) with the status `closed at Gate 2 with no direction chosen`, and suggest a new run whose grill starts from what they said.

### Recording the decision

When the user has answered, write `<run>/decision.md`:

```markdown
# Decision at Gate 2

Date: <YYYY-MM-DD>
Base direction: <id> (<stance name>)
Judges' ranking: <the ranking line as shown at Gate 2>

## The user's words
> <the user's reply, verbatim>

## Borrow notes
- <element> from <id> (<stance name>): <what exactly, in the user's words where possible>
(or "Nothing.")

## FORM line for the final contract
FORM: <the form from directions/<id>/direction.md>. seed: none (pinned) "<the stance as confirmed at Gate 1>"; chosen at Gate 2: "<the user's words>"
```

Refinement copies the FORM line into `final/direction.md`.

**Why the FORM line reads `seed: none (pinned)`.** Impeccable's finish reviewer expects FORM to carry a seed reference from impeccable's own direction roll (`concept-seed`), or `seed: none (pinned)` followed by the user's words that pin the direction. The studio does not use that roll; its three stances and the user's choice at Gate 2 take its place, so the FORM line quotes the confirmed stance and the user's own words. This is the studio's substitute, not impeccable's: the reviewer accepts a pin only when the original request or the user's confirmed answers pin both the direction's world and its first-surface experience in the words FORM quotes, and the stance it quotes was written by the studio and accepted with the user's yes. So the reviewer may still raise the missing seed as a material fix, and usually will. When it does, the fixer leaves it and Gate 3 names it as the studio's known substitute (`finish.md`, "Studio substitutes"); do not run `concept-seed` to satisfy it.

## For the judge

You compare two comps of the same screen, built from the same brief by designers you have never spoken to, and name the stronger one. You judge only from the screenshots and the brief.

### Look

1. Read the brief: who arrives, what they came for, the primary action, the content, and its Success section. Note what Success says a successful result does and what will decide the pick at Gate 2: you apply both under fit.
2. Open every PNG your packet names: for each comp, the first viewport at desktop and phone width, and every slice of the whole page at both widths (the whole page cut from the top into overlapping pieces; do not open the uncut `-full.png` files). The first viewport is what a visitor meets; weigh it most. If you cannot view images, return `error: cannot view images` and stop.
3. Before comparing, describe each comp to yourself in two lines from what you see: what leads, where the primary action is, what the page feels made of. The order you received the comps in carries no meaning. Judge each comp as captured: content shown half-faded or offset by an entrance animation counts as it looks, because that is what the page shows at load. The one exception: a fixed or sticky element (a header, a bottom action bar) is painted partway down the whole-page captures and their slices, over other content. That is a capture artifact, not a fault of the comp: judge fixed and sticky elements from the first-viewport captures only.

### Score

Score each comp from 1 to 5 on each criterion, then weight:

| Criterion | Weight | Asks |
|---|---|---|
| Design quality | 3 | Do hierarchy, composition, type and color work as one whole? Does it feel authored for this product, with an obvious first, second and third thing to look at? |
| Originality | 3 | Could it belong to a competitor or an unrelated product unchanged? Are the choices deliberate rather than the category's usual arrangement? |
| Craft | 2 | Alignment, spacing rhythm, type detail, contrast you can see, and a phone layout that holds: nothing cut off, cramped or overflowing. |
| Functionality and fit to the brief | 2 | Is the primary action visible and usable-looking at both widths? Is the brief's real content there, as far as the screenshots show? Would the visitor know within seconds what this is and what to do? Does it do what the brief's Success section asks, including what it says will decide the pick? |

Total = 3 × design + 3 × originality + 2 × craft + 2 × fit, out of 50.

A comp showing proof the brief does not list as real scores 1 on fit. Proof means claims about customers or outcomes: testimonials, customer names and logos, customer counts, ratings, press, photographs of real people or places, and performance figures. Not proof: arithmetic on a real figure from the brief (a real price times a number of units), and demonstration data inside a drawn product view or document when visibly labelled as sample data.

A visibly marked placeholder (such as "[Customer quote, to be supplied]") is the honest stand-in designers are told to use where the brief has no real content: it is not a craft fault. Lower fit for it only when the comp's lead depends on content the brief says does not exist.

The higher total wins. On equal totals, the higher design quality wins, then the higher originality; if still equal, choose. The margin is `clear` when the totals differ by 5 or more, `narrow` when they differ by 1 to 4, and `none` when they are equal.

### Return

Return exactly this, and nothing else:

```
pair: <first id> vs <second id>
opened: <every PNG path you opened, absolute, comma-separated>
<first id>: design <n>, originality <n>, craft <n>, fit <n>, total <n>
<second id>: design <n>, originality <n>, craft <n>, fit <n>, total <n>
winner: <id>
margin: clear | narrow | none
reasons: <two to four sentences naming each comp by its stance name and citing what is visible in the screenshots>
```
