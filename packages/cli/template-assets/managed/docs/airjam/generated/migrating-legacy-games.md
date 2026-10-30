<!-- Generated from content/docs/getting-started/migrating-legacy-games/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/getting-started/migrating-legacy-games -->

# Migrating Legacy Games

This guide is for older Air Jam games that still use the pre-v1 app shape.

If you are starting fresh, use [Quick Start](./quick-start.md) instead.

If you are using an LLM to help with the migration, copy this guide into the
conversation first. Codex or Claude are the best fit for this kind of
repo-wide migration work.

## When You Need This Guide

You are likely on the old shape if your game still has some of these patterns:

- `AirJamProvider` in `App.tsx`
- flat files like `src/host-view.tsx`, `src/controller-view.tsx`, and `src/store.ts`
- `HostShell` / `ControllerShell`
- old store actions like `joinTeam(team, playerId?)`
- controller code that calls `controller.sendInput(...)` directly in a loop

The v1 goal is not “make old code barely compile”.

The goal is:

1. move to the canonical v1 runtime shape
2. keep boundaries clean between runtime, replicated state, and game logic
3. remove old shell/provider assumptions instead of carrying them forward

## Prerelease Local Migration Note

If you are migrating an old game against a local unreleased Air Jam workspace before packages are published, keep the setup split clean:

1. install `@air-jam/sdk` from the local package or a local tarball
2. do not depend on `@air-jam/server` through a direct `file:` package reference if it still carries monorepo-only `workspace:*` internals
3. for prerelease local dev, resolve `air-jam-server` from your nearby Air Jam workspace checkout or use tarballs once you are doing package validation

This is only a prerelease migration concern. The release goal is published packages or tarball validation, not permanent cross-repo path coupling.

## The Target Shape

The current canonical app shape looks like this:

```text
src/
  airjam.config.ts
  app.tsx
  routes/
    host-view.tsx
    controller-view.tsx
  game/
    input.ts
    store.ts
    ...
```

Not every migrated game must match that exact folder tree.

What matters is the boundary model:

1. `defineAirJamGame(...)` declares the game in core; `createAirJamApp(game, options)` binds its browser runtime
2. `app.tsx` owns route-level `<airjam.Host>` and `<airjam.Controller>` wrappers
3. host/controller runtime owner hooks mount only in those route entry files
4. replicated state uses the current `createAirJamStore` action contract
5. host-local simulation stays separate from replicated store state

## Migration Checklist

Use this order. Do not jump around randomly.

1. Replace `AirJamProvider` bootstrap with `createAirJamApp`
2. Move host/controller ownership into route wrappers
3. Migrate replicated store actions to `(ctx, payload)`
4. Remove `HostShell` / `ControllerShell`
5. Decide what belongs in replicated store state versus host-local simulation
6. Modernize controller input only if the game actually has continuous input
7. Clean up old shell/theme workarounds and dead legacy branches
8. Re-run local validation before changing game behavior

## Step 1: Move Runtime Setup Into `airjam.config.ts`

Old shape:

```tsx filename="src/App.tsx"
import { AirJamProvider } from "@air-jam/sdk";
import { gameInputSchema } from "./types";

export function App() {
  return (
    <AirJamProvider
      serverUrl={import.meta.env.VITE_AIR_JAM_SERVER_URL}
      publicHost={import.meta.env.VITE_AIR_JAM_PUBLIC_HOST}
      input={{
        schema: gameInputSchema,
        latch: {
          booleanFields: ["action"],
        },
      }}
    >
      ...
    </AirJamProvider>
  );
}
```

Target shape:

```ts filename="src/airjam.config.ts"
import { defineAirJamGame } from "@air-jam/sdk/core";
import { gameInput } from "./game/input";
import { simulation } from "./game/simulation";

export const airjam = defineAirJamGame({
  metadata: {
    slug: "space-game",
    name: "Space Game",
    tagline: "Fly together and defend the fleet.",
    category: "arcade",
    minPlayers: 1,
    maxPlayers: 4,
    inputModalities: ["buttons", "touch"],
    supportedSdkRange: "^1.0.0",
    maintainer: { name: "Air Jam" },
    version: 1,
  },
  controllerPath: "/controller",
  simulation,
  input: gameInput,
});
```

This removes runtime wiring noise from your app tree and gives you one canonical config surface.

## Step 2: Move Host And Controller Ownership Into `app.tsx`

Old shape:

```tsx filename="src/App.tsx"
<Routes>
  <Route path="/" element={<HostView />} />
  <Route path="/controller" element={<ControllerView />} />
</Routes>
```

Target shape:

```tsx filename="src/app.tsx"
import { Route, Routes } from "react-router-dom";
import { createAirJamApp, env } from "@air-jam/sdk";
import { airjam as game } from "./airjam.config";

const airjam = createAirJamApp(game, { runtime: env.vite(import.meta.env) });

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <airjam.Host>
            <HostView />
          </airjam.Host>
        }
      />
      <Route
        path={airjam.paths.controller}
        element={
          <airjam.Controller>
            <ControllerView />
          </airjam.Controller>
        }
      />
    </Routes>
  );
}
```

This is the runtime boundary. Keep it explicit.

## Step 3: Fix Store Actions First

This is the most important migration after bootstrap.

Old actions often looked like this:

```tsx filename="src/store.ts"
actions: {
  joinTeam: (team, playerId) => {
    if (!playerId) return;
    ...
  },
  setReady: (ready, playerId) => {
    if (!playerId) return;
    ...
  },
}
```

The current action model is:

The `src/game/stores/game-store.ts` path below is a starter-friendly example.
If your project already uses a different store module layout, keep the same action contract and ownership rules while migrating.

```tsx filename="src/game/stores/game-store.ts"
actions: {
  joinTeam: ({ actorId, connectedPlayerIds }, { team }) =>
    set((state) => {
      if (!actorId) return state;
      ...
    }),

  setReady: ({ actorId }, { ready }) =>
    set((state) => {
      if (!actorId) return state;
      ...
    }),
}
```

Controller-side dispatch should always look like:

```tsx filename="src/routes/controller-view.tsx"
gameStore.actions.joinTeam({ team: "team1" });
gameStore.actions.setReady({ ready: true });
```

Do not keep trailing `playerId` arguments around.

For the full store model, see [Networked State](./networked-state.md).

## Step 4: Remove `HostShell` And `ControllerShell`

Treat the old shell components as migration targets, not as permanent app structure.

Why:

1. they hide app-owned layout inside generic wrappers
2. they can leak presentational concerns into the app
3. they make theme and layout cleanup harder than it should be

Use app-owned layout instead.

If you still need a narrow layout helper, use one intentionally, for example `SurfaceViewport` for shared full-screen controller or host UI scaling.

Do not rebuild your app around a generic shell.

## Step 5: Choose The Right Migration Branch

Not every legacy game should be migrated the same way.

### Branch A: Flat Legacy App

If your app still looks like:

```text
src/
  App.tsx
  host-view.tsx
  controller-view.tsx
  store.ts
  types.ts
```

then do the full cleanup:

1. add `src/airjam.config.ts`
2. rename to `src/app.tsx`
3. move runtime entry files to `src/routes/`
4. move input/store/domain files into `src/game/`

This is the cleanest migration for older minimal apps.

### Branch B: Already Modular Legacy App

If your app already has good structure like:

```text
src/
  features/
  store/
  hooks/
  components/
```

then do not force a cosmetic rewrite just to match a template.

Instead:

1. modernize bootstrap and route ownership
2. modernize the store action contract
3. keep healthy feature/domain modules mostly where they are

The migration guide is about boundaries, not folder cosplay.

### Branch C: Host-Simulation-Heavy App

If most of the game logic lives in a host-side hook or `useHostTick` loop, move it into a declared simulation (`defineAirJamSimulation`, declared with `defineAirJamGame({ simulation })`). `useHostTick` is removed.

1. replicated store state owns shared, synchronized state
2. the simulation owns timers, positions, physics and outcomes; it reads input from its step context, uses the step's `random` and game time instead of `Math.random()` and `Date.now()`, and dispatches store actions for outcomes such as scores
3. the host view draws with `useSimulationFrame`, plays sounds and toasts from `useSimulationEvents`, and keeps media loading and draw caches
4. what agents see moves from `useHostAgentObservation` into the simulation's `observe`

This is usually cleaner than trying to stuff the whole game loop into the replicated store, and it lets the game's tests run headless.

## Step 6: Migrate Input Based On Input Type

Do not overgeneralize input migration.

### Continuous Input Games

If your controller sends directional or analog-style input, declare those
controls and let the SDK's phone controls send them:

```tsx filename="src/game/input.ts"
import { button, defineAirJamInput, stick } from "@air-jam/sdk/core";

export const gameInput = defineAirJamInput({
  move: stick(),
  action: button("held"),
});
```

```tsx filename="src/controller/index.tsx"
import { ControlButton, Stick } from "@air-jam/sdk/ui";
import { gameInput } from "../game/input";

export function ControllerView() {
  return (
    <div className="grid h-full grid-cols-2 gap-3 p-3">
      <Stick control={gameInput.move} />
      <ControlButton control={gameInput.action}>Action</ControlButton>
    </div>
  );
}
```

The simulation reads them each step with `input(playerId)`. Remove the old
send loop, input writer and any timestamp field.

### Action-Only Or Choice-Driven Games

If the controller mainly sends taps, choices, or store actions, do not add per-frame input machinery just because another game needed it.

Use the simpler model that matches your game.

For more input details, see [Input System](./input-system.md).

## Step 7: Replace `latch` And Input Behavior Lists

Older games configure input through `latch` or `input.behavior` lists of
`pulse`, `hold` and `latest` fields. Both are gone: each control's kind carries
its meaning. A tap-safe boolean becomes `button("pressed")`, a held boolean
`button("held")`, a sticky vector `stick({ keepDirection: true })`, and any
other number an `axis()`.

## Step 8: Remove Legacy Workarounds

After bootstrap, shell, and action migration, remove old hacks that only existed because of the old shape.

Common examples:

1. theme fixes that fight shell-injected classes
2. old child-mode or shell-mode presentation branches
3. duplicated route aliases like `/host` unless you truly still need them
4. stale README instructions that still describe the old app shape

This step matters. A migration is not complete if the old assumptions are still quietly shaping the code.

## Identity Rules To Recheck

During migration, be explicit about identity.

You should know:

1. what is the Air Jam controller/session identity
2. what is the in-game avatar or character identity
3. which store keys use which identity

Do not leave this implicit.

This becomes especially important when:

1. controllers are assigned to in-game characters
2. bots exist
3. host simulation uses different IDs than controller presence

## Validation Checklist

Before calling a migration done, verify:

1. host route boots cleanly with `<airjam.Host>`
2. controller route joins cleanly with `<airjam.Controller>`
3. store actions no longer rely on trailing `playerId` arguments
4. no child component mounts a second runtime owner hook
5. shell-removal cleanup is complete
6. README and local dev commands match the migrated app shape
7. `pnpm run typecheck`
8. `pnpm run build`
9. the game still behaves correctly in local host/controller play

## Recommended Order For Real Migrations

When migrating multiple games, do them in this order:

1. smallest flat app first
2. host-simulation-heavy app second
3. already-modular app third

That order usually sharpens the guide fastest:

1. first app proves the basic recipe
2. second app forces the harder boundary decisions
3. third app benefits from the refined guide and should migrate more cleanly

## From 0.9 To 1.0

Games written against the 0.9 SDK, including agent-made Studio games, move
mechanically with the mappings below. Each removal fails typecheck, so work
through the compiler errors with this section open.

### The game is declared in core

`src/airjam.config.ts` exports only the named `airjam = defineAirJamGame(...)`
declaration from `@air-jam/sdk/core`. Move metadata into its `metadata` field;
remove the separate metadata export. Its entire import graph must stay free of
React, the SDK root, TSX and CSS. The loader names the importing file with
`AJ_DECLARATION_NOT_FRAMEWORK_FREE` when that boundary is crossed.

Move `createAirJamApp` to `app.tsx` and call
`createAirJamApp(airjam, { runtime: env.vite(import.meta.env) })`. The binding
returns `Host`, `Controller`, `paths` and `session`; game data stays on the
declaration. Passing the former options object as the first argument fails
with an error naming `defineAirJamGame` as its replacement.

Import agent helpers and their types from `@air-jam/sdk/core`. A declared
`testing` path, relative to the config, names the development module:

```ts
import { defineAirJamTesting } from "@air-jam/devtools/testing";
import { gamePlayer } from "./player";

export const testing = defineAirJamTesting({
  player: gamePlayer,
  profiles: { scoring, diagnostics },
  // Optional: visual: { scenarios: [...] }, using the game's declared agent.
});
```

The declared player is offered as `model` in every profile. Remove each
profile's manually created model policy; the name is reserved and fails with
`AJ_TEST_POLICY_RESERVED` when authored. Visual packs no longer declare their
own agent. Tools read the game through `airjam.inspect_game` and its
`declaration.agent` field.

Remove capacity from runtime options. `metadata.maxPlayers` is the capacity
for both browser and headless rooms: a four-player game refuses a fifth phone.
Remove identity fields from `airjam-template.json`; it now holds only scaffold
and export flags. Regenerate template catalogs after changing declarations.

### Stores Are Plain Objects

`createAirJamStore` moved to `@air-jam/sdk/core` and returns a store object,
not a hook. Declare every store in the app; reading an undeclared store throws
`AJ_STORE_NOT_DECLARED`.

```ts
// 0.9
import { createAirJamStore } from "@air-jam/sdk";
export const useGameStore = createAirJamStore<GameState>((set) => ({ ... }));

// 1.0
import { createAirJamStore } from "@air-jam/sdk/core";
export const gameStore = createAirJamStore<GameState>((set) => ({ ... }));
// airjam.config.ts
defineAirJamGame({ stores: [gameStore], ... });
```

| 0.9                                                                                                             | 1.0                                                              |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `useGameStore((s) => s.score)`                                                                                  | `useAirJamStore(gameStore, (s) => s.score)` from `@air-jam/sdk`  |
| `useGameStore.useActions().joinTeam(...)`                                                                       | `gameStore.actions.joinTeam(...)`                                |
| `useGameStore.asPlayer(id)`                                                                                     | `gameStore.asPlayer(id)`                                         |
| `useGameStore.getState()`, `.subscribe`                                                                         | `gameStore.getState()`, `gameStore.subscribe`                    |
| `useGameStore.useHostActionListener(listener)`                                                                  | `useHostActionListener(gameStore, listener)` from `@air-jam/sdk` |
| `useGameStore.useLiveStateRef().current`                                                                        | `gameStore.getState()`, always current                           |
| `acceptAirJamAction`, `rejectAirJamAction`, `AirJamActionContext` and the other store types from `@air-jam/sdk` | the same names from `@air-jam/sdk/core`                          |
| `createAirJamStore(init, { storeDomain })`                                                                      | unchanged, from `@air-jam/sdk/core`                              |
| `Date.now()` inside an action                                                                                   | `ctx.now`, the game time the action runs at                      |

Shells that compose runtimes themselves, such as the Arcade, pass their
stores to `AirJamHostRuntime` and `AirJamControllerRuntime` from
`@air-jam/sdk/arcade/runtime` with the `stores` prop.

### The SDK Owns The Loop

`useHostTick` is removed. Per-step game logic moves into a declared
simulation; components only draw it.

```tsx
// 0.9
useHostTick({
  mode: "fixed",
  intervalMs: 16,
  onTick: ({ deltaSeconds }) => stepGame(world, deltaSeconds),
});

// 1.0: src/game/simulation.ts
export const simulation = defineAirJamSimulation<World, GameInput, GameEvent>({
  stepMs: 16,
  create: ({ random }) => createWorld(random),
  step: (world, { dtSeconds, input, players, random, emit }) =>
    stepGame(world, dtSeconds),
  observe: (world) => ({ score: world.score }),
});
// airjam.config.ts
defineAirJamGame({ simulation, ... });
```

| 0.9                                          | 1.0                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `useHostTick({ onTick })`                    | the simulation's `step`                                                                     |
| `useHostTick({ onFrame })`, `fixedStepAlpha` | `useSimulationFrame(({ sim, alpha }) => draw(sim, alpha))`                                  |
| `HostTickInfo.deltaSeconds`, `.tick`         | the step context's `dtSeconds`, `tick`                                                      |
| `Math.random()` in game logic                | the step context's `random`                                                                 |
| `useHostAgentObservation({ read, capture })` | `read` becomes the simulation's `observe`; `capture` becomes `useHostAgentCapture(capture)` |
| UI state derived from the world              | `useSimulationSelector((sim) => value)`                                                     |
| one-off feedback such as sounds              | `emit` in `step`, `useSimulationEvents` in a component                                      |

### Input Is Declared

The `input: { schema, behavior }` config, controller send loops and the host's
`getInput` are removed. A game declares its controls, the SDK's phone controls
send them, and the simulation reads them each step.

```tsx
// 0.9: src/game/contracts/input.ts
export const gameInputSchema = z.object({ direction: z.number(), fire: z.boolean() });
// airjam.config.ts
createAirJamApp({ input: { schema: gameInputSchema, behavior: { pulse: ["fire"] } }, ... });
// controller
const writeInput = useInputWriter();
useControllerTick(() => writeInput({ direction: directionRef.current, fire: fireRef.current }), {
  intervalMs: 16,
});
<button onPointerDown={() => (directionRef.current = -1)} onPointerUp={() => (directionRef.current = 0)}>Up</button>
// host
const { direction, fire } = host.getInput(playerId) ?? { direction: 0, fire: false };

// 1.0: src/game/contracts/input.ts
import { axis, button, defineAirJamInput } from "@air-jam/sdk/core";
export const gameInput = defineAirJamInput({ direction: axis(), fire: button("pressed") });
// airjam.config.ts
defineAirJamGame({ input: gameInput, simulation, ... });
// controller
import { AxisButton, ControlButton } from "@air-jam/sdk/ui";
<AxisButton control={gameInput.direction} value={-1}>Up</AxisButton>
<ControlButton control={gameInput.fire}>Fire</ControlButton>
// simulation step
step: (sim, { input, players }) => {
  for (const player of players) {
    const { direction, fire } = input(player.id);
  }
},
```

| 0.9                                                       | 1.0                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| a boolean in `behavior.pulse` or `latch`                  | `button("pressed")`: true for exactly one step per press                       |
| any other boolean                                         | `button("held")`                                                               |
| a number from -1 to 1                                     | `axis()`, sent by `AxisButton` with a `value`                                  |
| a `{ x, y }` vector                                       | `stick()`, or `stick({ keepDirection: true })` for a vector in `behavior.hold` |
| a timestamp or sequence field                             | nothing: the SDK orders input by step                                          |
| buttons with pointer handlers writing refs                | `ControlButton`, `AxisButton` and `Stick`, styled through `data-active`        |
| `useInputWriter` and `useControllerTick` send loops       | nothing: the controller runtime sends on change, once per frame                |
| `host.getInput(playerId)` or `useGetInput` in a host tick | `input(playerId)` in the simulation's `step`; it always returns every control  |
| `z.infer<typeof gameInputSchema>`                         | `AirJamInputValues<typeof gameInput>` from `@air-jam/sdk/core`                 |

Choices, menus and other taps that are not per-step play stay store actions.

### Removed Exports

These exports are gone; use the replacement.

| Removed                                                                                                                                                                                | Use instead                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `@air-jam/sdk/arcade`, `@air-jam/sdk/arcade/bridge`                                                                                                                                    | the leaf that owns the concept, such as `@air-jam/sdk/arcade/bridge/host`                      |
| `useHostTick`, `HostTickInfo`, `HostTickOptions`, `HostFrameInfo`                                                                                                                      | a declared simulation, above                                                                   |
| `useHostAgentObservation`                                                                                                                                                              | the simulation's `observe` and `useHostAgentCapture`                                           |
| `AirJamSyncedStoreHook`                                                                                                                                                                | `AirJamStore` from `@air-jam/sdk/core`                                                         |
| `useConnectionStatus()`                                                                                                                                                                | `useAirJamHost((s) => s.connectionStatus)` or `useAirJamController((s) => s.connectionStatus)` |
| `usePlayers()`                                                                                                                                                                         | `useAirJamHost((s) => s.players)`                                                              |
| `isActiveMatchPhase`, `isEndedMatchPhase`, `isStandardMatchPhase`, `standardMatchPhases`                                                                                               | compare the phase directly; `toShellMatchPhase` stays                                          |
| `AirJamErrorBoundary`, `PlatformSettingsBoundary`                                                                                                                                      | nothing: `createAirJamApp` and the session runtimes mount both                                 |
| `getEffectiveAudioVolume`, `useAudioCategoryVolume`, `mergeRoomPlatformSettingsSnapshot`                                                                                               | `useMusicVolume`, `usePlatformAudioSettings`                                                   |
| `parseAirJamGameMetadata`                                                                                                                                                              | `airJamGameMetadataSchema.safeParse`                                                           |
| `RoomCode`, `RunMode`, `SignalPayload`, `SignalType`, `ControllerStatePayload`, `ControllerUpdatePlayerProfileAck`, `AirJamActionAccepted`, `AirJamActionRejected` from `@air-jam/sdk` | the same types from `@air-jam/sdk/protocol`                                                    |
| `isInternalActionName`, `resolveControllerJoinSource`, `JoinUrlStatus` from `@air-jam/sdk/core`                                                                                        | internal; `JoinUrlStatus` comes from `@air-jam/sdk`                                            |
| `buttonVariants`, `getPlayerAvatarImageUrl`, `resolvePlayerAvatarSeed` from `@air-jam/sdk/ui`                                                                                          | `Button`, `PlayerAvatar`                                                                       |
| `useInputWriter`, `useControllerTick`, `ControllerTickInfo`, `ControllerTickOptions`                                                                                                   | declared controls and the SDK's phone controls, above                                          |
| `useGetInput`, the host's `getInput`                                                                                                                                                   | `input(playerId)` in a simulation step                                                         |

Tool and platform paths also dropped helpers only the SDK itself used:
`arcade/bridge/controller` (`AIRJAM_CONTROLLER_BRIDGE_RESPONSE`,
`AIRJAM_CONTROLLER_PRESENTATION_SYNC`, `createControllerPresentationSyncMessage`,
`parseControllerBridgeResponseMessage`), `arcade/bridge/host`
(`AIRJAM_HOST_BRIDGE_RESPONSE`), `arcade/bridge/iframe` (the bridge init and
settings sync messages), `arcade/surface` (implicit store domain resolution),
`arcade/url` (`urlBuilder`, `arcadeSurfaceRuntimeUrlParams`, which stays in
`arcade/surface`), `controller-bridge`, `preview`, `runtime-control`,
`runtime-inspection`, `agent-tooling` and `metadata`. The
[architecture guide](./architecture.md) lists what each path
keeps.

## Related Docs

1. [Quick Start](./quick-start.md)
2. [Debugging and Logs](./debugging-and-logs.md)
3. [Input System](./input-system.md)
4. [Networked State](./networked-state.md)
5. [Hooks](./sdk-hooks.md)
