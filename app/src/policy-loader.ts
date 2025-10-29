import type { Context } from "probot";
import { normalizePolicy, type GuardPolicy } from "@agent-hq-guard/policy";
import defaultPolicy from "../policy.default.json";

type PullRequestEventNames =
  | "pull_request.opened"
  | "pull_request.synchronize"
  | "pull_request.reopened";

const CONFIG_FILE = "agent-hq-guard.yml";

export async function loadPolicy(
  context: Context<PullRequestEventNames | "check_suite.requested" | "workflow_run.completed">
): Promise<GuardPolicy> {
  const config = await context.config(CONFIG_FILE);
  if (config) {
    return normalizePolicy(config);
  }

  return normalizePolicy(defaultPolicy);
}
