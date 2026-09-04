# Production Migration Lifecycle Proof

Date: 2026-09-04
Gate: `G3-06`
Status: isolated implementation proof; production rollout evidence pending

## Proven Contract

Air Jam now has one agent-operable production schema lifecycle:

1. the Drizzle catalog requires hashed operating and verification directives
   for every new migration
2. runtime readiness and worker scheduling compare the live database with the
   generated exact schema head
3. the repo CLI exposes inspect, backup-bound immutable plan, guarded apply,
   and independent verify operations
4. production apply refuses historical and exclusive pending migrations
5. operational-lane migrations snapshot, pause, drain, and later restore only
   their declared lanes using revision-fenced production controls
6. durable migration runs retain intent, target, source, backup, drain, retry,
   and verification evidence
7. failed apply or verification leaves affected writers paused

## Automated Evidence

Focused repository and platform tests prove:

1. the complete CLI and required mutation arguments are discoverable
2. a new migration without policy directives is rejected
3. declared lanes and object checks enter the catalog
4. only an exact schema timestamp and hash is compatible
5. product readiness fails on an incompatible schema
6. an operational worker rejects a cycle before job authority is touched when
   the schema is incompatible
7. the pre-existing Railway database resolver contract still resolves targets
   without printing credentials

The generated migration `0036_canonical_production_migration_lifecycle.sql`
creates the durable run authority and verifies its table, lifecycle constraint,
and plan-digest uniqueness index.

## Isolated PostgreSQL Evidence

A disposable PostgreSQL 17 database was initialized in Docker tmpfs and seeded
with the exact known journal through `0035`. The canonical CLI then proved:

1. `inspect` reported `behind`, 36 known applied entries, one
   pending entry, and zero unknown entries
2. `plan` created a 4,902-byte custom-format backup, SHA-256-bound manifest,
   target fingerprint, immutable plan, and plan digest
   `ff3ec660792fb18626d3b00d5fab8562cafe97287418d93c7122531a6a150be7`
3. `apply` reached journal head `0036`, retained run
   `1971a5eb-81ab-4097-bf76-3ea267244156`, and passed the declared table,
   constraint, and index checks
4. `verify` moved the same run from `applied` to `verified`
5. replaying `apply` with the same idempotency key returned the existing
   verified run without another mutation
6. an independent fresh database applied all 37 migrations and inspected as
   exact-head `ready`

A second isolated database deliberately verified against an unreachable
deployment origin. The command failed, the durable run moved to
`verification_failed`, and its retained checks showed all database checks
passed while `deployment:exact-revision-readiness` failed. The lifecycle did
not report success or perform restoration.

The first ordinary Docker initialization attempt found the host's persistent
Docker store full. The proof was rerun safely with a bounded tmpfs database;
no unrelated Docker data was pruned.

## Evidence Still Required Before Closure

This document does not claim production completion yet. Closure requires:

1. green batch and CI-equivalent gates
2. one Canonicalizer review before push
3. one green GitHub PR and one GitHub-native Claude Opus review
4. merge, production plan/apply, exact-revision verification, and Railway
   readiness evidence

## Deferred Scope

Backup creation is part of migration safety. Isolated restore timing,
deployment rollback, and durable job replay remain the separate `G3-03`
recovery exercise.
