# Agents document only inside attended sessions; scheduled work is mechanical

The owner asked for an agent that regularly checks for updates and syncs them. We split that in two. Vault sync runs every 15 minutes from launchd or cron as a plain git script, with no agent and no token cost. Documentation passes run only inside sessions a person has open: at the end of a session that changed code, and at the start of the next session in that product when it finds undescribed commits. An unattended nightly pass through `claude -p` exists but is off unless the owner turns it on.

## Considered Options

- **A scheduled agent that polls the code repositories.** It would document commits made outside any session without waiting for the next one, but it spends usage with nobody watching, needs a long-lived token on every machine, and acts on a vault the owner may be editing at the same time.
- **Cloud scheduled tasks or GitHub Actions.** They run with the laptop closed, but both assume GitHub, and the owner's code and vault repositories live on a self-hosted GitLab.

## Consequences

- A commit made outside any session stays undescribed until the next session in that product starts. The described commit makes the gap visible rather than silent.
- Every documentation pass happens where a person can see its result and answer a conflict.
