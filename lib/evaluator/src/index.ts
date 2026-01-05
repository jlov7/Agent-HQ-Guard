import type { GuardPolicy } from "@agent-hq-guard/policy";

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
  const annotationKeys = new Set<string>();

  const allowedAgents = new Set(policy.allow_agents);
  for (const agent of input.agents) {
    if (allowedAgents.size > 0 && !allowedAgents.has(agent.id)) {
      reasons.push(`Agent ${agent.id} is not on the allowlist.`);
    }
  }

  if (policy.max_tokens_per_run > 0 && input.usage.tokens > policy.max_tokens_per_run) {
    reasons.push(`Token usage ${input.usage.tokens} exceeds max ${policy.max_tokens_per_run}.`);
  }

  const scopeMatchers = policy.write_scopes.map((scope) => ({
    path: scope.path,
    matchesPath: createGlobMatcher(scope.path),
    protected: (scope.protected ?? []).map((pattern) => ({
      pattern,
      matches: createGlobMatcher(pattern)
    }))
  }));
  const hasScopes = scopeMatchers.length > 0;
  const requiredApprovals = policy.approvals.destructive_ops?.required ?? 0;
  const approvalCount = input.approvals.destructive.count;

  for (const file of input.changes.files) {
    const normalizedFile = normalizePath(file);
    const matchingScopes = hasScopes
      ? scopeMatchers.filter((scope) => scope.matchesPath(normalizedFile))
      : scopeMatchers;

    if (hasScopes && matchingScopes.length === 0) {
      reasons.push(`File ${normalizedFile} is outside allowed write scopes.`);
      addAnnotation(annotationKeys, annotations, normalizedFile, "File is outside allowed write scopes.");
      continue;
    }

    const matchedProtected = new Set<string>();
    for (const scope of matchingScopes) {
      for (const protectedPattern of scope.protected) {
        if (protectedPattern.matches(normalizedFile)) {
          matchedProtected.add(protectedPattern.pattern);
        }
      }
    }

    if (matchedProtected.size > 0) {
      for (const pattern of matchedProtected) {
        addAnnotation(annotationKeys, annotations, normalizedFile, `Protected path ${pattern} modified.`);

        if (requiredApprovals > 0 && approvalCount < requiredApprovals) {
          reasons.push(
            `Protected path ${pattern} modified by ${normalizedFile} without required approvals (${approvalCount}/${requiredApprovals}).`
          );
        }
      }
    }
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

function addAnnotation(
  keys: Set<string>,
  annotations: Array<{ path: string; message: string }>,
  path: string,
  message: string
): void {
  const key = `${path}|${message}`;
  if (keys.has(key)) {
    return;
  }
  keys.add(key);
  annotations.push({ path, message });
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function createGlobMatcher(pattern: string): (candidate: string) => boolean {
  const normalizedPattern = normalizePath(pattern);
  const regex = globToRegExp(normalizedPattern);
  return (candidate) => regex.test(normalizePath(candidate));
}

function globToRegExp(pattern: string): RegExp {
  let regex = "^";
  let i = 0;

  while (i < pattern.length) {
    const char = pattern[i];
    if (char === "*") {
      if (pattern[i + 1] === "*") {
        while (pattern[i + 1] === "*") {
          i += 1;
        }

        if (pattern[i + 1] === "/") {
          regex += "(?:.*/)?";
          i += 2;
          continue;
        }

        regex += ".*";
        i += 1;
        continue;
      }

      regex += "[^/]*";
      i += 1;
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      i += 1;
      continue;
    }

    regex += escapeRegExp(char);
    i += 1;
  }

  regex += "$";
  return new RegExp(regex);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
