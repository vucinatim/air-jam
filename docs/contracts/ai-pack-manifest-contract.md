# AI Pack Manifest Contract

Last updated: 2026-09-04

Status: canonical 1.0 contract

Related docs:

1. [../architecture/documentation-and-ai-pack-architecture.md](../architecture/documentation-and-ai-pack-architecture.md)
2. [../architecture/platform-docs-surface-architecture.md](../architecture/platform-docs-surface-architecture.md)
3. [../guides/ai-pack-workflow-guide.md](../guides/ai-pack-workflow-guide.md)
4. [public-package-release-trust-contract.md](./public-package-release-trust-contract.md)

## Purpose

The AI pack is a managed framework-guidance bundle. Its manifest says exactly
which local files Air Jam owns, which content the installed CLI can restore,
and which version produced those bytes.

## Trust Model

The update authority is the snapshot packaged in the installed `@air-jam/cli`
artifact. npm provenance and the immutable public release candidate protect that
artifact. A hosted endpoint is not trusted to rewrite local agent guidance.

The platform publishes the same schema-2 manifest at
`/ai-pack/manifest.json`, with its declared files available below
`/ai-pack/files/<managed-path>`, for humans, browsers, archives, and inspection.
It does not create a second channel/version/pointer hierarchy. This hosted copy
is a read-only delivery surface; the CLI does not fetch it during `status`,
`diff`, `update`, or `repair`.

## Local Manifest

Every scaffolded project stores `.airjam/ai-pack.json` using schema version 2.
It records:

1. semantic pack version and stable/canary channel
2. release date
3. the fixed `packaged-snapshot` source and `@air-jam/cli` package identity
4. scaffold template and `create-airjam` version metadata
5. the exact managed file list, kind, byte size, and SHA-256 digest
6. one content digest over the ordered managed file metadata

Manifest parsing is strict. Unknown fields, unsafe paths, duplicate paths,
invalid sizes, invalid hashes, or unsupported source identities fail closed.

## Managed File Boundary

Only declared regular files below `docs/airjam/` are managed. The manifest is
managed implicitly. Paths may not be absolute, traverse upward, contain empty
segments, or use platform-specific separators.

The AI pack does not own:

1. `AGENTS.md` or `CLAUDE.md`
2. project-local skills
3. application code
4. project notes
5. files outside the declared managed set

Unmanaged files below `docs/airjam/` survive an update. Files declared by the
previous manifest but removed from the new manifest are removed as obsolete.

## Machine Lifecycle

```bash
pnpm exec airjam ai-pack status --dir . --json
pnpm exec airjam ai-pack diff --dir . --json
pnpm exec airjam ai-pack update --dir . --json
pnpm exec airjam ai-pack repair --dir . --json
```

`status` and `diff` compare against the installed package without network
access. `update` applies a strictly newer packaged version. `repair` explicitly
restores drift at the same version. A local version newer than the installed
CLI is never downgraded; the operator must upgrade the CLI.

Before mutation, the CLI verifies every packaged file, stages the complete next
tree, verifies the staged tree, and then swaps the managed docs tree and
manifest with rollback backups. A failed transaction restores the prior state.
Symlinked managed trees or manifests fail closed.

## Generation

The committed packaged manifest is generated after canonical public docs are
materialized:

```bash
pnpm --filter @air-jam/cli docs-pack:generate
pnpm --filter @air-jam/cli ai-pack:manifest:generate
pnpm --filter @air-jam/cli ai-pack:check
```

The check requires the declared files and digests to exactly match the packaged
snapshot. Platform artifact generation consumes the same source snapshot so the
hosted read-only representation cannot become an independent knowledge silo.
