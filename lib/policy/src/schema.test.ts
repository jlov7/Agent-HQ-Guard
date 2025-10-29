import { describe, expect, it } from "vitest";
import { normalizePolicy, parsePolicy } from "./index";

describe("normalizePolicy", () => {
  it("fills defaults and validates structure", () => {
    const policy = normalizePolicy({
      allow_agents: ["openai"],
      max_tokens_per_run: 1000
    });

    expect(policy.allow_agents).toContain("openai");
    expect(policy.metadata.name).toBe("default");
  });
});

describe("parsePolicy", () => {
  it("parses YAML content", () => {
    const policy = parsePolicy("allow_agents:\n  - openai-codex\n");
    expect(policy.allow_agents).toContain("openai-codex");
  });
});
