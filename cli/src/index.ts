#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { glob } from "glob";
import { parsePolicy } from "@agent-hq-guard/policy";
import { assessRun } from "@agent-hq-guard/evaluator";
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
  .option("--changes <paths>", "Comma-separated list of changed files")
  .option("--changes-file <path>", "Path to a newline-delimited changed files list")
  .option("--approvals <count>", "Approved review count", "0")
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
    const approvals = Number(options.approvals ?? "0");
    const changes = await resolveChanges(options.changes, options.changesFile);
    const effectivePolicy =
      budgetOverride > 0 ? { ...policy, max_tokens_per_run: budgetOverride } : policy;

    const results: Array<{
      manifestPath: string;
      evaluation: CliEvaluationResult;
      credential: ReturnType<typeof readCredentialFromFile>;
      credentialReport: ReturnType<typeof verifyCredential>;
    }> = [];
    for (const manifestPath of manifests) {
      const credential = readCredentialFromFile(manifestPath);
      const credentialReport = verifyCredential(credential);
      const evaluation = evaluateManifest(effectivePolicy, credential, credentialReport, {
        changes,
        approvals
      });
      results.push({ manifestPath, evaluation, credential, credentialReport });
    }

    for (const result of results) {
      console.log(`# ${path.basename(result.manifestPath)}`);
      console.log(result.evaluation.allow ? "allow" : "block");
      for (const reason of result.evaluation.reasons) {
        console.log(`- ${reason}`);
      }
      if (result.evaluation.annotations.length) {
        console.log("annotations:");
        for (const annotation of result.evaluation.annotations) {
          console.log(`- ${annotation.path}: ${annotation.message}`);
        }
      }
      if (policy.write_scopes.length && !changes.length) {
        console.log("note: no changed files provided; scope checks were not exercised.");
      }
      console.log(
        createCredentialSummaryMarkdown(result.credential, result.credentialReport)
      );
      console.log();
    }

    const overall = results.every((result) => result.evaluation.allow);
    process.exit(overall ? 0 : 1);
  });

export interface CliEvaluationResult {
  allow: boolean;
  reasons: string[];
  annotations: Array<{ path: string; message: string }>;
}

export function evaluateManifest(
  policy: ReturnType<typeof parsePolicy>,
  credential: ReturnType<typeof readCredentialFromFile>,
  credentialReport: ReturnType<typeof verifyCredential>,
  context: { changes: string[]; approvals: number }
): CliEvaluationResult {
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

if (require.main === module) {
  void program.parseAsync(process.argv);
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
