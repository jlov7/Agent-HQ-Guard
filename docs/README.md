# Agent HQ Guard Documentation Hub

> **Welcome to the complete documentation for Agent HQ Guard**

Agent HQ Guard provides governance for autonomous AI development. This hub helps you find the right documentation for your role and needs.

## 🎯 Start Here Based on Your Role

| Role                         | Start Here                                    | What You'll Learn                               |
| ---------------------------- | --------------------------------------------- | ----------------------------------------------- |
| **👋 New to Guard**          | [Quick Start](quickstart.md)                  | Install, configure, and deploy in under an hour |
| **💼 Business Stakeholder**  | [Non-Technical Guide](non-technical-guide.md) | Why Guard matters and what to expect            |
| **🔧 DevOps/SRE**            | [Operator Guide](operator-guide.md)           | Runbooks, monitoring, incident response         |
| **🛡️ Security Professional** | [Provenance](provenance.md)                   | Cryptographic signing, verification, compliance |
| **📋 Policy Author**         | [Policy Reference](policy-reference.md)       | YAML schema, Rego compilation, examples         |
| **🏗️ Architect**             | [Architecture](architecture.md)               | System design, data flows, deployment           |
| **❓ Everyone**              | [FAQ](faq.md)                                 | Common questions and troubleshooting            |

## 📚 Documentation Structure

```
docs/
├── quickstart.md            # Get running in under an hour
├── non-technical-guide.md   # Plain-language explanation
├── operator-guide.md        # SRE runbook + governance
├── policy-reference.md      # YAML + Rego mapping
├── provenance.md            # Credential lifecycle
├── architecture.md         # Diagrams & topology
├── faq.md                   # Common questions
├── release-notes.md         # What's new and migration notes
└── README.md                # You are here
```

## 🚀 Quick Navigation

### For Getting Started

- **[Quick Start Guide](quickstart.md)** — Step-by-step installation and configuration
- **[Non-Technical Guide](non-technical-guide.md)** — Understanding Guard without technical jargon

### For Day-to-Day Operations

- **[Operator Guide](operator-guide.md)** — Runbooks, monitoring, incident response
- **[FAQ](faq.md)** — Quick answers to common questions
- **[Policy Reference](policy-reference.md)** — Writing and testing policies

### For Updates

- **[Release Notes](release-notes.md)** — What's new and migration notes

### For Deep Dives

- **[Architecture](architecture.md)** — System design and data flows
- **[Provenance](provenance.md)** — Cryptographic signing and verification

## 💡 Key Concepts

### What Agent HQ Guard Does

Agent HQ Guard enforces **policy-driven governance** for autonomous AI agent runs:

- 🔒 **Agent Authorization** — Control which AI providers can execute
- 💰 **Budget Enforcement** — Hard limits on token consumption
- 🛡️ **Protected Paths** — Block changes to sensitive files without approval
- ✍️ **Provenance** — Require signatures with schema validation for auditability

### Two Integration Paths

**Compatibility Mode (Default):**

- Works with any GitHub Actions workflow
- Uses GitHub Checks API to block merges
- No special access required

**Native Mission Control (Feature-Flagged):**

- Requires `AGENT_HQ_API_URL` environment variable
- Streams decisions upstream before tools execute
- Reduced latency for policy violations

### How It Works

1. **Agent workflow** runs and generates a credential manifest
2. **Guard Action** validates manifest locally (fast feedback)
3. **Guard App** downloads manifest and evaluates policy
4. **Evaluator** (native) determines allow/deny
5. **Provenance Library** validates schema + signature structure
6. **GitHub Checks** API blocks merge if policy fails

## 🎓 Learning Paths

### Path 1: Quick Deployment

1. [Quick Start](quickstart.md) — Get Guard running
2. [Policy Reference](policy-reference.md) — Configure policies
3. [Operator Guide](operator-guide.md) — Monitor and maintain

### Path 2: Understanding the Why

1. [Non-Technical Guide](non-technical-guide.md) — Business value
2. [FAQ](faq.md) — Common questions
3. [Architecture](architecture.md) — How it works

### Path 3: Security & Compliance

1. [Provenance](provenance.md) — Cryptographic signing
2. [Policy Reference](policy-reference.md) — Security policies
3. [Operator Guide](operator-guide.md) — Security controls

### Path 4: Deep Technical Dive

1. [Architecture](architecture.md) — System design
2. [Policy Reference](policy-reference.md) — Rego compilation
3. [Provenance](provenance.md) — Schema + signature structure validation

## 🔍 Finding Information

### By Topic

**Installation & Setup:**

- [Quick Start](quickstart.md) — Complete setup guide
- [Architecture](architecture.md) — Deployment topologies

**Policy Configuration:**

- [Policy Reference](policy-reference.md) — Complete schema
- [FAQ](faq.md) — Common policy questions

**Security & Compliance:**

- [Provenance](provenance.md) — Cryptographic signing
- [Operator Guide](operator-guide.md) — Security controls

**Operations:**

- [Operator Guide](operator-guide.md) — Runbooks and monitoring
- [FAQ](faq.md) — Troubleshooting

**Understanding Guard:**

- [Non-Technical Guide](non-technical-guide.md) — Plain language
- [Architecture](architecture.md) — Technical deep dive

### By Problem

**"How do I install Guard?"**
→ [Quick Start](quickstart.md)

**"Why is my agent blocked?"**
→ [FAQ](faq.md) → [Policy Reference](policy-reference.md)

**"How do I write a policy?"**
→ [Policy Reference](policy-reference.md)

**"Provenance validation failed?"**
→ [Provenance](provenance.md) → [FAQ](faq.md)

**"Check stuck in pending?"**
→ [Operator Guide](operator-guide.md) → [FAQ](faq.md)

**"How does Guard work?"**
→ [Architecture](architecture.md)

## 📖 Document Details

### Quick Start Guide

**Length:** ~15 minutes  
**Prerequisites:** GitHub org admin, Node.js, Docker  
**Covers:** Installation, GitHub App setup, policy configuration, deployment

### Non-Technical Guide

**Length:** ~10 minutes  
**Prerequisites:** None  
**Covers:** Business value, what to expect, common questions

### Operator Guide

**Length:** ~20 minutes  
**Prerequisites:** SRE/DevOps experience  
**Covers:** Monitoring, incident response, security controls, maintenance

### Policy Reference

**Length:** ~25 minutes  
**Prerequisites:** YAML familiarity  
**Covers:** Schema, Rego compilation, examples, testing

### Provenance Guide

**Length:** ~20 minutes  
**Prerequisites:** Security concepts  
**Covers:** Cryptographic signing, verification, compliance

### Architecture Guide

**Length:** ~30 minutes  
**Prerequisites:** Software architecture knowledge  
**Covers:** System design, data flows, deployment, observability

### FAQ

**Length:** ~15 minutes  
**Prerequisites:** None  
**Covers:** Common questions, troubleshooting, best practices

## 🤝 Contributing to Documentation

Found an error or have suggestions?

1. Open an issue describing the problem
2. Or submit a PR with improvements
3. Include context: what document, what section, what's unclear

## 📞 Getting Help

- **Documentation questions:** See [FAQ](faq.md)
- **Technical issues:** Open a GitHub issue with:
  - PR link
  - Guard summary output
  - Manifest hashes
  - CLI simulation output (if debugging)

## 🎯 Next Steps

**Ready to get started?**

1. Read [Quick Start](quickstart.md)
2. Configure your first policy
3. Deploy Guard to a test repository
4. Monitor with [Operator Guide](operator-guide.md)

**Want to understand more?**

1. Read [Non-Technical Guide](non-technical-guide.md)
2. Explore [Architecture](architecture.md)
3. Review [FAQ](faq.md)

**Need to customize?**

1. Study [Policy Reference](policy-reference.md)
2. Review [Provenance](provenance.md) for compliance
3. Check [Operator Guide](operator-guide.md) for operations

---

**Welcome to Agent HQ Guard!** 🚀 Start with the guide that matches your role, and explore deeper as you need.

---

## About This Project

Agent HQ Guard is a **personal R&D passion project** exploring governance solutions for autonomous AI development. This represents independent research and experimentation, shared openly for the community to learn from or adapt. It is not a commercial product or actively maintained service—no warranties, guarantees, or support commitments are implied.
