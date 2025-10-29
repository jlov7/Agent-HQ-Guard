import { describe, expect, it } from "vitest";
import {
  credentialHash,
  verifyCredential,
  createCredentialSummaryMarkdown,
  resolveCredentialManifestPaths,
  type ActionCredential
} from "./index";

const baseCredential: ActionCredential = {
  version: "0.1.0",
  run_id: "run-123",
  repository: {
    owner: "demo",
    name: "repo",
    ref: "refs/heads/main",
    commit: "0123456789abcdef0123456789abcdef01234567"
  },
  workflow: {
    name: "ci",
    run_number: 42,
    trigger: "workflow_dispatch"
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
    currency: {
      amount: 0,
      units: "USD"
    }
  },
  artifacts: [],
  signatures: [
    {
      issuer: "sigstore",
      timestamp: new Date().toISOString(),
      signature: "-----BEGIN SIGNATURE-----fake-----END SIGNATURE-----",
      rekor_entry: "https://rekor.tlog.dev/entry/123"
    }
  ]
};

describe("credentialHash", () => {
  it("produces deterministic hash", () => {
    expect(credentialHash(baseCredential)).toEqual(credentialHash(baseCredential));
  });
});

describe("verifyCredential", () => {
  it("flags missing SHA values", () => {
    const result = verifyCredential({
      ...baseCredential,
      artifacts: [
        {
          name: "output",
          sha256: "not-a-sha",
          bindings: []
        }
      ]
    });

    expect(result.valid).toBe(false);
  });
});

describe("createCredentialSummaryMarkdown", () => {
  it("renders warnings when invalid", () => {
    const report = verifyCredential({
      ...baseCredential,
      signatures: []
    });

    const markdown = createCredentialSummaryMarkdown({ ...baseCredential, signatures: [] }, report);

    expect(markdown).toContain("[WARN] Attention");
    expect(markdown).toContain("Reasons");
  });
});

describe("resolveCredentialManifestPaths", () => {
  it("normalizes manifest paths relative to directory", () => {
    const manifests = resolveCredentialManifestPaths("/tmp/build", ["manifest.json", "/abs/file"]);
    expect(manifests).toEqual(["/tmp/build/manifest.json", "/abs/file"]);
  });
});
