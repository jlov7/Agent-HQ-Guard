# Agent HQ Guard: Provenance & Credentials

> **Understanding cryptographic provenance for AI-generated code**

Provenance—the cryptographic proof of who made what changes and when—is essential for trust in autonomous AI development. This guide explains how Agent HQ Guard implements provenance verification using industry-standard signing and verification.

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
  "agents": [
    {
      "id": "openai-codex",
      "capabilities": ["code-generation", "bug-fixing"],
      "provider": "openai"
    }
  ],
  "budgets": {
    "tokens": 45000,
    "cost_estimate": 0.45
  },
  "artifacts": [
    {
      "path": "src/index.ts",
      "hash": "sha256:abc123...",
      "manifest": {
        "reference": "c2pa://example.com/manifest.json"
      }
    }
  ],
  "signatures": [
    {
      "signature": "-----BEGIN SIGNATURE-----\n...",
      "certificate": "-----BEGIN CERTIFICATE-----\n...",
      "rekor_uuid": "abc123...",
      "rekor_url": "https://rekor.sigstore.dev"
    }
  ],
  "bindings": [
    {
      "type": "sha256",
      "value": "abc123..."
    }
  ]
}
```

### Key Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `version` | Schema version | `"0.1.0"` |
| `run_id` | Mission control identifier | `"run-123"` |
| `agents[]` | Participating agents | `[{ "id": "claude" }]` |
| `budgets.tokens` | Token consumption | `45000` |
| `artifacts[]` | Changed files with hashes | `[{ "path": "src/a.ts" }]` |
| `signatures[]` | Sigstore signatures | `[{ "signature": "..." }]` |
| `bindings[]` | Additional attestations | `[{ "type": "sha256" }]` |

## Signing Workflow

### Step 1: Generate Manifest

Your agent workflow creates a credential manifest:

```json
{
  "version": "0.1.0",
  "run_id": "workflow-123",
  "agents": [{"id": "openai-codex"}],
  "budgets": {"tokens": 45000},
  "artifacts": []
}
```

### Step 2: Sign with Cosign

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
2. **Signature verification** — Cosign signature valid
3. **Certificate check** — OIDC issuer matches GitHub Actions
4. **Rekor lookup** — Transparency log entry exists
5. **Hash verification** — Artifact hashes match claims

## Signature Formats

### Sigstore (Default)

**Format:** Sigstore envelope with Rekor transparency log

```json
{
  "signatures": [
    {
      "signature": "base64-encoded-signature",
      "certificate": "x509-certificate-pem",
      "rekor_uuid": "abc123...",
      "rekor_url": "https://rekor.sigstore.dev"
    }
  ]
}
```

**Benefits:**
- ✅ Industry standard (CNCF Sigstore)
- ✅ OIDC authentication (no key management)
- ✅ Transparency log (immutable record)
- ✅ GitHub Actions integration

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
        "format": "c2pa"
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

Guard performs verification automatically:

```typescript
// 1. Schema validation
validateSchema(manifest, ACTION_CREDENTIAL_V0_SCHEMA)

// 2. Signature verification
cosign.verifyBlob(manifest, signatureBundle)

// 3. Certificate validation
validateCertificate(certificate, {
  issuer: "https://token.actions.githubusercontent.com"
})

// 4. Rekor lookup
rekor.getEntry(rekorUuid)

// 5. Generate summary
createCredentialSummaryMarkdown(manifest, verificationResult)
```

### Manual Verification

You can verify manually:

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

- ✅ **Credential hashes** — Fingerprints for reference
- ✅ **Verification results** — Pass/fail status
- ✅ **Summary markdown** — Human-readable comments

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
  "bindings": [
    {
      "type": "sha256",
      "value": "abc123..."
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
2. Manifest signed with cosign?
3. Schema matches `action_credential_v0.json`?
4. OIDC issuer matches GitHub Actions?

**Fix:**
```bash
# Re-sign manifest
cosign sign-blob --oidc-issuer https://token.actions.githubusercontent.com manifest.json

# Re-upload artifact
```

### "Signature verification failed"

**Check:**
1. Certificate matches OIDC issuer?
2. Rekor entry exists?
3. Signature bundle format correct?

**Fix:**
```bash
# Verify manually
cosign verify-blob --bundle manifest.json.bundle manifest.json

# Check Rekor
rekor-cli get --uuid <rekor-uuid>
```

### "Rekor lookup timeout"

**Check:**
1. Rekor API accessible?
2. UUID correct?

**Fix:**
- Guard retries automatically
- Check Rekor status: https://rekor.sigstore.dev/api/v1/log
- Use alternative Rekor instance if needed

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
- Signature verification errors
- Rekor lookup timeouts

### 5. Document Signing Process

Keep docs updated:
- Signing workflow steps
- Troubleshooting procedures
- Archive retention policies

---

**Next Steps:** See [Policy Reference](policy-reference.md) for policy configuration, or [Architecture](architecture.md) for system design.