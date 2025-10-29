# Plain-Language Guide

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

## Why it Exists

- GitHub Agent HQ can run multiple AI coders in parallel. Without guardrails they can overspend, touch sensitive files, or skip approvals.
- Guard watches every run, compares it to your policy, and blocks the merge if something looks risky.

## What You’ll Notice

- Pull requests show a required check **Agent HQ Guard**. Green = good to merge. Red = needs attention.
- The bot adds a comment summarizing who the agents were, how many tokens they spent, and whether the run was signed.
- Team members can type `/agent-allow @provider` or `/budget 50k_tokens` in a PR comment to approve exceptions. Guard records those changes automatically.

## What Stays Private

- Guard stores hashes of the agent outputs, not the actual content. Manifests live in GitHub’s artifact store with the same retention as your workflows.

## Day-to-Day Actions

1. **Review PR summary comment** – it’s a human-readable, signed statement of what happened.
2. **Look at annotations** – Guard highlights protected files or budget overruns directly on the PR.
3. **Approve or deny** – If the run is compliant, merge. If not, ask the agent runner to fix the issues or provide a human override.

Guard lets your team experiment with autonomous development while keeping finances, security, and provenance accountable.
