# Skills are the only orchestration; no workflow scripts

The studio must run under Claude Code and also be installable into Codex, OpenClaw and similar agents, and its three gates force every run back into the main conversation between stages anyway. So the whole run is written once, as a plain Agent Skill that tells the host agent to delegate in parallel where it can and to work in sequence where it cannot, and there is no Claude Code workflow script. We chose one portable description over a scripted one because two copies of the orchestration, prose and script, would drift apart.

## Considered Options

- **Claude Code workflow scripts for the fan-out stages.** Round caps and stage order would be enforced by code, but the scripts run nowhere else and cannot ask the user anything, so the skill would still have to exist beside them.
- **A standalone Agent SDK program.** Fully deterministic and runnable unattended, but a second runtime to maintain and nothing reusable by other agent harnesses.

## Consequences

- The cap of three refinement rounds and the order of stages are followed by the agent, not enforced. What is enforced is the check: a script with an exit code decides whether a comp passes.
- If the prose proves unreliable in Claude Code, a workflow script may be added for the direction and judging stages only, generated from the same reference files and never as a second source of truth.
