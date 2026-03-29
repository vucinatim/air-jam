# Air Jam Logging System Plan

Last updated: 2026-03-29

## Goal

Define one clean, canonical observability system for Air Jam that:

- keeps production logging professional and structured
- makes development debugging extremely fast
- gives both humans and LLMs one reliable place to inspect what happened
- avoids ad hoc console output and scattered debug files

The logging system should feel invisible during normal use and invaluable during debugging.

## Direction Decision

Air Jam should deliberately move further toward one canonical automatic development observability path.

That means:

- keep production logging simple and standard
- make development observability first-class and automatic
- treat server, host, controller, and embedded-runtime diagnostics as one system
- avoid pushing logging setup work onto game or platform developers

This is the right direction because Air Jam is a multi-surface runtime, not a single-process app.
When bugs cross server, host, controller, and iframe boundaries, fragmented logs become the complexity tax.
One canonical dev stream reduces that tax without turning the framework into a heavy ops platform.

## Current Foundation

The project already has the right starting pieces:

- structured server logs with Pino
- dev browser log sink posting logs back to the server
- host-session `traceId` propagated through server auth/lifecycle logs
- browser sink metadata carrying `traceId` once host bootstrap succeeds

This foundation is now implemented:

- server logs and browser logs are written into one canonical dev file
- the default file path is workspace-root stable: `.airjam/logs/dev-latest.ndjson`
- `traceId` correlates host bootstrap and lifecycle logs across browser and server
- a small CLI exists to tail and filter the canonical file: `pnpm dev:logs`
- a shared runtime event catalog now lives in `@air-jam/sdk/protocol` so server, browser collector, and tests use one canonical event vocabulary
- embedded host/controller bridge runtimes now emit canonical browser runtime events with `runtimeKind` and `runtimeEpoch`, so stale-epoch and handshake failures land in the same dev stream
- high-frequency server channels now emit compact summary events instead of requiring raw spam or manual guesswork
- disconnect-driven recovery edges now emit canonical lifecycle events for controller removal, child-host recovery, and room teardown
- the dev log CLI can filter entries by `controllerId`, `event`, `runtimeKind`, and `runtimeEpoch`
- canonical dev events now carry ordering metadata so append order, source event time, and per-session browser order are all explicit instead of conflated
- browser console entries now carry a canonical category (`airjam`, `app`, `framework`, `browser`) so query tools can separate framework/browser noise from useful runtime logs
- repeated browser console warnings are collapsed within the sink before transport instead of flooding the canonical file with identical short-burst duplicates
- `pnpm dev:logs` now supports a practical `--view=signal` mode that hides plumbing chatter and low-value framework/browser console noise
- repeated idle `controller.input.summary` windows are now suppressed once the signal stops changing, so long-running idle sessions do not dominate the stream

What remains is polish and broader coverage, not a logging-system rewrite.

## Real Session Findings

A real local host/controller/game session was reviewed against the canonical file and `pnpm dev:logs`.

The result was positive:

- the stream is now genuinely usable for debugging
- controller-scoped views are readable and coherent
- runtime epoch transitions, room lifecycle, and controller action flow are easy to follow
- the ordering model is doing its job and makes mixed browser/server ingest understandable

The main remaining issue is not missing architecture. It is signal-to-noise.

Observed strengths:

- `--controller`, `--room`, `--event`, `--runtime`, and `--epoch` already make the CLI useful in practice
- canonical lifecycle events are easy to scan
- high-frequency transport activity is much more understandable as summaries than as raw message spam
- dual timestamps plus sequence ids make browser/server merge behavior legible

Observed noise and ergonomics gaps were addressed in the next pass:

- browser console entries are now categorized so framework/browser noise is queryable and suppressible
- infrastructure events can be hidden via signal-oriented CLI filtering
- repeated idle controller summaries are suppressed once they stop carrying new information
- repeated browser-console warnings are coalesced before transport when they occur in short bursts

This means the current remaining work is refinement, not another core logging pass.

## Ordering Model

The canonical dev file is append-only by collector ingest order.

That is intentional. The file should preserve what the server learned and when it learned it.

To avoid fake chronology, each event now carries separate ordering fields:

- `time`: compatibility alias for `occurredAt`
- `occurredAt`: when the source says the event happened
- `ingestedAt`: when the dev collector accepted the event
- `sourceSeq`: monotonic sequence within one browser logging session
- `collectorSeq`: monotonic append order in the canonical file

The reading rule is:

1. `collectorSeq` explains raw file order
2. `occurredAt` plus `sourceSeq` explains browser-local event order
3. `traceId`, `roomId`, and `controllerId` explain correlation scope

This avoids pretending that one mixed-process file can always be read as a perfectly synchronized wall-clock timeline.

One additional real-world note matters here: browser and server clocks are not guaranteed to agree.

In a real session, browser/controller events were observed where `ingestedAt` was slightly earlier than `occurredAt`.
That is expected cross-device clock skew, not a collector bug.
The correct interpretation is:

- `collectorSeq` is append truth
- `occurredAt` is source-local event time
- `sourceSeq` is source-local ordering truth within a browser session

The system should continue to treat those as distinct concepts.

## Canonical Event Glossary

These are the main events developers should expect to use during day-to-day debugging.

- `host.bootstrap.verified`: the host runtime was authenticated and got a canonical `traceId`
- `host.create_room.accepted`: the host now owns a room
- `controller.join.accepted`: a controller successfully entered a room
- `controller.leave.accepted`: a controller exited normally through the explicit leave path
- `controller.disconnect.applied`: a controller disappeared implicitly and the server removed it from room state
- `system.launch_game.accepted`: the room moved from system focus toward game launch
- `child_host.join.accepted`: a game runtime joined as the active child host
- `embedded_game.activate.accepted`: the embedded-game activation path succeeded
- `runtime.embedded_bridge.requested`, `runtime.embedded_bridge.attached`, `runtime.embedded_bridge.rejected`: the embedded bridge handshake path from browser runtime to parent shell
- `controller.input.summary`: compact summary of forwarded controller input over a short dev window
- `controller.action_rpc.summary`: compact summary of forwarded controller action RPC traffic over a short dev window
- `host.state_sync.summary`: compact summary of forwarded host state sync traffic over a short dev window
- `child_host.disconnect.pending_system_focus`: the active child host disappeared and the server scheduled system-focus recovery
- `child_host.disconnect.system_focus_restored`: the scheduled child-host teardown completed and room focus moved back to the system host
- `host.disconnect.pending_room_close`: the master host disappeared and the server scheduled room teardown
- `host.disconnect.room_closed`: the room was actually torn down after the master host disconnect grace window elapsed

The intended reading model is simple:

1. lifecycle edges use accepted/rejected or pending/completed events
2. high-frequency channels use summary events
3. one `traceId` or `roomId` should be enough to follow the whole story

The next refinement target is equally simple:

1. infra events should stay available, but fade into the background
2. idle summary events should stop repeating when they no longer add information
3. browser console events should become easier to separate into app, framework, browser, and Air Jam internal categories

## Canonical Direction

Air Jam should have two deliberately different logging modes.

### 1. Production Logging

Production logging should stay simple and standard:

- structured Pino logs to stdout/stderr
- machine-readable JSON
- no browser log mirroring by default
- ready for container/platform log ingestion

This is the professional deployment path.

### 2. Development Observability

Development should have one canonical unified log stream:

- a single NDJSON file for the active dev run
- server logs and browser logs written into the same file
- one chronological stream
- reset/truncated when the server starts
- searchable by `traceId`, `roomId`, `socketId`, `controllerId`, `appIdHint`
- tail/filterable by `event`, `controllerId`, `runtimeKind`, and `runtimeEpoch` through `pnpm dev:logs`

This is the main debugging path for local work and LLM-assisted diagnosis.

The intended default local workflow should eventually have two practical reading modes:

- full fidelity: everything in the canonical stream
- signal view: hide plumbing chatter and show the events most developers actually need first

That signal-oriented view is now available through `pnpm dev:logs -- --view=signal`.

The intended default developer experience is:

1. run Air Jam locally
2. reproduce the issue
3. inspect exactly one canonical log stream

No extra SDK setup, custom sink wiring, or per-app logging ceremony should be required.

## AI-Native Contract

The unified dev log system is not just a maintainer convenience.

It should be treated as one of the core Air Jam framework features for human and agent workflows.

The intended contract is:

1. if a developer uses the standard Air Jam server in development, the collector is on by default
2. if a game uses the normal Air Jam session providers/runtime entry points in development, browser logs are mirrored automatically
3. the canonical local file is `.airjam/logs/dev-latest.ndjson`
4. that file is reset when the local Air Jam server process starts
5. developers and agents should be able to inspect the same stream either:
   1. by reading the file directly
   2. by using a supported CLI query/view command

This matters because Air Jam bugs often span:

1. server lifecycle
2. host runtime
3. controller runtime
4. embedded bridge/runtime edges

If agents are not explicitly taught that one canonical stream exists, they will fall back to:

1. random browser console output
2. one-surface debugging
3. ad hoc temporary logging
4. much slower diagnosis loops

That is exactly the failure mode Air Jam should prevent.

## Current Truth And Gaps

The current implementation is already close to the right shape.

What is true today:

1. the server collector is enabled by default outside production
2. the collector truncates `dev-latest.ndjson` on server startup
3. browser logs are shipped automatically through the standard SDK provider path
4. scaffolded games already use the standard server package by default
5. the monorepo has a practical log viewer via `pnpm dev:logs`

What is still incomplete:

1. scaffolded projects do not yet get an equally obvious `pnpm logs` path
2. the published server CLI does not yet expose the log viewer as a first-class command
3. the AI pack does not yet teach this system clearly enough
4. the public docs do not yet elevate this to a canonical Air Jam debugging workflow
5. scaffold validation does not yet prove the end-to-end sink behavior in a generated project

So the remaining work is not a logging-system rewrite.

It is productization and teaching.

## AI-Native Rollout Plan

The next implementation work should follow this order.

### Phase A: Freeze The Framework Contract

Goal:

1. make the observability model explicit before more docs or skills drift around it

Tasks:

1. define the canonical developer-facing contract in docs:
   1. the unified stream covers server + host + controller + runtime diagnostics
   2. the canonical file is `.airjam/logs/dev-latest.ndjson`
   3. the file resets on server restart
   4. direct file reads are valid
   5. CLI querying is the preferred ergonomic path when available
2. define the support boundary:
   1. standard server path
   2. standard SDK provider/runtime path
   3. non-production/dev default behavior
3. define the exceptions clearly:
   1. `--web-only`
   2. collector explicitly disabled
   3. custom server/runtime setups that bypass the standard path

Exit criteria:

1. docs stop describing this as a vague debugging helper
2. the feature is described as a first-class framework contract

### Phase B: Teach The Workflow Canonically

Goal:

1. ensure humans and LLMs both learn the same debugging path

Tasks:

1. add or expand a canonical public docs page for the unified dev log system
2. update the AI-native workflow docs to call out the log sink as part of the standard agent debugging loop
3. update the scaffold local docs pack so generated projects carry the same guidance offline
4. strengthen the `debug-and-test` skill so it explicitly teaches:
   1. when to inspect the unified file
   2. when to use the CLI
   3. that the file resets on server restart
   4. that direct file reads are valid
   5. that this should come before adding ad hoc logs
5. update `AGENTS.md` guidance so non-trivial debugging work consults the canonical log stream early

Exit criteria:

1. an agent opening a fresh Air Jam repo can discover this workflow locally without guesswork
2. the debugging guidance no longer relies on monorepo-only tribal knowledge

### Phase C: Productize The Access Surface

Goal:

1. make the unified log stream equally usable in scaffolded repos and in the monorepo

Tasks:

1. promote the existing log viewer into the published server CLI
2. support a first-class command shape such as:
   1. `air-jam-server logs`
   2. `air-jam-server logs --follow`
   3. `air-jam-server logs --trace=<id>`
3. add a scaffolded project script such as:
   1. `pnpm logs`
4. keep direct file access documented as the zero-dependency fallback
5. preserve the current filter model for:
   1. `traceId`
   2. `roomId`
   3. `controllerId`
   4. `event`
   5. `runtimeKind`
   6. `runtimeEpoch`
   7. `source`
   8. `level`

Exit criteria:

1. scaffold users do not need monorepo-specific commands to inspect logs
2. agents have one obvious ergonomic query path in generated projects

### Phase D: Validate The Scaffold Contract

Goal:

1. prove that generated projects actually receive the observability system we claim they do

Tasks:

1. add scaffold smoke coverage that verifies:
   1. the generated project contains the docs/skill guidance
   2. the generated project exposes the intended logs command
2. add an integration test for the published server CLI logs command
3. add an end-to-end scaffold test that:
   1. starts the generated dev server
   2. confirms `.airjam/logs/dev-latest.ndjson` is created
   3. confirms the file resets on server restart
4. keep the validation narrow and high-signal rather than building a heavy test harness

Exit criteria:

1. the observability contract is enforced by tests instead of trust
2. future template changes cannot silently break log access for generated projects

### Phase E: Future Hosted Integration

Goal:

1. keep the local-first model while enabling richer future tooling

Tasks:

1. keep local file and local CLI access as the default debugging path
2. later expose filtered observability queries to Studio/agent tools using the same canonical event model
3. avoid turning the local debugging story into a hosted dependency

Exit criteria:

1. local debugging remains self-contained
2. future hosted tooling layers on top of the same canonical event model instead of replacing it

## Design Principles

### One Canonical Dev File

The dev system should produce one primary file:

- `.airjam/logs/dev-latest.ndjson`

That file should be the default place to inspect local runtime behavior.

Optional archive files can exist later, but there should always be one obvious current file.

### One Common Log Shape

Both server and browser events should normalize into one shared dev log shape.

Example fields:

- `time`
- `level`
- `source`: `server` | `browser`
- `service`
- `component`
- `msg`
- `traceId`
- `roomId`
- `socketId`
- `controllerId`
- `appIdHint`
- `origin`
- `code`
- `data`
- `err`

The point is not perfect universal schema purity. The point is a stable, grep-friendly shape with consistent top-level fields.

### Trace-First Correlation

Traceability should be built around a few stable ids:

- `traceId` for host session lifecycle
- `roomId`
- `socketId`
- `controllerId`
- launch capability token fingerprint or id when relevant

The primary debugging experience should be:

1. find the failing message
2. copy the `traceId`
3. search the same file for the rest of the session

This should expand beyond the current host-first coverage. Controller and embedded-runtime paths should correlate just as cleanly.

### Dev-Only Browser Mirroring

Browser log mirroring is a dev observability feature, not a production logging feature.

That means:

- enabled by default in dev
- disabled by default in production
- never required for app/game logic
- safe to ignore in deployed games

### No App-Level Logging Ceremony

Games and platform views should not need to manually “set up logging” for the default experience.

The framework/runtime should do the right thing automatically in development.

The default rule should be:

- if a developer uses the standard Air Jam providers/runtime entry points in development, canonical local diagnostics are already on

That should include sane defaults for noise suppression.
Developers should not need to learn which internal events to mentally ignore before the stream becomes useful.

## Target Architecture

### Server Logger Boundary

Keep Pino as the canonical server logger.

The server logger should support:

- normal stdout structured logging
- optional secondary dev sink to unified file
- child loggers with structured bindings

The logger boundary should stay centralized in the server package.

### Dev Log Collector Service

Introduce one canonical dev log collector on the server side.

Responsibilities:

- own the active dev log file path
- truncate/reset the current file on server boot
- append normalized log events from both server and browser
- optionally maintain archive files later

This should replace the current split between browser-specific files and terminal-only server output for local debugging.

### Browser Log Sink

Keep the browser sink as a lightweight SDK/runtime feature.

Responsibilities:

- capture `console.*`
- capture `window.onerror`
- capture `unhandledrejection`
- capture Air Jam diagnostics
- forward structured batches to the server
- send `pagehide` / `beforeunload` through a tiny dedicated unload beacon endpoint instead of relying on the normal batch timer
- treat `visibilitychange -> hidden` as an extra unload attribution hint in development when browsers are inconsistent about unload lifecycle timing

The browser sink should not know about files. It should only know how to send structured events to the server collector.

### Automatic Runtime Instrumentation

Dev observability should attach at framework boundaries, not app boundaries.

That means:

- session providers auto-enable browser diagnostics in development
- session providers emit mount/unmount lifecycle events automatically
- host runtime auto-publishes host correlation context
- host outbound `host:state` / `host:state_sync` only emit when the active room is also the authoritative `registeredRoomId`
- host runtime emits socket connect/disconnect/connect-error and reconnect/create-room attempt events
- controller runtime auto-publishes controller correlation context
- controller runtime emits socket connect/disconnect/connect-error and join-attempt events, including room-source attribution
- embedded bridge/runtime layers log lifecycle edges automatically
- browser lifecycle edges like `pagehide` / `beforeunload` enter the canonical stream
- server handlers create scoped child loggers once and reuse them consistently

App code may still call `console.*`, but the default observability system should not depend on app authors remembering to do so.

### Event-First Schema

The unified log shape should keep `msg`, but also standardize stable event names.

Recommended core fields:

- `time`
- `level`
- `source`
- `component`
- `event`
- `msg`
- `traceId`
- `roomId`
- `controllerId`
- `socketId`
- `sessionId`
- `runtimeEpoch`
- `data`
- `err`

Stable `event` names are what make grep, tooling, and future lightweight viewers reliable.

The canonical source of truth for those names should live in a shared protocol-level catalog rather than scattered string literals in handlers and tests.

### Shared Dev Log File

The collector should write one canonical file:

- `.airjam/logs/dev-latest.ndjson`

Optional future files:

- `.airjam/logs/dev-archive/<timestamp>.ndjson`
- `.airjam/logs/browser-latest.ndjson` only if we intentionally keep legacy compatibility during migration

But the end state should emphasize one main file, not many.

## Phases

### Phase 1. Unify Dev Log Sink

Goal:

- move from separate server stdout + browser file behavior to one canonical dev file

Tasks:

- add a dev log collector service in `packages/server`
- reset `dev-latest.ndjson` on server startup
- normalize browser sink entries into shared dev schema
- duplicate server logs into the same dev collector file
- keep normal stdout logging intact

Exit criteria:

- one local server run produces one canonical file with both server and browser events
- file is reset at server boot
- `traceId` links browser and server entries for one host session

Status:

- completed

### Phase 2. Tighten Log Shape

Goal:

- ensure the unified file is actually pleasant to read and search

Tasks:

- define stable top-level fields
- normalize server-origin and browser-origin entries
- redact sensitive values consistently
- keep nested payloads in `data` or `err`, not scattered randomly

Exit criteria:

- grep/search feels obvious
- repeated fields appear consistently
- log entries are readable without guessing the source subsystem

Status:

- completed enough for release use

### Phase 3. Improve Auth and Lifecycle Coverage

Goal:

- make security and session behavior especially easy to diagnose

Tasks:

- ensure auth/bootstrap failures always log clearly
- ensure host lifecycle transitions always carry `traceId`
- ensure browser diagnostics include the same `traceId` when available
- log room/game lifecycle edges consistently

Exit criteria:

- one failed bootstrap can be diagnosed from the unified file alone
- one reconnect/launch/close sequence can be followed by `traceId`

Status:

- completed for current auth and host lifecycle paths

### Phase 4. Add Developer-Friendly Access

Goal:

- make the log system even easier to consume without weakening the architecture

Tasks:

- optionally add a tiny local CLI/helper to tail or pretty-print `dev-latest.ndjson`
- optionally add a tiny debug overlay showing current `traceId`
- document the canonical file path in README/docs

Exit criteria:

- developers know exactly where to look
- LLM debugging can rely on one stable file path

Status:

- partially completed
- `pnpm dev:logs` and the canonical file path are in place
- optional overlay/debug UI remains future polish

### Phase 5. Complete Runtime Coverage

Goal:

- make the unified dev stream trustworthy across the full runtime, not just host bootstrap and browser console capture

Tasks:

- add structured server logs for controller join/leave/update/reject paths
- add structured server logs for realtime routing failures and important accepted transitions
- log bridge attach/detach/reject flows consistently
- ensure room/game lifecycle edges carry the same correlation fields

Exit criteria:

- controller, host, and bridge failures can be diagnosed from the canonical file alone
- common server-side silent failures no longer require source inspection to explain

Status:

- not started

### Phase 6. Finish Correlation Propagation

Goal:

- make correlation automatic across all Air Jam surfaces

Tasks:

- keep host `traceId` propagation as the baseline path
- introduce controller-side correlation context where missing
- include surface/runtime epoch identity for embedded runtime debugging
- standardize child logger bindings for `traceId`, `roomId`, `controllerId`, and `socketId`

Exit criteria:

- one developer can pivot from one event into the full cross-surface flow without guesswork
- host-only and controller-only sessions both have strong correlation coverage

Status:

- partially completed
- host correlation is in place
- controller/runtime-epoch correlation still needs canonical coverage

### Phase 7. Reduce Noise Without Losing Signal

Goal:

- keep the dev log canonical and useful without turning it into input spam

Tasks:

- avoid raw per-frame input logging by default
- summarize noisy channels where needed
- keep accepted/rejected lifecycle edges and failures explicit
- document what is intentionally not logged at full fidelity

Exit criteria:

- the canonical file stays readable during active multiplayer sessions
- the default stream remains high-signal for both humans and LLMs

Status:

- not started

## Naming and Structure Rules

### Public Terms

Use clear terms:

- `logger`
- `log collector`
- `browser log sink`
- `traceId`
- `dev-latest.ndjson`

Avoid overly technical or implementation-history names.

### File Structure

Recommended structure:

- `packages/server/src/logging/`
  - `logger.ts`
  - `dev-log-collector.ts`
- `packages/server/src/dev/`
  - browser log request plumbing only if still useful
- `packages/sdk/src/dev/`
  - browser log sink runtime

The collector should eventually live conceptually with logging, not as a random dev utility.

## Quality Bar

The finished logging system should satisfy all of these:

- one obvious dev log file
- structured logs, not ad hoc strings
- `traceId`-based correlation
- browser and server logs share one timeline
- host, controller, and bridge/runtime paths share one correlation model
- production logging stays clean and standard
- dev tooling stays optional and invisible to game code
- no secrets/raw sensitive values dumped casually

## Anti-Goals

Do not turn this into:

- a heavy production tracing platform
- a UI-first observability rewrite
- a replacement for platform log ingestion
- a requirement for games to manually configure logging
- a giant SDK logging configuration surface
- a per-event firehose of controller input noise

The system should stay small, sharp, and local-first.

## Current Next Step

The next concrete implementation slice should be:

1. add the canonical public docs page for the unified dev log system
2. update the scaffold AI pack and `debug-and-test` skill to teach it explicitly
3. promote the log viewer into the published server CLI
4. add a scaffold `pnpm logs` script

That is now the highest-value next step because the underlying collector path already exists.
