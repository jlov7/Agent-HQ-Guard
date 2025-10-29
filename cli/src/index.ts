#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { glob } from "glob";
import { parsePolicy } from "@agent-hq-guard/policy";
import {
  readCredentialFromFile,
  verifyCredential,
  createCredentialSummaryMarkdown
} from "@agent-hq-guard/provenance";

const program = new Command();
program.name("hqguard").description("Local simulator for Agent HQ Guard events.");

program
  .command("simulate")
  .description("Simulate a workflow run evaluation")
  .requiredOption("--manifests <pattern>", "Glob pattern to manifests")
  .option("--policy <path>", "Path to policy YAML", "policy.yaml")
  .option("--budget-tokens <tokens>", "Budget override tokens", "0")
  .action(async (options) => {
    const manifests = await glob(options.manifests);
    if (!manifests.length) {
      throw new Error(`No manifests found for pattern ${options.manifests}`);
    }

    let policyContent: string;
    try {
      policyContent = await fs.readFile(options.policy, "utf-8");
    } catch (error) {
      throw new Error(`Failed to read policy at ${options.policy}: ${error}`);
    }

    const policy = parsePolicy(policyContent);
    const budgetOverride = Number(options.budgetTokens ?? "0");

    const results: Array<{
      manifestPath: string;
      evaluation: CliEvaluationResult;
      credential: ReturnType<typeof readCredentialFromFile>;
    }> = [];
    for (const manifestPath of manifests) {
      const credential = readCredentialFromFile(manifestPath);
      const evaluation = evaluateManifest(policy, credential, budgetOverride);
      results.push({ manifestPath, evaluation, credential });
    }

    for (const result of results) {
      console.log(`# ${path.basename(result.manifestPath)}`);
      console.log(result.evaluation.allow ? "allow" : "block");
      for (const reason of result.evaluation.reasons) {
        console.log(`- ${reason}`);
      }
      console.log(
        createCredentialSummaryMarkdown(result.credential, verifyCredential(result.credential))
      );
      console.log();
    }

    const overall = results.every((result) => result.evaluation.allow);
    process.exit(overall ? 0 : 1);
  });

export interface CliEvaluationResult {
  allow: boolean;
  reasons: string[];
}

export function evaluateManifest(
  policy: ReturnType<typeof parsePolicy>,
  credential: ReturnType<typeof readCredentialFromFile>,
  budgetOverride: number
): CliEvaluationResult {
  const reasons: string[] = [];

  if (policy.allow_agents.length) {
    for (const agent of credential.agents) {
      if (!policy.allow_agents.includes(agent.id)) {
        reasons.push(`Agent ${agent.id} not allowed.`);
      }
    }
  }

  if (policy.max_tokens_per_run > 0 && credential.budgets.tokens > policy.max_tokens_per_run) {
    reasons.push(
      `Token usage ${credential.budgets.tokens} exceeds limit ${policy.max_tokens_per_run}.`
    );
  }

  if (budgetOverride > 0 && credential.budgets.tokens > budgetOverride) {
    reasons.push(`Token usage ${credential.budgets.tokens} exceeds limit ${budgetOverride}.`);
  }

  const credentialReport = verifyCredential(credential);
  if (!credentialReport.valid) {
    reasons.push(...credentialReport.reasons.map((reason) => `Provenance: ${reason}`));
  }

  return {
    allow: reasons.length === 0,
    reasons
  };
}

if (require.main === module) {
  void program.parseAsync(process.argv);
}
