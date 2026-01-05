# Agent HQ Guard GitHub Action

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

Use this action inside your Agent HQ workflows to validate action credentials before the Guard app finalizes required checks.

## Inputs

- `policy` — Path to the Sentinel-style policy YAML (optional; defaults to `policy.yaml` if present).
- `manifest_glob` — Glob pattern to locate credential manifests produced by agents.
- `budget_tokens` — Override the max token budget for the workflow run.
- `github_token` — GitHub token used to load PR files + approvals for scope enforcement.
- `changes` — Comma-separated changed file list (overrides PR detection).
- `changes_file` — Path to a newline-delimited changed files list.
- `approvals` — Approved review count (overrides PR detection).

Guard enforces protected paths only when it has a changed file list (PR context or `changes` input).

## Outputs

- `allow` — `true` when all guardrails pass.
- `reasons` — JSON array of decision rationale.
- `annotations` — JSON array of `{ path, message }` annotations.
- `result_path` — Path to the generated `agent-hq-guard-result.json` file for upload as an artifact.

## Example

```yaml
permissions:
  contents: read
  pull-requests: read

- uses: ./action
  with:
    policy: .github/agent-hq-guard.yml
    manifest_glob: out/*.json
    budget_tokens: 80000
    github_token: ${{ secrets.GITHUB_TOKEN }}
- uses: actions/upload-artifact@v4
  with:
    name: agent-hq-guard-manifest
    path: out
```
