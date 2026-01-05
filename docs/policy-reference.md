# Agent HQ Guard: Policy Reference

> **Complete guide to writing and testing Agent HQ Guard policies**

Policies are the heart of Agent HQ Guard. They define what agents can do, where they can write, and what approvals are required. This guide covers the YAML schema, Rego compilation, and advanced use cases.

## Policy Schema Overview

Every policy file (`.github/agent-hq-guard.yml`) follows this structure:

```yaml
metadata:
  name: string # Policy identifier
  version: string # Semantic version
  description: string # Optional description

allow_agents: [] # Whitelist of agent IDs
max_tokens_per_run: int # Token budget (0 = unlimited)

write_scopes: # File write permissions
  - path: string # Glob pattern for allowed writes
    protected: [] # Glob patterns requiring approval

approvals:
  destructive_ops:
    required: int # Number of approvals needed
    approvers: [] # Optional: specific approvers

provenance_required: bool # Require signed manifests
```

## Field Reference

### `metadata`

Policy metadata for identification and versioning.

```yaml
metadata:
  name: production-guard
  version: 1.2.0
  description: "Production guardrails with strict controls"
```

**Purpose:** Helps track policy changes and identify which policy is active.

### `allow_agents`

Whitelist of approved AI provider IDs. Empty array allows all agents.

```yaml
allow_agents:
  - openai-codex
  - anthropic-claude
  - google-jules
```

**Behavior:**

- If empty (`[]`), all agents are allowed
- If non-empty, only listed agents pass
- Agent IDs must match `credential.agents[].id` from manifests

**Example violation:**

```yaml
allow_agents: ["openai-codex"]
# Agent "anthropic-claude" runs → BLOCKED
```

### `max_tokens_per_run`

Hard ceiling on token consumption per workflow run.

```yaml
max_tokens_per_run: 80000
```

**Behavior:**

- `0` = unlimited (no budget enforcement)
- Positive integer = hard cap
- Guards against runaway costs

**Example violations:**

```yaml
max_tokens_per_run: 50000
# Run consumes 75,000 tokens → BLOCKED
```

### `write_scopes`

Defines where agents can write files and which paths require approval.

```yaml
write_scopes:
  - path: "src/**" # Allow writes to src/
    protected: # But protect these:
      - "src/infra/**" # Infrastructure changes
      - "src/secrets/**" # Secret files
```

**Path Matching:**

- `**` matches any directory depth
- `*` matches single directory level
- Patterns are glob-style (not regex)

**Behavior:**

- Agents can write to `path` patterns
- If they touch `protected` patterns, approvals are required
- Protected paths without approvals → BLOCKED
- If you want to protect paths outside a narrow scope, add another scope or use `path: "**"`

**Example:**

```yaml
write_scopes:
  - path: "src/**"
    protected: ["src/infra/**"]
# ✅ Allowed: src/features/new-feature.ts
# ❌ Blocked: src/infra/deploy.yaml (needs approval)
```

### `approvals`

Approval requirements for protected operations.

```yaml
approvals:
  destructive_ops:
    required: 1
    approvers:
      - "@maintainers"
      - "@security-team"
```

**Behavior:**

- `required` = minimum number of approved PR reviews
- `approvers` = optional list of teams/users (future feature)
- If `required` = 0, no approvals needed

**Current implementation:** Counts PR reviews with `state: APPROVED`. Future: team-based approval matching.

### `provenance_required`

Requires signed manifests for auditability.

```yaml
provenance_required: true
```

**Behavior:**

- `true` = manifest must be signed and valid
- `false` = signing optional (not recommended for production)

**What gets verified:**

- Manifest schema compliance
- Signature presence + PEM formatting
- Artifact `sha256` format

## Complete Policy Examples

### Minimal Policy (Allow Everything)

```yaml
metadata:
  name: permissive
  version: 1.0.0
allow_agents: [] # All agents allowed
max_tokens_per_run: 0 # No budget limit
write_scopes: [] # No scope restrictions
approvals:
  destructive_ops:
    required: 0 # No approvals needed
provenance_required: false # Signing optional
```

**Use case:** Development/testing environments where speed matters more than governance.

### Strict Production Policy

```yaml
metadata:
  name: production-strict
  version: 2.1.0
  description: "Maximum security and compliance"

allow_agents:
  - openai-codex
  - anthropic-claude

max_tokens_per_run: 50000

write_scopes:
  - path: "src/**"
    protected:
      - "src/infra/**"
      - "src/.env.*"
      - "src/secrets/**"
  - path: "docs/**"
    protected: [] # No protection needed

approvals:
  destructive_ops:
    required: 2 # Require 2 approvals
    approvers:
      - "@security-team"
      - "@platform-team"

provenance_required: true
```

**Use case:** Production environments with strict security requirements.

### Per-Team Policy

```yaml
metadata:
  name: team-specific
  version: 1.0.0

allow_agents:
  - anthropic-claude # Only Claude allowed

max_tokens_per_run: 100000 # Higher budget for team

write_scopes:
  - path: "frontend/**"
    protected:
      - "frontend/config/**"
  - path: "backend/**"
    protected:
      - "backend/migrations/**"

approvals:
  destructive_ops:
    required: 1

provenance_required: true
```

**Use case:** Different policies per repository or team.

## Rego Compilation

Guard compiles YAML policies into Rego (Open Policy Agent) for evaluation.

### Compilation Process

```bash
# Build Rego bundle
pnpm --filter @agent-hq-guard/policy run build

# Output: lib/policy/dist/index.rego
```

### Generated Rego Example

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

within_budget {
  input.usage.tokens <= max_tokens
  max_tokens := 80000
}

valid_scope {
  not disallowed_file
}

disallowed_file {
  file := input.changes.files[_]
  not file_allowed(file)
}

file_allowed(file) {
  some pattern in allowed_paths
  glob.match(pattern, ["/"], file)
}

protected_path_touched {
  file := input.changes.files[_]
  pattern := protected_paths[_]
  glob.match(pattern, ["/"], file)
}

allowed_paths := ["**"]
protected_paths := ["infra/**", ".github/**"]

approvals_required {
  required_approvals > 0
  protected_path_touched
}

approvals_satisfied {
  not approvals_required
}

approvals_satisfied {
  approvals_required
  input.approvals.destructive.count >= required_approvals
}

provenance_ok {
  input.provenance.valid == true
}

required_approvals := 1
```

### Policy Inputs

The native evaluator consumes this structure (and the Rego export uses the same shape):

```json
{
  "agent": {
    "id": "openai-codex",
    "capabilities": ["code-generation", "bug-fixing"]
  },
  "usage": {
    "tokens": 1200
  },
  "changes": {
    "files": ["src/index.ts", "src/infra/config.yaml"]
  },
  "approvals": {
    "destructive": {
      "count": 1
    }
  },
  "provenance": {
    "valid": true,
    "credential": {
      /* ActionCredential */
    }
  },
  "overrides": {
    "allowed_agents": [],
    "budget": null
  }
}
```

## Advanced Use Cases

### Multi-Repository Policies

Each repository can have its own policy:

```
org/
├── repo-a/
│   └── .github/agent-hq-guard.yml  # Strict policy
├── repo-b/
│   └── .github/agent-hq-guard.yml  # Permissive policy
└── repo-c/
    └── .github/agent-hq-guard.yml  # Team-specific policy
```

Guard evaluates policies per-repository independently.

### Budget Overrides via Slash Commands

Policies define defaults, but maintainers can override:

```yaml
# Policy sets default
max_tokens_per_run: 50000
# Maintainer comments on PR:
# /budget 100k_tokens

# Guard evaluates with override: 100000
```

### Protected Path Patterns

Common patterns:

```yaml
write_scopes:
  - path: "src/**"
    protected:
      # Infrastructure
      - "infra/**"
      - "**/terraform/**"
      - "**/k8s/**"

      # Secrets
      - "**/.env*"
      - "**/secrets/**"
      - "**/*secret*.yaml"

      # CI/CD
      - ".github/**"
      - ".gitlab-ci.yml"

      # Production configs
      - "**/production/**"
      - "**/prod/**"
```

## Testing Policies

### Local Simulation

Test policies before opening PRs:

```bash
pnpm --filter @agent-hq-guard/cli exec hqguard simulate \
  --policy .github/agent-hq-guard.yml \
  --manifests out/*.json
```

### Example Manifest

Create test manifests:

```json
{
  "version": "0.1.0",
  "run_id": "test-run-123",
  "repository": {
    "owner": "demo",
    "name": "repo",
    "ref": "refs/heads/feature",
    "commit": "0123456789abcdef0123456789abcdef01234567"
  },
  "workflow": {
    "name": "agents",
    "run_number": 1,
    "trigger": "workflow_dispatch"
  },
  "agents": [
    { "id": "openai-codex", "provider": "openai", "capabilities": [] }
  ],
  "decisions": [],
  "budgets": {
    "tokens": 45000,
    "currency": { "amount": 0, "units": "USD" }
  },
  "artifacts": [],
  "signatures": [
    {
      "issuer": "sigstore",
      "timestamp": "2024-01-01T00:00:00Z",
      "signature": "-----BEGIN SIGNATURE-----\n...",
      "rekor_entry": "https://rekor.dev/entry/123"
    }
  ]
}
```

### Optional OPA Testing

If you export Rego, you can test it directly with OPA:

```bash
# Generate input.json from manifest
opa eval \
  --input input.json \
  --data lib/policy/dist/index.rego \
  'data.agenthq.guard.allow'
```

## Windows MCP Alignment (Future)

Guard plans to support Windows MCP mediation data for per-tool approvals.

### Policy Extensions

```yaml
# Future: per-tool control
tool_approvals:
  required_for:
    - "file-write"
    - "database-modify"
  approvers:
    - "@security-team"
```

### Input Extensions

```json
{
  "tools": [
    {
      "name": "file-write",
      "approved_by": ["@alice"],
      "target": "src/infra/config.yaml"
    }
  ],
  "proxy": {
    "audit_log": [{ "timestamp": "...", "action": "..." }]
  }
}
```

## Policy Versioning

### Semantic Versioning

Use semantic versions for policies:

```yaml
metadata:
  name: production-guard
  version: 1.2.3 # MAJOR.MINOR.PATCH
```

**Guidelines:**

- **MAJOR:** Breaking changes (e.g., schema changes)
- **MINOR:** New features (e.g., new policy fields)
- **PATCH:** Bug fixes, clarifications

### Migration Strategy

When updating policies:

1. **Test locally** with CLI simulation
2. **Deploy to test repo** first
3. **Monitor check results** for unexpected blocks
4. **Document changes** in policy description
5. **Roll out gradually** to production repos

## Common Patterns

### Permissive Development

```yaml
allow_agents: []
max_tokens_per_run: 0
provenance_required: false
```

### Strict Security

```yaml
allow_agents: ["approved-provider"]
max_tokens_per_run: 50000
write_scopes:
  - path: "src/**"
    protected: ["**"]
provenance_required: true
```

### Budget-Conscious

```yaml
max_tokens_per_run: 80000
# Use /budget overrides for exceptions
```

## Troubleshooting

### Policy Not Loading

- Check YAML syntax (use `yamllint`)
- Verify file path: `.github/agent-hq-guard.yml`
- Check GitHub App permissions (Contents: Read)

### Unexpected Blocks

- Run CLI simulation to debug
- Check PR annotations for specific reasons
- Review policy logic (are patterns too broad?)

### Performance Issues

- Policies are cached after first load
- Native evaluation is fast (< 10ms); exported Rego is similarly lightweight
- Consider policy complexity (avoid excessive patterns)

---

**Next Steps:** See [Architecture](architecture.md) for system design, or [Provenance](provenance.md) for credential requirements.
