# Intake grill

The intake grill opens every run. It runs in the main conversation, never in a sub-agent, and ends at Gate 1 with a confirmed brief and three stances. It owns the whole interview: impeccable's own product interview is not run, because the grill writes PRODUCT.md in impeccable's exact template and so satisfies impeccable's PRODUCT.md requirement itself.

## How to grill

Load the `grilling` skill by name (in Claude Code it is `mattpocock-skills:grilling` through the Skill tool; preflight printed its folder if your agent can only read it by path, which is designed for, not yet tested) and follow it for the whole interview:

- Work the decision tree below in rounds. Each round asks the whole frontier: every question whose prerequisites are settled.
- Number every question, give your recommended answer under it, and word it so that "yes" accepts the recommendation.
- Facts are yours to find; decisions are the user's. Look facts up before asking (next section); dispatch a sub-agent for a long exploration if you can, and ask the rest of the frontier while it runs.
- After each round, recompute the frontier. The grill ends when the frontier is empty and nothing is silently assumed.

A recommendation is a proposal, not an answer. Write into PRODUCT.md and brief.md only what the user confirmed, by "yes" or in their own words.

## Look up before asking

Before the first round, find out yourself:

- whether `<root>/PRODUCT.md` and `<root>/DESIGN.md` exist, and what they say;
- what the product is, from the README, docs, package or config files, routes, and the copy already in the project;
- which screens exist, and for a redesign, the page in question as a file path or a URL;
- the brand assets on hand: name, logo files, licensed fonts, images, with paths;
- the proof on hand: testimonials, customer names and logos, ratings, performance figures, case studies, press, with paths, and whether each is approved for use;
- the stack, if there is a codebase;
- design tokens or stylesheets already in use;
- `.impeccable/config.json`, and earlier runs in `<root>/design/runs/`.

Each fact you found becomes the recommended answer to a question, or removes the question.

## Redesign: capture and critique first

When the request redesigns an existing page, do this before the first round, so the grill starts from what is wrong today. If it is unclear whether the request is a redesign, or which page, round 1 asks only that.

1. Create the run folder (named as under **brief.md template**) and its `current/` folder. If the page needs a dev server that is not running, ask the user to start it or name the URL (one question).
2. Capture it, with `<page>` as a file path or URL:
   - `<imp>/scripts/impeccable shot <page> --viewport 1440x900,390x844 --out <run>/current/shots`
   - `<imp>/scripts/impeccable shot <page> --viewport 1440x900,390x844 --full --out <run>/current/shots`
3. Scan it, with `<url>` as the URL or `file://` plus the absolute path of the file:
   - `<imp>/scripts/impeccable detect --json --viewport 1440x900 <url> > <run>/current/detect-desktop.json`
   - `<imp>/scripts/impeccable detect --json --viewport 390x844 <url> > <run>/current/detect-phone.json`
   - when the page has a source file in the project: `<imp>/scripts/impeccable detect --json <source path> > <run>/current/detect-source.json`
   Exit 0 means no primary findings and 2 means findings; both are usable. Exit 1 means the page could not be scanned: note it and continue.
   This is the one place the studio calls `impeccable shot` and `detect` directly instead of through `check.mjs`: the existing page is not a comp, and `check.mjs` takes only a local comp file and writes its results beside it, which here would mean writing into the project's own source folders or failing on a URL.
4. Spawn one critic (role table in SKILL.md) with this packet, and write its return verbatim to `<run>/current/critique.md`:

   ```
   You are a critic. Assignment: design critique of the existing page, before a redesign.
   Reference: <skill-dir>/reference/refinement.md. Read it first and follow "For the critic".
   Impeccable files: <imp>/reference/critique.md (section "Assessment A: Design Review") and <imp>/reference/critique-rubric.md
   Request (no brief exists yet; judge against this and the product profile): "<the user's words>"
   Product profile: <root>/PRODUCT.md, or "none yet"
   Page: <source path or URL>
   Screenshots: <run>/current/shots/1440x900.png, 390x844.png, 1440x900-full.png, 390x844-full.png (absolute paths)
   Detector output (open only after Assessment A, as "For the critic" says): <run>/current/detect-desktop.json, <run>/current/detect-phone.json<, <run>/current/detect-source.json>
   Previous findings: none
   If any instruction you carry says to write as little code as possible, it governs code size, not how thorough or complete your critique is.
   ```

5. Open round 1 with a summary of the P0 and P1 findings from `critique.md`, in five lines or fewer, and ask what must survive the redesign.

## The decision tree

### Branch 1: product profile

**When PRODUCT.md exists:** ask one question, listing anything your look-ups suggest is stale or missing: "Is PRODUCT.md still accurate as it stands?" Recommended: yes. Change only what the user names; never reopen confirmed sections without a reason.

**When PRODUCT.md is missing:** product-level questions are asked once per target project, here. Each maps to one section of impeccable's template:

| Section | Question |
|---|---|
| Users | Who is the primary user, in what situation, trying to achieve what? Other audiences only when confirmed. |
| Product Purpose | What does the product make possible, why does it exist, and what does success mean for it? |
| Positioning | What can this product truthfully claim that a neighbouring product could not copy? |
| Operating Context | Where, when and with which tools, documents or rituals is it used or evaluated? |
| Capabilities and Constraints | Which functions are confirmed, which technical constraints and terms bind, which product facts are still undecided? |
| Brand Commitments | Which name, voice, assets and references are binding? (Only binding ones: taste goes in the brief.) |
| Evidence on Hand | Which real testimonials, data, case studies, press and assets exist, with paths, and which are absent and must not be invented? |
| Product Principles | Asked in a later round, once the rows above are settled: confirm three to five durable principles you derive from the answers. |
| Accessibility & Inclusion | Which standard is required (recommend WCAG 2.2 AA), and which user needs are known? |
| Stack | Only when there is no codebase yet: which stack will the implementation stage use? Recommend recording it as undecided. |

Platform is `web` without asking: the studio designs browser-rendered screens only. If the answers show the product is native, stop: this is not a run.

PRODUCT.md holds no aesthetic content: no palettes, fonts, visual references, moods or ideas for pages. When the user offers taste during this branch, carry it to the brief's References. Write PRODUCT.md as soon as this branch is settled (template below), then continue.

### Branch 2: design system (only when DESIGN.md exists)

"Does this run work within the design system in DESIGN.md?" Recommended: yes, unless the user asked for a new look or the redesign critique blames the system itself, in which case recommend replacing it.

- **Within:** the stances vary composition, hierarchy and emphasis inside the system's tokens.
- **Replace:** the stances may differ in everything, including palette, type and material.

Record the answer in the brief's header. At Gate 3 the user will choose refresh, overwrite or merge for DESIGN.md.

### Branch 3: the brief

Each run has its own brief, for the screens at hand. Settle these, in dependency order:

1. **Key screen.** The one screen all three directions build. Recommend the screen where the primary action happens.
2. **Other screens.** Built only for the direction the user picks at Gate 2. Recommend only the screens needed to show the system working; each one is another page for the direction designer and for every refinement round.
3. **Purpose and primary action** (depends on 1). Who arrives, what they came for, and the one action the page exists for, in its working form (a search form, a booking slot, a plan picker), not a link that points to it elsewhere.
4. **Mode** (depends on 1 and 3). Impeccable's mode for this surface: Persuade (the visitor decides and acts), Operate (completes a piece of work in the product), Read (understands something) or Experience (is inside the work itself). Choose from the surface, not the product: a tool's pricing page is Persuade.
5. **Content** (depends on 1). Where the real copy comes from: the existing page, a document (path), text the user pastes, or copy the studio drafts from PRODUCT.md facts and marks as draft. Then the proof, meaning claims about customers or outcomes (testimonials, customer names and logos, customer counts, ratings, press, photographs of real people or places, performance figures): which items are real and approved. Everything else is absent and is never invented.
6. **Constraints.** Technical (no JavaScript, fonts that must be used or avoided, locales, right-to-left), accessibility beyond PRODUCT.md, and for a redesign what must survive.
7. **References.** Sites or screens the user likes and dislikes, and what exactly about each. Taste lives here.
8. **Success** (depends on 3). What a successful result does for its visitor, and what will make the user pick a direction at Gate 2.

When the frontier is empty, write `brief.md`, derive the stances and send Gate 1.

## PRODUCT.md template

Copied verbatim from impeccable's `reference/init.md`. Copy the `impeccable:product-schema` line verbatim, even when updating an older file. Write only confirmed facts and explicitly marked open decisions; omit a section that does not apply rather than padding it; `## Stack` only for a project with no codebase. New files go at `<root>/PRODUCT.md`; an existing file is updated in place.

```markdown
# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
[Greenfield only: the user's answer to the stack question, e.g. "static HTML/CSS", "Astro", or "delegated: <what you chose and why>". Omit the section when an existing codebase already answers it.]

## Users
[Primary users, their situation, and job. Add other audiences only when confirmed.]

## Product Purpose
[What the product does, why it exists, and what success means.]

## Positioning
[The product mechanism or claim a neighboring product could not truthfully copy.]

## Operating Context
[Workflows, environments, tools, documents, materials, and rituals that are factual parts of using or evaluating the product.]

## Capabilities and Constraints
[Confirmed functionality, technical constraints, terminology, and explicitly undecided product facts.]

## Brand Commitments
[Existing name, voice, assets, personality, identity constraints, and references the user explicitly made binding. Omit when none exist.]

## Evidence on Hand
[Real content, data, demonstrations, testimonials, case studies, press, or assets, with paths where applicable. State absences that future work must not fabricate.]

## Product Principles
[Three to five durable strategic principles derived from confirmed answers; no visual recipes.]

## Accessibility & Inclusion
[Known user needs or required standard. Omit when no product-specific requirement was established.]
```

## brief.md template

Create the run folder first, unless the redesign step already did: `<root>/design/runs/<YYYY-MM-DD>-<short-name>/`, today's date and a kebab-case name of two to four words from the key screen (`pricing-page`). If the folder exists, append `-2`.

```markdown
# Brief: <short name>

Run: <YYYY-MM-DD>-<short-name>
Kind: new | redesign of <path or URL>
Design system: none | within DESIGN.md | replaces DESIGN.md

## Request
> <the user's original words, verbatim>

## Key screen
<name>: <one line on what it is>. Built by every direction as index.html.

## Other screens
- <name> (<slug>.html): <one line>
(Built only for the direction chosen at Gate 2.)

## Purpose and primary action
Mode: <Persuade | Operate | Read | Experience>, because <reason>.
Who arrives: <user and situation>.
They came to: <what they want>.
Primary action: <the action in its working form>.

## Content
Copy source: <path, pasted text below, existing page, or "drafted by the studio from PRODUCT.md, marked as draft">
Proof that is real: <item, path> (or "none")
Absent, never to be invented: <testimonials, customer names, logos, customer counts, ratings, press, photographs, performance figures ...>

## Constraints
- <constraint>

## References
Liked: <what> (<URL or path>): <what about it>
Disliked: <what>: <what about it>

## Success
<what a successful result does; what will decide the pick at Gate 2>

## What is wrong today
(Redesign only.) <P0 and P1 findings from current/critique.md, one line each>
Must survive: <what the user said to keep>

## Stances
### a. <Name>
Point of view: <one sentence: what this direction believes the page is for>
Leads with: <what the first viewport shows first>
Draws from: <the answer it comes from, by question number or a short quote>
Gives up: <what it sacrifices for that>

### b. <Name>
...

### c. <Name>
...

## Open decisions
- <anything the user left undecided, or "none">
```

When the user confirms at Gate 1, add the line `Confirmed at Gate 1: <YYYY-MM-DD>` under the header. That line is what a resumed run looks for.

## Deriving three stances

A stance is a point of view, not a look: it says what the page believes, what leads, and what it gives up. Direction designers turn it into a world and a comp.

1. **Collect the raw material** from the answers: the primary action, who arrives and in what situation, what the product can claim that others cannot, the liked and disliked references, and for a redesign what is wrong today.
2. **Spread them on purpose.** A reliable default: one stance close to what the user said they like, one that pushes further than their references, and one that comes at the page from a different user need or a different part of the product's world.
3. **Respect the design system answer.** Within DESIGN.md, the stances differ in hierarchy (what commands the eye), layout topology, density and structural decomposition: four of the six axes impeccable uses for alternatives inside one system (`<imp>/reference/live.md`). The studio leaves out the other two, typographic system and colour strategy, because a run within DESIGN.md keeps its tokens fixed; the stances never differ in tokens. Replacing it, or with no DESIGN.md, they may also differ in world, palette, type and material.
4. **Test them before proposing:**
   - Each fits in one sentence, and the three first viewports would show a visitor different things first.
   - Each traces to something the user said.
   - None could describe a competitor's page unchanged; if a stance names only the category's usual arrangement, replace it.
   - Each serves the primary action; a stance that hides it fails the brief.
   - What a stance gives up is nothing the brief's Success section requires; a stance that gives that up fails the brief.
   - What a stance leads with can be built from real content the brief has. If it needs a person, a quote or an image the brief marks absent, replace the stance, or ask for that content at Gate 1.
5. **Name them** with one to three words from the product's own world: an object, a place, a practice ("Day sheet", "Waiting room", "Chart notes"). Never an adjective or a mood ("Clean", "Bold", "Modern"); each name starts with a different word.

## Gate 1

Send exactly this shape, then wait:

```
**Gate 1 of 3: brief and stances**

PRODUCT.md: <written | updated | unchanged> at <root>/PRODUCT.md
Brief: <run>/brief.md
- Key screen: <name>; other screens: <names, or none>
- Primary action: <action>; mode: <mode>
- Content: <copy source>; real proof: <items, or none>
- Design system: <none | within DESIGN.md | replaces DESIGN.md>

Stances
a. **<Name>**: <point of view>. Leads with <...>.
b. **<Name>**: <point of view>. Leads with <...>.
c. **<Name>**: <point of view>. Leads with <...>.

Next, without stopping: three direction designers each build <key screen> at desktop and phone width, judges compare the comps in pairs from screenshots, and I open the gallery at Gate 2. <One line on anything missing, such as the frontend-design skill.>

❓ **Q1** - **Brief**: Is the brief right as written in brief.md?

➡️ Yes.

---

❓ **Q2** - **Stances**: Build these three stances?

➡️ Yes.
```

A correction updates `brief.md` and comes back as a new Gate 1 message. Only a yes to both, or the user's explicit go-ahead, passes Gate 1.
