import fs from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { glob } from "glob";
import { parsePolicy, normalizePolicy } from "@agent-hq-guard/policy";
import { assessRun } from "@agent-hq-guard/evaluator";
import {
  readCredentialFromFile,
  verifyCredential,
  createCredentialSummaryMarkdown
} from "@agent-hq-guard/provenance";

export interface EvaluationResult {
  allow: boolean;
  reasons: string[];
  annotations: Array<{ path: string; message: string }>;
}

async function run() {
  try {
    const policyPath = core.getInput("policy") || "";
    const manifestGlob = core.getInput("manifest_glob", { required: true });
    const budgetOverride = Number(core.getInput("budget_tokens") || "0");
    const approvalsInput = core.getInput("approvals");
    const changesInput = core.getInput("changes");
    const changesFileInput = core.getInput("changes_file");
    const token = core.getInput("github_token") || process.env.GITHUB_TOKEN || "";

    const manifests = await glob(manifestGlob);
    if (!manifests.length) {
      core.setFailed(`No manifests matched pattern ${manifestGlob}`);
      return;
    }

    let policyContent = "";
    if (policyPath) {
      policyContent = await fs.readFile(policyPath, "utf-8");
    } else {
      try {
        policyContent = await fs.readFile(path.join(process.cwd(), "policy.yaml"), "utf-8");
      } catch {
        core.info("No policy file provided; using default allowlist.");
      }
    }

    const policy = policyContent ? parsePolicy(policyContent) : normalizePolicy({});
    const effectivePolicy =
      budgetOverride > 0 ? { ...policy, max_tokens_per_run: budgetOverride } : policy;

    const credentials = manifests.map((manifestPath) => readCredentialFromFile(manifestPath));

    const changesFromInput = await resolveChanges(changesInput, changesFileInput);
    const approvalsOverride =
      approvalsInput.trim().length > 0 ? Number(approvalsInput) : undefined;

    let contextInfo: PullRequestContext | undefined;
    if (!changesFromInput.length || approvalsOverride === undefined) {
      contextInfo = await resolvePullRequestContext(token);
    }

    const changes = changesFromInput.length ? changesFromInput : contextInfo?.files ?? [];
    const approvals =
      approvalsOverride !== undefined ? approvalsOverride : contextInfo?.approvals ?? 0;

    if (!changes.length && policy.write_scopes.length) {
      core.warning("No changed files detected; write-scope checks were skipped.");
    }

    const results = credentials.map((credential) =>
      evaluateCredential(effectivePolicy, credential, {
        changes,
        approvals
      })
    );

    const allow = results.every((result) => result.allow);
    const reasons = results.flatMap((result) => result.reasons);
    const annotations = results.flatMap((result) => result.annotations);

    if (credentials[0]) {
      const credentialReport = verifyCredential(credentials[0]);
      const summary = createCredentialSummaryMarkdown(credentials[0], credentialReport);
      if (process.env.GITHUB_STEP_SUMMARY) {
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
      }
    }

    const outputPayload = {
      allow,
      reasons,
      annotations,
      manifests
    };

    const outputPath = path.join(process.cwd(), "agent-hq-guard-result.json");
    await fs.writeFile(outputPath, JSON.stringify(outputPayload, null, 2));
    core.setOutput("allow", allow);
    core.setOutput("reasons", JSON.stringify(reasons));
    core.setOutput("annotations", JSON.stringify(annotations));
    core.setOutput("result_path", outputPath);

    if (!allow) {
      core.setFailed(reasons.join("; "));
    }

    core.info(`Agent HQ Guard evaluation complete for run ${github.context.runId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}

export function evaluateCredential(
  policy: ReturnType<typeof parsePolicy>,
  credential: ReturnType<typeof readCredentialFromFile>,
  context: { changes: string[]; approvals: number }
): EvaluationResult {
  const credentialReport = verifyCredential(credential);
  const assessment = assessRun(policy, {
    agents: credential.agents,
    usage: { tokens: credential.budgets.tokens },
    changes: { files: context.changes },
    approvals: { destructive: { count: context.approvals } },
    provenance: { valid: credentialReport.valid }
  });

  const reasons = [...assessment.reasons];
  if (!credentialReport.valid) {
    reasons.push(...credentialReport.reasons.map((reason) => `Provenance: ${reason}`));
  }

  return {
    allow: reasons.length === 0,
    reasons,
    annotations: assessment.annotations
  };
}

if (process.env.VITEST !== "true") {
  void run();
}

interface PullRequestContext {
  files: string[];
  approvals: number;
}

async function resolveChanges(changes?: string, changesFile?: string): Promise<string[]> {
  const files = new Set<string>();
  if (changes) {
    for (const entry of changes.split(",")) {
      const trimmed = entry.trim();
      if (trimmed) {
        files.add(trimmed);
      }
    }
  }

  if (changesFile) {
    const content = await fs.readFile(changesFile, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) {
        files.add(trimmed);
      }
    }
  }

  return Array.from(files);
}

async function resolvePullRequestContext(token: string): Promise<PullRequestContext | undefined> {
  const pullRequest = github.context.payload.pull_request;
  if (!pullRequest || !token) {
    return undefined;
  }

  const { owner, repo } = github.context.repo;
  const pullNumber = pullRequest.number;
  const octokit = github.getOctokit(token);

  try {
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100
    });

    const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100
    });

    return {
      files: files.map((file) => file.filename),
      approvals: countApprovals(reviews)
    };
  } catch (error) {
    core.warning(
      `Failed to load PR context for changes/approvals: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return undefined;
  }
}

function countApprovals(
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
