# Policy Reference

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

## YAML Schema

```yaml
metadata:
  name: default
  version: 0.1.0
  description: Optional description
allow_agents: [] # Array of agent identifiers
max_tokens_per_run: 0 # Integer token ceiling (0 == unlimited)
write_scopes: # File scope + protected patterns
  - path: "src/**"
    protected:
      - "infra/**"
approvals:
  destructive_ops:
    required: 1 # Approval count
    approvers:
      - "@maintainers" # Optional list of approver handles
provenance_required: true # Boolean flag
```

### Field Behaviors

| Field                                | Purpose                                                                       | Inputs                |
| ------------------------------------ | ----------------------------------------------------------------------------- | --------------------- |
| `allow_agents`                       | Allow-list of agent IDs (`credential.agents[].id`). Leave empty to allow all. | Array of strings      |
| `max_tokens_per_run`                 | Hard ceiling on `credential.budgets.tokens`.                                  | Integer               |
| `write_scopes[].protected`           | Glob patterns; Guard blocks PR if modified without approval.                  | Array of glob strings |
| `approvals.destructive_ops.required` | Minimum number of approved PR reviews (state `APPROVED`).                     | Integer               |
| `provenance_required`                | Require signed manifests (Sigstore + Rekor).                                  | Boolean               |

## Rego Compilation

Policies compile into Rego and can be shipped to OPA. Example snippet:

```rego
package agenthq.guard

default allow = false

allow {
  allow_agent
  within_budget
  valid_scope
  approvals_satisfied
  provenance_ok
}

allow_agent {
  input.agent.id == agent
  agent := allowlist[_]
}
allowlist := ["openai-codex", "anthropic-claude"]
```

Use `pnpm --filter @agent-hq-guard/policy run build` to emit bundled Rego under `lib/policy/dist/` and stage into `lib/policy/bundle/`.

## Policy Inputs

The evaluator feeds the following structure into OPA:

```json
{
  "agent": { "id": "openai-codex" },
  "usage": { "tokens": 1200 },
  "changes": { "files": ["src/index.ts"] },
  "approvals": { "destructive": { "count": 1 } },
  "provenance": { "valid": true }
}
```

### Windows MCP Alignment

- Pass mediation data via `input.tools[].approved_by`.
- Provide proxy audit trail under `input.proxy.audit_log`.
- Extend the policy bundle to incorporate Windows MCP attributes; Guard preserves them on the `input` object for Rego decisions.

## Testing Policies

```bash
pnpm --filter @agent-hq-guard/cli exec hqguard simulate \
  --policy .github/agent-hq-guard.yml \
  --manifests ./out/*.json
```

Combine CLI output with `opa eval` to inspect Rego decisions:

```bash
opa eval --input input.json --data lib/policy/dist/index.js 'data.agenthq.guard.allow'
```

Policies are source-controlled YAML. Treat changes like code: review, test via CLI, and capture diffs in PRs.
