# Prerelease Agent Dev Loop Hardening Plan

Last updated: 2026-05-02  
Status: active prerelease hardening, core startup/agent-guidance slice landed

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Agent Control System Rewrite Plan](./agent-control-system-rewrite-plan.md)
3. [Air Jam MCP And Agent Devtools Plan](./air-jam-mcp-and-agent-devtools-plan.md)
4. [SDK Game Authoring Ergonomics Plan](./sdk-game-authoring-ergonomics-plan.md)
5. [AI-Native Development Workflow](../systems/ai-native-development-workflow.md)
6. [Harness Visual Contract](../systems/harness-visual-contract.md)

## Purpose

Make the prerelease local development loop obvious and reliable for both humans and coding agents.

The desired prerelease experience is:

```text
pnpm run dev
open the host preview
use visible preview controllers for UI smoke proof
use the agent contract for reliable gameplay proof
reset local state with one command when the runtime gets weird
```

This plan is intentionally not a broad agent-control rewrite. It is a focused cleanup pass for the exact friction surfaced by the recent external one-shot game-development test.

## Core Decision

Air Jam local development should expose one normal front door:

```bash
pnpm run dev
```

`dev:preview` should not be part of the normal scaffolded or documented happy path. If a preview-specific compatibility mode remains internally, it must not create a hidden detached backend that survives the foreground preview process and later causes stale runtime ownership failures.

## Non-Goals

Do not build these before prerelease:

1. a full preview-controller gesture bridge
2. MCP tools like `preview_controller_drag` or `preview_controller_click`
3. a controller iframe geometry API
4. a full multi-controller visual automation framework
5. a new special dev loop only for one external agent client

Those are valid future product ideas, but they are too large for this prerelease hardening pass.

## Current Diagnosis

### 1. The Local Dev Story Has Too Many Doors

Agents can encounter several similar launch paths:

1. `pnpm run dev`
2. `pnpm run dev:preview`
3. MCP `airjam.start_dev`
4. browser-preview launch config
5. direct `vite` fallback

The result is that agents spend time choosing a launch path instead of building and testing the game.

### 2. Hidden Background Servers Create Stale Runtime State

The preview-managed path can start a detached `air-jam-server` on port `4000`. If the foreground browser/preview process stops but the detached backend remains alive, the next normal dev run can silently reuse stale state.

This creates confusing failures such as:

1. runtime ownership lease timeouts
2. host sessions that belong to old browser tabs
3. `airjam.status` showing no managed process while port `4000` is still occupied
4. manual `lsof` / kill cycles becoming the recovery path

### 3. Preview Controllers Are Human-Trustworthy But Agent-Awkward

Preview controllers are real controller routes embedded in the visible host page. They are good for humans and for visual smoke testing.

The agent problem is narrower:

1. some tools run JavaScript in the parent page and try to synthesize pointer events into the iframe
2. synthetic pointer events can fail around `setPointerCapture`, iframe boundaries, and React batching
3. this makes fake-event interaction unreliable even when real mouse interaction works

Prerelease guidance should tell agents to use real browser click/drag gestures for visible controller UI smoke tests and avoid synthetic pointer-event injection. For reliable gameplay assertions, agents should use the semantic agent contract.

### 4. Controller Source UI Is Too Split

Phone controllers, preview controllers, and virtual/agent controllers should be one room-controller roster with source metadata.

The product model should be:

```text
controller = participant endpoint
source = badge
```

not separate UI buckets that make agent, preview, and phone controllers feel unrelated.

### 5. Host-Only Dev State Can Become Confusing Under HMR

Games can combine replicated state with host-only refs for physics/runtime state. HMR can then create confusing half-reset states, especially when host action listeners or host-only refs survive differently from replicated state.

This is not necessarily a release blocker, but the dev loop needs either a fix or a clear reset story.

## Prerelease Workstreams

## Current Progress

Landed in the first implementation slice:

1. generated projects now present `pnpm run dev` as the single normal local launch path
2. `dev:preview` is removed from scaffolded `package.json` output and de-emphasized as advanced/internal where it still exists
3. generated `AGENTS.md`, `CLAUDE.md`, first-read docs, and MCP skill guidance now explain the intended split:
   - visible preview controllers for real click/drag/release UI smoke proof
   - semantic agent contract for reliable gameplay, physics, scoring, reset, and state assertions
4. `airjam status` and MCP `airjam.status` now expose unmanaged listeners on known local Air Jam ports
5. `airjam reset local` and MCP `airjam.reset_local` provide one best-effort cleanup path for stale local dev state
6. dev startup reuse warnings now include owner PID/age/command context
7. early log reads now return a "logs not ready yet" message instead of treating a missing log file as a hard failure
8. session/bootstrap errors now point agents at status/reset and distinguish missing host/bootstrap state from stale lease suspicion more clearly
9. the preview controller dock now presents phone, preview, and virtual/agent controllers as one roster with source badges and row-level controls
10. generated guidance now tells agents to hard refresh or reset after host-only runtime, physics, or `useHostActionListener` edits if HMR creates duplicated effects or half-state
11. the SDK package validation caveat from this slice is cleared; SDK source and test typechecks now pass alongside the SDK runtime test suite
12. the packaged minimal scaffold already ships a wired `src/game/contracts/agent.ts` semantic contract, and create-airjam CLI tests now cover the new `status` and `reset local` recovery command help surfaces
13. devtools-core now has direct coverage proving status reports unmanaged known-port listeners and `resetLocalDev` stops a likely stale local dev listener through an isolated test port, without touching real `4000`/`5173` processes
14. the repo root now carries the same concrete local agent workflow through `AGENTS.md` and `CLAUDE.md`, so external agents testing this repo get the one-command dev path, preview-controller guidance, semantic-contract guidance, and reset/log recovery path before reading generated-template docs

## Workstream 1. One Dev Command

Goal: remove ambiguous launch paths from the normal generated-project experience.

Tasks:

1. remove `dev:preview` from newly scaffolded project `package.json` output, or keep it only as a clearly deprecated compatibility alias
2. update generated docs and agent instructions to make `pnpm run dev` the only normal local launch command
3. update Claude/browser-tool guidance so external preview tools also launch `pnpm run dev`
4. ensure no docs recommend raw `vite` for Air Jam projects
5. if preview-managed mode remains, document it as internal/advanced only

Acceptance:

1. a generated project points agents to exactly one normal dev command
2. an agent reading only `AGENTS.md` and the first-read docs will not choose `dev:preview`
3. browser preview launch configs, if shipped, use `pnpm run dev`

## Workstream 2. Stale Runtime Detection And Reset

Goal: make dirty local runtime state visible and recoverable without manual port surgery.

Tasks:

1. make `airjam.status` report known unmanaged listeners on local Air Jam ports such as `4000` and `5173`
2. include PID, command, age, and cwd where available
3. make normal dev startup print a loud diagnostic when reusing an existing backend
4. add a local reset command, such as `airjam reset local`
5. reset should stop managed dev processes, stale known-port listeners, and preview-managed leftovers
6. make reset best-effort but explicit about what it stopped and what remains

Acceptance:

1. stale `air-jam-server` on `4000` is visible through Air Jam tooling
2. a user or agent can recover with one Air Jam command
3. normal dev startup no longer silently adopts an old backend without useful process context

## Workstream 3. Clear Session And Lease Errors

Goal: make agent-session failures actionable.

Tasks:

1. split `open_game_session` errors into distinct causes:
   - no host room/page is active
   - join URL cannot be resolved
   - room closed while connecting
   - runtime or harness lease is held elsewhere
2. include likely owner process/session details when available
3. point failures at `airjam.status`, reset, and canonical logs
4. avoid generic "another session may own the lease" messages when the actual issue is missing host state

Acceptance:

1. agents can choose the next recovery step from the error message alone
2. stale-process failures and no-host failures no longer look identical

## Workstream 4. Agent Instructions And Client Guidance

Goal: teach agents the intended control split before they improvise.

Tasks:

1. update generated `AGENTS.md` with the local dev and controller-testing rules
2. add or update a short first-read agent workflow doc
3. add Claude-specific guidance if useful, such as `CLAUDE.md` or `.claude/` files
4. if a `.claude/launch.json` is added, make it launch `pnpm run dev` and open the host URL
5. explicitly instruct agents:
   - use real browser clicks/drags for visible preview-controller smoke tests
   - do not synthesize pointer events into controller iframes
   - use semantic `agent` actions for reliable gameplay, physics, scoring, reset, and state assertions
   - use logs/status/reset before debugging gameplay
6. add the controller-owned start rule:
   - multiplayer games must be startable or ready-able from controllers
   - the host should not be the only place where play begins

Acceptance:

1. agents get the intended workflow from project-local instructions
2. external agents are less likely to fight iframe event synthesis
3. generated games default toward controller-owned starts and semantic test seams

## Workstream 5. Minimal Template Agent Contract

Goal: make the semantic agent seam present from the smallest generated project.

Tasks:

1. ensure the minimal template ships `src/game/contracts/agent.ts`
2. wire the contract through `src/airjam.config.ts`
3. include a tiny snapshot projection
4. include at least one participant action and one host/reset/staging action if the template behavior justifies it
5. keep the example intentionally small so agents extend it instead of copying a large pattern blindly

Acceptance:

1. a fresh minimal project has a working semantic contract
2. `open_game_session`, `read_game_session`, and `invoke_game_session_action` are discoverable immediately
3. the example teaches the intended pattern without bloating the starter

## Workstream 6. Preview Controller Roster Polish

Goal: make all controller sources legible in one UI.

Tasks:

1. show phone, preview, and agent/virtual controllers in one room-controller roster
2. render source badges for `Phone`, `Preview`, and `Agent`
3. show disconnected/stale/resume-lease state where relevant
4. provide consistent remove/kick controls for each controller row
5. avoid separate visual buckets that imply agent controllers and preview controllers are different product concepts
6. add stable test ids and data attributes for preview windows, iframes, roster rows, controller ids, and source badges

Acceptance:

1. the host UI reads as one coherent local control panel
2. agents and humans can identify which controller is which
3. every controller source can be removed from the room through the same recovery affordance

## Workstream 7. HMR And Host Listener Cleanup

Goal: reduce confusing dev-only half-state during iterative game building.

Tasks:

1. investigate `useHostActionListener` behavior across HMR
2. prevent duplicated listener registrations after hot updates where practical
3. document or implement a clean reset path for host-only refs when host runtime code changes
4. prefer local reset/hard refresh instructions over risky broad runtime rewrites before prerelease

Acceptance:

1. repeated HMR no longer creates obvious duplicate host action effects
2. if a full fix is risky, agent docs tell builders when to reset after runtime/physics edits

## Workstream 8. Logs And Diagnostics Polish

Goal: make canonical logs easier to use during the first seconds of dev startup and during failures.

Tasks:

1. make log reads fail gracefully when `dev-latest.ndjson` is not ready yet
2. return a "logs not ready, retry shortly" style message instead of an opaque error
3. include canonical log commands in relevant runtime/session errors
4. preserve the unified log stream as the first debugging surface

Acceptance:

1. agents do not treat early log-read failure as a game bug
2. error messages point to the same canonical log path and command vocabulary

## Cut Line For Prerelease

The prerelease-critical subset is:

1. Workstream 1: one dev command
2. Workstream 2: stale runtime detection and reset
3. Workstream 3: clearer session/lease errors
4. Workstream 4: agent instructions and client guidance
5. Workstream 5: minimal template contract, if not already complete in the current branch

Workstreams 6 through 8 are high-value but may be split if the prerelease schedule tightens.

## Future Follow-Up

After prerelease, consider a real preview-controller automation layer:

1. preview-controller gesture helpers
2. controller-local coordinate conversion
3. visible multi-controller browser driving
4. MCP/browser helper APIs for `click`, `drag`, and `screenshot` inside controller windows

That future work should be treated as product architecture, not a prerelease patch.
