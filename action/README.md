# Agent HQ Guard GitHub Action

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

Use this action inside your Agent HQ workflows to validate action credentials before the Guard app finalizes required checks.

## Inputs

- `policy` — Path to the Sentinel-style policy YAML (optional; defaults to `policy.yaml` if present).
- `manifest_glob` — Glob pattern to locate credential manifests produced by agents.
- `budget_tokens` — Override the max token budget for the workflow run.

## Outputs

- `allow` — `true` when all guardrails pass.
- `reasons` — JSON array of decision rationale.
- `result_path` — Path to the generated `agent-hq-guard-result.json` file for upload as an artifact.

## Example

```yaml
- uses: ./action
  with:
    policy: .github/agent-hq-guard.yml
    manifest_glob: out/*.json
    budget_tokens: 80000
- uses: actions/upload-artifact@v4
  with:
    name: agent-hq-guard-manifest
    path: out
```
