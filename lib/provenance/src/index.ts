import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import actionCredentialSchema from "../../../packages/schemas/action_credential_v0.json";

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

export interface SchemaReport {
  valid: boolean;
  errors: string[];
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(actionCredentialSchema);

export function readCredentialFromFile(filePath: string): ActionCredential {
  const buffer = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(buffer) as ActionCredential;
}

export function credentialHash(credential: ActionCredential): string {
  const data = stableStringify(credential);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function verifyCredential(credential: ActionCredential): CredentialReport {
  const reasons: string[] = [];

  const schemaReport = validateCredentialSchema(credential);
  if (!schemaReport.valid) {
    reasons.push(...schemaReport.errors.map((error) => `Schema: ${error}`));
  }

  const signatures = credential.signatures ?? [];
  if (!signatures.length) {
    reasons.push("No signatures present on credential.");
  }

  const artifacts = credential.artifacts ?? [];
  const invalidArtifacts = artifacts.filter(
    (artifact) => !/^[0-9a-f]{64}$/i.test(artifact.sha256)
  );
  if (invalidArtifacts.length) {
    reasons.push(`Artifacts missing sha256: ${invalidArtifacts.map((a) => a.name).join(", ")}`);
  }

  for (const signature of signatures) {
    if (!signature.signature.startsWith("-----BEGIN")) {
      reasons.push(`Signature from ${signature.issuer} is not PEM encoded.`);
    }
  }

  const summary = [
    `Run: ${credential.run_id}`,
    `Agents: ${credential.agents?.map((agent) => agent.id).join(", ") || "none"}`,
    `Tokens: ${credential.budgets?.tokens ?? 0}`,
    `Artifacts: ${artifacts.length}`
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

export function validateCredentialSchema(credential: unknown): SchemaReport {
  const valid = validateSchema(credential);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validateSchema.errors ?? []).map((error) => formatAjvError(error));
  return {
    valid: false,
    errors
  };
}

function formatAjvError(error: ErrorObject): string {
  const pathLabel = error.instancePath ? error.instancePath : "/";
  const detail = error.message ?? "Invalid value";
  return `${pathLabel} ${detail}`.trim();
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}
