import { z } from "zod";
import yaml from "js-yaml";

export const policySchema = z.object({
  metadata: z
    .object({
      name: z.string().default("default"),
      version: z.string().default("0.1.0"),
      description: z.string().optional()
    })
    .default({}),
  allow_agents: z.array(z.string()).default([]),
  max_tokens_per_run: z.number().int().nonnegative().default(0),
  write_scopes: z
    .array(
      z.object({
        path: z.string(),
        protected: z.array(z.string()).default([])
      })
    )
    .default([]),
  approvals: z
    .object({
      destructive_ops: z
        .object({
          required: z.number().int().nonnegative().default(0),
          approvers: z.array(z.string()).default([])
        })
        .optional()
    })
    .default({}),
  provenance_required: z.boolean().default(true)
});

export type GuardPolicy = z.infer<typeof policySchema>;

export function parsePolicy(input: string): GuardPolicy {
  const doc = yaml.load(input);
  return normalizePolicy(doc);
}

export function normalizePolicy(value: unknown): GuardPolicy {
  if (typeof value !== "object" || value === null) {
    throw new Error("Policy must be an object.");
  }

  return policySchema.parse(value);
}
