# FAQ

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

## Non-Technical Stakeholders

**Q: What problem does Agent HQ Guard solve?**  
It stops autonomous coding agents from bypassing team policies. Every run must respect budgets, approvals, and provenance before code lands.

**Q: Can humans override the guardrails?**  
Yes. Maintainers use `/agent-allow` and `/budget` slash commands. Guard logs every override back to the PR.

**Q: How do I know if a run is safe to merge?**  
Look for the required check **Agent HQ Guard** on the PR. A passing check includes a signed credential summary comment.

**Q: Does this block manual commits?**  
No. Guard only adjudicates GitHub Agent HQ or Action-driven workflows that upload manifests.

## Engineers

**Q: Why is my agent blocked?**  
Check PR annotations. Common reasons: agent not on `allow_agents`, token budgets exceeded, or protected paths modified without the needed approval.

**Q: The check says provenance invalid. What now?**  
Ensure the workflow uploaded the manifest artifact and that cosign signed it. Re-run the workflow after fixing the manifest.

**Q: How do I test policy changes locally?**  
`pnpm --filter @agent-hq-guard/cli exec hqguard simulate --policy .github/agent-hq-guard.yml --manifests out/*.json`.

**Q: Mission control API is down—will Guard fail the PR?**  
No. The mission-control client retries three times with exponential backoff and surfaces a warning. The check status is still determined by policy/provenance.

## Operations & Security

**Q: What data does Guard store?**  
Only sqlite overrides and credential hashes. No raw artifact content is persisted.

**Q: How do I rotate keys?**  
Rotate GitHub App secrets and cosign identities, then redeploy. SBOM signing uses GitHub OIDC so there are no long-lived signing keys.

**Q: Can I plug in my own policy engine?**  
Yes. Compile the YAML into Rego (`pnpm --filter @agent-hq-guard/policy run build`) and push to your OPA instance. Swap the evaluation endpoint via `OPA_URL` in the compose file.

**Q: Where do I get support?**  
Open an issue with context: PR link, guard summary, manifest hashes. Include CLI simulation output when possible.
