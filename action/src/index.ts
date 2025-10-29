import fs from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { glob } from "glob";
import { parsePolicy, normalizePolicy } from "@agent-hq-guard/policy";
import {
  readCredentialFromFile,
  verifyCredential,
  createCredentialSummaryMarkdown
} from "@agent-hq-guard/provenance";

export interface EvaluationResult {
  allow: boolean;
  reasons: string[];
}

async function run() {
  try {
    const policyPath = core.getInput("policy") || "";
    const manifestGlob = core.getInput("manifest_glob", { required: true });
    const budgetOverride = Number(core.getInput("budget_tokens") || "0");

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

    const credentials = manifests.map((manifestPath) => readCredentialFromFile(manifestPath));

    const results = credentials.map((credential) =>
      evaluateCredential(policy, credential, budgetOverride)
    );

    const allow = results.every((result) => result.allow);
    const reasons = results.flatMap((result) => result.reasons);

    if (credentials[0]) {
      const summary = createCredentialSummaryMarkdown(
        credentials[0],
        verifyCredential(credentials[0])
      );
      if (process.env.GITHUB_STEP_SUMMARY) {
        await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
      }
    }

    const outputPayload = {
      allow,
      reasons,
      manifests
    };

    const outputPath = path.join(process.cwd(), "agent-hq-guard-result.json");
    await fs.writeFile(outputPath, JSON.stringify(outputPayload, null, 2));
    core.setOutput("allow", allow);
    core.setOutput("reasons", JSON.stringify(reasons));
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
  budgetOverride: number
): EvaluationResult {
  const reasons: string[] = [];

  if (policy.allow_agents.length) {
    for (const agent of credential.agents) {
      if (!policy.allow_agents.includes(agent.id)) {
        reasons.push(`Agent ${agent.id} not allowed.`);
      }
    }
  }

  const credentialReport = verifyCredential(credential);
  if (!credentialReport.valid) {
    reasons.push(...credentialReport.reasons.map((reason) => `Provenance: ${reason}`));
  }

  if (policy.max_tokens_per_run > 0 && credential.budgets.tokens > policy.max_tokens_per_run) {
    reasons.push(
      `Token usage ${credential.budgets.tokens} exceeds limit ${policy.max_tokens_per_run}.`
    );
  }

  if (budgetOverride > 0 && credential.budgets.tokens > budgetOverride) {
    reasons.push(`Token usage ${credential.budgets.tokens} exceeds limit ${budgetOverride}.`);
  }

  return {
    allow: reasons.length === 0,
    reasons
  };
}

if (process.env.VITEST !== "true") {
  void run();
}
