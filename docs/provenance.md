# Agent HQ Guard: Provenance & Credentials

> **Understanding cryptographic provenance for AI-generated code**

Provenance—the cryptographic proof of who made what changes and when—is essential for trust in autonomous AI development. This guide explains how Agent HQ Guard implements provenance verification using industry-standard signing and verification.

## Implementation Status (Current)

Guard currently verifies:

- Schema validity against `action_credential_v0.json`
- Signature presence + PEM structure
- Artifact `sha256` format

Full Sigstore/Rekor/C2PA verification is planned. You can still run external verification (cosign/Rekor) alongside Guard for deeper assurance.

## Why Provenance Matters

In traditional software development, you know who made changes because:

- Git commits are tied to developer identities
- Code reviews provide human oversight
- CI/CD logs show execution history

**With AI agents, this breaks down:**

- ✅ Multiple AI providers can collaborate
- ✅ Changes happen autonomously
- ✅ No direct "developer" identity
- ❌ Need cryptographic proof of origin

**Provenance solves this by providing:**

- 🔐 **Cryptographic signatures** — Prove who signed the manifest
- 📋 **Audit trails** — Immutable record in transparency logs
- 🎯 **Non-repudiation** — Can't deny who made changes
- ✅ **Compliance** — Meet audit requirements

## Action Credential Schema (A2PA v0)

Guard uses the Action Credential schema (`packages/schemas/action_credential_v0.json`) to standardize manifest formats.

### Schema Structure

```json
{
  "version": "0.1.0",
  "run_id": "mission-control-run-123",
  "repository": {
    "owner": "demo",
    "name": "repo",
    "ref": "refs/heads/main",
    "commit": "0123456789abcdef0123456789abcdef01234567"
  },
  "workflow": {
    "name": "guarded-run",
    "run_number": 42,
    "trigger": "pull_request"
  },
  "agents": [
    {
      "id": "openai-codex",
      "capabilities": ["code-generation", "bug-fixing"],
      "provider": "openai"
    }
  ],
  "decisions": [],
  "budgets": {
    "tokens": 45000,
    "currency": {
      "amount": 0,
      "units": "USD"
    }
  },
  "artifacts": [
    {
      "name": "manifest.json",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "bindings": []
    }
  ],
  "signatures": [
    {
      "issuer": "sigstore",
      "timestamp": "2024-01-01T00:00:00Z",
      "signature": "-----BEGIN SIGNATURE-----\n...",
      "rekor_entry": "https://rekor.dev/entry/123"
    }
  ]
}
```

### Key Fields

| Field               | Purpose                       | Example                        |
| ------------------- | ----------------------------- | ------------------------------ |
| `version`           | Schema version                | `"0.1.0"`                      |
| `run_id`            | Mission control identifier    | `"run-123"`                    |
| `repository.*`      | Repo + commit context          | `"owner/name@sha"`             |
| `workflow.*`        | Workflow metadata             | `"guarded-run"`                |
| `agents[]`          | Participating agents          | `[{ "id": "claude" }]`         |
| `budgets.tokens`    | Token consumption             | `45000`                        |
| `artifacts[]`       | Artifact hashes + bindings     | `[{ "name": "manifest.json" }]` |
| `signatures[]`      | Signer metadata + signature    | `[{ "issuer": "sigstore" }]`   |

## External Signing Workflow (Optional)

### Step 1: Generate Manifest

Your agent workflow creates a credential manifest:

```json
{
  "version": "0.1.0",
  "run_id": "workflow-123",
  "repository": {
    "owner": "demo",
    "name": "repo",
    "ref": "refs/heads/feature",
    "commit": "0123456789abcdef0123456789abcdef01234567"
  },
  "workflow": {
    "name": "agents",
    "run_number": 7,
    "trigger": "pull_request"
  },
  "agents": [{ "id": "openai-codex" }],
  "decisions": [],
  "budgets": {
    "tokens": 45000,
    "currency": { "amount": 0, "units": "USD" }
  },
  "artifacts": [],
  "signatures": [
    {
      "issuer": "sigstore",
      "timestamp": "2024-01-01T00:00:00Z",
      "signature": "-----BEGIN SIGNATURE-----\n...",
      "rekor_entry": "https://rekor.dev/entry/123"
    }
  ]
}
```

### Step 2: Sign with Cosign (External)

Sign the manifest using GitHub Actions OIDC:

```bash
cosign sign-blob \
  --oidc-issuer https://token.actions.githubusercontent.com \
  --bundle manifest.json.bundle \
  manifest.json
```

**What this does:**

- Creates a Sigstore signature
- Uses GitHub OIDC for authentication (no keys to manage)
- Uploads to Rekor transparency log
- Generates a signature bundle

### Step 3: Upload Artifact

Upload manifest + signature to GitHub Actions artifact:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: agent-hq-guard-manifest
    path: |
      manifest.json
      manifest.json.bundle
```

### Step 4: Guard Verification

Guard App downloads and verifies:

1. **Schema validation** — Manifest matches `action_credential_v0.json`
2. **Signature structure** — Signatures are present and PEM formatted
3. **Hash format** — Artifact `sha256` values are well-formed

For cryptographic signature verification, run cosign/Rekor checks in your workflow or external tooling.

## Signature Formats

### Sigstore-Style Metadata (External Verification)

**Format:** Metadata fields that can reference Sigstore/Rekor artifacts

```json
{
  "signatures": [
    {
      "issuer": "sigstore",
      "timestamp": "2024-01-01T00:00:00Z",
      "signature": "-----BEGIN SIGNATURE-----\n...",
      "rekor_entry": "https://rekor.dev/entry/123"
    }
  ]
}
```

**Benefits:**

- ✅ Industry standard (CNCF Sigstore)
- ✅ Transparency log references
- ✅ Works with external cosign/Rekor verification

### In-Toto (Future)

**Format:** In-toto attestations

```json
{
  "predicateType": "https://example.com/agent-credential",
  "predicate": {
    "agents": [...],
    "budgets": {...}
  }
}
```

**Benefits:**

- ✅ Supply chain attestations
- ✅ Link attestations together
- ✅ Policy-driven verification

### C2PA (Future)

**Format:** C2PA 2.2 manifests

```json
{
  "artifacts": [
    {
      "manifest": {
        "reference": "c2pa://example.com/manifest.json",
        "type": "c2pa"
      }
    }
  ]
}
```

**Benefits:**

- ✅ Rich metadata embedding
- ✅ Industry standard (C2PA)
- ✅ Cross-platform compatibility

## Verification Process

### Automatic Verification (Guard)

Guard performs structural verification automatically:

```typescript
// 1. Schema validation
validateCredentialSchema(manifest);

// 2. Signature structure checks
verifyCredential(manifest);

// 3. Generate summary
createCredentialSummaryMarkdown(manifest, verificationResult);
```

### Manual Verification (External)

You can verify signatures manually:

```bash
# Verify signature
cosign verify-blob \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --bundle manifest.json.bundle \
  manifest.json

# Query Rekor
rekor-cli get --uuid <rekor-uuid>

# Or via API
curl https://rekor.sigstore.dev/api/v1/log/entries/<rekor-uuid>
```

## Retention Strategy

### What Guard Stores

- ✅ **Override records** — Allowlist + budget exceptions (SQLite)
- ✅ **Evaluation summaries** — Stored in GitHub Checks + comments

### What Guard Doesn't Store

- ❌ Raw manifest content
- ❌ Signature bundles
- ❌ Artifact content

### GitHub Artifact Retention

Manifests live in GitHub's artifact storage:

- **Default retention:** 90 days (configurable)
- **Manual cleanup:** Delete artifacts when no longer needed
- **Compliance:** Archive critical manifests externally

### Future: Long-Term Archive

Planned features:

- Post-merge manifest archival
- External storage integration (S3, GCS)
- Compliance retention policies

## Non-Repudiation Checklist

For compliance and audit:

- ✅ **Require provenance:** `provenance_required: true` in policy
- ✅ **Enforce signing:** Fail checks if signatures missing
- ✅ **Archive manifests:** Keep signed manifests for audit
- ✅ **Monitor violations:** Alert on provenance failures
- ✅ **Document process:** Maintain signing workflow docs

### Compliance Use Cases

**SOC 2:** Cryptographic proof of changes  
**ISO 27001:** Audit trail of AI agent activities  
**GDPR:** Provenance of data processing changes  
**HIPAA:** Who modified healthcare-related code

## Soft vs Durable Bindings

### Durable Bindings (Preferred)

Embed C2PA manifests or reference them:

```json
{
  "artifacts": [
    {
      "manifest": {
        "reference": "c2pa://example.com/manifest.json",
        "format": "c2pa"
      }
    }
  ]
}
```

**Benefits:**

- ✅ Embedded in artifacts
- ✅ Portable across systems
- ✅ Rich metadata

### Soft Bindings (Fallback)

Use hash pointers when embedding isn't possible:

```json
{
  "artifacts": [
    {
      "name": "model-output.bin",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "bindings": [
        {
          "type": "soft",
          "value": "sha256:abc123..."
        }
      ]
    }
  ]
}
```

**Use cases:**

- PDFs (can't embed)
- Binary files
- Legacy formats

## Troubleshooting

### "Provenance invalid" Error

**Check:**

1. Manifest uploaded to artifact?
2. Schema matches `action_credential_v0.json`?
3. `signatures[]` present and PEM formatted?
4. `artifacts[].sha256` values well-formed?

**Fix:**

- Rebuild the manifest payload to match schema
- Ensure signatures are attached and PEM formatted
- Re-upload the artifact bundle

### External Sigstore Verification

If you run cosign/Rekor checks outside Guard, troubleshoot there:

- Verify with `cosign verify-blob`
- Check Rekor entries with `rekor-cli`

## Best Practices

### 1. Always Require Provenance in Production

```yaml
provenance_required: true
```

### 2. Sign Every Manifest

```yaml
# In workflow
- name: Sign manifest
  run: |
    cosign sign-blob \
      --oidc-issuer https://token.actions.githubusercontent.com \
      --bundle manifest.json.bundle \
      manifest.json
```

### 3. Archive Critical Manifests

```bash
# Download and archive
gh run download <run-id> -n agent-hq-guard-manifest
aws s3 cp manifest.json s3://archive/manifests/
```

### 4. Monitor Verification Failures

Set up alerts for:

- Provenance validation failures
- External signature verification errors

### 5. Document Signing Process

Keep docs updated:

- Signing workflow steps
- Troubleshooting procedures
- Archive retention policies

---

**Next Steps:** See [Policy Reference](policy-reference.md) for policy configuration, or [Architecture](architecture.md) for system design.
