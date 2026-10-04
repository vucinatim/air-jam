# Launch load and recovery rehearsal

Date: 2026-09-12
Scope: local `G3-04` / `G3-05`; required drill and envelope complete, canonicality ready; **not deployed**

## Purpose and operating path

Prove a useful launch envelope rather than infer capacity from a single-room
microbenchmark. The existing `perf sanity` command and ordinary CI remain
unchanged. This opt-in command owns an isolated real server process, required
App ID authentication, normal database admission, and real usage persistence:

```bash
pnpm --silent run repo -- perf launch-load --help
# Export AIR_JAM_TEST_DATABASE_URL from local secret configuration first.
pnpm --silent run repo -- perf launch-load --profile smoke --json
pnpm --silent run repo -- perf launch-load --profile release --json
```

The connection must target loopback PostgreSQL with CREATE DATABASE permission.
Each run creates and migrates a new randomly named database and drops only that
owned database during cleanup. Existing databases are not reset. The fault
proxy interrupts only this runtime's database connections, not PostgreSQL or
normal development. No provider operations are involved.

The release profile calls for 100 rooms / 400 controllers for 30 minutes,
then 200 / 800 for five minutes. Input is 30 Hz per controller and replicated
state is 10 Hz. A separate step fills the actual normal 300-room cap and
attempts room 301. The dependency drill interrupts database connectivity for
12 seconds, below the 30-second instance lease, while existing game traffic
continues. Readiness, fresh admission, and recovery are observed, not mocked.

Output goes to a new `.airjam/launch-load/<runId>` directory: runtime logs,
observations, and a JSON report. Latency histograms use bounded storage; the
report separates server-process CPU/RSS from the driver, records connection
counts, per-peer traffic loss, actual send cadence, and cleanup. A smoke run
cannot satisfy the release duration. The load represents synthetic socket
traffic, not browser rendering or all possible game payloads.

## What actually happened

Two short runs on Node 24.12.0 reached the normal room cap, rejected room 301
with `SERVICE_UNAVAILABLE` and a 15-second retry hint, then crashed the runtime
immediately after database interruption. **Both runs failed.** At that point the
35-minute release profile had not been run. [Retained measurements](./launch-load-smoke-2026-09-12.json)
preserve both attempts; unabridged local output remains under the matching run
IDs in `.airjam/launch-load/`.

The first smoke exposed two independent defects:

1. Concurrent usage projection transactions collided on deterministic aggregate
   keys. A direct PostgreSQL regression reproduced SQLSTATE `23505`: 12 of 16
   concurrent joins failed on `runtime_usage_game_session_metrics_pkey`; seven
   of eight same-game room activations failed on
   `runtime_usage_daily_game_metrics_pkey`.
2. PostgreSQL driver `postgres@3.4.7` crashed at `connection.js:250`,
   `nextWrite`, attempting `socket.write` after the connection had closed.

The analytics correction takes a transaction-owned session lock before
projection and sorted game locks before refreshing shared daily totals. The
existing rebuild writer now uses the same transaction boundaries. There is no
new queue, schema, retry engine, player restriction, or change to room joining.
Three PostgreSQL regressions preserve all 34 lifecycle events / 16 closed
controller segments / 160 controller-seconds, correct totals for eight rooms,
and concurrent rebuild/live-write results. Fourteen focused analytics tests
passed. Every regression used and disposed of a fresh database.
This proves concurrent-writer integrity, not arbitrary event-arrival ordering;
the existing ledger rebuild remains the recovery path for historical projection
reconciliation. No new ordering or replay guarantee is claimed here.

The second socket smoke observed **zero usage persistence failures before the
deliberate outage**. Its two-second baseline (2 rooms / 8 controllers) and burst
(4 / 16) sustained 29.95 and 29.97 inputs/second/controller, with zero input
loss and 3 ms input p95. These small-loopback numbers do not establish launch
capacity. The first runner used an interval that drifted to 28.5 Hz; the runner
now schedules against a monotonic deadline and reports actual cadence instead
of assuming that a requested timer frequency was achieved.

Both runs stopped their child process and disposed of the exact owned database.
The second failure still emitted valid JSON on stdout and correctly reported
failed continuity and unexpected disconnections, preserving the child-exit
cause instead of replacing it with a generic abort.

Normal verification: 36 fixture/metrics tests and five repo CLI tests pass;
the affected-source TypeScript/lint gate passes in 4,713 ms. The longer batch
gate and final canonicality pass are deferred until the blocked driver work
has a settled scope, not represented as completed review.

## Driver diagnosis

The driver failure matches upstream
[issue 1066](https://github.com/porsager/postgres/issues/1066) and
[open PR 1168](https://github.com/porsager/postgres/pull/1168).
Inspection of the latest published 3.4.9 source still shows the same unguarded
write. A version bump alone is not a demonstrated repair.

The runtime uses transaction-scoped handles. After closure, the driver's
rollback path can try to execute through the stale handle. Merely guarding a
null socket may avoid the crash while leaving query promises unsettled. A
correct dependency-level repair must reject stale work, preserve pool ownership,
and prove successful fresh queries after recovery.

A repository-only pnpm patch is insufficient: the published Air Jam server
currently leaves `postgres` external, so npm consumers would not inherit it.
Before choosing a dependency repair, resolve how that repair reaches both
deployments and published artifacts, versus changing the database adapter.
No fork, driver patch, adapter replacement, or deployment was made during those
first two smoke attempts.

## Driver repair and passing recovery smoke

The subsequent correction remains at the driver's ownership boundary:
[version-pinned dependency repair](../../../patches/README.md). Scoped work
must still own the exact reservation callback before it can execute or release
the connection. Closure rejects its private queued queries. ESM, CommonJS, and
Cloudflare sources receive the same change. No null-write suppression, runtime
exception swallowing, retry engine, or database adapter replacement was added.

The server now bundles both the corrected driver and its Drizzle adapter, so
the adapter cannot import an unpatched external driver. `postgres` is a build-
time server dependency, not an unused published runtime requirement. All three
Docker dependency stages copy the pinned patch before frozen installation.

All **10 PostgreSQL driver regression cases pass on Node 24.12.0**: rollback,
late transaction work after connection reuse, stale reserved release, and
queued transaction/reserved queries, each through ESM and CommonJS. Test time
was 6.724 seconds (7.44 seconds total). The unpatched Node 25 comparison proved
stale-transaction and queued-transaction failures; its reserved cases initially
failed before interruption because a test-only `fetch_types:false` setting
prevented first reservation. Those setup failures are **not** ownership-defect
evidence. The corrected matrix uses ordinary production defaults.

The third actual socket smoke **passes** on Node 24.12.0. During a measured
12,098.7 ms database outage, input and state loss stayed at zero. Readiness
became unavailable and new-room admission returned `SERVICE_UNAVAILABLE` with
a 15-second retry hint. Fresh admission recovered **6,415.4 ms after restoration**.
All six phases had zero input/state loss, no unexpected disconnection or
protocol violation, and successful exact-fixture cleanup.
[Retained recovery measurements](./launch-load-recovery-smoke-2026-09-12.json)
do not substitute for the full release profile.

The new source fingerprint records relevant runtime, driver, and harness
sources at both ends of a measurement; changes invalidate the result. This
keeps an uncommitted local run distinguishable from an immutable release
candidate without requiring a misleading commit/merge claim.

## Packaged recovery and shutdown

The extracted server artifact also retained all 235 of 235 inputs through a
12,037 ms database interruption and recovered readiness in 6,929 ms. Fresh
bootstrap, room creation, and controller joining succeeded. That first artifact
is **not a complete pass**: after its normal drain finished, factory shutdown
exceeded the diagnostic's ten-second deadline. Each diagnostic cleaned up its
own process, proxy, and generated database; dependencies were linked locally,
not installed from a clean registry.

Four focused ESM/CommonJS regressions then reproduced that shutdown defect:
ordinary `sql.end()` waited indefinitely on unused disconnected pool slots,
even though their failed query promises had already rejected. Actual socket
closure had left a stale active-query reference behind. The dependency repair
now clears that completed query/result state and settles an already pending
shutdown on closure. This corrects driver lifecycle state rather than forcing
an application timeout. All **18 expanded Node 24 regressions pass** (18.1
seconds), including healthy in-flight query draining and shutdown already
pending at interruption. A fourth source smoke also passes with an unchanged
source fingerprint, a 12,125.4 ms outage, recovery in 6,883.6 ms, and complete
runtime/database cleanup. Its outage intake attempt timed out rather than
returning an explicit denial; this is unavailable admission, not proof of a
friendly error response.

The rebuilt package with patch `77mhlc3gwcvvryifzb5qt3jiwa` then **passed behavior
and cleanup**: all 235 inputs delivered during a 12,028 ms outage, readiness
recovered in 6,940 ms, and fresh bootstrap/room/controller admission succeeded.
Normal drain finished in 2,835 ms and factory shutdown in 9 ms. The proxy and
generated database were disposed of; the diagnostic exited zero.
[Packaged recovery evidence](./launch-load-packaged-recovery-2026-09-12.json)
retains the exact tarball hash and linked-dependency limitation. The full
release-profile rehearsal could then proceed without a known shutdown blocker.

## Full release-profile result

Run `launch-load-20260912155441044-2d9f1027` completed every phase and cleaned up
its runtime, fault proxy, and owned database. Relevant source fingerprints were
identical at both ends. [Retained full-profile measurements](./launch-load-release-2026-09-12.json)
include the original report hash, machine, phase counters, failures, and resource
derivation. This is an uncommitted source measurement, not an immutable candidate.

| Phase                     | Rooms / controllers                      | Duration   | Input / state p95 | Message loss |
| ------------------------- | ---------------------------------------- | ---------- | ----------------- | ------------ |
| Baseline                  | 100 / 400                                | 30 minutes | 23 / 35 ms        | 0%           |
| Burst                     | 200 / 800                                | 5 minutes  | 32 / 40 ms        | 0%           |
| Filling admission ceiling | 200 active, rising to 300 admitted / 800 | 60 seconds | 78 / 103 ms       | 0%           |
| Database disconnected     | 100 / 400                                | 12 seconds | 12 / 15 ms        | 0%           |

The baseline delivered 21,380,800 inputs and 7,190,800 state messages; the burst
delivered 7,164,800 and 2,400,800. Actual per-controller input cadence was 29.70
and 29.85 Hz respectively; state cadence was 9.99 and 10.00 Hz. Every peer had
zero measured loss, with no unexpected disconnect or cross-room/duplicate
protocol violation. Room 301 received the normal capacity rejection and a
15-second retry hint. Peak database connections attributed to the runtime were
10, not an unbounded connection increase.

Readiness became unavailable during the 12,005 ms database interruption.
The new-room attempt timed out at eight seconds rather than delivering its
eventual explicit denial to that caller. After restoration, readiness and fresh
room/controller admission recovered in 4,444 ms. Ten recorded runtime failures
were confined to the intentional outage; nine were usage-persistence failures.
This proves gameplay continuity, not lossless analytics during database loss.
Usage rebuild reconciles retained events; it cannot recreate an event that was
never persisted. No healthy-phase persistence failure was observed.

**The command exited 1 and `releaseQualified` remains false.** Its two violations
are the overload-phase input/state p95 exceeding the runner's 50 ms threshold.
The baseline and twice-load burst satisfy their cadence, loss, and latency
checks. Do not rewrite this result as a fully passing release profile, rerun
until lucky, or loosen the threshold merely to make it green.

The overload samples show a busy single realtime event loop (interval
utilization reached approximately 0.99), while memory and database connection
counts stayed bounded. That is consistent with local process capacity pressure,
not proof of a specific hot function or a database bottleneck. No CPU profile
was collected, so a deeper cause is not claimed.

The ratified floor is 100 sustained rooms, a twice-load attempt, and safe
overload behavior—not a 300-active-room latency promise. This drill establishes
that bounded local floor and exposes the upper-end limitation. The 300-room
policy ceiling is an admission ceiling, not a supported performance envelope.
Keep the failed strict result in the residual-risk record and verify the final
deployment; this measurement alone does not justify distributed rooms, more
infrastructure, or silently reducing user-facing limits. A sustained overload
latency guarantee would require a separately scoped bottleneck correction and
new measurement, not another mandatory pre-adoption scale program.

## Resource and cost interpretation

Use the successful baseline and burst separately, excluding fixture setup and
the fault/recovery transition. Each phase's observed server samples yield CPU
counter deltas, time-weighted RSS, and public TCP bytes written. Record the
sampled duration rather than claiming coverage outside those samples.

Railway's application-resource prices, checked on 2026-09-12, are
`$0.000463/vCPU-minute`, `$0.000231/GB-minute`, and `$0.05/GB` egress.
[Provider pricing](https://docs.railway.com/pricing/plans)

For an explicitly labeled local projection:

- CPU charge = measured CPU seconds / 60 × CPU-minute price
- memory charge = mean RSS bytes / 1,000,000,000 × observed minutes × RAM price
- egress charge = server TCP bytes written / 1,000,000,000 × egress price
- divide by observed hours and room count for a synthetic room-hour estimate

The decimal-GB conversion is explicit and conservative relative to binary GB.
These are raw usage estimates, not invoice totals or an incremental per-player
price. Server RSS is not provider container memory; laptop CPU time is not a
Railway CPU benchmark. TCP bytes exclude TLS and provider-network overhead.
Platform, PostgreSQL, browser worker, storage, build costs, idle time, plan
credits/minimums, and other projects are excluded. Different game payload sizes
or replication rates change egress directly. Never multiply peak concurrency
by a whole month and call that an expected hobby bill; report sustained-peak
and occasional-event scenarios separately, with those assumptions visible.

The baseline's sampled runtime averaged 0.45 CPU cores and 234 MB RSS; the burst
averaged 0.82 cores and 278 MB RSS. These are process observations on an M1 Pro,
not recommended Railway allocations. Across all phases peak RSS was 344 MB.
Baseline and burst resource windows cover 1,791.05 and 295.25 seconds; observer
phase tags can lag a child sample by up to the five-second sampling interval.

The raw synthetic usage projections are approximately **$0.89/hour for 100
active rooms** and **$1.76/hour for 200**, or about **$0.009 per active room-hour**.
Egress contributes about 98% at these payload sizes and frequencies. Ten rooms
playing for three hours would extrapolate to about $0.27 of this realtime usage;
that is an illustrative workload calculation, not the total event bill. A
constant 100-room peak for 30 days would instead project to about $637 before
the stated exclusions. It is not an expected hobby-month scenario. Idle and
light-use fixed hosting costs must come from actual provider observations.

## Published operating envelope and residual risks

For release planning, use **100 concurrent rooms / 400 controllers** as the
measured local sustained baseline, with a demonstrated five-minute burst to
**200 / 800**. These numbers describe this synthetic workload and machine, not
a universal game limit or a Railway sizing guarantee. The normal 300-room
admission ceiling is unchanged; latency at that ceiling did not meet the
strict profile. The recorded failed result remains authoritative.

The operational interpretation is deliberately narrow:

1. Existing gameplay survived the tested 12-second database outage; fresh
   admission was unavailable and recovered 4.4 seconds after restoration.
   Longer outages, process loss, and different failure modes are not proved
   by this drill.
2. Capacity rejection was explicit at room 301. During the database fault,
   one fresh caller instead reached its eight-second timeout. Do not promise
   that every dependency failure produces an immediate friendly response.
3. Nine usage writes failed during that outage. Retained-ledger rebuilding
   repairs projections, not missing events; analytics is not lossless under
   database failure.
4. At the observed traffic shape, realtime egress dominates variable cost.
   Use the estimates above for workload comparisons, and actual provider
   usage for budgets; neither signups nor the admission cap predicts the bill.
5. Observe latency, intake rejection, readiness, persistence failures, and
   resource/cost trends through the existing operational surfaces. A trend
   beyond this envelope warrants diagnosis and the existing pause/degradation
   controls, not an automatic budget increase or untested horizontal scaling.

`G3-05` publishes this evidence and its limitations; it does not accept residual
risk on the maintainer's behalf. The final exact-candidate rehearsal must still
verify the deployed service shape, coordinated host-authority changes, browser
experience, and real provider observations. Public launch remains a separate
go/no-go decision. No new scheduler, autoscaler, user permission prompt, or
lowered room cap is part of this closure.

## Final batch review and remaining delivery

The batch's one Canonicalizer session (`77728d61-7503-4f4c-bb81-3a05f6711d69`)
requested one consolidation: the older analytics test maintained a second
disposable database and manually split migration SQL. That helper is removed.
One neutral `tests/helpers/postgres-fixture.ts` now owns fresh migrated
databases, loopback validation, cleanup, and the fault proxy. The launch-only
wrapper seeds its own creator identities and budget; unrelated driver/analytics
tests do not pay for those seeds. The rebuilder uses the same fixture and
`AIR_JAM_TEST_DATABASE_URL`, eliminating the separate Docker/env/migrator path.
Explicit TypeScript inclusion of the launch scripts remains intentional so the
CLI entrypoint itself is checked, not only imported helpers.

After that test-infrastructure-only consolidation, 38 fixture/metrics unit
tests and 23 real PostgreSQL tests passed (18 driver, three concurrent ledger,
two rebuilder). The follow-up source smoke
`launch-load-20260912165050417-9c153b23` passed all phases, rejected room 301,
retained zero message loss, recovered fresh admission in 6,813 ms after a
12,155 ms outage, and disposed of its runtime and database. Its source hash
was unchanged at both ends:
`31692dfdb8c9b875e58d6484c9189925bad17aeb196a2e9ed55eab53cca3a5b8`.
The full-run artifact retains the earlier exact source hash; this narrower
follow-up does not pretend the 35-minute measurement was rerun on a new tree.

The same Canonicalizer session then returned **READY**. The full final
`pnpm check:batch` also passed after consolidation. No additional performance
threshold, application runtime mechanism, or compatibility layer was introduced
to obtain review closure.

- normal protected pull-request and reviewed delivery gates
- final launch risk judgment using the published bounded operating envelope,
  retaining the failed strict overload result
- exact-candidate deployed observation; local source measurement is not a
  Railway capacity, browser gameplay, or final host-grant integration proof

The full local `pnpm check:batch` now passes with the repaired driver installed;
database-dependent suites remain opt-in and are not counted as executed by
that ordinary gate. The targeted driver and usage PostgreSQL results above
are separate real-database evidence. A frozen-lockfile installation also
passed after the server dependency move.

`G3-04` closes the required honest drill, not the failed strict overload check
or a production rollout. This is concrete pre-launch
failure discovery and bounded repairs, not a new reliability architecture or a
claim that production has been fixed. Clean-registry candidate verification, real deployment image
builds, and production observation remain part of reviewed exact-candidate
delivery, not claims made by the source-level smoke.
