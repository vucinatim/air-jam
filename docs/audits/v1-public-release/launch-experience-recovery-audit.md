# Launch Experience Recovery Audit

Date: 2026-09-11
Readiness item: G6-07
Status: local implementation and validation; not merged or deployed

## Problem and scope

The first local homepage visit reported repeated catalog errors. The checkout
inherited an older remote database configuration without the now-required
separate hosted-game asset origin. That was a local environment mismatch, not
evidence of a production outage. More importantly, the UI treated a failed
catalog query as an empty catalog, so the page concealed the actual failure.

This pass fixes concrete newcomer and player recovery paths. It adds no service,
database table, room-permission model, or agent workflow policy.

## Changes

- Homepage and Arcade distinguish loading, empty, failed, and cached results.
  One shared notice offers retry; known games remain usable during a refresh
  failure. A failed fetch is not authoritative evidence that a reconnecting
  player's game has disappeared.
- Arcade cards have real, named launch buttons with keyboard support.
  Source, template, and creator controls remain independent. Hidden catalog
  controls are inert and their preview videos stop playing.
- Rejected automatic launches remain consumed instead of retrying on each
  render. Held controller input must be released before another launch attempt.
  The existing runtime reducer owns the failure state and explicit retry.
- Controllers explain missing rooms and failed joins, use the SDK's existing
  reconnect operation, and open the existing room menu for recovery. Transport
  jargon stays out of player copy. Successful joining still goes straight to
  the normal controller.
- An embedded controller announces loading, offers a soft delayed-load message
  after ten seconds, and can reload its iframe without leaving the room.
  Late attachment still clears that message; ten seconds is not a hard cutoff.
- Fullscreen prompting waits for a successful join. Room-menu copy no longer
  says someone has joined when they have not.
- Removed disabled landing-background plumbing; normal card previews remain.
- Removed the obsolete `Studio Soon` navigation and its dead rendering branches.
  The product's creation experience is the agent-operable harness, not a promised
  separate browser editor.
- Local database setup and hosted-catalog prerequisites are documented in the
  README and platform environment example.

## Local environment

The existing local database was ahead of this branch because it contained the
unmerged host-authority migration. It was preserved, not reset or downgraded.
A separate local database, `airjam_launch_experience_20260911`, was created on
the repo-owned Postgres instance and migrated to this branch's migration 0039.
The ignored root `.env.local` selects it; old service-local provider settings
were not overwritten. `platform database migration inspect --json` reports
`ready`, `compatible: true`, 40 applied migrations, and no pending/unknown ones.

Normal reference-game development does not need an artificial hosted-release
origin. Published-release testing still requires matching isolated storage,
database, and asset-origin configuration; security checks were not relaxed.

## Browser evidence

In-app browser, local `pnpm run dev`, Air Capture:

1. Homepage loaded without the original console errors after database isolation.
2. Direct Arcade navigation created a connected room and displayed the logo and
   local game. Enter on the named game button launched Air Capture.
3. `/controller` without a room displayed join guidance and opened the existing
   room-code form. A nonexistent code displayed `Room not found` with recovery.
4. Changing to the live room joined successfully. The normal phone-facing LAN
   URL attached the embedded controller and showed the real game lobby.
5. At a 390 × 844 phone viewport, lobby controls and the match button fitted
   the visible surface. This is viewport evidence, not physical-phone proof.
6. A simulated phone connection loss showed recovery feedback. Restoring the
   network automatically returned to the same room's game controller.
7. Blocking only the catalog request produced the shared failure notice on both
   homepage and direct Arcade navigation. Arcade retained its local game.
   Removing the fault and clicking retry cleared the notice.

One diagnostic attempt embedded a LAN game iframe inside a localhost controller
page; the browser blocked that document with `ERR_BLOCKED_BY_CLIENT`. The delayed
message and iframe reload were exercised there. Using the actual phone-facing
join URL loaded successfully. No browser security policy was disabled.

## Mechanical validation

- Implementation changed checks passed; one warm three-file check took 3.24s.
- The full batch passed generated-source checks, typechecking, lint, and
  canonical guards, but stopped at one realtime-admission integration failure.
  That file then passed all 8 tests, and the complete server suite passed
  162 tests with 20 database-dependent skips. The initial aggregate run is
  retained as a failure, not relabeled green. It was not reproduced in either
  rerun; the original cause is not established.
- The remaining SDK and platform stages were run explicitly: SDK 269 passed;
  platform 411 passed and 60 database-dependent skips. These include the new
  controller, catalog, homepage, navigation, and launch-state regressions.
- Database-dependent skips are not production database proof.
- The complete devtools-core suite passed 63 tests. The five workspace startup
  readiness regressions passed. Instant checks took 210–280ms.
- All 38 focused UI/runtime regressions passed. A separate TypeScript check of
  the new test entrypoints reported zero diagnostics (the normal platform
  typecheck excludes those tests).

## Agent attachment regression found during the same pass

Trying the existing semantic CLI against the browser's room uncovered a separate
cause of local disruption: `session open --room` started development processes
before attaching, replacing the stack that owned the requested room. Its
missing-room fallback then attempted to create a different isolated host.

Explicit room or controller-URL attachment now skips dev-process ownership and
never falls back to a replacement host. A stale target returns `Room not found`.
Implicit startup (no explicit target) retains its existing owned lifecycle.
This is an effect-boundary correction, not a new orchestration mechanism.

The live attach check also exposed two mismatches hidden by simplified test
fixtures: the replicated Arcade surface includes presentation fields that the
strict bridge identity schema intentionally rejects, and local catalog IDs
carry a prefix absent from source-game IDs. Devtools now validates the identity
projection and uses the shared local-reference mapping for source contract
discovery, while retaining the complete runtime identity for store addressing.
It does not select a contract by trusting the caller's requested game instead
of the room's actual game. Hosted identities and bridge validation stay intact.

Rebuilding the SDK during this check invalidated React contexts in the existing
hot-reloaded host. Refreshing the host, as required by the local dev-loop
agreement, reconnected the same room; this was not a production failure.

The first successful semantic action revealed slow request-correlated reads:
the host bridge mistook a state-sync payload containing `requestId` for its
optional envelope settings and removed the payload. Splitting now preserves
the event's required arguments before considering optional settings. Regression
tests distinguish the payload's correlation ID from the bridge envelope's ID.

After correlated reads worked, an action still waited eight seconds despite
committing correctly. The platform's action-RPC listener discarded the server
acknowledgement callback before invoking the existing bridge forwarder. Keeping
that typed callback restores the already-supported response path; no new RPC
or acknowledgement mechanism is introduced.

Final clean CLI lifecycle against the browser's Pong room:

- Explicit attach: 1.54s, no process ownership, seven discovered actions.
- Read: 1.33s, valid lobby state with no missing stores.
- `join_team`: host acknowledgement accepted and committed team/slot change
  observed. The invocation exceeded ten seconds wall time; background-browser
  latency is possible but unproven. This is correctness proof, not a claim of
  consistently fast action execution.
- Close: 0.23s. Missing-room rejection: 0.72s. Platform remained HTTP 200 and
  the broker had zero remaining sessions; attachment did not replace the stack.

Final targeted validation included eight attachment/Arcade tests, fifteen SDK
bridge tests, SDK typechecking and builds, SDK surface guards, and the platform
component regression for an acknowledgement round-trip exactly once. The new
component test also passed explicit test-root TypeScript validation.

## Workspace startup race

A fresh `pnpm run dev` exposed another local failure: the server imported SDK
chunks while the SDK watcher's initial build was still rewriting them. The
existing process group now waits for the SDK's successful JavaScript build
marker before starting its consumers together. There is no second build, retry
loop, or new supervisor. Tests cover ordering, split output, and early failures.
A real Pong startup then completed successfully, with SDK readiness preceding
server, platform, and game startup.

The subsequent homepage check reported no console errors or broken images and
no horizontal overflow at 390 × 844. Direct Arcade launch displayed Pong's real
lobby. These remain local browser checks, not production evidence.

## Canonicality review

The final canonicality pass requested two bounded consolidations. Catalog
failure is now explicit data, not inferred from whether a notice renders;
launch feedback has its own slot and cannot suppress a valid empty-catalog
state. One retry presentation serves both failure types. Both SDK bridges now
share one envelope splitter with explicit required-argument counts, retaining
payload correlation IDs. The corrections passed 30 targeted platform tests,
16 SDK bridge tests, and SDK typechecking. The SDK changed gate correctly
requested batch-level consumer validation; no push or delivery is claimed from
these focused checks.

Canonicalizer returned `ready` after these corrections in the same review
session, `0bcf58b8-2976-40b8-af68-b50b42712431`. A small pre-existing duplicate
identity projection remains an optional cleanup, not a release blocker. This
canonicality result is not a GitHub review or production delivery approval.

## Remaining release evidence

G6-07 stays in progress. This audit does not claim a complete cross-game,
physical-device, hosted-release, or creator publish-flow sign-off. Those remain
in the canonical release program, along with review and exact-candidate proof.
The existing stop-before-merge-and-deploy instruction remains in effect.
