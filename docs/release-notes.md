# Release Notes — 2026-01-05

## Highlights

- Shared evaluator package now powers the app, action, and CLI for consistent policy decisions and annotations.
- Approvals and protected-path checks are stricter: approvals dedupe by latest review, and provenance credentials are verified against repo/commit context.
- Action/CLI can accept explicit change lists and approvals, and emit annotations to guide reviewers.
- Provenance validation adds JSON schema checks with Ajv alongside signature-structure validation.
- Documentation, examples, and default policies refreshed to align with native evaluation and glob-based path matching.

## Action and CLI Updates

- New inputs: `changes`, `changes_file`, `approvals` (optional but recommended for accurate path enforcement).
- Optional `github_token` for fetching PR context when running in GitHub Actions.
- Outputs include `annotations` with protected path hits.

## Policy Notes

- Path matching uses glob semantics (`*` single segment, `**` any depth). Use `**` to match all files.
- Default policies updated to reflect this behavior; review your patterns if you relied on `*` for deep matches.

## Migration Checklist

1. Update your workflow to pass `changes` or `changes_file` and `approvals` when available.
2. Re-run CLI `simulate` with current policies to confirm protected-path coverage.
3. Review the updated documentation for provenance requirements and evaluator behavior.
