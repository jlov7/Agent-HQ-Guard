import { describe, expect, it } from "vitest";
import { compilePolicyToRego } from "./compiler";
import { normalizePolicy } from "./schema";

describe("compilePolicyToRego", () => {
  it("renders allowlist block", () => {
    const rego = compilePolicyToRego(
      normalizePolicy({
        allow_agents: ["openai-codex"],
        max_tokens_per_run: 1000
      })
    );

    expect(rego).toContain("allow_agent");
    expect(rego).toContain("openai-codex");
  });

  it("renders write scopes and approval gating", () => {
    const rego = compilePolicyToRego(
      normalizePolicy({
        write_scopes: [
          {
            path: "src/**",
            protected: ["src/infra/**"]
          }
        ],
        approvals: {
          destructive_ops: {
            required: 2,
            approvers: []
          }
        }
      })
    );

    expect(rego).toContain("allowed_paths");
    expect(rego).toContain("src/**");
    expect(rego).toContain("protected_paths");
    expect(rego).toContain("src/infra/**");
    expect(rego).toContain("protected_path_touched");
    expect(rego).toContain("required_approvals := 2");
    expect(rego).toContain("approvals_required");
  });
});
