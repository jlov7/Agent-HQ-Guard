# Agent HQ Guard

> **Governance for Autonomous AI Development**  
> Stop unauthorized agents. Detect protected-path violations. Enforce provenance. Gate merges with confidence.

## The Problem We're Solving

As we enter 2025, GitHub Agent HQ and similar platforms are enabling **multi-agent autonomous coding** at unprecedented scale. Multiple AI agents can now collaborate on codebases simultaneously, bringing revolutionary speed—but also unprecedented risk.

**What happens when:**

- An agent exceeds your token budget by 10x?
- An unauthorized AI provider modifies your production infrastructure?
- Sensitive files get changed without proper approvals?
- You can't prove who (or what) made a critical change?

**Answer:** Without guardrails, you're flying blind. Agent HQ Guard puts you back in control.

## Project Status

**Agent HQ Guard is a personal R&D passion project** exploring governance solutions for autonomous AI development. This represents independent research and experimentation driven by curiosity about how to safely integrate AI agents into software development workflows.

This is **not a commercial product** or an actively maintained service. It's shared publicly as open-source research that others may find useful, adapt, or learn from. No warranties, guarantees, or ongoing support commitments are implied.

---

## Why This Matters Now

The AI development landscape is accelerating faster than traditional governance can keep up. Organizations adopting autonomous agents face:

- **Financial risk** — Uncontrolled token usage can spiral costs
- **Security exposure** — Agents touching sensitive infrastructure without oversight
- **Compliance gaps** — Lack of audit trails and provenance for AI-generated changes
- **Trust deficits** — Teams hesitant to adopt AI without governance

Agent HQ Guard explores how **policy-driven enforcement** can work seamlessly with GitHub's ecosystem while maintaining the speed and flexibility that makes AI agents powerful.

## What Agent HQ Guard Delivers

Agent HQ Guard is a **GitHub App and Action** that enforces policy, provenance, and budget controls across every autonomous agent run. Think of it as CI/CD guards specifically designed for the AI era.

### Core Capabilities

- **🔒 Agent Authorization** — Whitelist which AI providers can execute in your repositories
- **💰 Budget Enforcement** — Hard limits on token consumption per run
- **🛡️ Protected Path Detection** — Block changes to sensitive files without approval
- **✍️ Provenance Verification** — Require signed manifests (Sigstore, in-toto, C2PA) for auditability
- **✅ GitHub Checks Integration** — Block merges until all policies pass
- **🎛️ Human Overrides** — Slash commands (`/agent-allow`, `/budget`) for maintainer controls

### Architecture Components

| Component                                  | Purpose                                               | Who Uses It               |
| ------------------------------------------ | ----------------------------------------------------- | ------------------------- |
| **GitHub App** (`app/`)                    | Probot service monitoring PRs, workflows, and checks  | DevOps/Platform teams     |
| **GitHub Action** (`action/`)              | Validates manifests in CI/CD pipelines                | Developers                |
| **Policy Engine** (`lib/policy/`)          | YAML → Rego compiler for Sentinel-compatible policies | Security/Policy teams     |
| **Provenance Toolkit** (`lib/provenance/`) | Credential validation, signing, and verification      | Security/Compliance teams |
| **CLI** (`cli/`)                           | Local simulation and testing                          | All developers            |
| **Examples** (`examples/`)                 | Reference implementations                             | Everyone                  |

## Two Integration Paths

### 1. Compatibility Mode (Default)

Works with any GitHub Actions workflow. Uses:

- GitHub Checks API for blocking merges
- PR annotations for visibility
- Artifact storage for manifests
- Slash commands for overrides

**Best for:** Teams integrating Guard into existing workflows without Agent HQ access.

### 2. Native Mission Control (Feature-Flagged)

Streams decisions upstream before tools execute. Set `AGENT_HQ_API_URL` to enable:

- Pre-execution allow/deny decisions
- Retry-safe mission control client
- Reduced latency for policy violations

**Best for:** Teams with GitHub Agent HQ access who want proactive enforcement.

## Quick Start

Get Guard running in under 10 minutes:

```bash
# 1. Install dependencies
pnpm install

# 2. Create policy file
cp lib/policy/examples/default.yaml .github/agent-hq-guard.yml

# 3. Deploy the app (or run locally)
docker-compose up --build

# 4. Add to your agent workflows
# See examples/parallel-run/ for complete workflow
```

**Full setup:** See [Quick Start Guide](docs/quickstart.md)

## Real-World Use Cases

### Financial Governance

**Problem:** AI agents consuming unbounded tokens, blowing through budgets.  
**Solution:** `max_tokens_per_run: 80000` hard-caps every run. Works with `/budget` overrides for exceptions.

### Security Posture

**Problem:** Agents modifying production infrastructure or secrets without review.  
**Solution:** Protected path patterns (`infra/**`, `.github/**`) require explicit approvals before merge.

### Compliance & Audit

**Problem:** Can't prove what agent made which change, or when.  
**Solution:** Signed provenance manifests (Sigstore + C2PA) provide cryptographic proof of every run.

### Multi-Vendor Control

**Problem:** Need to restrict which AI providers can execute in your org.  
**Solution:** `allow_agents` whitelist ensures only approved providers run.

## Documentation Hub

| Document                                              | Audience       | Description                                 |
| ----------------------------------------------------- | -------------- | ------------------------------------------- |
| [📖 Quick Start](docs/quickstart.md)                  | New users      | Get running in under an hour                |
| [👥 Non-Technical Guide](docs/non-technical-guide.md) | Stakeholders   | Plain-language explanation                  |
| [⚙️ Operator Guide](docs/operator-guide.md)           | SREs/DevOps    | Runbooks, incident response, monitoring     |
| [📋 Policy Reference](docs/policy-reference.md)       | Policy authors | YAML schema, Rego compilation, examples     |
| [🔐 Provenance](docs/provenance.md)                   | Security teams | Credential lifecycle, signing, verification |
| [🏗️ Architecture](docs/architecture.md)               | Architects     | System design, flows, deployment            |
| [❓ FAQ](docs/faq.md)                                 | Everyone       | Common questions and troubleshooting        |

## Quality & Security

- **Type-safe** — Full TypeScript coverage with strict mode
- **Tested** — Comprehensive test suite with coverage reporting
- **Deterministic builds** — Locked dependencies via `pnpm-workspace`
- **Signed releases** — SBOM + cosign signing in CI
- **Security-first** — Dependabot auto-updates, strict peer dependencies

Run quality checks:

```bash
pnpm check    # Lint + typecheck + test
pnpm build    # Compile all packages
pnpm coverage # Generate coverage reports
```

## Local Simulation

Test policies before opening PRs:

```bash
pnpm --filter @agent-hq-guard/cli exec hqguard simulate \
  --policy .github/agent-hq-guard.yml \
  --manifests out/*.json
```

See [examples/](examples/) for reference scenarios.

## The Vision

Agent HQ Guard exists because **autonomous AI development needs governance**, not gatekeeping. This project explores how teams might:

- ✅ Adopt AI agents with confidence
- ✅ Maintain financial and security controls
- ✅ Meet compliance requirements
- ✅ Build audit trails for the AI era

This is a **personal R&D passion project** born from continuous exploration and experimentation with AI development tools. It represents independent research into governance patterns that could help teams safely adopt autonomous agents—shared openly for the community to learn from, adapt, or build upon.

## Roadmap

- [ ] Post-merge cleanup hooks for sqlite overrides
- [ ] Severity-aware PR review annotations
- [ ] Windows MCP alignment for per-tool approvals
- [ ] Enhanced observability dashboards

## Contributing

This project is shared as open-source research and experimentation. While I welcome contributions, discussions, and feedback, please understand this is a personal R&D project with no formal roadmap or support commitments. See [docs/](docs/) for architectural guidance and understanding the codebase.

---

**Agent HQ Guard** — Governance for the AI development era. 🚀
