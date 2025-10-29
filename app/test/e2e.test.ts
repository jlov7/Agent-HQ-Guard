import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import type { Context } from "probot";
import { handleWorkflowRunCompleted } from "../src/workflow-run";
import { normalizePolicy } from "@agent-hq-guard/policy";

const MANIFEST = {
  version: "0.1.0",
  run_id: "run-1",
  repository: {
    owner: "me",
    name: "repo",
    ref: "refs/heads/feature",
    commit: "0123456789abcdef0123456789abcdef01234567"
  },
  workflow: {
    name: "agents",
    run_number: 1,
    trigger: "pull_request"
  },
  agents: [{ id: "openai-codex", provider: "openai", capabilities: ["code"] }],
  decisions: [],
  budgets: {
    tokens: 10000,
    currency: { amount: 0, units: "USD" }
  },
  artifacts: [],
  signatures: [
    {
      issuer: "sigstore",
      timestamp: "2024-01-01T00:00:00Z",
      signature: "-----BEGIN SIGNATURE-----fake-----END SIGNATURE-----",
      rekor_entry: "https://rekor.dev/entry/1"
    }
  ]
};

describe("workflow run evaluation", () => {
  it("allows run when policy satisfied", async () => {
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(MANIFEST)));

    const contextPartial = {
      payload: {
        workflow_run: {
          id: 1,
          pull_requests: [
            {
              number: 5,
              head: { sha: MANIFEST.repository.commit }
            }
          ]
        }
      },
      repo: () => ({ owner: "me", repo: "repo" }),
      octokit: {
        pulls: {
          listFiles: async () => ({ data: [] }),
          listReviews: async () => ({ data: [] })
        },
        actions: {
          listWorkflowRunArtifacts: async () => ({
            data: {
              artifacts: [{ id: 1, name: "agent-hq-guard-manifest" }]
            }
          }),
          downloadArtifact: async () => ({
            data: zip.toBuffer()
          })
        }
      },
      log: {
        info: () => undefined,
        error: () => undefined
      }
    } satisfies Partial<Context<"workflow_run.completed">>;

    const context = contextPartial as Context<"workflow_run.completed">;

    const evaluation = await handleWorkflowRunCompleted(
      context,
      normalizePolicy({
        allow_agents: ["openai-codex"],
        max_tokens_per_run: 20000,
        write_scopes: []
      }),
      {
        loadOverrides: async () => ({ allowAgents: [], budgetTokens: undefined })
      }
    );

    expect(evaluation?.assessmentDetails.allow).toBe(true);
  });

  it("returns undefined when no pull request is associated", async () => {
    const context = {
      payload: {
        workflow_run: {
          id: 2,
          pull_requests: []
        }
      },
      log: {
        info: () => undefined
      }
    } satisfies Partial<Context<"workflow_run.completed">>;

    const result = await handleWorkflowRunCompleted(
      context as Context<"workflow_run.completed">,
      normalizePolicy({}),
      {
        loadOverrides: async () => ({ allowAgents: [], budgetTokens: undefined })
      }
    );

    expect(result).toBeUndefined();
  });
});
