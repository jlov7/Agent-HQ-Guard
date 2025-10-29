# Provenance & Credentials

Eval gates: Agent HQ Guard: block unauthorized agents; detect protected-path writes; require provenance; checks gate merges.

## Action Credential Schema (A2PA v0)

Path: `packages/schemas/action_credential_v0.json`

Key fields:

- `version` – schema version (`0.1.0`)
- `run_id` – mission-control run identifier
- `agents[]` – participating agents + capabilities
- `budgets.tokens` – total tokens consumed / permitted
- `artifacts[]` – hashed outputs with optional manifest references (C2PA, Sigstore, in-toto)
- `signatures[]` – Sigstore-style envelope with Rekor URL

## Signing Workflow

1. `cosign sign-blob --oidc-issuer https://token.actions.githubusercontent.com manifest.json`
2. Upload manifest + signature via workflow artifact (`agent-hq-guard-manifest`).
3. Guard Action validates schema and attaches human-readable summary to `$GITHUB_STEP_SUMMARY`.
4. Guard App verifies signatures, budgets, and links Rekor entry in the PR comment.

### Soft vs Durable Bindings

- **Durable (preferred):** Use C2PA 2.2 manifests embedded or referenced via `manifest.reference`.
- **Soft:** Provide SHA256 or watermark pointer in `bindings[]` when embedding is impossible (e.g., PDFs).

## Verification

Guard’s provenance module:

- Validates signature presence and PEM format.
- Ensures artifact hashes match expected pattern.
- Produces summary markdown with pass/warn status.
- Offers manifest path resolution helpers for local audit.

### Manual Verification

```bash
cosign verify-blob \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --signature manifest.sig \
  manifest.json
```

```bash
rekor-cli get --uuid <rekor-uuid>
```

## Retention Strategy

- Guard stores credential hashes only.
- The compose stack keeps artifacts in GitHub’s artifact store; configure retention (default 7 days in examples).
- Plan to purge sqlite overrides post-merge (future automation).

## Non-Repudiation Checklist

- Require provenance: `provenance_required: true`.
- Enforce SBOM signing in CI (see `.github/workflows/ci.yml`).
- Archive `agent-hq-guard-result.json` for audit.
- Ensure mission control responses are logged (logger hook available in `createMissionControlClient`).
