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
});
