# Production Budget Evidence Proof

Last updated: 2026-08-29
Status: Gate `G3-02` budget-evidence slice implemented and locally proven

This document preserves the proof for Air Jam's first project-scoped spend
authority. The readiness manifest remains the execution-state authority and
keeps `G3-02` active until quotas, durable queues, cleanup, realtime admission,
and overload behavior are also complete.

## Result

Air Jam can now retrieve its own Railway project usage, retain the provider's
raw measurements and the exact rate card used, derive the ratified budget
state, and persist the evidence through one agent-operable command.

The implementation has these invariants:

1. callers submit provider facts, never a budget-state label
2. thresholds come only from reviewed source policy
3. the ordinary cycle uses `$25` target, `$50` warning, `$75` protection,
   `$90` near-ceiling, and `$100` ceiling values
4. the launch cycle uses `$50`, `$75`, `$100`, `$135`, and `$150`, but remains
   inactive until its exact period start is approved in source
5. provider values, cost breakdown, provider scope, rate card, collector,
   reason, and source version are retained as immutable evidence
6. preview is the default; persistence requires explicit `--apply`
7. a completed idempotent command replays the stored item before another
   provider read, while conflicting key reuse fails
8. repeated snapshots do not double-count spend because status selects the
   newest evidence for each provider scope
9. evidence older than six hours is reported as stale with no authoritative
   current state and a separately labeled last-known state
10. no command can raise a threshold or activate the launch allowance

## Canonical Commands

Discover the complete surface:

```bash
pnpm --silent run repo -- platform operations budget --help
```

Read the persisted current state:

```bash
pnpm --silent run repo -- platform operations budget status --json
```

Fetch Railway and preview the result without writing:

```bash
pnpm --silent run repo -- platform operations budget sync \
  --railway-project <project-id> \
  --actor <operator> \
  --reason <reason> \
  --idempotency-key <key> \
  --json
```

Add `--apply` to persist the immutable evidence. Use
`--railway-environment <id>` with the same command when targeting an explicit
remote platform database; credentials are resolved without printing them.

## Measured Proof

The provider-to-domain-to-database lifecycle was exercised on `2026-08-29`
against a fresh isolated PostgreSQL cluster with the complete migration history.
The provider side was read-only and no production platform record was changed.

The observed Railway project evidence was:

| Fact                           |                                 Value |
| ------------------------------ | ------------------------------------: |
| Current-cycle actual usage     |                           `$7.203280` |
| Provider projection            |                           `$8.610859` |
| Derived actual state           |                              `normal` |
| Derived projected state        |                              `normal` |
| Ordinary hard-ceiling headroom |                          `$92.796720` |
| Provider source                | `railway-graphql-v2-usage@2026-08-29` |
| Rate card                      |   `railway-public-pricing@2026-08-29` |

The proof established:

1. migration `0024_white_deadpool.sql` applies after the full prior history
2. two concurrent identical ingestions produce one cycle and one evidence row
3. a conflicting idempotency-key reuse is rejected
4. preview writes nothing
5. apply records the provider facts and derives `normal`
6. repeating the applied public command returns the same evidence ID with
   `replayed: true`
7. the temporary PostgreSQL cluster was stopped and moved to Trash after proof

The focused automated evidence is:

```bash
node --test \
  scripts/repo/runtime/railway-api-contract.test.mjs \
  scripts/repo/runtime/production-budget-cli-contract.test.mjs \
  scripts/repo/runtime/production-control-authority.test.mjs

AIR_JAM_TEST_DATABASE_URL=<isolated-postgres-url> \
  pnpm --filter platform test -- --run \
  src/server/operations/production-budget-service.postgres.test.ts
```

## Remaining Gate Work

This slice deliberately does not pretend to finish `G3-02`:

1. production has not received the migration or an evidence item
2. scheduled evidence refresh and budget-state incidents belong to Gate 4
3. ratified creator/game usage remains to be computed in shadow mode
4. budget states are not yet connected to quota enforcement or automatic lane
   posture
5. durable release/browser queues, cleanup, realtime admission, and overload
   proof remain required

The next production-valid slice was shadow quota accounting. It is now recorded
in the [production shadow quota proof](./production-shadow-quota-proof.md),
which explains what would be denied under protection without rejecting
legitimate early users. Durable bounded jobs are the next unfinished owner.
