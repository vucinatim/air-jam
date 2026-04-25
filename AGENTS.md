# Agent Contract

This file defines general engineering expectations for contributors and coding agents in this repository.

## Mission

Build and maintain a clean, minimal, and extensible codebase that can scale without unnecessary complexity.

## Ultimate Vision

Air Jam is not only a multiplayer game framework.

The long-term goal is for it to become an AI-native game creation and evaluation harness where a single prompt can drive the full lifecycle of building, testing, polishing, publishing, and iterating on a game.

The intended end state is:

1. a user can ask for a game at a very high level, such as "make a mario kart clone"
2. Air Jam Studio can orchestrate multiple specialized agents in parallel
3. different agents can own gameplay logic, assets, audio, music, UI, polish, balancing, testing, and release preparation
4. agents can run the game directly, inspect logs, inspect visuals, read authoritative runtime state, and control players without relying only on browser automation
5. the framework exposes clean machine-usable contracts for controller actions, state inspection, runtime events, visual feedback, and evaluation loops
6. the same contracts work for both human development and agent-driven development
7. the system keeps iterating until the game reaches a high level of finish and polish rather than stopping at a rough prototype

This vision has architectural consequences now:

1. runtime, transport, controller input, replicated state, signals, logs, and preview surfaces must stay explicit and machine-readable
2. behavior should be accessible through strong contracts rather than hidden in UI-only flows
3. local preview, hosted preview, runtime authority, analytics, and publish flows should converge on one coherent operating model
4. agent control surfaces should be treated as first-class future product requirements, not afterthought tooling

## Core Principles

1. Prefer simple, explicit solutions over clever abstractions.
2. Keep architecture modular and composable.
3. Prioritize long-term maintainability over short-term speed.
4. Avoid hacks that increase future complexity.
5. Refactor when needed instead of layering temporary fixes.
6. DO not assume we are building for backwards compatibility - we want to do full purge refactors when we can.

## Development Standards

1. Make small, focused changes with clear intent.
2. Preserve clear boundaries between core logic, transport/networking, and UI.
3. Keep behavior deterministic where practical.
4. Do not trust client input for authoritative decisions.
5. Add or update tests when behavior changes.
6. Keep public APIs and documentation aligned.

## Parallel Work Rule

When work is naturally separable, agents should use parallel execution by default rather than treating it as optional.

Preferred pattern:

1. do shared contract, API, schema, or architecture work centrally first
2. once the shared boundary is stable, split independent implementation work across parallel agents
3. use this especially for cross-game refactors, repeated game-by-game improvements, scaffold parity work, and other bounded repo slices with disjoint ownership
4. finish with one central integration pass for validation, fallout fixes, and final contract cleanup

Do not parallelize prematurely when the shared API or architecture is still moving, because that creates churn instead of speed.

## Quality Gates

Run relevant checks before considering work complete:

1. Type checking
2. Linting
3. Tests
4. Build validation

## Debugging Rule

When debugging uncertain behavior, inspect the unified dev log stream first.

Preferred order:

1. run `pnpm exec air-jam-server logs --view=signal`
2. narrow with `--trace`, `--room`, `--controller`, `--runtime`, `--process`, or `--source`
3. only add temporary ad hoc logging if the unified stream still leaves a real gap

Treat `.airjam/logs/dev-latest.ndjson` as the canonical local debugging stream for server, browser/runtime, platform/Arcade, and workspace-process stories.

## Chrome MCP Rule

When using Chrome DevTools MCP in this repository, always use the
`chrome-devtools-airjam` server.

Do not use any shared or other-project Chrome MCP server for this repo.
If the named server is unavailable, say so explicitly instead of silently
falling back to another Chrome DevTools server.

## Documentation Discipline

1. Keep long-term product direction in `docs/vision.md`.
2. Keep intended architecture in `docs/framework-paradigm.md`.
3. Keep the single active repo-wide execution ledger in `docs/work-ledger.md`.
4. Keep the durable follow-up backlog in `docs/suggestions.md`.
5. Keep monorepo workflow guidance in `docs/monorepo-operating-system.md`.
6. Keep navigation pointers in `docs/docs-index.md`.
7. Treat `docs/plans/*.md` as bounded system plans, not duplicate global trackers.
8. Move completed/superseded plan snapshots to `docs/archive/`.
9. Update docs in the same change when contracts or behavior change.

## Follow-Up Tracking Rule

1. Put current work and status changes in `docs/work-ledger.md`.
2. Put multi-step active tracks in `docs/plans/`.
3. Put only durable non-critical follow-ups in `docs/suggestions.md`.
4. Do not turn `docs/suggestions.md` into a second active task tracker.

## Decision Rule

When in doubt, choose the option that reduces complexity, keeps boundaries clear, and makes future changes easier.
