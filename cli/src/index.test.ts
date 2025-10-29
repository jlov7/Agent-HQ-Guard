import { describe, expect, it } from "vitest";
import { normalizePolicy } from "@agent-hq-guard/policy";
import type { ActionCredential } from "@agent-hq-guard/provenance";
import { evaluateManifest } from "./index";

const credential: ActionCredential = {
  version: "0.1.0",
  run_id: "cli-run",
  repository: {
    owner: "demo",
    name: "repo",
    ref: "refs/heads/feature",
    commit: "0123456789abcdef0123456789abcdef01234567"
  },
  workflow: {
    name: "agents",
    run_number: 7,
    trigger: "workflow_dispatch"
  },
  agents: [
    {
      id: "anthropic-claude",
      provider: "anthropic",
      capabilities: ["code"]
    }
  ],
  decisions: [],
  budgets: {
    tokens: 1200,
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

describe("evaluateManifest", () => {
  it("approves matching credential when under budget", () => {
    const policy = normalizePolicy({
      allow_agents: ["anthropic-claude"],
      max_tokens_per_run: 5000,
      provenance_required: true
    });

    const result = evaluateManifest(policy, credential, 0);
    expect(result.allow).toBe(true);
  });

  it("fails when provenance invalid or budget exceeded", () => {
    const policy = normalizePolicy({
      allow_agents: ["anthropic-claude"],
      max_tokens_per_run: 500,
      provenance_required: true
    });

    const tampered = {
      ...credential,
      signatures: []
    };

    const result = evaluateManifest(policy, tampered, 400);
    expect(result.allow).toBe(false);
    expect(result.reasons).toContain("Provenance: No signatures present on credential.");
    expect(result.reasons).toContain("Token usage 1200 exceeds limit 500.");
    expect(result.reasons).toContain("Token usage 1200 exceeds limit 400.");
  });
});
