# hqguard CLI

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

Local developer companion for rehearsing Agent HQ Guard decisions without waiting on CI.

## Usage

```bash
pnpm --filter @agent-hq-guard/cli run build
./cli/dist/index.js simulate --policy policy.yaml --manifests out/*.json --budget-tokens 40000 \
  --changes "src/infra/terraform.tf,docs/readme.md" --approvals 1
```

The command exits non-zero when any manifest violates the policy.

## Notes

- Use `--changes-file` to pass the output of `git diff --name-only`.
- If no changes are provided, write-scope checks are not exercised.
