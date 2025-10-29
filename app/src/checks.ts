import type { Context } from "probot";

export const GUARD_CHECK_NAME = "Agent HQ Guard";

type GuardContextName =
  | "pull_request.opened"
  | "pull_request.synchronize"
  | "pull_request.reopened"
  | "check_suite.requested"
  | "workflow_run.completed";

interface SetCheckOptions {
  conclusion?: "success" | "failure" | "neutral" | "action_required";
  summary: string;
  text?: string;
  annotations?: Array<{
    path: string;
    message: string;
    start_line?: number;
    end_line?: number;
  }>;
}

export async function ensureGuardCheck<TName extends GuardContextName>(
  context: Context<TName>,
  headSha: string
) {
  const { owner, repo } = context.repo();

  const checks = await context.octokit.checks.listForRef({
    owner,
    repo,
    ref: headSha
  });

  const existing = checks.data.check_runs.find((run) => run.name === GUARD_CHECK_NAME);

  if (existing) {
    return existing.id;
  }

  const response = await context.octokit.checks.create({
    owner,
    repo,
    name: GUARD_CHECK_NAME,
    head_sha: headSha,
    status: "in_progress",
    output: {
      title: GUARD_CHECK_NAME,
      summary: "Agent HQ Guard evaluation is running.",
      text: "Waiting for workflow artifacts and provenance to finish."
    }
  });

  return response.data.id;
}

export async function updateGuardCheck<TName extends GuardContextName>(
  context: Context<TName>,
  headSha: string,
  checkRunId: number,
  options: SetCheckOptions
) {
  const { owner, repo } = context.repo();

  await context.octokit.checks.update({
    owner,
    repo,
    check_run_id: checkRunId,
    status: options.conclusion ? "completed" : "in_progress",
    conclusion: options.conclusion,
    output: {
      title: GUARD_CHECK_NAME,
      summary: options.summary,
      text: options.text,
      annotations: options.annotations?.map((annotation) => ({
        path: annotation.path,
        annotation_level: options.conclusion === "success" ? "notice" : "failure",
        message: annotation.message,
        start_line: annotation.start_line ?? 1,
        end_line: annotation.end_line ?? annotation.start_line ?? 1
      }))
    }
  });
}
