import { describe, expect, it, vi } from "vitest";
import type { Context } from "probot";
import { createSlashCommandHandler, type SlashCommandStorage } from "../src/slash-commands";

describe("slash commands", () => {
  it("parses agent allow command", async () => {
    const storage: SlashCommandStorage & { allowed: string[] } = {
      allowed: [] as string[],
      async addAgentOverride(_repo: string, _pullNumber: number, agent: string) {
        storage.allowed.push(agent);
      },
      async setBudget() {
        /* noop for test */
      }
    };
    const handler = createSlashCommandHandler(storage);
    const commentMock = vi.fn();

    const contextPartial = {
      payload: {
        comment: { body: "/agent-allow @openai" },
        issue: { number: 1, pull_request: {} },
        repository: { owner: { login: "me" }, name: "repo" }
      },
      repo: () => ({ owner: "me", repo: "repo" }),
      octokit: { issues: { createComment: commentMock } }
    } satisfies Partial<Context<"issue_comment.created">>;

    await handler(contextPartial as Context<"issue_comment.created">);

    expect(storage.allowed).toContain("openai");
    expect(commentMock).toHaveBeenCalled();
  });

  it("updates token budget via slash command", async () => {
    let savedBudget = 0;
    const storage: SlashCommandStorage = {
      async addAgentOverride() {
        /* noop */
      },
      async setBudget(_repo: string, _pullNumber: number, tokens: number) {
        savedBudget = tokens;
      }
    };
    const handler = createSlashCommandHandler(storage);
    const commentMock = vi.fn();

    const contextPartial = {
      payload: {
        comment: { body: "/budget 5k_tokens" },
        issue: { number: 7, pull_request: {} },
        repository: { owner: { login: "me" }, name: "repo" }
      },
      repo: () => ({ owner: "me", repo: "repo" }),
      octokit: { issues: { createComment: commentMock } }
    } satisfies Partial<Context<"issue_comment.created">>;

    await handler(contextPartial as Context<"issue_comment.created">);

    expect(savedBudget).toBe(5000);
    expect(commentMock).toHaveBeenCalled();
  });
});
