# @air-jam/sdk

Core SDK for building Air Jam hosts and mobile controllers.

## Stability And Compatibility Policy

Air Jam SDK follows semver. What that means concretely for creators building
against v1:

1. **Durable v1 surface.** The authoring paths every game uses:
   `@air-jam/sdk` (the React binding), `@air-jam/sdk/core` (the framework-free
   runtime), `@air-jam/sdk/ui`, `@air-jam/sdk/metadata` and
   `@air-jam/sdk/styles.css`. Breaking changes on these require a major
   version bump, and v1 will be kept working for games for **at least 12
   months** after v1.0.0 ships.
2. **Non-breaking v1.x.** Within the `1.x` line we commit to: no removals,
   no incompatible type changes, and no silent behavior changes on the stable
   lanes above. New functionality lands as additive APIs.
3. **Tooling and platform paths.** `@air-jam/sdk/prefabs`, `preview`,
   `protocol`, `runtime-*`, `agent-tooling`, `controller-bridge`, `arcade/*`,
   `release` and `platform-machine` serve Air Jam's own tools, server and
   hosted platform. They may change within `1.x`, with changes noted in
   release notes. The
   [architecture guide](https://airjam.io/docs/how-it-works/architecture)
   lists every entry point and its one purpose.
4. **v2 migration.** When v2 ships, we commit to publishing a codemod (or
   migration notes if the surface is too narrow to automate) alongside the
   release. v1 games will not be silently broken — the v1 SDK will remain
   installable.
5. **Metadata and agent contracts.** Catalog metadata is versioned explicitly;
   machine-operable game behavior is declared once through the semantic agent
   contract used by CLI and MCP sessions.

Games built against v1 should declare `supportedSdkRange: "^1.0.0"` in their
metadata unless they intentionally pin tighter.

## Three Lanes (Canonical)

1. `Input lane` (each player's controls):
   declared with `defineAirJamInput` from `@air-jam/sdk/core`, filled by `ControlButton`, `AxisButton` and `Stick` from `@air-jam/sdk/ui`, and read in simulation steps with `input(playerId)`.
2. `State lane` (replicated, host-authoritative):
   `createAirJamStore` from `@air-jam/sdk/core`, dispatched through `store.actions`, with `(ctx, payload)` action handlers.
3. `Signal lane` (out-of-band UX/system):
   `sendSignal` / `sendSystemCommand` for haptics, toasts, room-level commands, and remote audio cues.

Do not mix lanes:

1. Do not send per-frame stick/button input through store actions.
2. Do not mutate authoritative game state via signals.
3. Do not dispatch state actions via `store.getState().actions.*`; use `store.actions`.

## Installation

```bash
pnpm add @air-jam/sdk zod
```

## Minimal Setup

Use `defineAirJamGameMetadata` for catalog-facing identity and
`createAirJamApp` for runtime/session wiring. Platform submissions can still
edit metadata in the dashboard; the code export gives tooling a typed default
to prefill, validate, and compare against release artifacts.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { button, defineAirJamInput, stick } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { simulation } from "./game/simulation";

export const gameInput = defineAirJamInput({
  move: stick(),
  action: button("pressed"),
});

export const gameMetadata = defineAirJamGameMetadata({
  slug: "my-game",
  name: "My Game",
  tagline: "A short catalog pitch for players.",
  category: "party",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons", "touch"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Your Name" },
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  controllerPath: "/controller",
  simulation,
  input: gameInput,
});
```

## Production Auth Modes

There are two canonical production modes:

1. Static `appId` mode
2. Optional signed host-grant mode

Static `appId` mode is the default. Set:

```bash
VITE_AIR_JAM_SERVER_URL=https://api.airjam.io
VITE_AIR_JAM_APP_ID=aj_app_your_app_id
```

If you want stricter ownership guarantees while keeping the game static, add:

```bash
VITE_AIR_JAM_HOST_GRANT_ENDPOINT=/api/airjam/host-grant
```

and have that endpoint return:

```json
{ "hostGrant": "..." }
```

The SDK fetches the host grant automatically before `host:bootstrap`. Game code stays unchanged.

## Host Usage

Mount runtime ownership explicitly at the host boundary, then read it from child code with `useAirJamHost()`.

If a component only needs host session state, call `useAirJamHost(selector)` to
avoid rerendering on unrelated runtime fields.
Selectors receive state fields only; call `useAirJamHost()` when a component
also needs runtime controls such as `joinUrl` or `sendSignal`.

```tsx
import { useAirJamHost } from "@air-jam/sdk";
import { airjam } from "./airjam.config";

const HostShell = () => (
  <airjam.Host
    onPlayerJoin={(player) => console.log("joined", player.id)}
    onPlayerLeave={(controllerId) => console.log("left", controllerId)}
  >
    <HostView />
  </airjam.Host>
);

export const HostView = () => {
  const host = useAirJamHost();
  return (
    <section>
      <h1>Room: {host.roomId}</h1>
      <p>Status: {host.connectionStatus}</p>
      <p>Join URL: {host.joinUrl}</p>
    </section>
  );
};
```

Use `host.players` for gameplay-facing player iteration. Use `host.controllers`
when you need the richer controller-session roster with source
(`phone | preview | virtual`), connected state, and resume-lease metadata.
Use `host.resetRoom()` when you need a fresh empty room without restarting the
local backend.

Players' controls reach the game only in its simulation steps, through
`input(playerId)`. A pressed button reads `true` for one step per press, a held
button while it is down, an axis a number and a stick an `{ x, y }`.

## Controller Usage

Mount runtime ownership explicitly at the controller boundary, then read it from child code with `useAirJamController()`.

If a component only needs controller session state, call
`useAirJamController(selector)` to avoid rerendering on unrelated runtime
updates.
Selectors receive state fields only; call `useAirJamController()` when a
component also needs controls such as `sendSystemCommand`.

```tsx
import { ControlButton, Stick, SurfaceViewport } from "@air-jam/sdk/ui";
import { airjam, gameInput } from "./airjam.config";

const ControllerShell = () => (
  <airjam.Controller nickname="Player 1">
    <ControllerView />
  </airjam.Controller>
);

export const ControllerView = () => (
  <SurfaceViewport orientation="landscape">
    <section className="grid h-full grid-cols-2 gap-3 p-3">
      <Stick control={gameInput.move} />
      <ControlButton control={gameInput.action}>Action</ControlButton>
    </section>
  </SurfaceViewport>
);
```

Controllers usually join via URL query param: `/controller?room=ABCD`.

Standalone controllers also keep one stable local device identity and the last
room-scoped controller binding. If the same phone refreshes or briefly
disconnects, the SDK automatically attempts to resume that controller binding
instead of creating a duplicate player.

The important rule is:

1. mount `airjam.Host` / `airjam.Controller` once per runtime surface
2. use `useAirJamHost()` / `useAirJamController()` only as read hooks below that boundary
3. wrap controller UI in `SurfaceViewport` and set its `orientation` there

When the controller runs inside Arcade, `SurfaceViewport` automatically publishes
its orientation to the parent Arcade chrome. The same component still handles
standalone controller layout, so games do not need a separate host-side
orientation bridge. Multiplayer game state should live in the networked stores
and replicate automatically.

## Preview Controllers (Experimental)

The preview-controller feature lives under the explicit experimental leaf:

```ts
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";
```

Use it when you want a fast local desktop tryout path without replacing the
normal phone-controller product model.

Important rules:

1. phone controllers remain the canonical product experience
2. preview controllers are not a second topology or fake simulator path
3. preview controllers use the real controller route and join the same room as normal controllers
4. production should stay explicit opt-in

The preview workspace also exposes local recovery controls:

1. source-aware `Kick` controls for room controllers
2. `Reset room`, which creates a fresh empty room and reloads the local host page

Recommended host usage:

```tsx
import { HostPreviewControllerWorkspace } from "@air-jam/sdk/preview";

export const HostView = () => {
  const previewControllersEnabled = import.meta.env.DEV;

  return (
    <>
      <GameCanvas />
      <HostPreviewControllerWorkspace enabled={previewControllersEnabled} />
    </>
  );
};
```

The shared preview leaf currently provides:

1. `HostPreviewControllerWorkspace` for normal host-surface mounting
2. `PreviewControllerWorkspace` and `PreviewControllerWindow` for lower-level composition
3. `usePreviewControllerManager` for host-local preview session state
4. `buildPreviewControllerUrl` and related launch helpers for explicit launch control

The floating window chrome also supports per-window portrait/landscape rotation,
and active preview-window opacity is driven by the shared platform settings
runtime so hosts can persist their preferred transparency level.

Keep preview usage inside explicit host-side UI and do not treat it as a stable
root-SDK contract yet.

## Runtime Inspection Contract

Runtime inspection is a real machine-tooling requirement and is published from
an explicit experimental leaf. Agent control remains game-semantic, and runtime
logs remain in the unified log stream; Air Jam does not keep parallel dormant
control or observability contracts for hypothetical consumers.

## Prefab Contract Leaf (Experimental)

Prefab definitions should live under a stable, scanable contract instead of
drifting between scene glue, render layers, and runtime population code.

The first prefab contract helpers now live under the explicit experimental leaf:

```ts
import {
  createPrefabCatalog,
  definePrefab,
  type PrefabDefinition,
} from "@air-jam/sdk/prefabs";
```

Use this leaf when you need a canonical prefab definition that future tooling
can scan, preview, configure, and catalog.

Important rules:

1. this leaf defines prefab contracts, not a prefab runtime or editor
2. keep prefab definitions separate from scene population, pooling, or runtime spawn systems
3. keep larger gameplay behavior in domain, engine, or adapter modules instead of burying it inside prefab metadata
4. treat this as the future-facing namespace for Studio and agent-oriented prefab tooling

Current scope:

1. `definePrefab(...)` for a stable prefab definition shape
2. `createPrefabCatalog(...)` for a game-owned prefab registry export
3. shared preview and placement descriptor types for future Studio/catalog work

## Controller Feedback Helpers

Use explicit audio ownership at each host/controller surface boundary, then consume that runtime-owned manager below it. `AudioRuntime` is role-aware: controller surfaces automatically receive host-triggered remote sounds.

```tsx
import { AudioRuntime, useAudio, useControllerToasts } from "@air-jam/sdk";

const manifest = {
  hit: { src: ["/sounds/hit.wav"] },
};

const ControllerHud = () => {
  const audio = useAudio();
  const { latestToast } = useControllerToasts();

  return latestToast ? <p>{latestToast.message}</p> : null;
};

const ControllerShell = () => (
  <AudioRuntime manifest={manifest}>
    <ControllerHud />
  </AudioRuntime>
);
```

Host-side `sendSignal("TOAST", ...)` now pairs directly with `useControllerToasts()`.
Mount `AudioRuntime` once per runtime surface, then call `useAudio()` only below that boundary.

## Shared Platform Settings

Shared user settings are platform-owned and inherited by embedded games.

Mount `PlatformSettingsRuntime` once in the platform shell when you want a persisted owner runtime.
`airjam.Host` / `airjam.Controller` already provide a settings boundary for games, so repo games should not wrap each host/controller surface in another redundant `PlatformSettingsRuntime`.

```tsx
import {
  PlatformSettingsRuntime,
  useInheritedPlatformSettings,
  usePlatformAudioSettings,
} from "@air-jam/sdk";

const ArcadeShell = () => (
  <PlatformSettingsRuntime persistence="local">
    <SettingsPanel />
    <EmbeddedGame />
  </PlatformSettingsRuntime>
);

const SettingsPanel = () => {
  const { masterVolume, setMasterVolume } = usePlatformAudioSettings();
  return (
    <button onClick={() => setMasterVolume(masterVolume === 0 ? 1 : 0)}>
      Toggle Master
    </button>
  );
};

const EmbeddedGame = () => {
  const settings = useInheritedPlatformSettings();
  return <pre>{JSON.stringify(settings.audio, null, 2)}</pre>;
};
```

Rules:

1. mount `PlatformSettingsRuntime persistence="local"` once in the platform shell
2. let `airjam.Host` and `airjam.Controller` supply the in-game settings boundary automatically
3. embedded games inherit platform settings read-only
4. keep platform settings limited to shared cross-game concerns like audio, accessibility, and feedback
5. do not recreate feature-specific global settings stores alongside this runtime

## Optional UI Primitives

`@air-jam/sdk/ui` exports optional presentational primitives (`Button`, `Slider`, `PlayerAvatar`, `VolumeControls`).
These components are lifecycle-free: they do not create sockets or own host/controller session state.
`VolumeControls` reads and writes the shared audio slice through the platform settings runtime.

## Networked State (Host Source of Truth)

Use `createAirJamStore` from `@air-jam/sdk/core` for shared game state synced
from host to controllers, declare it in `createAirJamApp({ stores })`, and read
it in components with `useAirJamStore`.

```tsx
import { createAirJamStore, type AirJamActionContext } from "@air-jam/sdk/core";

interface GameState {
  phase: "lobby" | "playing";
  actions: {
    setPhase: (
      ctx: AirJamActionContext,
      payload: { phase: "lobby" | "playing" },
    ) => void;
  };
}

export const gameStore = createAirJamStore<GameState>((set) => ({
  phase: "lobby",
  actions: {
    setPhase: (_ctx, { phase }) => set({ phase }),
  },
}));

// In a component:
const phase = useAirJamStore(gameStore, (state) => state.phase);
gameStore.actions.setPhase({ phase: "playing" });
```

Dispatch through `gameStore.actions`. On controllers, action calls are proxied to the host automatically and actor identity is attached by the server. A declared store syncs while its host or controller runs, whether or not a component reads it; reading an undeclared store throws `AJ_STORE_NOT_DECLARED`.

Important identity rule:

1. `ctx.actorId` is always the identity of the dispatcher
2. if host code dispatches through `gameStore.actions`, then `ctx.actorId === "host"`
3. if host code intentionally wants to run the same semantic action as controller `X`, use `gameStore.asPlayer("X")` instead of smuggling `controllerId` through an unrelated payload

Every action dispatch now resolves to an acknowledgement:

1. `{ ok: true, status: "accepted", source, result? }`
2. `{ ok: false, status: "rejected", source, reason, message, details? }`

Networked action contract:

1. `() => Promise<ack>` for no-payload actions
2. `(payloadObject) => Promise<ack>` for payload actions
3. payload roots must be plain objects, not primitives, arrays, DOM events, or `T | undefined` unions
4. if an action has no payload, omit it entirely instead of using `undefined` as part of an object-union payload type

Action context includes `connectedPlayerIds`, so host actions can prune stale assignments without custom presence-sync actions, and `now`, the game time actions read instead of `Date.now()` so headless runs and replays see the same time.

For host-only local side effects such as sounds, local sim refs, or one-shot animations, listen to host-applied actions instead of queueing ephemeral commands through replicated state:

```tsx
useHostActionListener(gameStore, (event) => {
  if (event.actionName !== "fireProjectile") {
    return;
  }

  projectileRuntimeRef.current.spawn(event.payload);
});
```

For explicit host-side player impersonation, use the host-only player-action lane:

```tsx
const playerActions = gameStore.asPlayer("ctrl_2");

await playerActions.joinTeam({ team: "red" });
```

When a store action should return an explicit semantic result or rejection, use
`acceptAirJamAction(...)` and `rejectAirJamAction(...)`:

```tsx
import {
  acceptAirJamAction,
  createAirJamStore,
  rejectAirJamAction,
} from "@air-jam/sdk/core";

export const gameStore = createAirJamStore((set, get) => ({
  aliveByPlayerId: {} as Record<string, boolean>,
  actions: {
    fire: ({ actorId }) => {
      if (!actorId || get().aliveByPlayerId[actorId] === false)
        return rejectAirJamAction("player_dead", "Dead players cannot fire.");
      return acceptAirJamAction({ cooldownMs: 4500 });
    },
  },
}));
```

If an action returns `void`, Air Jam treats it as accepted automatically.

## Runtime Pause Controls

Runtime pause/play is independent from your game-owned match phase. Keep lobby,
playing, and ended state in your game store, and use explicit runtime commands
only for pause UI.

```tsx
const host = useAirJamHost();

<button
  onClick={
    host.runtimeState === "playing" ? host.pauseRuntime : host.resumeRuntime
  }
>
  {host.runtimeState === "playing" ? "Pause" : "Resume"}
</button>;
```

## One Correct Way (Default Path)

1. Define one `airjam` app config with `createAirJamApp`.
2. Declare each player's controls with `defineAirJamInput` and bind controller UI to them with `ControlButton`, `AxisButton` and `Stick`; the SDK sends them.
3. Read controls only in simulation steps, with `input(playerId)`.
4. Put per-step gameplay in a declared simulation (`defineAirJamSimulation` from `@air-jam/sdk/core`, declared with `createAirJamApp({ simulation })`); draw it with `useSimulationFrame` instead of hand-rolled `requestAnimationFrame` or `setInterval` loops.
5. Keep replicated gameplay state in `createAirJamStore` and declare it in `createAirJamApp({ stores })`.
6. Dispatch all store actions through `store.actions` zero-arg or payload-object calls and check the returned acknowledgement when outcome matters.

## Canonical `airjam.config.ts`

Keep one runtime/session declaration and use role wrappers directly in routes.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { gameInput } from "./game/contracts/input";
import { simulation } from "./game/engine/simulation";
import { gameStore } from "./game/stores/game-store";

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  controllerPath: "/controller",
  stores: [gameStore],
  // Optional agent-facing contracts belong here too.
  // agent: agentContract,
  simulation,
  input: gameInput,
});
```

```tsx
import { Route, Routes } from "react-router-dom";
import { airjam } from "./airjam.config";

export const App = () => (
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
```

This keeps runtime config, declared controls, route path ownership, and the
optional semantic agent contract in one place.

## Environment Variables

- `VITE_AIR_JAM_SERVER_URL` / `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
- `VITE_AIR_JAM_APP_ID` / `NEXT_PUBLIC_AIR_JAM_APP_ID`

## Full Docs

- Platform docs: https://airjam.io/docs
- Monorepo docs index: `docs/docs-index.md`
