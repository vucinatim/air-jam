# Production Lifecycle Cleanup Proof

Last updated: 2026-08-30
Status: Gate `G3-02` terminal release-generation and inactive-media cleanup slice implemented and locally proven; production rollout pending

## Outcome

Air Jam now treats storage retention as a durable product lifecycle rather than
an ad hoc object-store deletion. PostgreSQL discovers eligible resources,
records one globally idempotent scheduling command, and creates resource-scoped
`lifecycle_cleanup` jobs for the independently deployed platform operational
worker.

The implemented retention classes are:

1. failed or abandoned release generations after 24 hours
2. stale uploads, failed media, and archived unassigned media after 24 hours

Media retention begins when the asset fails or is archived. A never-finalized
upload uses its creation time. The database records and constrains that
inactivity clock so an old asset archived today does not become immediately
eligible merely because its upload is old.

## Safety Contract

Cleanup revalidates and locks the resource before touching storage. It refuses
candidate or promoted release generations, assigned media, active media, and
resources whose retention deadline has not elapsed. The currently live release
is therefore outside the eligible state space rather than protected by a
caller convention.

The first attempt inventories the exact bounded object set below the canonical
resource root and persists the keys, sizes, and ETags on the durable attempt.
Retries reuse that first manifest instead of listing again. This guarantees
that an object appearing after the original cleanup decision cannot be swept
into a later retry. Object deletion is idempotent, so a crash or partial object
store failure can delete the same manifest again before PostgreSQL atomically
records both the storage tombstone and terminal job result.

Managed-storage quotas exclude only resources with a committed
`storageDeletedAt` tombstone. A failed or partially completed cleanup therefore
cannot make retained storage disappear from quota accounting.

## Durable And Automatic Operation

Operational jobs now identify their canonical resource independently of
release scope. Versioned resource kinds are `release_generation` and
`game_media_asset`; release metadata remains present only for release-scoped
work. Active-job uniqueness prevents two cleanup jobs from owning the same
resource, and replay is fenced to the original resource identity.

The platform operational worker schedules eligible cleanup on a bounded
interval, executes the same durable claim/lease/retry lifecycle as release
processing, and includes cleanup scheduling in its readiness and drain state.
The default schedule interval is 15 minutes and can be configured with
`AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS`.

Canonical agent discovery and operation are:

```bash
pnpm --silent run repo -- platform operations lifecycle cleanup --help
pnpm --silent run repo -- platform operations lifecycle cleanup \
  --actor <actor> --reason <reason> --idempotency-key <key> --json
pnpm --silent run repo -- platform operations lifecycle cleanup \
  --actor <actor> --reason <reason> --idempotency-key <key> --apply --json
pnpm --silent run repo -- platform operations jobs list \
  --kind lifecycle_cleanup --resource-kind <kind> --resource <id> --json
```

Preview calculates exact object and byte totals but redacts storage roots,
object keys, and object-store metadata. Apply enqueues work; it does not perform
destructive storage IO in the operator process. Repeating an identical batch
idempotency key returns the original jobs and reports that replay explicitly.

## Migration Contract

Migrations `0030` through `0033`:

1. generalize jobs and attempts from mandatory release scope to canonical
   resource scope
2. allow one idempotent cleanup command to create a bounded batch of jobs
3. fence replay lineage to the original resource
4. add cleanup tombstones and the media inactivity clock with legacy backfill

A fresh database was migrated through `0033`. A separate database was migrated
through `0029`, seeded with a legacy release job and archived media asset, then
upgraded through `0033`. The job retained its generation identity as
`resourceKind=release_generation`, and the media inactivity clock was
backfilled from its last legacy transition timestamp.

## Validation

The PostgreSQL contract suite proves:

1. exact candidate object counts and bytes for both resource classes
2. batch idempotency and resource-scoped job creation
3. terminal tombstones and quota exclusion only after committed deletion
4. retry after a simulated partial object-store failure
5. reuse of the first persisted manifest across attempts
6. survival of an object created after the first cleanup decision
7. release replay, generation, media-assignment, and worker authority invariants

Platform typechecking, worker-service tests, CLI discovery, fresh migration,
and legacy-upgrade proof also pass locally. The full `pnpm check:ci` repository
gate passes, including canonical-contract checks, all package tests and builds,
and multiplayer performance sanity. The hermetic platform deployment build also
passes and contains the generalized operational-worker entrypoint. The slice is
open for review as stacked pull request `#69`.

## Remaining Gate Work

This does not close `G3-02`. Superseded unpublished artifacts still need the
ratified long retention window and creator-visible warning state. Realtime
global admission, overload drills, and explicit production migration and
worker rollout also remain. A read-only Railway inspection on `2026-08-30`
confirmed that both production and pull request `#69` still contain the three
existing application services plus PostgreSQL, without the new
`air-jam-platform-worker` service. Cleanup therefore cannot run prematurely,
but the fourth-service provisioning, configuration, health, drain, retry, and
rollback proof remain mandatory rollout work. Production data and
infrastructure were not mutated by this proof.
