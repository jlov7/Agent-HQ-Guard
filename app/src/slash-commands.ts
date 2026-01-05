import type { Context } from "probot";
import type { GuardStorage } from "./storage";

const AGENT_ALLOW_REGEX = /\/agent-allow\s+@?([\w-]+)/i;
const BUDGET_REGEX = /\/budget\s+([0-9]+)(k_tokens|_tokens| tokens| tokens?)/i;

export type SlashCommandStorage = Pick<GuardStorage, "addAgentOverride" | "setBudget">;

export function createSlashCommandHandler(storage: SlashCommandStorage) {
  return async function handleSlashCommand(context: Context<"issue_comment.created">) {
    const comment = context.payload.comment.body ?? "";
    if (!context.payload.issue.pull_request) {
      return;
    }
    const repo = `${context.payload.repository.owner.login}/${context.payload.repository.name}`;
    const pullNumber = context.payload.issue.number;

    if (AGENT_ALLOW_REGEX.test(comment)) {
      const match = comment.match(AGENT_ALLOW_REGEX);
      if (match) {
        const agent = match[1];
        await storage.addAgentOverride(repo, pullNumber, agent);
        await context.octokit.rest.issues.createComment({
          ...context.repo(),
          issue_number: pullNumber,
          body: `Agent HQ Guard: agent \`${agent}\` added to allowlist for this run.`
        });
      }
    }

    if (BUDGET_REGEX.test(comment)) {
      const match = comment.match(BUDGET_REGEX);
      if (match) {
        const tokens = Number(match[1]) * (match[2].startsWith("k") ? 1000 : 1);
        await storage.setBudget(repo, pullNumber, tokens);
        await context.octokit.rest.issues.createComment({
          ...context.repo(),
          issue_number: pullNumber,
          body: `Agent HQ Guard: budget set to ${tokens} tokens.`
        });
      }
    }
  };
}
