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

## Repo CLI Rule

When doing repo maintenance work, check `package.json` first for a dedicated
repo-native CLI before reaching for ad hoc commands or third-party CLIs.

In this repo, the canonical maintainer entrypoint is:

```bash
pnpm run repo -- --help
```

Use that surface to discover and prefer repo-owned operations when they exist.

For Railway work specifically, prefer the repo-native Railway toolkit over the
generic Railway CLI:

```bash
pnpm run repo -- railway --help
```

Current Railway helpers include:

1. `whoami`
2. `project`
3. `env`
4. `vars`

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

## Browser Testing Rule

When agents need to open, inspect, click through, or verify local Air Jam
surfaces, use the in-app browser through the internal `browser-use` feature.

Use that path for:

1. opening local host/controller/dashboard/release URLs
2. clicking through flows and verifying visible UI behavior
3. showing the user what is rendering in the actual browser surface

Keep that browser workflow as the canonical path for interactive local UI work in this repo.

## Local Agent Dev Loop Rule

For local Air Jam game/dev-loop work, use one normal front door:

```bash
pnpm run dev
```

Do not replace it with raw `vite`, and do not choose preview-specific dev commands for normal work. If a browser or preview tool wants to launch the app command itself, still give it `pnpm run dev`.

For visible controller UI smoke tests:

1. use the visible preview controllers in the browser surface
2. interact through real browser click, drag, and release gestures
3. do not synthesize pointer events into controller iframes from parent-page eval

For reliable gameplay, physics, scoring, reset, and state assertions:

1. use the semantic agent contract
2. use Air Jam MCP game-session actions such as `airjam.open_game_session`, `airjam.read_game_session`, `airjam.invoke_game_session_action`, and `airjam.close_game_session`
3. treat preview controllers as visual UI proof, not the primary automation lane

If local runtime state feels stale, first use status/log/reset tooling before debugging gameplay:

```bash
pnpm run status
pnpm run reset:local
pnpm exec air-jam-server logs --view=signal
```

After editing host-only runtime refs, physics loops, or `useHostActionListener` side effects, hard refresh the host or run `pnpm run reset:local` if actions appear duplicated or rendered state no longer matches replicated state.

Multiplayer games should be startable or ready-able from controllers. The host screen should not be the only place where play begins.

## Documentation Discipline

1. Keep long-term product direction in `docs/vision.md`.
2. Keep discoverability direction in `docs/discoverability-vision.md`.
3. Keep intended architecture in `docs/framework-paradigm.md`.
4. Keep the canonical quick current snapshot in `docs/current-state.md`.
5. Keep historical progress and milestone memory in `docs/work-ledger.md`.
6. Keep the stable repo operating system rules in `docs/working-agreements.md`.
7. Keep the durable follow-up backlog in `docs/suggestions.md`.
8. Keep monorepo workflow guidance in `docs/monorepo-operating-system.md`.
9. Keep navigation pointers in `docs/docs-index.md`.
10. Keep live doc taxonomy and naming rules centralized in `docs/documentation-taxonomy.md`.
11. Treat `docs/plans/*.md` as bounded system plans, not duplicate global trackers.
12. When a plan is meaningfully closed, superseded, or no longer governing current work, move it to `docs/archive/` before shifting focus to the next major track.
13. Archive plan snapshots with a date-first filename: `YYYY-MM-DD-semantic-name.md`.
14. Update docs in the same change when contracts or behavior change.

## Follow-Up Tracking Rule

1. Put the quick current repo snapshot in `docs/current-state.md`.
2. Put historical progress and phase-close notes in `docs/work-ledger.md`.
3. Put multi-step active tracks in `docs/plans/`.
4. Put only durable non-critical follow-ups in `docs/suggestions.md`.
5. Do not turn `docs/suggestions.md` into a second active task tracker.
6. Before moving to a different major track, archive any plan that has effectively finished or stopped governing current work.

## Decision Rule

When in doubt, choose the option that reduces complexity, keeps boundaries clear, and makes future changes easier.
