# Legacy Game Migration Working Notes

Last updated: 2026-03-29
Status: archived reference

Related docs:

1. [V1 Closeout Plan (Archived)](../archive/v1-closeout-plan-2026-03-31.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [Documentation Architecture](../systems/documentation-architecture.md)
5. [Legacy Game Migration Guide](../systems/legacy-game-migration-guide.md)

## Purpose

This document is the archived working dataset used while deriving the final migration recipe for the three legacy ZeroDays Air Jam games.

It exists to capture:

1. exact migration deltas per game
2. cleanup and simplification opportunities unlocked by the migration
3. framework and docs additions the migration work reveals
4. the eventual reusable migration recipe

This is not the final public migration guide.

That guide now lives in [Legacy Game Migration Guide](../systems/legacy-game-migration-guide.md).

Keep this file as supporting historical detail, not as an active execution plan.

## Legacy Game Set

The three legacy games live outside the monorepo in:

1. [code-review](/Users/timvucina/Desktop/zerodays/air-jam-games/code-review)
2. [last-band-standing](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing)
3. [the-office](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office)

## Canonical Target Pattern

The migration target is not “make the old code compile against the new package”.

The migration target is the current Air Jam app shape represented by:

1. [air-capture](/Users/timvucina/Desktop/MyProjects/air-jam/games/air-capture)
2. [pong template](/Users/timvucina/Desktop/MyProjects/air-jam/games/pong)

The most important target traits are:

1. `createAirJamApp(...)` in `src/airjam.config.ts`
2. route-level `<airjam.Host>` and `<airjam.Controller>` wrappers in `src/app.tsx`
3. host and controller runtime owner hooks mounted only in their route entry files
4. game code grouped under `src/game/`
5. store actions using the current action context shape (`actorId`, `connectedPlayerIds`, role-aware decisions)
6. app-owned host/controller UI instead of the old generic shell wrappers
7. current controller input patterns (`useInputWriter`, `useControllerTick`, local controller stores where useful)

## Cross-Game Migration Buckets

These are the migration buckets already visible before touching game-specific logic.

### 1. App Bootstrap Migration

All three legacy games appear to use:

1. `AirJamProvider`
2. direct `serverUrl` / `publicHost` wiring in `App.tsx`
3. direct route paths such as `"/controller"`

The target shape is:

1. `src/airjam.config.ts`
2. `createAirJamApp({ runtime: env.vite(import.meta.env), ... })`
3. route wrappers through `airjam.Host` and `airjam.Controller`

### 2. File Layout Migration

All three legacy games still use the older flat layout:

1. `src/App.tsx`
2. `src/host-view.tsx`
3. `src/controller-view.tsx`
4. `src/store.ts`
5. `src/types.ts`

The target layout should move toward:

1. `src/app.tsx`
2. `src/airjam.config.ts`
3. `src/routes/host-view.tsx`
4. `src/routes/controller-view.tsx`
5. `src/game/...`

This is not just cosmetic. It makes host/controller runtime boundaries and game-domain code much clearer.

### 3. Store Action Contract Migration

Legacy stores still depend on the older action shape, including patterns like:

1. positional arguments
2. implicit actor injection
3. weaker connected-player pruning logic

The target shape is:

1. `(ctx, payload) => ...`
2. use `ctx.actorId` instead of magic injected player IDs
3. use `ctx.connectedPlayerIds` where team assignments or lobby membership must stay consistent
4. make host-only or controller-only permissions explicit inside actions

### 4. Shell Migration

Legacy games still use generic shell helpers such as:

1. `HostShell`
2. `ControllerShell`

The target architecture is more explicit:

1. app-owned host presentation
2. `ForcedOrientationShell` or other targeted UI helpers where actually needed
3. no reliance on a generic shell component to define app structure

### 5. Migration Scope Rule

The migration should preserve game behavior where possible.

It should not rewrite game design or visual identity unless:

1. the old implementation depends on a removed framework pattern
2. the old implementation becomes simpler and cleaner through the migration
3. the old implementation is clearly brittle or duplicated

## Game 1: Code Review

Source:

1. [package.json](/Users/timvucina/Desktop/zerodays/air-jam-games/code-review/package.json)
2. [App.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/code-review/src/App.tsx)
3. [host-view.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/code-review/src/host-view.tsx)
4. [controller-view.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/code-review/src/controller-view.tsx)
5. [store.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/code-review/src/store.ts)
6. [types.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/code-review/src/types.ts)

### Current Shape

`code-review` is the smallest and clearest legacy migration candidate.

It currently uses:

1. `AirJamProvider` bootstrap in `App.tsx`
2. a flat `src/` layout
3. `HostShell` and `ControllerShell`
4. `createAirJamStore` with the older action style
5. direct `controller.sendInput(...)` in a local RAF loop
6. `input.latch.booleanFields` configured at provider level

### Required Migration Changes

These should be treated as the minimum real migration, not optional cleanup.

#### 1. Replace Provider Bootstrap With `createAirJamApp`

Move runtime configuration out of `App.tsx` and into `src/airjam.config.ts`.

Expected result:

1. `src/airjam.config.ts` defines runtime and input schema
2. `src/app.tsx` mounts `<airjam.Host>` and `<airjam.Controller>`
3. route paths come from the config instead of being repeated ad hoc

#### 2. Restructure The File Layout

The game should move away from the flat legacy shape.

Expected direction:

1. `src/app.tsx`
2. `src/airjam.config.ts`
3. `src/routes/host-view.tsx`
4. `src/routes/controller-view.tsx`
5. `src/game/store.ts`
6. `src/game/input.ts`
7. `src/game/types.ts` only if real domain types still need to exist separately

This migration should intentionally separate runtime wiring from game-domain code.

#### 3. Migrate The Store Action Contract

The old `joinTeam(team, playerId?)` pattern depends on old action semantics.

The store should move to:

1. `joinTeam: ({ actorId, connectedPlayerIds }, { team }) => ...`
2. explicit connected-player pruning when needed
3. explicit role/actor-aware logic rather than hidden injected params

This is one of the most important migration changes because it moves the game onto the current authoritative action model.

#### 4. Replace Generic Shell Helpers

`HostShell` and `ControllerShell` should not remain part of the migrated canonical app shape.

Expected direction:

1. host view owns its own chrome and layout directly
2. controller view uses `ForcedOrientationShell` if it still needs forced portrait behavior
3. the shell helpers disappear from app structure

#### 5. Move Off The Old Input Latch Configuration Pattern

`input.latch.booleanFields` in `AirJamProvider` is a legacy setup shape.

The input schema should move into the current config and controller input behavior should be expressed through the current controller/runtime patterns rather than through the old provider-level latch framing.

This needs careful implementation because the boxing controls depend on punch pulses and defend holds.

### Recommended Cleanup During Migration

These are not separate feature projects. They are cleanup wins the migration should take if they do not expand scope.

#### 1. Move Controller Input Sending To The Current Pattern

The controller currently uses `controller.sendInput(...)` in a custom RAF loop.

That is understandable, but the current framework pattern is cleaner:

1. local controller state / refs
2. `useInputWriter()`
3. `useControllerTick(...)` where fixed cadence makes sense

This should simplify the controller boundary and make the code more consistent with `pong` and `air-capture`.

#### 2. Separate Input Schema From General Types

`types.ts` currently mixes runtime input schema and gameplay constants.

A cleaner target is:

1. `src/game/input.ts` for input schema
2. `src/game/constants.ts` or similar for gameplay timing constants
3. `src/game/store.ts` for synced state

#### 3. Remove Child-Mode Presentation Branches Unless Truly Needed

The host currently branches on `host.isChildMode` for overlay behavior.

The migration should verify whether this remains necessary in the current embedded/runtime model.

If not, remove it.

If yes, keep it narrowly and document why.

### Simplifications The Migration Unlocks

Migrating `code-review` should remove several old-shape concerns at once:

1. no provider wiring noise in `App.tsx`
2. no mixed runtime and domain setup in the same files
3. clearer host/controller ownership boundaries
4. cleaner actor-aware store logic
5. a route structure that matches the public docs and scaffold

This is why `code-review` is a good first migration target.

### Framework / Docs Additions Revealed By This Migration

The `code-review` migration suggests the following additions would be valuable:

1. a public migration guide specifically for `AirJamProvider` -> `createAirJamApp`
2. a public migration example for old `createAirJamStore` action signatures -> `(ctx, payload)`
3. a simple checklist for flat legacy apps moving to `src/routes` + `src/game`
4. a note about when to keep custom controller tick loops versus when to use `useControllerTick`
5. a prerelease local-dev note that external legacy games should not depend on `@air-jam/server` through a direct `file:` package reference while the server package still carries monorepo `workspace:*` internals
6. a temporary local migration rule: external games can resolve `air-jam-server` from a nearby Air Jam workspace checkout during prerelease migration, then move to published packages or tarball validation later

### Estimated Migration Difficulty

`code-review` looks like `low-to-medium` migration difficulty.

Reasons:

1. small file surface
2. straightforward host/controller split
3. modest synced-state requirements
4. no large submodule graph

The main care points are:

1. punch input behavior
2. team assignment logic
3. preserving the host overlay flow cleanly while removing legacy shell/provider patterns

## Game 2: Last Band Standing

Source:

1. [package.json](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing/package.json)
2. [App.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing/src/App.tsx)
3. [host-view.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing/src/host-view.tsx)
4. [controller-view.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing/src/controller-view.tsx)
5. [store/create-store.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing/src/store/create-store.ts)
6. [store/types.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing/src/store/types.ts)
7. [types.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing/src/types.ts)

### Current Shape

`last-band-standing` is richer than `code-review`, but it is also more internally organized.

Important current traits:

1. old Air Jam bootstrap in `App.tsx` through `AirJamProvider`
2. `HostShell` and `ControllerShell` still wrap the runtime views
3. store actions still use the old injected-player-argument style
4. the app already has good feature grouping under `src/features/`
5. the app already has a reasonably separated store domain under `src/store/`
6. there is an extra non-runtime debug route: `/youtube-test`

This makes it a strong second migration target because it shows what a more complex old app needs without the game-domain code being chaotic.

### Required Migration Changes

#### 1. Replace Provider Bootstrap With `createAirJamApp`

This is the same migration bucket as `code-review`.

Expected result:

1. `src/airjam.config.ts` becomes the runtime entry definition
2. `src/app.tsx` mounts `<airjam.Host>` and `<airjam.Controller>`
3. host/controller routes use the current wrapper model

#### 2. Preserve Feature Modules, But Reshape Runtime Entry Files

Unlike `code-review`, this game already has useful structure in:

1. `src/features/`
2. `src/store/`
3. dedicated components and hooks

So the migration should not flatten or rewrite that.

Instead, the intended reshape is:

1. `src/app.tsx`
2. `src/airjam.config.ts`
3. `src/routes/host-view.tsx`
4. `src/routes/controller-view.tsx`
5. keep feature/domain modules largely where they are unless import cleanup becomes obviously better

This is an important observation: the migration guide should explicitly say that not every old game needs a full directory redesign if its domain modules are already healthy.

#### 3. Migrate Store Actions To The Current Context Contract

This is a bigger deal here than in `code-review`, because many actions still rely on optional `playerId` arguments:

1. `setPlayerName(name, playerId?)`
2. `setReady(ready, playerId?)`
3. `submitGuess(optionId, playerId?)`
4. `startMatch()` and other host-only transitions with no explicit role checks

The target shape should be:

1. `setPlayerName: ({ actorId }, { name }) => ...`
2. `setReady: ({ actorId }, { ready }) => ...`
3. `submitGuess: ({ actorId }, { optionId }) => ...`
4. host-owned actions should explicitly require `role === "host"` when needed

This migration should remove hidden SDK-era assumptions and put the game on the current action model.

#### 4. Replace Generic Shell Helpers

As with `code-review`, the shell helpers should disappear from the migrated canonical surface.

Expected direction:

1. explicit host/controller layout in the route files
2. targeted helpers only where they still add value
3. no generic shell component as the app boundary

#### 5. Reevaluate Extra Non-Game Routes

`/youtube-test` is useful, but it is not part of the actual game runtime.

The migration should decide explicitly whether it should:

1. remain as a plain debug route outside `airjam.Host` / `airjam.Controller`
2. move under a debug namespace
3. stay internal-only and not be treated as part of the public app surface

This is not a blocker, but it should be a deliberate decision rather than being passively carried forward.

### Recommended Cleanup During Migration

#### 1. Remove Duplicate Host Routes Unless They Still Serve A Purpose

The app currently serves both `/` and `/host` as host routes.

The migration should decide whether both are still needed.

Preferred default:

1. keep `/` as host
2. remove `/host` unless there is a real workflow reason to keep it

#### 2. Move Input Schema Into A More Explicit Game Boundary

`types.ts` currently mixes input schema and shared game enums.

A cleaner target would likely be:

1. `src/game/input.ts` or `src/input.ts`
2. a dedicated shared game-domain types file for `GamePhase` / guess kinds

This is smaller than the bootstrap/store migration, but it makes the final app easier to read.

#### 3. Consider `useControllerTick` / `useInputWriter` Only If Input Is Actually Continuous

Unlike `code-review`, this game does not appear to have a continuous movement loop.

That means the migration guide should not blindly tell every app to move to `useControllerTick`.

For `last-band-standing`, the current controller interaction is more action/choice oriented, so the controller path may not need the same input-loop modernization bucket at all.

This is an important migration observation because it prevents over-generalizing from the first game.

### Simplifications The Migration Unlocks

Migrating `last-band-standing` should simplify the app without rewriting its domain structure:

1. remove provider wiring from `App.tsx`
2. keep the good feature modules while modernizing only the Air Jam boundaries
3. remove implicit player-ID action assumptions
4. make host-only versus controller-only actions explicit
5. clarify which routes are real game runtime surfaces and which are debug utilities

### Framework / Docs Additions Revealed By This Migration

This game suggests the migration guide should include:

1. a branch for “flat legacy app” versus “already modular legacy app”
2. a dedicated section on migrating old injected-argument actions to context-aware actions
3. guidance for non-runtime debug routes that should stay outside host/controller wrappers
4. explicit advice on when not to introduce controller tick/writer patterns unnecessarily

### Estimated Migration Difficulty

`last-band-standing` looks like `medium` migration difficulty.

Reasons:

1. richer UI surface than `code-review`
2. more action paths and state transitions
3. one extra debug route to place deliberately
4. more imported modules, but already reasonably organized

The positive factor is that the game-domain structure is already decent.

So the migration risk is more about:

1. action contract correctness
2. preserving host/controller flow during bootstrap changes
3. keeping the route surface intentional
4. not over-refactoring healthy feature modules just because the app is being migrated

## Game 3: The Office

Source:

1. [package.json](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office/package.json)
2. [App.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office/src/App.tsx)
3. [host-view.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office/src/host-view.tsx)
4. [controller-view.tsx](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office/src/controller-view.tsx)
5. [store.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office/src/store.ts)
6. [types.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office/src/types.ts)
7. [hooks/use-game-state.ts](/Users/timvucina/Desktop/zerodays/air-jam-games/the-office/src/hooks/use-game-state.ts)

### Current Shape

`the-office` sits between the first two migration cases:

1. not as flat and minimal as `code-review`
2. not as feature-modular as `last-band-standing`
3. strongly driven by a custom host-side game loop in `use-game-state`

Important current traits:

1. old `AirJamProvider` bootstrap in `App.tsx`
2. `HostShell` and `ControllerShell`
3. controller still uses a direct `controller.sendInput(...)` RAF loop
4. store actions are still plain argument-based, with no current context contract
5. theme workarounds exist specifically to fight shell-injected dark styling
6. host game logic is already separated into a useful custom hook

This is useful because it exposes not only migration mechanics but also one qualitative cleanup goal: removing legacy SDK-shell leakage from app UI.

### Required Migration Changes

#### 1. Replace Provider Bootstrap With `createAirJamApp`

As with the other two games:

1. add `src/airjam.config.ts`
2. move host/controller ownership into `src/app.tsx`
3. stop wiring runtime env directly through `AirJamProvider` in `App.tsx`

#### 2. Move Runtime Entry Files Into Explicit Routes

This app should move to:

1. `src/app.tsx`
2. `src/routes/host-view.tsx`
3. `src/routes/controller-view.tsx`
4. game/domain files remain under `src/components`, `src/hooks`, and related files unless a clearer `src/game/` grouping is obviously worthwhile during the actual rewrite

This looks like a case where a moderate reorganization is useful, but not a total rewrite of the existing game-domain structure.

#### 3. Migrate Store Actions To The Current Context Contract

The store currently uses plain-argument actions such as:

1. `completeTask(playerId, reward)`
2. `assignPlayer(controllerId, playerId)`
3. `setBusy(playerId, taskName)`
4. `updatePlayerStats(playerId, updates)`

The migration should evaluate each action carefully rather than blindly wrapping it.

Likely split:

1. controller-originated actions should use `actorId`
2. host-only simulation/update actions may remain host-owned store actions, but should still use the current action contract where they cross the synced-store boundary
3. host-local simulation logic that does not need replication may not belong in synced store actions at all

This is the game most likely to force a clean distinction between:

1. synced authoritative store state
2. host-local simulation machinery

That distinction is valuable for the final public migration guide.

#### 4. Replace Generic Shell Helpers And Remove Theme Workarounds

This app currently has explicit hacks to remove shell-injected dark classes.

That is a strong signal that the migration should:

1. remove `HostShell`
2. remove `ControllerShell`
3. own host/controller presentation directly
4. delete the dark-theme workaround code if it becomes unnecessary after shell removal

This is not just cosmetic cleanup. It is a real simplification and a strong argument for the newer app-owned layout model.

#### 5. Reevaluate Continuous Controller Input

Like `code-review`, `the-office` still uses a custom RAF loop with `controller.sendInput(...)`.

This likely should move to:

1. local refs/state
2. `useInputWriter()`
3. `useControllerTick(...)`

because this controller has continuous directional input plus an action button.

This makes `the-office` a second strong example, together with `code-review`, for the “continuous controller input” branch of the migration guide.

### Recommended Cleanup During Migration

#### 1. Separate Host-Local Game Engine Logic From Synced Store Responsibilities

`use-game-state.ts` appears to carry a large amount of host-only simulation logic.

That is not automatically a problem, but the migration should use this moment to make the boundary explicit:

1. synced store owns replicated/shared state
2. host-local hook owns simulation details, refs, timers, and image loading
3. only the minimum necessary state crosses between them

This will likely make the migrated version easier to reason about than the current one.

#### 2. Revisit Player Assignment Semantics

The store currently maps controller IDs to player IDs and also indexes stats/busy state by controller-oriented keys.

The migration should make those identities explicit and consistent:

1. what is a controller/session identity
2. what is an in-game avatar/character identity
3. which state should be keyed by which identity

This is a likely source of hidden confusion if left implicit.

#### 3. Move Input Schema Out Of The Generic `types.ts`

As with the other games, the input schema should likely move into a dedicated file.

The current file is small, so this is not urgent, but it improves consistency with the current reference apps.

### Simplifications The Migration Unlocks

Migrating `the-office` should unlock meaningful cleanup:

1. no provider bootstrap noise in `App.tsx`
2. no shell-driven dark/light theme fighting
3. cleaner distinction between host-local simulation and replicated store state
4. current controller input writing pattern instead of the old direct send loop
5. clearer identity handling for controller IDs versus in-game player IDs

### Framework / Docs Additions Revealed By This Migration

This game suggests the migration guide should include:

1. a section on shell-removal cleanup, including deleting old theme workarounds
2. a section on deciding what remains in host-local hooks versus what belongs in the synced store
3. a section on identity modeling when controller IDs and game-avatar IDs are different concepts
4. a reusable branch for continuous controller input migrations (`controller.sendInput` loop -> writer/tick pattern)

### Estimated Migration Difficulty

`the-office` looks like `medium` migration difficulty.

Reasons:

1. more custom host simulation than the other two
2. less tidy modular structure than `last-band-standing`
3. direct controller input loop still present
4. theme/shell workarounds need to be removed cleanly

The migration should still be manageable, but it will need more boundary discipline than `code-review`.

## Emerging Reusable Migration Recipe

This section should stay short until all three games are reviewed.

Current draft sequence:

1. move app bootstrap to `airjam.config.ts`
2. move host/controller route ownership into `src/app.tsx`
3. preserve healthy existing feature structure rather than forcing one directory shape everywhere
4. migrate synced store actions to the current context/payload contract
5. replace old shell helpers with explicit app-owned layout
6. decide deliberately which routes are runtime routes and which are debug/support routes
7. separate host-local simulation logic from truly replicated store state where needed
8. only then do game-specific cleanup

## Next Pass

The next pass should be:

1. turn these observations into the first actual migration guide draft
2. identify the exact migration order for the three games
3. decide which game to migrate first in code
4. capture any codemod-worthy repeated steps separately if they are now obvious
