# Agent HQ Guard Quick Start

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

## Prerequisites

- GitHub organization where you can create GitHub Apps and manage branch protection.
- Node.js 20+, pnpm 10+, Docker (optional but recommended for the compose stack).
- Cosign and OIDC permissions in the repo if you plan to sign SBOMs.

## 1. Clone & Bootstrap

```bash
git clone https://github.com/you/agent-hq-guard.git
cd agent-hq-guard
pnpm install
pnpm check
```

The `check` script runs linting, type-checking, and the full Vitest suite with coverage.

## 2. Create the GitHub App

1. Navigate to **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Required permissions:
   - Checks: Read & Write
   - Contents: Read
   - Pull requests: Read
3. Subscribe to events:
   - `check_suite`
   - `pull_request`
   - `workflow_run`
   - `issue_comment`
4. Set the webhook URL to your deployed Guard URL (default `http://localhost:3000/api/github/webhooks` when running via Docker).
5. Generate private key + save App ID and Client ID in a `.env` file if running locally.

## 3. Configure Policy

Create `.github/agent-hq-guard.yml` in the target repository:

```yaml
metadata:
  name: mainline-guard
allow_agents:
  - openai-codex
  - anthropic-claude
max_tokens_per_run: 80000
write_scopes:
  - path: "src/**"
    protected:
      - "infra/**"
      - ".github/**"
approvals:
  destructive_ops:
    required: 1
provenance_required: true
```

## 4. Wire the GitHub Action

In each agent workflow add:

```yaml
- name: Guard multi-agent run
  uses: ./action
  with:
    policy: .github/agent-hq-guard.yml
    manifest_glob: out/*.json
    budget_tokens: 80000
- uses: actions/upload-artifact@v4
  with:
    name: agent-hq-guard-manifest
    path: out
```

## 5. Run Locally (Optional)

Spin everything up with Postgres, Redis, OPA, and OTEL:

```bash
docker-compose up --build
```

Use the CLI to simulate a run:

```bash
pnpm --filter @agent-hq-guard/cli run build
./cli/dist/index.js simulate --policy .github/agent-hq-guard.yml --manifests out/*.json
```

## 6. Enforce the Check

Set branch protection on your default branch to require the **Agent HQ Guard** check. Configure Code Owners or Review rules to backstop destructive operations.

## 7. Native Mission Control (Optional)

If you have access to GitHub Agent HQ’s mission-control API, set:

```bash
export AGENT_HQ_API_URL="https://mission-control.example.com"
```

The Guard will publish allow/deny decisions upstream before tools execute.

## 8. Deploy Checklist

- [ ] `pnpm build` succeeds and produces bundles.
- [ ] SBOM artifacts (`sbom.json`, `sbom.sig`) uploaded in CI.
- [ ] GitHub App connected to target organization.
- [ ] Required Check enforced on default branch.
- [ ] Slash commands documented for maintainers.

You now have guardrails protecting multi-agent runs with consistent policy, provenance, and budget enforcement.
