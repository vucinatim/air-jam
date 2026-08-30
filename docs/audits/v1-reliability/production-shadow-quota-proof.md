# Production Shadow Quota Proof

Last updated: 2026-08-29
Status: Gate `G3-02` shadow-accounting slice implemented and locally proven

## Outcome

Air Jam now has one versioned, machine-readable allowance catalog and one
deterministic admission evaluator for the ratified free-cloud policy. The
evaluator combines authoritative usage, persisted lane mode, and fresh derived
budget state. It returns `shadow_denied` below protection and only returns an
enforced quota denial when a lane is restricted or the budget ladder activates
protection.

This slice does not silently turn limits on for users. Product adapters are not
yet wired to reject on these decisions. The CLI makes current usage and the
exact future decision visible first, which is the required observation period
before enforcement.

## Canonical Policy

The source-owned catalog implements the roadmap allowances:

| Quota                         |         Limit | Window                    | Current authority                                                   |
| ----------------------------- | ------------: | ------------------------- | ------------------------------------------------------------------- |
| Creator games                 |          `50` | lifetime                  | `games` lifecycle rows                                              |
| Creator listed games          |          `20` | lifetime                  | listed `games` rows                                                 |
| Creator managed storage       |       `2 GiB` | lifetime                  | compressed and extracted release artifacts plus media source assets |
| Game managed storage          |     `500 MiB` | lifetime                  | the same logical-byte authority scoped to one owned game            |
| Release submissions           |  `200` / `50` | rolling 30 days / UTC day | release lifecycle rows                                              |
| Browser validations           |  `100` / `20` | rolling 30 days / UTC day | screenshot-capture check attempts                                   |
| Concurrent release jobs       |           `2` | concurrent                | explicitly unavailable until durable jobs exist                     |
| Creator room time             | `1,000` hours | rolling 30 days           | clipped authoritative runtime game segments                         |
| Creator/game concurrent rooms |   `50` / `50` | concurrent                | explicitly unavailable until global realtime admission exists       |

Archived media remains counted because archive currently changes lifecycle
state without deleting the stored object. This avoids claiming reclaimed bytes
before lifecycle cleanup has actually removed them.

Approximate product telemetry is not read anywhere in quota accounting.
Request-lifetime release work and process-local room maps are rejected as false
concurrency authority rather than being presented as exact.

## Admission Semantics

Evaluation order is:

1. validate the quota key, scope, lane, limit, unit, and window against source
2. require readable persisted lane authority
3. honor a paused lane and its retry guidance
4. require fresh budget evidence and an available usage authority
5. apply the lane-specific budget response ladder
6. compare current plus requested usage with the ratified limit
7. return `shadow_denied` in normal/warning state, or `denied` when restricted
   or protected

The source contract added `game_creation` and `game_listing` as explicit lanes.
Mapping those quotas onto an unrelated release or ingestion lane would have
hidden their semantic ownership.

## Agent Surface

Discovery and usage inspection are available through:

```bash
pnpm --silent run repo -- platform operations quota --help
pnpm --silent run repo -- platform operations quota status \
  --creator <creator-id> \
  --game <owned-game-id> \
  --json
```

An agent can explain one prospective decision without supplying policy state or
limits:

```bash
pnpm --silent run repo -- platform operations quota check \
  --key creator_release_submissions_day \
  --lane release_submission \
  --creator <creator-id> \
  --amount 1 \
  --json
```

The caller supplies only the semantic scope and requested amount. Usage, lane
mode, budget state, allowance, outcome, reason, and BYOC guidance are derived.

## Validation

Focused proof passed:

```bash
pnpm --filter platform typecheck
pnpm --filter @air-jam/database-contract typecheck
pnpm --filter platform exec vitest run \
  src/server/operations/production-quota-policy.test.ts
node --test \
  scripts/repo/runtime/production-quota-cli-contract.test.mjs \
  scripts/repo/runtime/production-control-authority.test.mjs
```

A fresh native PostgreSQL cluster then received every migration from `0000`
through `0025`. The database test inserted creator, game, release, artifact,
media, validation, runtime-segment, and budget facts and proved:

1. creator and game scope remain distinct
2. logical storage bytes include all retained objects
3. rolling room seconds are clipped to the 30-day window
4. missing durable/global concurrency owners remain explicitly unavailable
5. normal-budget overage produces `shadow_denied`
6. the same service combines lifecycle usage with lane and budget authority
7. the public repo CLI returns that same database-backed decision as stable JSON

The temporary cluster was stopped and moved to Trash. Production data and
production control state were not changed.

## Remaining Gate Work

This does not close `G3-02`:

1. product application services still need to emit and then honor these exact
   decisions after the observation period
2. durable release/browser jobs must provide real queue and concurrency state
3. lifecycle cleanup must reconcile logical records with physical storage
4. realtime needs global room/controller admission and graceful drain
5. load, overload, and dependency-degradation behavior remains unproven
