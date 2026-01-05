import { describe, expect, it } from "vitest";
import { assessRun } from "./index";
import type { GuardPolicy } from "@agent-hq-guard/policy";

describe("assessRun", () => {
  const policy: GuardPolicy = {
    metadata: { name: "default", version: "0.1.0" },
    allow_agents: ["openai"],
    max_tokens_per_run: 1000,
    write_scopes: [
      {
        path: "src/**",
        protected: ["src/infra/**"]
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
      changes: { files: ["src/infra/terraform.tf"] },
      approvals: { destructive: { count: 0 } },
      provenance: { valid: true }
    });

    expect(result.allow).toBe(false);
    expect(result.reasons).toEqual([
      "Token usage 5000 exceeds max 1000.",
      "Protected path src/infra/** modified by src/infra/terraform.tf without required approvals (0/1)."
    ]);
  });

  it("flags protected path modifications and provenance gaps", () => {
    const result = assessRun(policy, {
      agents: [{ id: "openai" }],
      usage: { tokens: 100 },
      changes: { files: ["src/infra/terraform.tf"] },
      approvals: { destructive: { count: 0 } },
      provenance: { valid: false }
    });

    expect(result.allow).toBe(false);
    expect(result.reasons).toContain(
      "Protected path src/infra/** modified by src/infra/terraform.tf without required approvals (0/1)."
    );
    expect(result.reasons).toContain("Provenance credential is missing or invalid.");
  });

  it("blocks changes outside allowed write scopes", () => {
    const result = assessRun(policy, {
      agents: [{ id: "openai" }],
      usage: { tokens: 100 },
      changes: { files: ["docs/readme.md"] },
      approvals: { destructive: { count: 1 } },
      provenance: { valid: true }
    });

    expect(result.allow).toBe(false);
    expect(result.reasons).toEqual(["File docs/readme.md is outside allowed write scopes."]);
  });

  it("allows protected paths when approvals are satisfied", () => {
    const result = assessRun(policy, {
      agents: [{ id: "openai" }],
      usage: { tokens: 100 },
      changes: { files: ["src/infra/terraform.tf"] },
      approvals: { destructive: { count: 1 } },
      provenance: { valid: true }
    });

    expect(result.allow).toBe(true);
  });
});
