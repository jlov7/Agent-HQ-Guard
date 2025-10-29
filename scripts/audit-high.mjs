#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const audit = spawnSync("pnpm", ["audit", "--prod", "--json"], {
  encoding: "utf8"
});

if (audit.error) {
  console.error("pnpm audit failed to execute", audit.error);
  process.exit(2);
}

const output = audit.stdout?.trim();
if (!output) {
  console.error("pnpm audit produced no output");
  process.exit(audit.status ?? 1);
}

const reports = [];

try {
  reports.push(JSON.parse(output));
} catch (error) {
  const lines = output.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      reports.push(JSON.parse(line));
    } catch (lineError) {
      console.warn("Skipping unparsable pnpm audit line", { line, error: lineError.message });
    }
  }
}

const highFindings = [];

for (const payload of reports) {
  if (!payload || typeof payload !== "object") continue;
  const advisories = payload.advisories;
  if (!advisories || typeof advisories !== "object") continue;

  for (const advisory of Object.values(advisories)) {
    if (!advisory || typeof advisory !== "object") continue;
    const severity = String(advisory.severity || "").toLowerCase();
    if (severity === "high" || severity === "critical") {
      highFindings.push({
        module: advisory.module_name,
        title: advisory.title,
        severity,
        recommendation: advisory.recommendation,
        url: advisory.url
      });
    }
  }
}

if (highFindings.length > 0) {
  console.error("High severity vulnerabilities detected:");
  for (const finding of highFindings) {
    console.error(
      `- [${finding.severity.toUpperCase()}] ${finding.module}: ${finding.title}`
    );
    if (finding.url) {
      console.error(`  ${finding.url}`);
    }
    if (finding.recommendation) {
      console.error(`  Recommendation: ${finding.recommendation}`);
    }
  }
  process.exit(1);
}

console.log("No high or critical vulnerabilities detected by pnpm audit.");
process.exit(0);
