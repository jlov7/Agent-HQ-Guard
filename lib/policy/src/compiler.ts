import type { GuardPolicy } from "./schema";

const HEADER = `package agenthq.guard

default allow = false

`;

export function compilePolicyToRego(policy: GuardPolicy): string {
  const lines: string[] = [HEADER.trimEnd()];

  lines.push(
    `
allow {
  allow_agent
  within_budget
  valid_scope
  approvals_satisfied
  provenance_ok
}
`.trim()
  );

  lines.push(renderAgentAllowlist(policy));
  lines.push(renderBudget(policy));
  lines.push(renderScope(policy));
  lines.push(renderApprovals(policy));
  lines.push(renderProvenance(policy));

  return `${lines.join("\n\n")}\n`;
}

function renderAgentAllowlist(policy: GuardPolicy): string {
  if (!policy.allow_agents.length) {
    return `allow_agent { true }`;
  }

  const agentSet = policy.allow_agents.map((agent) => `"${agent}"`).join(", ");

  return `
allow_agent {
  input.agent.id == agent
  agent := allowlist[_]
}

allowlist := [${agentSet}]
`.trim();
}

function renderBudget(policy: GuardPolicy): string {
  if (!policy.max_tokens_per_run) {
    return `
within_budget { true }
`.trim();
  }

  return `
within_budget {
  input.usage.tokens <= ${policy.max_tokens_per_run}
}
`.trim();
}

function renderScope(policy: GuardPolicy): string {
  const allowedPaths = policy.write_scopes.map((scope) => scope.path);
  const protectedPaths = policy.write_scopes.flatMap((scope) => scope.protected);

  if (!policy.write_scopes.length) {
    return `
valid_scope { true }

protected_path_touched {
  file := input.changes.files[_]
  pattern := protected_paths[_]
  glob.match(pattern, ["/"], file)
}

protected_paths := []
`.trim();
  }

  return `
valid_scope {
  not disallowed_file
}

disallowed_file {
  file := input.changes.files[_]
  not file_allowed(file)
}

file_allowed(file) {
  some pattern in allowed_paths
  glob.match(pattern, ["/"], file)
}

protected_path_touched {
  file := input.changes.files[_]
  pattern := protected_paths[_]
  glob.match(pattern, ["/"], file)
}

allowed_paths := [
  ${allowedPaths.map((p) => `"${p}"`).join(",\n  ")}
]

protected_paths := [
  ${protectedPaths.map((p) => `"${p}"`).join(",\n  ")}
]
`.trim();
}

function renderApprovals(policy: GuardPolicy): string {
  const required = policy.approvals.destructive_ops?.required ?? 0;

  if (required === 0) {
    return `
approvals_satisfied { true }
`.trim();
  }

  return `
required_approvals := ${required}

approvals_required {
  required_approvals > 0
  protected_path_touched
}

approvals_satisfied {
  not approvals_required
}

approvals_satisfied {
  approvals_required
  input.approvals.destructive.count >= required_approvals
}
`.trim();
}

function renderProvenance(policy: GuardPolicy): string {
  if (!policy.provenance_required) {
    return `
provenance_ok { true }
`.trim();
  }

  return `
provenance_ok {
  input.provenance.valid == true
}
`.trim();
}
