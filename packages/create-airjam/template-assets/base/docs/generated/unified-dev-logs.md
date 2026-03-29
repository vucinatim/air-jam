<!-- Generated from content/docs/getting-started/dev-logs/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/getting-started/dev-logs -->

# Unified Dev Logs

Air Jam has one canonical local observability stream for development:

- server logs
- host runtime logs
- controller runtime logs
- embedded runtime diagnostics
- local dev-runner tool output such as Vite and other child-process failures

That stream exists so you do not have to debug each surface in isolation.

## Canonical File

The canonical file is:

```text
.airjam/logs/dev-latest.ndjson
```

This file is:

1. local-first
2. append-only for the current server run
3. reset when the Air Jam server process starts

That means it is the right place to inspect:

1. room lifecycle
2. host bootstrap and reconnect
3. controller join and disconnect flow
4. browser/runtime diagnostics that were mirrored back to the server

## What Writes Into It

During normal Air Jam development:

1. the Air Jam server writes structured server events into the file
2. the SDK browser log sink mirrors host and controller browser/runtime logs into the same file
3. the standard dev runners mirror local child-process output into the same file as `workspace` events

If you use the standard Air Jam server and standard SDK session providers in development, this happens automatically.

No extra logging setup should be required for the normal path.

## When It Resets

The file resets when the Air Jam server process starts.

That gives you a clean current-session stream by default.

One nuance matters:

If your dev workflow reuses an already-running local server process, the file will not reset until that server actually restarts.

### 1. Preferred: CLI Querying

If the project exposes the log viewer command, use it first.

Examples:

```bash
pnpm logs
pnpm logs -- --follow
pnpm logs -- --trace=host_abc123
pnpm logs -- --source=browser --level=warn
pnpm logs -- --view=signal --room=ROOM1
```

The exact command may vary slightly by repo, but the intended Air Jam workflow is:

1. query the canonical stream with filters
2. narrow to the failing trace, room, controller, or runtime
3. only add custom logging if the stream still does not explain the issue

### 2. Fallback: Read The File Directly

Direct file reads are also valid.

That is useful when:

1. the repo does not yet expose the convenience CLI
2. you are using your own tooling
3. an LLM or script wants the raw NDJSON stream

## Best Filters

The most useful filters are:

1. `traceId` for one host session story
2. `roomId` for one multiplayer room
3. `controllerId` for one player/controller path
4. `event` for one lifecycle edge
5. `runtimeKind` and `runtimeEpoch` for embedded bridge/runtime issues

In practice, the fastest loop is usually:

1. reproduce the issue
2. find the relevant `traceId`, `roomId`, or `controllerId`
3. inspect the rest of the stream through that lens

## Which Identifier To Reach For First

Use the narrowest identifier that matches the failure:

1. use `traceId` when the problem is mainly one host session story:
   host bootstrap, reconnect, room ownership, launch flow
2. use `roomId` when multiple surfaces are involved in one room and you want the whole multiplayer story
3. use `controllerId` when one player path is failing:
   join, disconnect, input, action RPC, targeted controller feedback
4. use `runtimeKind` and `runtimeEpoch` when debugging embedded bridge/runtime activation problems
5. use `event` when you already know the lifecycle edge you are hunting

If you are unsure, start with `roomId` or `traceId` and then narrow further.

## Signal View Vs Raw NDJSON

Use `--view=signal` when:

1. you want the fastest first read of the session
2. you care about lifecycle edges, accepted/rejected outcomes, and high-signal runtime events
3. you want to suppress low-value framework/browser console noise

Read raw NDJSON or use broader CLI filters when:

1. you need exact append order
2. you need the full event payloads and metadata
3. you suspect the hidden plumbing events are part of the problem
4. you are doing deeper agent/script analysis over the stream

The practical rule is:

1. start with `pnpm logs -- --view=signal`
2. narrow with `--trace`, `--room`, `--controller`, or `--runtime`
3. fall back to raw NDJSON only when the signal view is still insufficient

## Recommended Debug Order

When something breaks:

1. inspect the canonical dev log stream first
2. use SDK diagnostics second
3. add temporary custom logs only if the canonical stream still leaves a gap

Do not default to scattered `console.log` calls across host, controller, and server code.

Air Jam is specifically designed to avoid that debugging style.

## Important Exceptions

The automatic unified stream depends on the standard development path.

You should not assume full automatic coverage when:

1. running `--web-only` without a local Air Jam server
2. disabling the collector explicitly
3. replacing the standard server/runtime path with custom infrastructure
4. bypassing the standard dev runner and launching tools outside the Air Jam scripts

## Related Docs

1. [Debugging and Logs](./debugging-and-logs.md)
2. [For Agents](./for-agents.md)
3. [Host System](./host-system.md)
