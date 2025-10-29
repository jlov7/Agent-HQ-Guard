# Agent HQ Guard: Operator Guide

> **Complete operational runbook for SREs and DevOps teams**

This guide covers everything you need to operate Agent HQ Guard in production: monitoring, incident response, security posture, and maintenance procedures.

## Guard Responsibilities

Agent HQ Guard enforces four core responsibilities:

### 1. Policy Enforcement

- **Sentinel-compatible YAML** drives allowlists, token budgets, protected paths, and approval counts
- **Rego compilation** converts policies to OPA bundles
- **Evaluation** happens on every workflow run completion

### 2. Provenance Verification

- **Signed A2PA manifests** (Sigstore + in-toto + C2PA bindings) required before checks pass
- **Signature validation** verifies Sigstore envelopes
- **Rekor lookups** confirm transparency log entries

### 3. Budget Governance

- **Per-run token ceilings** enforced at workflow and PR levels
- **Override controls** via slash commands (`/budget`)
- **Cost tracking** via credential summaries

### 4. Override Workflows

- **Slash commands** (`/agent-allow`, `/budget`) for maintainer controls
- **Audit logging** of all overrides
- **Sqlite persistence** for temporary exceptions

## Runtime Architecture

```mermaid
sequenceDiagram
    participant Agent as Agent Workflow
    participant Action as Guard Action
    participant Artifact as Artifact Store
    participant App as Guard App
    participant GH as GitHub Checks
    participant MC as Mission Control
    participant Storage as SQLite

    Agent->>Action: Emit credential manifests
    Action->>Action: Validate schema + budgets
    Action->>Artifact: Upload manifest artifact
    Action->>GH: Set outputs (allow/reasons)
    Artifact->>App: workflow_run.completed webhook
    App->>Artifact: Download manifest zip
    App->>Storage: Load policy + overrides
    App->>App: Policy + provenance evaluation
    App->>GH: Update Agent HQ Guard Check + annotations
    App->>MC: (optional) Publish decision (retry w/backoff)
    App->>Storage: Log override if slash command used
```

## Health & Observability

### Health Endpoints

Guard exposes two health endpoints:

**Liveness (`/healthz`):**

```bash
curl http://localhost:3000/healthz
# Returns: {"status":"ok"}
```

- Always returns 200 (simple alive check)
- Use for Kubernetes liveness probes
- No dependencies checked

**Readiness (`/readyz`):**

```bash
curl http://localhost:3000/readyz
# Returns: {"status":"ready","missionControlEnabled":true}
```

- Checks storage connectivity (sqlite ping)
- Reports mission control status
- Use for Kubernetes readiness probes
- Returns 503 if degraded

### Logging

Guard uses Probot's pino logger with structured logging:

```json
{
  "level": "info",
  "msg": "Policy evaluation complete",
  "repo": "owner/repo",
  "pr": 123,
  "sha": "abc123...",
  "allow": true,
  "reasons": [],
  "evaluationTime": 45
}
```

**Log Levels:**

- `debug` — Detailed evaluation steps
- `info` — Policy decisions, check updates
- `warn` — Retries, degraded modes
- `error` — Failures, exceptions

**Ship logs to:**

- OTEL collector (included in `docker-compose.yml`)
- Your observability stack (Datadog, New Relic, etc.)
- Centralized logging (ELK, Loki, etc.)

### Metrics (Recommended)

Track these metrics for production:

```prometheus
# Policy evaluations
guard_evaluations_total{repo="owner/repo",allow="true|false"} 1234

# Overrides
guard_overrides_total{type="agent-allow|budget"} 56

# Mission control
guard_mc_publish_total{status="success|failure"} 789

# Latency
guard_evaluation_duration_seconds{repo="owner/repo"} 0.045

# Provenance
guard_provenance_verifications_total{valid="true|false"} 234
```

**Alert thresholds:**

- Evaluation failures > 5% → Alert
- MC retry failures > 10% → Alert
- Provenance failures > 2% → Alert

### Dashboards

Recommended Grafana dashboard panels:

1. **Policy Decisions** — Pass/fail rate over time
2. **Token Usage** — Average tokens per run
3. **Override Frequency** — Slash command usage
4. **Latency** — Evaluation time percentiles
5. **Provenance** — Verification success rate

## Incident Response

### Check Fails Unexpectedly

**Symptoms:**

- PR shows red "Agent HQ Guard" check
- Unexpected policy violations

**Investigation:**

1. **Check PR annotations** — Guard lists specific reasons
2. **Review workflow artifacts** — Download `agent-hq-guard-manifest`
3. **Inspect Guard logs** — Look for evaluation errors
4. **Run CLI simulation** — Reproduce locally:
   ```bash
   ./cli/dist/index.js simulate \
     --policy .github/agent-hq-guard.yml \
     --manifests out/*.json
   ```

**Resolution:**

- Fix policy if too strict
- Use slash command override if appropriate
- Update policy and redeploy

### Provenance Validation Failure

**Symptoms:**

- "Provenance invalid" error
- Signature verification failures

**Investigation:**

1. **Verify manifest upload** — Check workflow artifact exists
2. **Check signing step** — Ensure `cosign sign-blob` ran
3. **Verify schema** — Manifest matches `action_credential_v0.json`
4. **Manual verification:**
   ```bash
   cosign verify-blob \
     --certificate-oidc-issuer https://token.actions.githubusercontent.com \
     --bundle manifest.json.bundle \
     manifest.json
   ```

**Resolution:**

- Fix signing workflow
- Re-run workflow after fixes
- Update policy if signing optional temporarily

### Mission Control Unreachable

**Symptoms:**

- Warnings in logs about MC failures
- Retry counts increasing

**Investigation:**

1. **Check `AGENT_HQ_API_URL`** — Verify environment variable
2. **Test connectivity:**
   ```bash
   curl -v $AGENT_HQ_API_URL/health
   ```
3. **Review retry logs** — Guard retries 3x with exponential backoff

**Resolution:**

- Guard continues working (check status still determined by policy)
- Fix MC connectivity if needed
- Disable MC temporarily: `unset AGENT_HQ_API_URL`

### Storage Degradation

**Symptoms:**

- `/readyz` returns 503
- Overrides not persisting

**Investigation:**

1. **Check sqlite file** — Verify permissions, disk space
2. **Test connectivity:**
   ```bash
   sqlite3 guard.db "SELECT 1;"
   ```

**Resolution:**

- Fix permissions/disk space
- Migrate to Postgres for production
- Restore from backup if corrupted

### Policy Load Failures

**Symptoms:**

- Checks stuck in "pending"
- "Policy not found" errors

**Investigation:**

1. **Verify file path** — `.github/agent-hq-guard.yml` exists
2. **Check permissions** — GitHub App has Contents: Read
3. **Validate YAML** — Use `yamllint`
4. **Check logs** — Policy load errors

**Resolution:**

- Fix file path/permissions
- Validate YAML syntax
- Ensure policy file committed

## Overrides & Governance

### Slash Commands

Guard supports two slash commands:

**Allow Agent:**

```
/agent-allow @openai-codex
```

**Adjust Budget:**

```
/budget 100k_tokens
```

### Override Lifecycle

1. **Maintainer comments** slash command on PR
2. **Guard processes** command (validates permissions)
3. **Override stored** in sqlite (`overrides` table)
4. **Check re-evaluated** with override applied
5. **Bot responds** confirming override

### Audit Trail

All overrides logged:

- PR number
- Override type/value
- Maintainer who issued
- Timestamp
- Policy evaluation result

**Query overrides:**

```bash
sqlite3 guard.db "SELECT * FROM overrides WHERE pr_number = 123;"
```

### Cleanup

**Current:** Overrides persist indefinitely  
**Future:** Post-merge cleanup hooks to purge overrides

**Manual cleanup:**

```bash
# Delete overrides for merged PRs
sqlite3 guard.db "DELETE FROM overrides WHERE pr_number IN (SELECT number FROM merged_prs);"
```

## Data Retention & Privacy

### What Guard Stores

- ✅ **Credential hashes** — Fingerprints for reference
- ✅ **Sqlite overrides** — Slash command decisions
- ✅ **Policy evaluation results** — Logged via pino

### What Guard Doesn't Store

- ❌ Raw artifact content
- ❌ Code changes
- ❌ Secrets or credentials
- ❌ Full manifest content

### Retention Policies

**Manifests:**

- Stored in GitHub artifacts (90-day default retention)
- Configure retention per repository
- Archive externally for compliance

**Overrides:**

- Sqlite storage (no automatic cleanup)
- Plan manual cleanup or scheduled jobs

**Logs:**

- Follow your observability stack retention
- Typically 30-90 days
- Archive critical events longer

### Privacy Considerations

- **No PII storage** — Guard doesn't store personal data
- **Hash-only** — Credentials stored as hashes, not content
- **Artifact isolation** — GitHub artifacts are repository-scoped
- **Log sanitization** — Avoid logging sensitive data

## Security Controls

### Key Rotation

**GitHub App Private Key:**

1. Regenerate in GitHub App settings
2. Update `PRIVATE_KEY_PATH` environment variable
3. Redeploy Guard App
4. Old key invalidated immediately

**Webhook Secret:**

1. Generate new secret
2. Update `WEBHOOK_SECRET`
3. Update GitHub App webhook URL
4. Redeploy Guard App

**Cosign:** No rotation needed (uses GitHub OIDC, ephemeral)

### SBOM & Signing

**CI Pipeline:**

```yaml
- name: Generate SBOM
  run: |
    cyclonedx-bom -o sbom.json

- name: Sign SBOM
  run: |
    cosign sign-blob \
      --oidc-issuer https://token.actions.githubusercontent.com \
      --bundle sbom.json.bundle \
      sbom.json
```

**Verification:**

```bash
cosign verify-blob --bundle sbom.json.bundle sbom.json
```

### Dependency Management

- **Strict peer dependencies** — `.npmrc` enforces
- **Shared workspace lockfile** — Deterministic builds
- **Dependabot** — Auto-updates npm packages weekly
- **Security audits** — `pnpm audit` in CI

### Access Controls

**GitHub App Permissions:**

- Minimal required permissions
- Repository-scoped (not organization-wide by default)
- Review permissions regularly

**Environment Variables:**

- Use secrets management (K8s secrets, Fly secrets, etc.)
- Never commit secrets to git
- Rotate regularly

## Maintenance Tasks

### Regular Maintenance

**Weekly:**

- [ ] Review override usage (slash commands)
- [ ] Check policy evaluation metrics
- [ ] Monitor provenance verification rates

**Monthly:**

- [ ] Review and update policies
- [ ] Clean up old overrides
- [ ] Review dependency updates (Dependabot)
- [ ] Check storage growth (sqlite)

**Quarterly:**

- [ ] Rotate GitHub App credentials
- [ ] Review access permissions
- [ ] Update Guard App version
- [ ] Archive critical manifests

### Release Process

1. **Update version** in `package.json`
2. **Run tests:** `pnpm check`
3. **Build:** `pnpm build`
4. **Generate SBOM:** `cyclonedx-bom`
5. **Sign SBOM:** `cosign sign-blob`
6. **Deploy:** Update production deployment
7. **Verify:** Check `/readyz` endpoint
8. **Monitor:** Watch logs for errors

### Policy Updates

When updating policies:

1. **Test locally** with CLI simulation
2. **Deploy to test repo** first
3. **Monitor check results** for unexpected blocks
4. **Document changes** in policy description
5. **Roll out gradually** to production repos

### Database Migration

**Sqlite → Postgres:**

```bash
# Export overrides
sqlite3 guard.db ".dump overrides" > overrides.sql

# Import to Postgres
psql -d guard_db -f overrides.sql
```

**Update connection string:**

```bash
export DATABASE_URL="postgresql://user:pass@host/db"
```

## Branch Protection Template

Recommended branch protection settings:

1. **Require pull request reviews**
   - Minimum approvals: 1 (or policy-defined)
   - Dismiss stale reviews: Enabled

2. **Require status checks**
   - ✅ Agent HQ Guard (required)
   - ✅ CI/CD checks (your existing)
   - ✅ SBOM upload (optional)

3. **Require conversation resolution**
   - Enabled

4. **Enforce admins**
   - Include administrators: Enabled (or disabled for strict orgs)

## Troubleshooting Guide

### Common Issues

**Issue: Check stuck in "pending"**

- **Cause:** Policy not loaded
- **Fix:** Verify `.github/agent-hq-guard.yml` exists and is valid

**Issue: Overrides not working**

- **Cause:** Storage connectivity issue
- **Fix:** Check sqlite file permissions, disk space

**Issue: High latency**

- **Cause:** Policy complexity, network issues
- **Fix:** Optimize policy patterns, check network connectivity

**Issue: Provenance always fails**

- **Cause:** Signing workflow broken
- **Fix:** Verify `cosign sign-blob` step in workflows

## Support & Escalation

### When to Escalate

- Production outages (> 5 min)
- Security incidents
- Data loss
- Compliance violations

### Information to Provide

- PR link
- Guard summary output
- Manifest hashes
- CLI simulation output
- Guard App logs
- Policy file

---

**Next Steps:** See [Architecture](architecture.md) for system design, or [Policy Reference](policy-reference.md) for policy authoring.
