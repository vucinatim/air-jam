# Framework Usage Review

Date: 2026-03-21  
Scope: `../../zerodays/air-jam-games/last-band-standing`, `../../zerodays/air-jam-games/code-review`

## Why this review

These two games were vibecoded with minimal framework internals knowledge, so they are strong signals for how developers and LLMs interpret the SDK in practice.

## Executive Summary

The framework works functionally, but the host/controller shell contract is still ambiguous.  
That ambiguity leads to duplicated wiring and brittle CSS hacks in real projects.

Main conclusion: prioritize shell/headless API clarity and composability over adding more features first.

## Findings (Severity Ordered)

### P1: Custom UI currently requires brittle CSS hacks against shell internals

Evidence:
- `code-review` hides shell internals using selector-level hacks:
  - `../../zerodays/air-jam-games/code-review/src/index.css:33`
  - `../../zerodays/air-jam-games/code-review/src/index.css:37`
- `last-band-standing` uses deep, fragile selectors against current DOM structure:
  - `../../zerodays/air-jam-games/last-band-standing/src/index.css:31`
  - `../../zerodays/air-jam-games/last-band-standing/src/index.css:33`

Impact:
- Shell DOM/class changes can break existing games unexpectedly.
- Encourages copy-paste workaround patterns.

### P1: SDK currently encourages duplicated host lifecycle wiring

Evidence:
- `HostShell` calls `useAirJamHost()` internally:
  - `packages/sdk/src/components/host-shell.tsx:37`
- Games also call `useAirJamHost()` in host views:
  - `../../zerodays/air-jam-games/last-band-standing/src/host-view.tsx:21`
  - `../../zerodays/air-jam-games/code-review/src/host-view.tsx:254`
- Host connection/listener registration happens inside hook effect:
  - `packages/sdk/src/hooks/use-air-jam-host.ts:429`

Impact:
- Duplicate listeners/registration risk in real-world usage patterns.
- Developers cannot clearly tell when to use `HostShell` vs hook-only mode.

### P2: Hook return shape invites unstable effect dependencies

Evidence:
- Vibecoded games use whole object dependencies:
  - `../../zerodays/air-jam-games/code-review/src/host-view.tsx:1228` (`[host, ...]`)
  - `../../zerodays/air-jam-games/code-review/src/controller-view.tsx:148` (`[controller, ...]`)
- Hook returns are object literals, not memoized API objects:
  - `packages/sdk/src/hooks/use-air-jam-host.ts:653`
  - `packages/sdk/src/hooks/use-air-jam-controller.ts:594`

Impact:
- Easy to accidentally resubscribe loops/effects.
- LLM-generated code frequently falls into this pattern.

### P2: Host chrome is often rebuilt manually because shell is not composable enough

Evidence:
- `code-review` implements custom paused overlay, join URL copy/open, QR generation, player list:
  - `../../zerodays/air-jam-games/code-review/src/host-view.tsx:302`
  - `../../zerodays/air-jam-games/code-review/src/host-view.tsx:1274`
- Same responsibilities already exist in SDK shell:
  - `packages/sdk/src/components/host-shell.tsx:215`

Impact:
- Reimplementation and divergence across games.
- Inconsistent UX and duplicated maintenance burden.

### P2: Docs/templates reinforce the ambiguous pattern

Evidence:
- SDK docs and templates show `useAirJamHost()` + `<HostShell>` together:
  - `packages/sdk/README.md:41`
  - `packages/create-airjam/templates/pong/airjam-docs/getting-started/introduction/page.md:57`
  - `packages/create-airjam/templates/pong/src/host-view.tsx:18`

Impact:
- Current guidance normalizes patterns that create the issues above.

## What to tighten now (before broader launch traffic)

1. Define two explicit modes in docs:
   - `Full Shell Mode`: use shell defaults.
   - `Headless Mode`: no shell UI, hooks only.
2. Add shell-level toggles to remove need for CSS hacks:
   - Host: top bar/paused overlay visibility toggles.
   - Controller: header/padding visibility toggles.
3. Update examples/templates to one canonical pattern per mode.
4. Add hook dependency guidance:
   - Never use full `host`/`controller` objects as effect dependencies.
   - Prefer field-level deps or stable hook helpers (`useGetInput`, `useSendSignal`).

## What can be deferred

1. Full host-shell component decomposition into many primitives.
2. Major API redesign around host initialization semantics.
3. Any new optional shell features beyond composability/stability basics.

## Proposed SDK Direction (Clean, Minimal, Extensible)

1. Keep existing shells for fast onboarding.
2. Make shells configurable enough to avoid CSS hacks.
3. Keep hooks as core headless primitives.
4. Ensure docs make the contract unambiguous and composable.

This preserves simple defaults while supporting professional custom UIs without brittle workarounds.

## Addendum: Prototype + The Office Audit

Date: 2026-03-21  
Scope: `apps/prototype-game`, `../../zerodays/air-jam-games/the-office`

### Additional Findings (Severity Ordered)

### P1: `the-office` has mixed time sources (`requestAnimationFrame` time vs `Date.now`) in core game/task logic

Evidence:
- `GameCanvas` passes RAF timestamp (`currentTime`) into game update:
  - `../../zerodays/air-jam-games/the-office/src/components/game-canvas.tsx:453`
- `updateGame` uses that `currentTime` against `gameStartTime` (epoch ms from `Date.now()`):
  - `../../zerodays/air-jam-games/the-office/src/hooks/use-game-state.ts:567`
- `TaskManager.update(currentTime)` also uses RAF time, but task `spawnTime` is set with `Date.now()`:
  - `../../zerodays/air-jam-games/the-office/src/task-manager.ts:336`
  - `../../zerodays/air-jam-games/the-office/src/task-manager.ts:378`

Impact:
- Task expiry logic is inconsistent and can fail (tasks effectively never expire).
- Game-duration timeout check is inconsistent and can fail (timer-based end condition can be broken).

Required tightening:
- Standardize on a single timebase (prefer `performance.now()` / RAF time everywhere in loop logic), or pass `Date.now()` consistently everywhere.

### P1: `the-office` still relies on invasive shell-theme hacks

Evidence:
- Host side polling DOM with selector hacks to remove shell dark mode:
  - `../../zerodays/air-jam-games/the-office/src/host-view.tsx:47`
  - `../../zerodays/air-jam-games/the-office/src/host-view.tsx:50`
- Controller side uses a global `MutationObserver` to strip `.dark` classes:
  - `../../zerodays/air-jam-games/the-office/src/controller-view.tsx:17`
  - `../../zerodays/air-jam-games/the-office/src/controller-view.tsx:61`

Impact:
- Fragile against SDK internals.
- Higher runtime overhead and hard-to-debug visual side effects.

### P1: `prototype-game` has event listener cleanup mismatch in controller sound subscription

Evidence:
- Listener is attached via inline callback:
  - `apps/prototype-game/src/routes/controller-view.tsx:184`
- Cleanup attempts to remove a different function reference (`handlePlaySound`):
  - `apps/prototype-game/src/routes/controller-view.tsx:179`
  - `apps/prototype-game/src/routes/controller-view.tsx:192`

Impact:
- Leaked listeners across remount/reconnect cycles.
- Duplicate sound playback over time.

### P2: Unstable object dependencies appear again in `the-office`

Evidence:
- Host `getInput` callback depends on whole `host` object:
  - `../../zerodays/air-jam-games/the-office/src/host-view.tsx:41`
  - `../../zerodays/air-jam-games/the-office/src/host-view.tsx:43`
- Controller input loop effect depends on whole `controller` object:
  - `../../zerodays/air-jam-games/the-office/src/controller-view.tsx:117`

Impact:
- Unnecessary effect teardown/restart cycles.
- Reinforces a common misuse pattern for SDK consumers/LLMs.

### P2: `the-office` assignment initialization can use stale assignment snapshots

Evidence:
- Assignment candidate list is derived from `playerAssignments` selector snapshot inside loop:
  - `../../zerodays/air-jam-games/the-office/src/hooks/use-game-state.ts:196`
- New assignments are dispatched during same loop:
  - `../../zerodays/air-jam-games/the-office/src/hooks/use-game-state.ts:199`

Impact:
- Potential duplicate character assignment when multiple players are initialized in one pass.

### P3: Input transport strategy is inconsistent across sample games

Evidence:
- `prototype-game` sends on state changes (store subscription):
  - `apps/prototype-game/src/routes/controller-view.tsx:161`
- `the-office` streams every frame with RAF:
  - `../../zerodays/air-jam-games/the-office/src/controller-view.tsx:106`

Impact:
- No clear best-practice in docs for cadence tradeoffs (bandwidth vs responsiveness vs simplicity).

Recommended doc/API tightening:
- Document two official patterns (`event-driven` vs `frame-driven`) and when to choose each.
- Optionally provide a small SDK helper hook for input publishing cadence to reduce custom loop boilerplate.

### Positive patterns worth keeping

1. `prototype-game` uses `useGetInput()` for host-side game loops:
   - `apps/prototype-game/src/game/hooks/useGameInput.ts:9`
2. `prototype-game` uses `useSendSignal()` in gameplay components (headless-friendly):
   - `apps/prototype-game/src/game/components/Ship.tsx:95`
   - `apps/prototype-game/src/game/components/Laser.tsx:50`
