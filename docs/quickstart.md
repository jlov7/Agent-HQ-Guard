# Agent HQ Guard: Quick Start Guide

> **Get Agent HQ Guard running in your repository in under an hour.**

This guide walks you through installing, configuring, and deploying Agent HQ Guard step-by-step. By the end, you'll have policy-driven governance protecting your autonomous agent runs.

## Prerequisites

Before starting, ensure you have:

- ✅ A GitHub organization where you can create GitHub Apps
- ✅ Node.js 20+ and pnpm 10+ installed
- ✅ Docker (optional but recommended for local development)
- ✅ Repository admin access to configure branch protection rules
- ✅ Cosign and OIDC permissions (for signing SBOMs in production)

## Step 1: Clone & Install

```bash
git clone https://github.com/you/agent-hq-guard.git
cd agent-hq-guard
pnpm install
pnpm check
```

The `check` command runs linting, type-checking, and the full test suite. If everything passes, you're ready to proceed.

**What this does:** Installs all dependencies and verifies the codebase is healthy.

## Step 2: Create Your GitHub App

Agent HQ Guard runs as a GitHub App, which gives it secure access to your repositories.

### 2.1 Navigate to GitHub App Settings

1. Go to your GitHub organization
2. Navigate to **Settings → Developer settings → GitHub Apps**
3. Click **New GitHub App**

### 2.2 Configure Basic Settings

- **Name:** `Agent HQ Guard` (or your preferred name)
- **Homepage URL:** Your organization's homepage
- **Webhook URL:** Your deployed Guard URL (for local: `http://localhost:3000/api/github/webhooks`)
- **Webhook secret:** Generate a secure random string (save this!)

### 2.3 Set Permissions

Agent HQ Guard needs these permissions:

| Permission | Access Level | Why |
|------------|--------------|-----|
| **Checks** | Read & Write | Update check status on PRs |
| **Contents** | Read | Read repository contents and policy files |
| **Pull requests** | Read | Monitor PR state and approvals |
| **Metadata** | Read | Access repository metadata |

### 2.4 Subscribe to Events

Enable these webhook events:

- ✅ `check_suite` — When check suites are requested
- ✅ `pull_request` — When PRs are opened/updated
- ✅ `workflow_run` — When workflow runs complete
- ✅ `issue_comment` — For slash command processing

### 2.5 Generate Credentials

1. Click **Generate private key** and download the `.pem` file
2. Save your **App ID** and **Client ID**
3. Create a `.env` file (local development):

```bash
APP_ID=your_app_id_here
PRIVATE_KEY_PATH=./path/to/your-private-key.pem
WEBHOOK_SECRET=your_webhook_secret_here
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

**What this does:** Creates the GitHub App identity that Guard uses to interact with your repositories.

## Step 3: Configure Your Policy

Policies define what Guard enforces. Create `.github/agent-hq-guard.yml` in your target repository:

```yaml
metadata:
  name: mainline-guard
  version: 1.0.0
  description: Production guardrails for autonomous agents

# Which AI providers are allowed
allow_agents:
  - openai-codex
  - anthropic-claude
  - google-jules

# Maximum tokens per run (0 = unlimited)
max_tokens_per_run: 80000

# File scope controls
write_scopes:
  - path: "src/**"      # Allow writes to src/
    protected:          # But protect these subdirectories
      - "infra/**"      # Infrastructure changes need approval
      - ".github/**"    # GitHub workflows need approval

# Approval requirements
approvals:
  destructive_ops:
    required: 1          # Need at least 1 approval for protected files
    approvers:
      - "@maintainers"   # Optional: specific teams/groups

# Require signed manifests for audit
provenance_required: true
```

**Understanding the policy:**
- `allow_agents` — Whitelist of approved AI providers
- `max_tokens_per_run` — Hard budget cap (prevents runaway costs)
- `write_scopes[].protected` — Files that require human approval
- `provenance_required` — Enforces cryptographic signing

**What this does:** Defines the rules Guard enforces. You can customize this per repository.

## Step 4: Wire Up the GitHub Action

In each agent workflow file (`.github/workflows/agent-workflow.yml`), add Guard:

```yaml
name: Autonomous Agent Run

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  agent-run:
    runs-on: ubuntu-latest
    steps:
      # ... your agent execution steps ...

      # Guard: Validate and enforce policy
      - name: Agent HQ Guard
        uses: ./action
        with:
          policy: .github/agent-hq-guard.yml
          manifest_glob: out/*.json
          budget_tokens: 80000

      # Guard: Upload manifest artifact
      - name: Upload Guard Manifest
        uses: actions/upload-artifact@v4
        with:
          name: agent-hq-guard-manifest
          path: out
          retention-days: 90
```

**What this does:** 
- Validates agent manifests against your policy
- Fails fast if budgets or provenance are violated
- Uploads manifests for Guard App to verify

## Step 5: Run Locally (Development)

For local development and testing, use Docker Compose:

```bash
docker-compose up --build
```

This starts:
- ✅ Guard GitHub App (Probot)
- ✅ PostgreSQL (for storage)
- ✅ Redis (for caching)
- ✅ OPA (policy engine)
- ✅ OTEL Collector (observability)

**Local webhook testing:** Use [ngrok](https://ngrok.com/) or GitHub's webhook testing tools to forward events to `http://localhost:3000`.

### Test with CLI

Simulate a run locally:

```bash
# Build the CLI
pnpm --filter @agent-hq-guard/cli run build

# Simulate a run
./cli/dist/index.js simulate \
  --policy .github/agent-hq-guard.yml \
  --manifests out/*.json
```

**What this does:** Lets you test policy changes before opening PRs.

## Step 6: Configure Branch Protection

Enforce Guard checks at the repository level:

1. Navigate to **Settings → Branches → Branch protection rules**
2. Add rule for your default branch (e.g., `main`)
3. Enable:
   - ✅ **Require pull request reviews** (minimum 1)
   - ✅ **Require status checks to pass**
   - ✅ Add **Agent HQ Guard** to required checks
   - ✅ **Require conversation resolution before merging**

**What this does:** Prevents merging code that fails Guard checks.

## Step 7: Enable Native Mission Control (Optional)

If you have access to GitHub Agent HQ's mission control API:

1. Set environment variable:
   ```bash
   export AGENT_HQ_API_URL="https://mission-control.example.com"
   ```

2. Guard will publish allow/deny decisions upstream before tools execute

3. Check readiness:
   ```bash
   curl http://localhost:3000/readyz
   # Should show: {"status":"ready","missionControlEnabled":true}
   ```

**What this does:** Enables proactive enforcement before agents execute, reducing wasted compute.

## Step 8: Deploy to Production

### Deployment Checklist

- [ ] `pnpm build` succeeds and produces all bundles
- [ ] SBOM artifacts (`sbom.json`, `sbom.sig`) uploaded in CI
- [ ] GitHub App connected to target organization/repositories
- [ ] Required Check configured in branch protection
- [ ] Environment variables secured (use secrets management)
- [ ] Monitoring/alerting configured for health endpoints
- [ ] Slash commands documented for maintainers
- [ ] Policy files reviewed and approved

### Production Deployment Options

**Option 1: Fly.io / Heroku**
```bash
# Fly.io example
fly launch
fly secrets set APP_ID=xxx PRIVATE_KEY_PATH=xxx WEBHOOK_SECRET=xxx
```

**Option 2: Kubernetes**
```yaml
# Use Helm chart or deploy directly
# Ensure health endpoints are exposed
```

**Option 3: GitHub Actions (Self-Hosted Runner)**
- Deploy Guard App as a service
- Configure webhook URL to your runner's public URL

## Step 9: Verify Everything Works

1. **Create a test PR** with an agent workflow
2. **Check the PR status** — Should see "Agent HQ Guard" check
3. **Review the summary comment** — Guard should post credential summary
4. **Test slash commands:**
   - Comment `/agent-allow @openai-codex` on PR
   - Comment `/budget 100k_tokens` on PR
   - Verify Guard responds

## Troubleshooting

### Check fails unexpectedly

1. **Check PR annotations** — Guard lists specific reasons
2. **Review workflow artifacts** — Download `agent-hq-guard-manifest`
3. **Run CLI simulation** — Reproduce locally
4. **Check logs** — Guard App logs show detailed evaluation

### Provenance validation fails

1. **Verify manifest upload** — Check workflow artifact exists
2. **Check signing** — Ensure `cosign sign-blob` ran successfully
3. **Verify schema** — Manifest must match `action_credential_v0.json`

### Mission control unreachable

1. **Check `AGENT_HQ_API_URL`** — Verify environment variable
2. **Review retry logs** — Guard retries 3x with backoff
3. **Disable if needed** — Unset `AGENT_HQ_API_URL` temporarily

## Next Steps

- 📖 Read the [Operator Guide](operator-guide.md) for runbooks and monitoring
- 📋 Review the [Policy Reference](policy-reference.md) for advanced configuration
- 🔐 Understand [Provenance](provenance.md) for compliance requirements
- ❓ Check the [FAQ](faq.md) for common questions

## Getting Help

- **Issues:** Open a GitHub issue with:
  - PR link
  - Guard summary output
  - Manifest hashes
  - CLI simulation output (if available)

- **Questions:** See [FAQ](faq.md) or [Architecture](architecture.md) docs

---

**Congratulations!** You now have governance protecting your autonomous agent runs. 🎉