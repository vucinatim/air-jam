# Production Database Migration Contract

Last updated: 2026-09-04
Status: canonical contract

## Purpose

This contract defines the only supported lifecycle for changing Air Jam's
production PostgreSQL schema. It is designed for unattended agents without
turning migrations into an autonomous black box.

The operator decides intent. The repository supplies immutable plans, exact
target identity, backups, concurrency controls, durable evidence, and
independent verification.

## Authority

The committed Drizzle journal and SQL files under `apps/platform/drizzle` are
the sole schema source of truth. The generated
`platform-schema-head.generated.ts` binds runtime readiness and worker claims to
the exact journal head.

There is no second migration registry, hand-written production SQL path, or
automatic production migration at application startup.

## Migration Policy

Every migration after journal index `35` declares its operating mode inside the
SQL file. These comments are part of the migration hash.

```sql
-- airjam:migration-mode=online
-- airjam:verify=table:example
```

Supported modes:

1. `online`: safe while the previous and next application revisions overlap.
2. `operational_lanes`: requires one `airjam:affected-lanes` directive. Apply
   pauses only those canonical production-control lanes and waits for their
   active leases to finish.
3. `exclusive`: cannot be applied to production. It must be redesigned into
   online expand/migrate/contract phases.

Every new migration declares at least one independent `table`, `index`, or
`constraint` verification check. Historical migrations are recognized but
cannot be introduced as pending work on a production plan.

## Canonical Lifecycle

The repo CLI is the only normal operator surface:

```bash
pnpm run repo -- platform database migration --help
```

The lifecycle is:

1. `inspect` compares an explicit database target with the exact source
   catalog. Unknown hashes, a missing journal, and source-behind state fail
   closed.
2. `plan` creates a PostgreSQL custom-format backup and manifest, captures the
   database fingerprint and current journal head, snapshots affected lane
   revisions, and writes an immutable digest-addressed plan.
3. `apply` requires the plan path, digest, authority, actor, reason,
   idempotency key, and `--apply`. It rechecks every binding, pauses only the
   declared lanes, drains active jobs, applies Drizzle migrations, and verifies
   the journal and declared database objects. It does not reopen lanes.
4. the exact planned application revision is deployed.
5. `verify` independently checks the database again and, for production, calls
   the deployed `/api/readiness` endpoint and requires the exact planned Git
   revision. Only then does it restore lanes that the migration paused.

The plan and backup are local operational artifacts under
`.airjam/operations/database-migrations` by default. They may contain database
names and provider resource IDs, but never database URLs or credentials.

## Runtime Safety

`/api/health` remains process liveness. `/api/readiness` includes the generated
schema-head comparison and returns `503` when the database is missing, behind,
ahead, drifted, or unavailable.

The operational worker checks the same schema authority before every claim and
periodically while running. An incompatible schema leaves the process alive and
observable but blocks all new job, maintenance, event-delivery, synthetic, and
issue-projection work.

Application changes paired with an `online` migration must remain compatible
with both adjacent schema versions during rollout. Changes that cannot satisfy
that rule must use explicit production-control lanes and phased migrations.

## Failure and Retry Contract

Migration runs are durable and unique by plan digest and idempotency key.

1. retries with the same plan and key replay safely
2. reuse of either identity for different intent is rejected
3. apply failures are recorded as `apply_failed`
4. post-apply or deployed-revision failures are recorded as
   `verification_failed`
5. affected lanes stay paused on every failure after drain begins
6. verification may be retried after the external condition is repaired
7. lane restoration uses expected revisions; concurrent operator changes fail
   closed instead of being overwritten

The migration record binds source commit and head, target fingerprint, full
plan, backup evidence, drain evidence, actor, reason, and verification result.

## Backup Boundary

`platform database backup` is also available independently. A successful
backup returns the artifact path, SHA-256, size, target fingerprint, source
schema head, and manifest digest. Producing a backup does not prove restore;
isolated restore and recovery rehearsal belong to Gate `G3-03`.

## Production Sequence

Production plans are created only from the clean, merged commit intended for
deployment. Because `main` is the production branch, agents should keep the
merge-to-apply interval short:

1. merge the reviewed migration commit
2. inspect and create the production plan against the explicit Railway
   environment
3. apply the plan while the new deployment is progressing
4. wait for the exact revision to become current and ready
5. verify the plan and allow the lifecycle to restore affected lanes

Do not invoke raw `drizzle-kit migrate`, extract a production URL into a shell,
or restore lanes manually during the normal path.
