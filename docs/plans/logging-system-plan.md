# Air Jam Logging System Plan

## Goal

Define one clean, canonical observability system for Air Jam that:

- keeps production logging professional and structured
- makes development debugging extremely fast
- gives both humans and LLMs one reliable place to inspect what happened
- avoids ad hoc console output and scattered debug files

The logging system should feel invisible during normal use and invaluable during debugging.

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

What remains is polish and broader coverage, not a logging-system rewrite.

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

This is the main debugging path for local work and LLM-assisted diagnosis.

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

The browser sink should not know about files. It should only know how to send structured events to the server collector.

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
- production logging stays clean and standard
- dev tooling stays optional and invisible to game code
- no secrets/raw sensitive values dumped casually

## Anti-Goals

Do not turn this into:

- a heavy production tracing platform
- a UI-first observability rewrite
- a replacement for platform log ingestion
- a requirement for games to manually configure logging

The system should stay small, sharp, and local-first.

## Current Next Step

Use the unified file to fix the actual runtime issues it exposes.

Near-term follow-up is small:

- add more coverage for controller-side routing/security logs if needed
- optionally add a tiny in-browser debug overlay for current `traceId`
- keep the schema disciplined as new log sources are added
