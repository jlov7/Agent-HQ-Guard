# Agent HQ Guard: Plain-Language Guide

> **For non-technical stakeholders:** Understanding what Agent HQ Guard does and why it matters

## The Story in Simple Terms

Imagine you're running a company where AI assistants can write code for you. They're fast, they're smart, and they can work on multiple projects at once. But here's the challenge: **How do you make sure they don't break things, spend too much money, or touch stuff they shouldn't?**

That's exactly what Agent HQ Guard does. It's like having a **smart security guard** that watches every AI agent as it works, checks that it follows your rules, and stops it from merging code if something looks wrong.

## Why This Matters in 2025

The AI development revolution is here. Companies are using AI agents to:

- Write code automatically
- Fix bugs faster
- Generate entire features
- Work on multiple projects simultaneously

But with great power comes great responsibility. Without guardrails, you risk:

- **💰 Overspending** — AI services charge per "token" (think of tokens as words processed). One runaway agent could cost thousands in minutes.
- **🔓 Security breaches** — Agents might modify critical infrastructure files or access secrets they shouldn't.
- **⚖️ Compliance failures** — You can't prove who made what changes, which breaks audit requirements.
- **🤝 Trust issues** — Teams won't adopt AI if they can't trust it's being controlled.

**Agent HQ Guard solves all of these problems.**

## What You'll See in Practice

### On Every Pull Request

When an AI agent completes work, you'll see:

1. **A Check Status** — Green ✅ means everything passed. Red ❌ means something needs attention.
2. **A Summary Comment** — The Guard automatically posts a human-readable summary showing:
   - Which AI agents worked on this
   - How many tokens they spent (to track costs)
   - Whether the work was properly signed and verified
   - Any issues that need review

3. **Annotations** — If an agent tried to touch a protected file (like production infrastructure), you'll see warnings directly on the code.

### Example Scenario

**The Good Scenario:**

- Agent named "Claude" works on a feature
- Spends 45,000 tokens (within budget)
- Only modifies files in `src/features/`
- Properly signed manifest
- ✅ **Check passes** → Safe to merge

**The Problem Scenario:**

- Agent named "GPT-4" tries to work (but isn't on your approved list)
- Attempts to modify `infra/production.yaml` (protected file)
- Spends 150,000 tokens (over budget)
- ❌ **Check fails** → Merge blocked until issues resolved

## How Teams Control It

Guard gives humans **override controls** using simple slash commands:

- `/agent-allow @openai-codex` — Temporarily allow an agent that's normally blocked
- `/budget 100k_tokens` — Raise the token budget for this specific PR

These overrides are:

- ✅ Logged for audit purposes
- ✅ Visible to everyone reviewing the PR
- ✅ Automatic (no manual configuration needed)

## Privacy & Security

**What Guard stores:**

- ✅ Hashes (fingerprints) of what agents did
- ✅ Policy decisions and overrides
- ✅ Audit logs

**What Guard doesn't store:**

- ❌ Actual code content
- ❌ Secrets or credentials
- ❌ Sensitive data

Manifests (the detailed records) live in GitHub's artifact storage with the same retention policies as your workflows—typically 7-90 days, then automatically deleted.

## Day-to-Day Workflow

### For Project Managers

1. **Review PR summaries** — Check the Guard comment to see what agents did and how much they cost
2. **Monitor budgets** — Ensure token spending stays within limits
3. **Track approvals** — Verify protected files have proper reviews

### For Security Teams

1. **Check annotations** — Look for protected-path violations
2. **Verify provenance** — Ensure every run is properly signed
3. **Audit overrides** — Review slash command usage to ensure compliance

### For Developers

1. **Trust the checks** — If Guard passes, you know the run is compliant
2. **Use overrides wisely** — Slash commands are powerful but should be rare
3. **Review summaries** — Understand what agents did before merging

## Real-World Benefits

### Financial Control

**Before Guard:** "We spent $50,000 on AI tokens last month and don't know why."  
**After Guard:** "We cap every run at 80,000 tokens. Budget overruns are blocked automatically."

### Security Confidence

**Before Guard:** "Did an agent modify our production config? We have no idea."  
**After Guard:** "Any agent touching `infra/` is blocked unless explicitly approved."

### Compliance Readiness

**Before Guard:** "We can't prove who made this change or when."  
**After Guard:** "Every change has a cryptographically signed manifest proving provenance."

## Common Questions

**Q: Does this slow down development?**  
A: No. Guard runs in parallel with your workflows. It only blocks merges if policies are violated—which is exactly what you want.

**Q: Can agents work around Guard?**  
A: No. Guard is enforced at the GitHub level. Agents can't merge code without passing the checks.

**Q: What if Guard makes a mistake?**  
A: Humans can always override with slash commands. Guard is designed to be helpful, not obstructive.

**Q: Do we need special infrastructure?**  
A: Guard runs as a GitHub App. You can deploy it anywhere (including GitHub's infrastructure). No special setup required.

## The Bottom Line

Agent HQ Guard lets you **adopt AI development tools with confidence**. You get:

- ✅ Financial oversight
- ✅ Security controls
- ✅ Compliance proof
- ✅ Team trust

Without sacrificing the speed and flexibility that makes AI agents powerful.

**Think of it as seatbelts for autonomous development.** You hope you never need them, but you're glad they're there.

---

## About This Project

Agent HQ Guard is a **personal R&D passion project** exploring governance solutions for AI development. This represents independent research and experimentation, shared openly for the community to learn from or adapt. It is not a commercial product or actively maintained service—no warranties, guarantees, or support commitments are implied.

---

**Ready to dive deeper?** Check out the [Quick Start Guide](quickstart.md) for technical setup, or the [FAQ](faq.md) for detailed answers.
