# Design Studio

A multi-agent studio that does the work of a skilled UI/UX designer for browser-rendered interfaces. It exists so that any project can get an interviewed brief, divergent visual directions and critiqued comps without a human designer in the loop for every step.

## Language

### The studio and its work

**Studio**:
The whole system of agents, skills and rules that carries out design work on request.
_Avoid_: Harness, agency, pipeline

**Run**:
One pass of the studio on one brief, from intake grill to sign-off.
_Avoid_: Session, job, task

**Target project**:
The project whose interface a run designs, and the owner of that run's files.
_Avoid_: Client, workspace, host repo

**Design stage**:
The part of the work that ends in approved comps and a documented design system.
_Avoid_: Phase 1, mockup stage

**Implementation stage**:
The later, separate part of the work that applies an approved design to the target project's real code.
_Avoid_: Phase 2, build, handoff

**Preflight**:
The check, before a run starts, that everything the studio depends on is installed.
_Avoid_: Setup, doctor, install check

### What a run works from

**Product profile**:
The lasting facts about a target project's product, audience, brand and constraints, established once and reused by every run.
_Avoid_: Product brief, context, persona doc

**Brief**:
The confirmed statement of what one run must design, for whom and under which constraints, which every agent in that run inherits.
_Avoid_: Spec, PRD, requirements

**Stance**:
A named point of view assigned to one direction designer so that the directions differ on purpose.
_Avoid_: Lens, style, theme, persona

### What a run produces

**Direction**:
One of several deliberately divergent visual approaches to the same brief, each built from its own stance.
_Avoid_: Concept, option, variant

**Comp**:
A page rendered in a browser that shows a direction applied to the brief's real content.
_Avoid_: Mockup, prototype, wireframe

**Gallery**:
The single page that shows a run's directions side by side with the judges' ranking, for the user to choose from.
_Avoid_: Report, comparison, showcase

### Who does what

**Direction designer**:
The agent that builds one comp from the brief and one stance.
_Avoid_: Generator, builder, creator

**Judge**:
An agent that compares the rendered comps of two directions and names the stronger, having built neither.
_Avoid_: Evaluator, reviewer, voter

**Critic**:
An agent that examines the chosen comp as rendered (or, before a redesign, the existing page) and lists what must change, having built none of it.
_Avoid_: Reviewer, auditor, QA

**Fixer**:
The agent that changes the chosen comp to resolve findings.
_Avoid_: Builder, polisher, implementer

### How quality is decided

**Check**:
A scripted pass-or-fail test of a rendered comp whose result does not depend on any agent's opinion.
_Avoid_: Gate, lint, validation

**Finding**:
One specific problem in a comp, reported by a check or a critic. A blocking finding is one that must be resolved before sign-off.
_Avoid_: Issue, bug, comment

**Refinement round**:
One cycle of critic, fixer and checks on the chosen comp. A run has at most three.
_Avoid_: Iteration, loop, pass

### Where the user decides

**Intake grill**:
The interview that opens every run and ends with a confirmed brief and three stances.
_Avoid_: Discovery, kickoff, onboarding

**Gate**:
A point where a run stops and waits for the user's decision. There are three: brief, direction and sign-off.
_Avoid_: Checkpoint, approval step, review

**Sign-off**:
The user's acceptance of the final comps, which ends the design stage of a run.
_Avoid_: Approval, done, ship
