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
  if (!policy.write_scopes.length) {
    return `
valid_scope { true }
`.trim();
  }

  const protectedPaths = policy.write_scopes.flatMap((scope) => scope.protected);

  if (!protectedPaths.length) {
    return `
valid_scope { true }
`.trim();
  }

  return `
valid_scope {
  not violates_protected_path
}

violates_protected_path {
  some changed in input.changes.files
  some path in protected_paths
  glob.match(path, ["/"], changed)
}

protected_paths := [
  ${protectedPaths.map((p) => `"${p}"`).join(",\n  ")}
]
`.trim();
}

function renderApprovals(policy: GuardPolicy): string {
  const destructive = policy.approvals.destructive_ops;

  if (!destructive || destructive.required === 0) {
    return `
approvals_satisfied { true }
`.trim();
  }

  return `
approvals_satisfied {
  input.approvals.destructive.count >= ${destructive.required}
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
