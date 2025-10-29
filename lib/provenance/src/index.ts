import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface ActionCredentialSignature {
  issuer: string;
  timestamp: string;
  signature: string;
  rekor_entry: string;
}

export interface ActionCredentialArtifactBinding {
  type: "embedded" | "soft";
  value: string;
}

export interface ActionCredential {
  version: string;
  run_id: string;
  repository: {
    owner: string;
    name: string;
    ref: string;
    commit: string;
  };
  workflow: {
    name: string;
    run_number: number;
    trigger: string;
  };
  agents: Array<{
    id: string;
    provider: string;
    capabilities: string[];
    tools?: string[];
  }>;
  decisions: Array<{
    type: string;
    status: "allow" | "deny" | "warn";
    details: string;
  }>;
  budgets: {
    tokens: number;
    currency: {
      amount: number;
      units: string;
    };
  };
  artifacts: Array<{
    name: string;
    sha256: string;
    bindings: ActionCredentialArtifactBinding[];
    manifest?: {
      type: "c2pa" | "sigstore" | "in-toto";
      reference: string;
    };
  }>;
  signatures: ActionCredentialSignature[];
}

export interface CredentialReport {
  valid: boolean;
  reasons: string[];
  summary: string;
}

export function readCredentialFromFile(filePath: string): ActionCredential {
  const buffer = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(buffer) as ActionCredential;
}

export function credentialHash(credential: ActionCredential): string {
  const data = JSON.stringify(credential, Object.keys(credential).sort());
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function verifyCredential(credential: ActionCredential): CredentialReport {
  const reasons: string[] = [];

  if (!credential.signatures.length) {
    reasons.push("No signatures present on credential.");
  }

  const invalidArtifacts = credential.artifacts.filter(
    (artifact) => !/^[0-9a-f]{64}$/i.test(artifact.sha256)
  );
  if (invalidArtifacts.length) {
    reasons.push(`Artifacts missing sha256: ${invalidArtifacts.map((a) => a.name).join(", ")}`);
  }

  for (const signature of credential.signatures) {
    if (!signature.signature.startsWith("-----BEGIN")) {
      reasons.push(`Signature from ${signature.issuer} is not PEM encoded.`);
    }
  }

  const summary = [
    `Run: ${credential.run_id}`,
    `Agents: ${credential.agents.map((agent) => agent.id).join(", ") || "none"}`,
    `Tokens: ${credential.budgets.tokens}`,
    `Artifacts: ${credential.artifacts.length}`
  ].join(" | ");

  return {
    valid: reasons.length === 0,
    reasons,
    summary
  };
}

export function createCredentialSummaryMarkdown(
  credential: ActionCredential,
  report: CredentialReport
): string {
  const status = report.valid ? "[PASS] Valid" : "[WARN] Attention";
  const lines = [
    `${status} Agent HQ Guard Action Credential`,
    "",
    `**Run ID:** \`${credential.run_id}\``,
    `**Agents:** ${credential.agents.map((agent) => `\`${agent.id}\``).join(", ") || "None"}`,
    `**Token Budget:** ${credential.budgets.tokens}`,
    `**Artifacts:** ${credential.artifacts.length}`,
    "",
    `**Summary:** ${report.summary}`
  ];

  if (!report.valid) {
    lines.push("", "**Reasons:**");
    for (const reason of report.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  return lines.join("\n");
}

export function resolveCredentialManifestPaths(
  credentialDir: string,
  manifests: string[]
): string[] {
  return manifests.map((manifestPath) =>
    path.isAbsolute(manifestPath) ? manifestPath : path.join(credentialDir, manifestPath)
  );
}
