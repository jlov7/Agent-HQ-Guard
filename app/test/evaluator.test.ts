import { describe, expect, it } from "vitest";
import { assessRun } from "../src/evaluator";
import type { GuardPolicy } from "@agent-hq-guard/policy";

describe("assessRun", () => {
  const policy: GuardPolicy = {
    metadata: { name: "default", version: "0.1.0" },
    allow_agents: ["openai"],
    max_tokens_per_run: 1000,
    write_scopes: [
      {
        path: "src/**",
        protected: ["infra/**"]
      }
    ],
    approvals: {
      destructive_ops: {
        required: 1,
        approvers: []
      }
    },
    provenance_required: true
  };

  it("blocks unauthorized agents", () => {
    const result = assessRun(policy, {
      agents: [{ id: "claude" }],
      usage: { tokens: 100 },
      changes: { files: [] },
      approvals: { destructive: { count: 1 } },
      provenance: { valid: true }
    });

    expect(result.allow).toBe(false);
  });

  it("reports budget overflow and missing approval", () => {
    const result = assessRun(policy, {
      agents: [{ id: "openai" }],
      usage: { tokens: 5000 },
      changes: { files: [] },
      approvals: { destructive: { count: 0 } },
      provenance: { valid: true }
    });

    expect(result.allow).toBe(false);
    expect(result.reasons).toEqual([
      "Token usage 5000 exceeds max 1000.",
      "Destructive approvals 0 below required 1."
    ]);
  });

  it("flags protected path modifications and provenance gaps", () => {
    const result = assessRun(policy, {
      agents: [{ id: "openai" }],
      usage: { tokens: 100 },
      changes: { files: ["infra/terraform.tf"] },
      approvals: { destructive: { count: 1 } },
      provenance: { valid: false }
    });

    expect(result.allow).toBe(false);
    expect(result.reasons).toContain("Protected path infra/** modified by infra/terraform.tf.");
    expect(result.reasons).toContain("Provenance credential is missing or invalid.");
  });
});
