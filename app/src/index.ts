import type { Request, Response, Router } from "express";
import type { Probot } from "probot";
import { loadPolicy } from "./policy-loader";
import { ensureGuardCheck, updateGuardCheck } from "./checks";
import { GuardStorage } from "./storage";
import { createSlashCommandHandler } from "./slash-commands";
import { handleWorkflowRunCompleted } from "./workflow-run";
import { createMissionControlClient } from "./mission-control";
import { createCredentialSummaryMarkdown } from "@agent-hq-guard/provenance";

const storage = new GuardStorage();
const missionControl = createMissionControlClient();

export default function agentHqGuard(app: Probot) {
  const probotWithRouter = app as unknown as { router?: Router };
  const router = probotWithRouter.router;
  if (router) {
    router.get("/healthz", (_req: Request, res: Response) => {
      res.json({ status: "ok" });
    });

    router.get("/readyz", async (_req: Request, res: Response) => {
      try {
        await storage.healthCheck();
        res.json({
          status: "ready",
          missionControlEnabled: Boolean(process.env.AGENT_HQ_API_URL)
        });
      } catch (error) {
        res.status(503).json({
          status: "degraded",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  } else {
    app.log.warn("Probot router missing; health endpoints disabled.");
  }

  app.on(
    ["pull_request.opened", "pull_request.reopened", "pull_request.synchronize"],
    async (context) => {
      const policy = await loadPolicy(context);
      const headSha = context.payload.pull_request.head.sha;
      const checkRunId = await ensureGuardCheck(context, headSha);
      await updateGuardCheck(context, headSha, checkRunId, {
        summary: `Agent HQ Guard is enforcing policy ${policy.metadata.name}@${policy.metadata.version}.`
      });
    }
  );

  app.on("check_suite.requested", async (context) => {
    const policy = await loadPolicy(context);
    const headSha = context.payload.check_suite.head_sha;
    const checkRunId = await ensureGuardCheck(context, headSha);
    await updateGuardCheck(context, headSha, checkRunId, {
      summary: `Check suite queued. Guard policy ${policy.metadata.name} pending workflow results.`
    });
  });

  app.on("issue_comment.created", createSlashCommandHandler(storage));

  app.on("workflow_run.completed", async (context) => {
    const policy = await loadPolicy(context);
    const evaluation = await handleWorkflowRunCompleted(context, policy, storage);
    if (!evaluation) {
      return;
    }

    const checkRunId = await ensureGuardCheck(context, evaluation.headSha);

    await updateGuardCheck(context, evaluation.headSha, checkRunId, {
      conclusion: evaluation.assessmentDetails.allow ? "success" : "action_required",
      summary: evaluation.resultSummary,
      text: renderAnnotationText(evaluation),
      annotations: evaluation.assessmentDetails.annotations.map((annotation) => ({
        path: annotation.path,
        message: annotation.message,
        start_line: 1
      }))
    });

    if (evaluation.credential && evaluation.credentialReport) {
      await context.octokit.rest.issues.createComment({
        ...context.repo(),
        issue_number: evaluation.pullNumber,
        body: createCredentialSummaryMarkdown(evaluation.credential, evaluation.credentialReport)
      });
    }

    if (missionControl && evaluation.credential) {
      try {
        await missionControl.publishDecision({
          runId: evaluation.credential.run_id,
          allow: evaluation.assessmentDetails.allow,
          reasons: evaluation.assessmentDetails.reasons,
          budgetTokens: evaluation.credential.budgets.tokens
        });
      } catch (error) {
        context.log.error(error, "Failed to publish decision to mission control");
      }
    }
  });
}

function renderAnnotationText(evaluation: Awaited<ReturnType<typeof handleWorkflowRunCompleted>>) {
  if (!evaluation) {
    return undefined;
  }

  const lines: string[] = [];
  lines.push("### Agent Decisions");
  if (evaluation.assessmentDetails.reasons.length) {
    for (const reason of evaluation.assessmentDetails.reasons) {
      lines.push(`- ${reason}`);
    }
  } else {
    lines.push("- All checks passed.");
  }

  if (evaluation.credential) {
    lines.push("\n### Signed Manifest\n");
    lines.push("```json");
    lines.push(JSON.stringify(evaluation.credential, null, 2));
    lines.push("```");
  }

  if (evaluation.assessmentDetails.annotations.length) {
    lines.push("\n### Protected Paths\n");
    for (const annotation of evaluation.assessmentDetails.annotations) {
      lines.push(`- ${annotation.path}: ${annotation.message}`);
    }
  }

  return lines.join("\n");
}
