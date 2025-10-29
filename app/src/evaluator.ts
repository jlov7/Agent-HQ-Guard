import type { GuardPolicy } from "@agent-hq-guard/policy";
import type { ActionCredential } from "@agent-hq-guard/provenance";

export interface RunAssessmentInput {
  agents: Array<{ id: string }>;
  usage: {
    tokens: number;
  };
  changes: {
    files: string[];
  };
  approvals: {
    destructive: {
      count: number;
    };
  };
  provenance: {
    valid: boolean;
    credential?: ActionCredential;
  };
}

export interface RunAssessmentResult {
  allow: boolean;
  reasons: string[];
  annotations: Array<{ path: string; message: string }>;
}

export function assessRun(policy: GuardPolicy, input: RunAssessmentInput): RunAssessmentResult {
  const reasons: string[] = [];
  const annotations: Array<{ path: string; message: string }> = [];

  const allowedAgents = new Set(policy.allow_agents);
  for (const agent of input.agents) {
    if (allowedAgents.size > 0 && !allowedAgents.has(agent.id)) {
      reasons.push(`Agent ${agent.id} is not on the allowlist.`);
    }
  }

  if (policy.max_tokens_per_run > 0 && input.usage.tokens > policy.max_tokens_per_run) {
    reasons.push(`Token usage ${input.usage.tokens} exceeds max ${policy.max_tokens_per_run}.`);
  }

  const protectedPaths = new Set(policy.write_scopes.flatMap((scope) => scope.protected ?? []));
  if (protectedPaths.size > 0) {
    for (const file of input.changes.files) {
      for (const pattern of protectedPaths) {
        if (matchesPattern(pattern, file)) {
          annotations.push({
            path: file,
            message: `Protected path ${pattern} modified without approval.`
          });
          reasons.push(`Protected path ${pattern} modified by ${file}.`);
        }
      }
    }
  }

  const requiredApprovals = policy.approvals.destructive_ops?.required ?? 0;
  if (requiredApprovals > 0 && input.approvals.destructive.count < requiredApprovals) {
    reasons.push(
      `Destructive approvals ${input.approvals.destructive.count} below required ${requiredApprovals}.`
    );
  }

  if (policy.provenance_required && !input.provenance.valid) {
    reasons.push("Provenance credential is missing or invalid.");
  }

  return {
    allow: reasons.length === 0,
    reasons,
    annotations
  };
}

function matchesPattern(pattern: string, filePath: string): boolean {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return filePath.startsWith(prefix);
  }
  return pattern === filePath;
}
