# Agent HQ Guard Documentation Hub

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

## Choose Your Adventure

| Audience                   | Start Here                                     | Summary                                                  |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| New engineers              | [Quick Start](quickstart.md)                   | Install, configure, and ship Guard in under an hour.     |
| Operators / SREs           | [Operator Guide](operator-guide.md)            | Runbook, overrides, incident response, security posture. |
| Policy authors             | [Policy Reference](policy-reference.md)        | YAML schema, Rego compilation, Windows MCP alignment.    |
| Security & compliance      | [Provenance & Credentials](provenance.md)      | Manifest schema, signing flows, verification steps.      |
| Non-technical stakeholders | [Plain-Language Guide](non-technical-guide.md) | Why Guard matters, what to expect on PRs.                |
| Everyone                   | [FAQ](faq.md)                                  | Quick answers for day-to-day questions.                  |

## Architecture at a Glance

The [Architecture & Flow](architecture.md) document includes Mermaid diagrams for both compatibility and native mission-control paths, plus deployment guidance.

## Compatibility vs. Native

- **Compatibility path** (default): GitHub Check + Action + artifacts + slash commands.
- **Native path** (`AGENT_HQ_API_URL` set): Guard publishes allow/deny decisions upstream before agent tools run, with retry-safe mission control client.

## Development Tooling

- `pnpm check` → lint + type-check + tests with coverage.
- `pnpm build` → compile all packages, emit declarations, and bundle actions/CLI.
- Coverage artifacts are uploaded from CI; inspect them to keep regressions in check.
- Deterministic builds enforced via `.npmrc` (`shared-workspace-lockfile` & `strict-peer-dependencies`).

## Documentation Map

```
docs/
├── quickstart.md            # Step-by-step onboarding
├── operator-guide.md        # SRE runbook + governance
├── policy-reference.md      # YAML + Rego mapping
├── provenance.md            # Credential lifecycle
├── non-technical-guide.md   # Plain-language explainer
├── faq.md                   # Common questions
├── architecture.md          # Diagrams & topology
└── README.md                # You are here
```

Use these resources to roll out Guard safely, explain it to stakeholders, and keep your guardrails evolving with confidence.
