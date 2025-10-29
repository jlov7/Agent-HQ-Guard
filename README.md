# Agent HQ Guard

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

In the Universe 2025 wave of GitHub Agent HQ rollouts, multi-agent coding missions need grounded guardrails before they can touch main. Agent HQ Guard is a personal R&D passion project that packages those guardrails as a GitHub App + Action duo so you can enforce per-repo policy, budgets, and provenance across every autonomous run.

## What It Delivers

- **GitHub App (`app/`)** — Probot service that watches `pull_request`, `workflow_run`, and `check_suite` events, evaluates Sentinel-compatible policies, and posts signed action credential summaries back to the PR.
- **Policy Engine (`lib/policy/`)** — YAML schema + Rego compiler to mirror Sentinel guardrails and drive both compatibility and native mission control flows.
- **Provenance Toolkit (`lib/provenance/`)** — Action credential schema validation, summary rendering, and signature sanity checks (Sigstore, in-toto, C2PA bindings).
- **GitHub Action (`action/`)** — Validates manifests inside workflows, writes `agent-hq-guard-result.json`, and fails fast when budgets or provenance are off.
- **CLI (`cli/`)** — `hqguard simulate --policy ./policy.yaml --manifests ./out/*.json` for local rehearsal of Agent HQ events.
- **Docs (`docs/`)** — Persona-based guides (Quick Start, Operator Guide, Policy Reference, Provenance, FAQ, non-technical briefing).
- **Examples (`examples/`)** — Happy-path parallel run plus a protected-path violation to teach failure handling.

## Two Integration Paths

1. **Native (feature-flagged)** — Set `AGENT_HQ_API_URL` and Guard streams decisions to mission control before tools execute.
2. **Compatibility (always available)** — Checks API, commit status, PR annotations, and artifacts keep merges blocked until provenance, budgets, and scope checks pass.

## Quick Start

1. `pnpm install`
2. Copy `lib/policy/examples/default.yaml` to your repo as `.github/agent-hq-guard.yml`
3. Deploy the app: `docker-compose up --build`
4. Add the GitHub Action to your agent workflows:
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
5. Require the `Agent HQ Guard` check in branch protection.

## Quality Gates & Tooling

- `pnpm check` → lint, type-check, and tests with coverage (`@vitest/coverage-v8`).
- Deterministic builds enforced via `.npmrc` (`shared-workspace-lockfile`, `strict-peer-dependencies`).
- CI (`.github/workflows/ci.yml`) runs format checks, lint, typecheck, tests with coverage artifact upload, SBOM generation, and cosign signing.
- Dependabot keeps npm packages and workflow actions patched weekly.

## Slash Commands

- `/agent-allow @provider` — Temporarily allow an agent for the PR.
- `/budget 50k_tokens` — Raise/lower the token budget for the PR mission.

## Documentation

- [Quick Start](docs/quickstart.md)
- [Operator Guide](docs/operator-guide.md)
- [Policy Reference](docs/policy-reference.md)
- [Provenance & Credentials](docs/provenance.md)
- [Plain-Language Guide](docs/non-technical-guide.md)
- [FAQ](docs/faq.md)
- [Architecture & Flow](docs/architecture.md)

## Security Touchpoints

- Signed manifests (A2PA v0) validated via schema + Sigstore references
- Protected-path annotations surfaced via Checks API for accessibility-friendly review
- SBOM + cosign flow baked into CI (`.github/workflows/ci.yml`)

## Local Simulation

Run `pnpm --filter @agent-hq-guard/cli exec hqguard simulate --policy examples/parallel-run/policy.yaml --manifests out/*.json` to dry-run decisions before opening a PR.

## Examples

| Scenario                 | Path                      | Outcome                                                   |
| ------------------------ | ------------------------- | --------------------------------------------------------- |
| Parallel agents succeed  | `examples/parallel-run`   | Guard check passes when manifests and budgets comply.     |
| Protected path violation | `examples/protected-path` | Guard check fails, annotations flag sensitive file edits. |

## Roadmap Notes

- Post-merge cleanup hook to wipe sqlite overrides
- Severity-aware annotations backported into PR reviews
- Expand Windows MCP alignment for per-tool approvals (see docs)

Personal R&D passion project, no commercial promises—just the guardrails needed to keep Universe 2025 agents from scribbling over `main`.
