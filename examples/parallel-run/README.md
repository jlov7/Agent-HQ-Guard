# Parallel Multi-Agent Example

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

This example workflow demonstrates orchestrating parallel agent runs with the Guard gating merges via required checks.

1. Two agents (Codex and Claude) run concurrently.
2. Each agent emits an action credential manifest uploaded as an artifact.
3. The Guard action validates the manifests before the Guard app finalizes PR status.

## Files

- `.github/workflows/agents.yml` — example workflow
- `policy.yaml` — sentinel-compatible guard policy
