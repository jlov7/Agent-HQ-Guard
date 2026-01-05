import AdmZip from "adm-zip";
import type { Context } from "probot";
import { assessRun } from "@agent-hq-guard/evaluator";
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
      valid: credentialReport?.valid ?? false
    }
  });

  if (credential) {
    const contextIssues = validateCredentialContext(credential, {
      owner,
      repo,
      headSha
    });
    if (contextIssues.length) {
      assessment.reasons.push(...contextIssues);
      assessment.allow = false;
    }
  }

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
  const files = (await context.octokit.paginate(context.octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  })) as Array<{ filename: string }>;
  return files.map((file) => file.filename);
}

async function countApprovals(context: Context, pullNumber: number): Promise<number> {
  const { owner, repo } = context.repo();
  const reviews = (await context.octokit.paginate(context.octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  })) as Array<{
    user?: { login?: string | null } | null;
    state?: string;
    submitted_at?: string | null;
  }>;
  return countApprovalsFromReviews(reviews);
}

async function fetchCredentials(
  context: Context<"workflow_run.completed">,
  runId: number
): Promise<ActionCredential[]> {
  const { owner, repo } = context.repo();
  const artifacts = await context.octokit.rest.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: runId
  });

  const manifestArtifacts = (artifacts.data.artifacts ?? []) as Array<{
    id: number;
    name: string;
  }>;

  const manifests = manifestArtifacts.filter((artifact) =>
    artifact.name.startsWith(MANIFEST_PREFIX)
  );

  const credentials: ActionCredential[] = [];

  for (const artifact of manifests) {
    const downloaded = await context.octokit.rest.actions.downloadArtifact({
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

function validateCredentialContext(
  credential: ActionCredential,
  expected: { owner: string; repo: string; headSha: string }
): string[] {
  const reasons: string[] = [];
  if (
    credential.repository.owner !== expected.owner ||
    credential.repository.name !== expected.repo
  ) {
    reasons.push(
      `Credential repository ${credential.repository.owner}/${credential.repository.name} does not match ${expected.owner}/${expected.repo}.`
    );
  }

  if (credential.repository.commit !== expected.headSha) {
    reasons.push(
      `Credential commit ${credential.repository.commit} does not match PR head ${expected.headSha}.`
    );
  }

  return reasons;
}

function countApprovalsFromReviews(
  reviews: Array<{
    user?: { login?: string | null } | null;
    state?: string;
    submitted_at?: string | null;
  }>
): number {
  const latestByUser = new Map<string, { state?: string; submitted_at?: string | null }>();
  for (const review of reviews) {
    const login = review.user?.login;
    if (!login) {
      continue;
    }

    const existing = latestByUser.get(login);
    if (!existing || (review.submitted_at ?? "") > (existing.submitted_at ?? "")) {
      latestByUser.set(login, review);
    }
  }

  let count = 0;
  for (const review of latestByUser.values()) {
    if (review.state === "APPROVED") {
      count += 1;
    }
  }

  return count;
}
