import AdmZip from "adm-zip";
import type { Context } from "probot";
import { assessRun } from "./evaluator";
import type { GuardStorage } from "./storage";
import type { GuardPolicy } from "@agent-hq-guard/policy";
import {
  verifyCredential,
  type ActionCredential,
  type CredentialReport
} from "@agent-hq-guard/provenance";

interface WorkflowEvaluation {
  headSha: string;
  pullNumber: number;
  resultSummary: string;
  assessmentDetails: {
    allow: boolean;
    reasons: string[];
    annotations: Array<{ path: string; message: string }>;
  };
  credential?: ActionCredential;
  credentialReport?: CredentialReport;
}

const MANIFEST_PREFIX = "agent-hq-guard";

export async function handleWorkflowRunCompleted(
  context: Context<"workflow_run.completed">,
  policy: GuardPolicy,
  storage: Pick<GuardStorage, "loadOverrides">
): Promise<WorkflowEvaluation | undefined> {
  const run = context.payload.workflow_run;
  const pr = run.pull_requests?.[0];
  if (!pr) {
    context.log.info("No pull request associated with workflow run %s", run.id);
    return undefined;
  }

  const headSha = pr.head.sha;
  const { owner, repo } = context.repo();
  const overrides = await storage.loadOverrides(`${owner}/${repo}`, pr.number);

  const effectivePolicy: GuardPolicy = {
    ...policy,
    allow_agents: Array.from(new Set([...policy.allow_agents, ...overrides.allowAgents]))
  };

  if (overrides.budgetTokens) {
    effectivePolicy.max_tokens_per_run = overrides.budgetTokens;
  }

  const [files, approvals] = await Promise.all([
    listChangedFiles(context, pr.number),
    countApprovals(context, pr.number)
  ]);

  const credentials = await fetchCredentials(context, run.id);
  const credential = credentials[0];
  const credentialReport = credential ? verifyCredential(credential) : undefined;

  const assessment = assessRun(effectivePolicy, {
    agents: credential?.agents ?? [],
    usage: {
      tokens: credential?.budgets.tokens ?? 0
    },
    changes: {
      files
    },
    approvals: {
      destructive: {
        count: approvals
      }
    },
    provenance: {
      valid: credentialReport?.valid ?? false,
      credential
    }
  });

  const summary = buildSummary(assessment, credentialReport);

  return {
    headSha,
    pullNumber: pr.number,
    resultSummary: summary,
    assessmentDetails: assessment,
    credential,
    credentialReport
  };
}

async function listChangedFiles(context: Context, pullNumber: number): Promise<string[]> {
  const { owner, repo } = context.repo();
  const response = await context.octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });
  return response.data.map((file) => file.filename);
}

async function countApprovals(context: Context, pullNumber: number): Promise<number> {
  const { owner, repo } = context.repo();
  const response = await context.octokit.pulls.listReviews({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });
  return response.data.filter((review) => review.state === "APPROVED").length;
}

async function fetchCredentials(
  context: Context<"workflow_run.completed">,
  runId: number
): Promise<ActionCredential[]> {
  const { owner, repo } = context.repo();
  const artifacts = await context.octokit.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: runId
  });

  const manifests = artifacts.data.artifacts.filter((artifact) =>
    artifact.name.startsWith(MANIFEST_PREFIX)
  );

  const credentials: ActionCredential[] = [];

  for (const artifact of manifests) {
    const downloaded = await context.octokit.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: artifact.id,
      archive_format: "zip"
    });

    const buffer = Buffer.from(downloaded.data as ArrayBuffer);
    const zip = new AdmZip(buffer);

    for (const entry of zip.getEntries()) {
      if (entry.entryName.endsWith(".json")) {
        const parsed = JSON.parse(entry.getData().toString("utf-8")) as ActionCredential;
        credentials.push(parsed);
      }
    }
  }

  return credentials;
}

function buildSummary(
  assessment: ReturnType<typeof assessRun>,
  credentialReport?: ReturnType<typeof verifyCredential>
): string {
  const status = assessment.allow ? "allow" : "block";
  const reasonText = assessment.reasons.length
    ? assessment.reasons.join("; ")
    : "All guardrails satisfied.";
  const provenance = credentialReport
    ? credentialReport.valid
      ? "Provenance validated."
      : `Provenance issues: ${credentialReport.reasons.join("; ")}`
    : "No credential found.";

  return `Decision: ${status}. ${reasonText} ${provenance}`;
}
