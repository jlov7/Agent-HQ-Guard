import { describe, expect, it } from "vitest";
import { normalizePolicy } from "@agent-hq-guard/policy";
import type { ActionCredential } from "@agent-hq-guard/provenance";
import { evaluateCredential } from "./index";

const baseCredential: ActionCredential = {
  version: "0.1.0",
  run_id: "run-123",
  repository: {
    owner: "demo",
    name: "repo",
    ref: "refs/heads/test",
    commit: "0123456789abcdef0123456789abcdef01234567"
  },
  workflow: {
    name: "agents",
    run_number: 1,
    trigger: "pull_request"
  },
  agents: [
    {
      id: "openai-codex",
      provider: "openai",
      capabilities: ["code"]
    }
  ],
  decisions: [],
  budgets: {
    tokens: 1000,
    currency: { amount: 0, units: "USD" }
  },
  artifacts: [],
  signatures: [
    {
      issuer: "sigstore",
      timestamp: new Date().toISOString(),
      signature: "-----BEGIN SIGNATURE-----fake-----END SIGNATURE-----",
      rekor_entry: "https://rekor.dev/entry/1"
    }
  ]
};

describe("action evaluateCredential", () => {
  it("allows compliant credential", () => {
    const policy = normalizePolicy({
      allow_agents: ["openai-codex"],
      max_tokens_per_run: 5000,
      provenance_required: true
    });

    const result = evaluateCredential(policy, baseCredential, {
      changes: [],
      approvals: 0
    });
    expect(result.allow).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("blocks unauthorized agent and budget overflow", () => {
    const policy = normalizePolicy({
      allow_agents: ["anthropic-claude"],
      max_tokens_per_run: 500,
      provenance_required: true
    });

    const result = evaluateCredential(policy, baseCredential, {
      changes: [],
      approvals: 0
    });
    expect(result.allow).toBe(false);
    expect(result.reasons).toEqual([
      "Agent openai-codex is not on the allowlist.",
      "Token usage 1000 exceeds max 500."
    ]);
  });
});
