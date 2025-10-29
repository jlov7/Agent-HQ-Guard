# Agent HQ Guard: Frequently Asked Questions

> **Quick answers to common questions about Agent HQ Guard**

## For Non-Technical Stakeholders

### Q: What problem does Agent HQ Guard solve?

**A:** Agent HQ Guard prevents autonomous AI coding agents from bypassing your team's policies. Without it, agents could:
- Spend unlimited money on AI tokens
- Modify sensitive files without approval
- Skip security reviews
- Leave no audit trail of who made what changes

Guard enforces **budgets, approvals, and provenance** before code can merge—giving you confidence to adopt AI development tools.

### Q: Can humans override the guardrails?

**A:** Yes! Maintainers use simple slash commands in PR comments:
- `/agent-allow @provider` — Temporarily allow a blocked agent
- `/budget 50k_tokens` — Raise/lower the token budget

Every override is logged and visible in the PR, maintaining accountability while allowing flexibility.

### Q: How do I know if a run is safe to merge?

**A:** Look for the **Agent HQ Guard** check on the PR:
- ✅ **Green check** = All policies passed, safe to merge
- ❌ **Red X** = Policy violations detected, review needed

Guard also posts a signed credential summary comment showing who the agents were, token usage, and provenance status.

### Q: Does this block manual commits?

**A:** No. Guard only evaluates GitHub Agent HQ workflows that upload manifests. Manual commits from developers bypass Guard entirely.

### Q: Will this slow down our development?

**A:** No. Guard runs in parallel with your workflows and only blocks merges when policies are violated. Most compliant runs pass instantly.

### Q: What happens if Guard makes a mistake?

**A:** Humans can always override with slash commands. Guard is designed to be helpful, not obstructive. If a policy is too strict, you can adjust it or use temporary overrides.

## For Engineers

### Q: Why is my agent blocked?

**A:** Check PR annotations or the Guard summary comment. Common reasons:
- Agent not on `allow_agents` list
- Token budget exceeded (`max_tokens_per_run`)
- Protected path modified without approval
- Missing or invalid provenance manifest

### Q: The check says provenance invalid. What now?

**A:** Ensure:
1. Your workflow uploaded the manifest artifact (`agent-hq-guard-manifest`)
2. The manifest was signed with `cosign sign-blob`
3. The manifest schema matches `action_credential_v0.json`

Re-run the workflow after fixing the manifest signing step.

### Q: How do I test policy changes locally?

**A:** Use the CLI to simulate runs:

```bash
pnpm --filter @agent-hq-guard/cli exec hqguard simulate \
  --policy .github/agent-hq-guard.yml \
  --manifests out/*.json
```

This lets you test policy changes before opening PRs.

### Q: Mission control API is down—will Guard fail the PR?

**A:** No. The mission-control client retries three times with exponential backoff and surfaces a warning. The check status is still determined by policy/provenance evaluation, not mission control availability.

### Q: How do I debug a failing check?

**A:** Follow this debugging flow:

1. **Check PR annotations** — Guard lists specific reasons
2. **Review workflow artifacts** — Download `agent-hq-guard-manifest`
3. **Run CLI simulation** — Reproduce locally:
   ```bash
   ./cli/dist/index.js simulate --policy .github/agent-hq-guard.yml --manifests out/*.json
   ```
4. **Check Guard App logs** — Evaluation details are logged
5. **Verify policy syntax** — Ensure YAML is valid

### Q: Can I use Guard with multiple repositories?

**A:** Yes! Install the GitHub App at the organization level, and each repository can have its own `.github/agent-hq-guard.yml` policy file. Guard evaluates policies per-repository.

### Q: How do I update Guard when new versions are released?

**A:** 
1. Update the action reference in your workflows
2. Redeploy the Guard App (if self-hosted)
3. Review policy schema changes (check release notes)
4. Test with CLI simulation before deploying

## For Operations & Security Teams

### Q: What data does Guard store?

**A:** Guard stores:
- ✅ Credential hashes (fingerprints, not content)
- ✅ Sqlite overrides (slash command decisions)
- ✅ Policy evaluation results

Guard does **not** store:
- ❌ Raw artifact content
- ❌ Code changes
- ❌ Secrets or credentials

Manifests live in GitHub's artifact storage with standard retention policies.

### Q: How do I rotate keys?

**A:** 
1. **GitHub App:** Regenerate private key in GitHub App settings, update `PRIVATE_KEY_PATH`
2. **Cosign:** Rotate OIDC identities (GitHub Actions OIDC is ephemeral, no rotation needed)
3. **Webhook secret:** Generate new secret, update `WEBHOOK_SECRET`
4. Redeploy Guard App

SBOM signing uses GitHub OIDC, so there are no long-lived signing keys to rotate.

### Q: Can I plug in my own policy engine?

**A:** Yes! Guard compiles YAML into Rego. You can:

1. Build your own Rego bundle:
   ```bash
   pnpm --filter @agent-hq-guard/policy run build
   ```

2. Deploy to your OPA instance

3. Swap evaluation endpoint via `OPA_URL` in compose file

Guard provides the framework; you control the policy engine.

### Q: How do I monitor Guard health?

**A:** Guard exposes health endpoints:

- `GET /healthz` — Liveness check (always returns 200)
- `GET /readyz` — Readiness check (includes storage + mission control status)

Configure these in:
- Kubernetes probes
- Uptime monitors
- Load balancer health checks

### Q: What's the incident response process?

**A:** See [Operator Guide](operator-guide.md) for full runbook. Quick checklist:

1. **Check fails unexpectedly** → Review PR annotations, inspect artifacts, run CLI simulation
2. **Provenance validation failure** → Verify manifest upload, check cosign signing
3. **Mission control unreachable** → Guard retries automatically; disable via `AGENT_HQ_API_URL` if needed

### Q: How do I audit Guard decisions?

**A:** Guard provides:

- **PR comments** — Every decision is logged with credential summary
- **Check annotations** — Detailed reasons for failures
- **Sqlite overrides** — All slash command decisions stored
- **Workflow artifacts** — Signed manifests preserved

Query sqlite database or review PR history for audit trails.

### Q: Can I require multiple approvals for protected paths?

**A:** Yes. Configure in policy:

```yaml
approvals:
  destructive_ops:
    required: 2  # Require 2 approvals
    approvers:
      - "@security-team"
      - "@maintainers"
```

### Q: How do I exclude certain files from protection?

**A:** Use `write_scopes` with negative patterns (future feature) or structure your policy:

```yaml
write_scopes:
  - path: "src/**"
    protected:
      - "src/infra/**"     # Protect infra
      # src/features/** is unprotected
```

### Q: What happens when a PR is merged?

**A:** Currently, Guard checks remain in PR history. Planned:
- Post-merge cleanup hooks to purge sqlite overrides
- Archive manifests for compliance retention

Manifests in GitHub artifacts follow standard retention (7-90 days).

## Advanced Topics

### Q: How does Guard compare to Sentinel?

**A:** Guard's YAML policy format is **Sentinel-compatible**, meaning:
- Policies compile to Rego (same as Sentinel)
- You can migrate Sentinel policies to Guard
- Guard adds GitHub-native integration (Checks API, Actions, etc.)

### Q: Can I use Guard without GitHub?

**A:** Currently, Guard is GitHub-native. The CLI works standalone, but the App requires GitHub. For other platforms, consider:
- CLI-only workflows
- Custom integration using Guard libraries
- Policy engine extraction (OPA bundle)

### Q: What about Windows MCP alignment?

**A:** Guard supports Windows MCP mediation data via policy inputs:
- `input.tools[].approved_by` — Tool approval tracking
- `input.proxy.audit_log` — Proxy audit trail

Extend policy bundles to incorporate Windows MCP attributes. See [Policy Reference](policy-reference.md).

### Q: How do I contribute to Guard?

**A:** 
1. Read [Architecture](architecture.md) for system design
2. Run `pnpm check` to verify code quality
3. Add tests for new features
4. Update documentation
5. Open a PR with clear description

---

**Still have questions?** Open an issue with:
- Your question
- Context (PR link, policy file, etc.)
- CLI simulation output (if debugging)

We're here to help! 🚀