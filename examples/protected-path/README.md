# Protected Path Violation Example

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

This example demonstrates Guard blocking a run when an agent attempts to modify a protected path (`infra/**`) without the required approval.

- Workflow: `.github/workflows/protected-path.yml`
- Policy: `policy.yaml`
- Expected result: Guard check fails with annotations pointing at `infra/terraform.tf`.
