# @air-jam/sdk

Core SDK for building Air Jam hosts and mobile controllers.

## Three Lanes (Canonical)

1. `Input lane` (high frequency, transient):
   `useControllerTick` + `useInputWriter` on controller, `host.getInput` / `useGetInput` on host.
2. `State lane` (replicated, host-authoritative):
   `createAirJamStore` + `useActions` with `(ctx, payload)` action handlers.
3. `Signal lane` (out-of-band UX/system):
   `sendSignal` / `sendSystemCommand` for haptics, toasts, room-level commands, and remote audio cues.

Do not mix lanes:

1. Do not send per-frame stick/button input through store actions.
2. Do not mutate authoritative game state via signals.
3. Do not dispatch state actions via `state.actions.*`; use `useStore.useActions()`.

## Installation

```bash
pnpm add @air-jam/sdk zod
```

## Minimal Setup

Use `createAirJamApp` as the canonical runtime/session wiring API.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { z } from "zod";

const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: { controllerPath: "/controller" },
  input: { schema: inputSchema },
});
```

## Production Auth Modes

There are two canonical production modes:

1. Static `appId` mode
2. Optional signed host-grant mode

Static `appId` mode is the default. Set:

```bash
VITE_AIR_JAM_SERVER_URL=https://api.air-jam.app
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

If a component only needs replicated host session state, prefer
`useAirJamHostState(selector)` to avoid rerendering on unrelated runtime fields.

```tsx
import { AirJamHostRuntime, env, useAirJamHost } from "@air-jam/sdk";

const HostShell = () => (
  <AirJamHostRuntime
    topology={env.vite(import.meta.env).topology}
    appId={import.meta.env.VITE_AIR_JAM_APP_ID}
    input={{ schema: inputSchema }}
    onPlayerJoin={(player) => console.log("joined", player.id)}
    onPlayerLeave={(controllerId) => console.log("left", controllerId)}
  >
    <HostView />
  </AirJamHostRuntime>
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

Use `host.getInput(controllerId)` in your game loop.

Default input behavior:

- booleans: `pulse` (tap-safe consume-on-read)
- vectors: `latest` (continuous latest value)

Optional overrides are available via `input.behavior` (`pulse | hold | latest`).

### Migration From `input.latch`

If you previously used:

```ts
input: {
  schema,
  latch: {
    booleanFields: ["action"],
    vectorFields: ["vector"],
  },
}
```

Use:

```ts
input: {
  schema,
  behavior: {
    pulse: ["action", "vector"],
  },
}
```

Notes:

- most games can now remove input behavior config entirely (`input: { schema }`)
- booleans default to tap-safe `pulse`
- vectors default to `latest` (continuous)

## Controller Usage

Mount runtime ownership explicitly at the controller boundary, then read it from child code with `useAirJamController()`.

If a component only needs replicated controller session state, prefer
`useAirJamControllerState(selector)` to avoid rerendering on unrelated runtime
updates.

```tsx
import {
  AirJamControllerRuntime,
  env,
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";

const ControllerShell = () => (
  <AirJamControllerRuntime
    topology={env.vite(import.meta.env).topology}
    appId={import.meta.env.VITE_AIR_JAM_APP_ID}
    nickname="Player 1"
  >
    <ControllerView />
  </AirJamControllerRuntime>
);

export const ControllerView = () => {
  const controller = useAirJamController();
  const writeInput = useInputWriter();

  useControllerTick(
    () => {
      writeInput({
        vector: { x: 0, y: 0 },
        action: false,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        controller.runtimeState === "playing",
      intervalMs: 16,
    },
  );

  return (
    <section>
      <p>Layout: {controller.controllerOrientation}</p>
      <button
        onPointerDown={() =>
          writeInput({
            vector: { x: 0, y: 0 },
            action: true, // one-shot pulses still valid
          })
        }
      >
        Action
      </button>
    </section>
  );
};
```

Controllers usually join via URL query param: `/controller?room=ABCD`.

Standalone controllers also keep one stable local device identity and the last
room-scoped controller binding. If the same phone refreshes or briefly
disconnects, the SDK automatically attempts to resume that controller binding
instead of creating a duplicate player.

The important rule is:

1. mount `AirJamHostRuntime` / `AirJamControllerRuntime` once per runtime surface
2. use `useAirJamHost()` / `useAirJamController()` only as read hooks below that boundary

Hosts can also publish lightweight controller presentation state with
`host.sendState({ orientation: "portrait" | "landscape" })`, which controllers
receive as `controller.controllerOrientation`.

This path is intentionally narrow. Use it for controller layout and short
presentation metadata, not for authoritative gameplay state. Multiplayer game
state should live in the networked stores and replicate automatically.

## Preview Controllers (Experimental)

The preview-controller feature lives under the explicit experimental leaf:

```ts
import { HostPreviewControllerDock } from "@air-jam/sdk/preview";
```

Use it when you want a fast local desktop tryout path without replacing the
normal phone-controller product model.

Important rules:

1. phone controllers remain the canonical product experience
2. preview controllers are not a second topology or fake simulator path
3. preview controllers use the real controller route and join the same room as normal controllers
4. production should stay explicit opt-in

Recommended host usage:

```tsx
import { HostPreviewControllerDock } from "@air-jam/sdk/preview";

export const HostView = () => {
  const previewControllersEnabled = import.meta.env.DEV;

  return (
    <>
      <GameCanvas />
      <HostPreviewControllerDock enabled={previewControllersEnabled} />
    </>
  );
};
```

The shared preview leaf currently provides:

1. `HostPreviewControllerDock` for normal host-surface mounting
2. `PreviewControllerDock` and `PreviewControllerSurface` for lower-level composition
3. `usePreviewControllerManager` for host-local preview session state
4. `buildPreviewControllerUrl` and related launch helpers for explicit launch control

Keep preview usage inside explicit host-side UI and do not treat it as a stable
root-SDK contract yet.

## Runtime Contract Leaves (Experimental)

The first machine-facing runtime seams now live under explicit experimental
leaves instead of being hidden inside preview, Arcade, or the root SDK:

```ts
import {
  createHostRuntimeControlContract,
  useControllerRuntimeControlContract,
} from "@air-jam/sdk/runtime-control";
import {
  createHostRuntimeInspectionContract,
  useControllerRuntimeInspectionContract,
} from "@air-jam/sdk/runtime-inspection";
import {
  subscribeToRuntimeObservability,
  useRuntimeObservabilitySubscription,
} from "@air-jam/sdk/runtime-observability";
```

Use these leaves when you need explicit machine-usable control, inspection, or
observability seams on top of the real runtime/session model.

Important rules:

1. these leaves are experimental and intentionally unstable
2. they are additive adapters over the real host/controller runtime owners
3. they are not a second gameplay path and do not replace normal human UI
4. they are the future-facing namespace for bots, tests, previews, and agent tooling

Current scope:

1. `@air-jam/sdk/runtime-control` exposes narrow host/controller session-driving adapters
2. `@air-jam/sdk/runtime-inspection` exposes structural host/controller runtime snapshots
3. `@air-jam/sdk/runtime-observability` exposes machine-readable runtime event filtering over the canonical runtime event stream

## Controller Feedback Helpers

Use explicit audio ownership at the controller boundary, then consume that runtime-owned manager below it.

```tsx
import {
  AudioRuntime,
  ControllerRemoteAudioRuntime,
  useAudio,
  useControllerToasts,
} from "@air-jam/sdk";

const manifest = {
  hit: { src: ["/sounds/hit.wav"] },
};

const ControllerHud = () => {
  const audio = useAudio();
  const { latestToast } = useControllerToasts();

  return latestToast ? <p>{latestToast.message}</p> : null;
};

const ControllerShell = () => (
  <ControllerRemoteAudioRuntime manifest={manifest}>
    <ControllerHud />
  </ControllerRemoteAudioRuntime>
);
```

Host-side `sendSignal("TOAST", ...)` now pairs directly with `useControllerToasts()`.
Mount `AudioRuntime` / `ControllerRemoteAudioRuntime` once per runtime surface, then call `useAudio()` only below that boundary.

## Shared Platform Settings

Shared user settings are platform-owned and inherited by embedded games.

Mount `PlatformSettingsRuntime` once in the platform shell when you want a persisted owner runtime.
`AirJamHostRuntime` / `AirJamControllerRuntime` already provide a settings boundary for games, so repo games should not wrap each host/controller surface in another redundant `PlatformSettingsRuntime`.

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
2. let `airjam.Host`, `airjam.Controller`, `AirJamHostRuntime`, and `AirJamControllerRuntime` supply the in-game settings boundary automatically
3. embedded games inherit platform settings read-only
4. keep platform settings limited to shared cross-game concerns like audio, accessibility, and feedback
5. do not recreate feature-specific global settings stores alongside this runtime

## Optional UI Primitives

`@air-jam/sdk/ui` exports optional presentational primitives (`Button`, `Slider`, `PlayerAvatar`, `VolumeControls`).
These components are lifecycle-free: they do not create sockets or own host/controller session state.
`VolumeControls` reads and writes the shared audio slice through the platform settings runtime.

## Networked State (Host Source of Truth)

Use `createAirJamStore` for shared game state synced from host to controllers.

```tsx
import { createAirJamStore } from "@air-jam/sdk";

interface RuntimeState {
  phase: "lobby" | "playing";
  actions: {
    setPhase: (
      ctx: {
        actorId: string;
        role: "controller" | "host";
        connectedPlayerIds: string[];
      },
      payload: { phase: "lobby" | "playing" },
    ) => void;
  };
}

export const useGameStore = createAirJamStore<RuntimeState>((set) => ({
  phase: "lobby",
  actions: {
    setPhase: (_ctx, { phase }) => set({ phase }),
  },
}));

const actions = useGameStore.useActions();
actions.setPhase({ phase: "playing" });
```

Use `useGameStore.useActions()` for action dispatch. On controllers, action calls are proxied to the host automatically and actor identity is attached by the server.

Networked action contract:

1. `() => void` for no-payload actions
2. `(payloadObject) => void` for payload actions
3. payload roots must be plain objects, not primitives, arrays, or DOM events

Action context includes `connectedPlayerIds`, so host actions can prune stale assignments without custom presence-sync actions.

## Host Lifecycle Bridge

Use `useHostRuntimeStateBridge` to keep transport pause/play state aligned with your store lifecycle phase transitions.

```tsx
import { useHostRuntimeStateBridge } from "@air-jam/sdk";

useHostRuntimeStateBridge({
  matchPhase, // "lobby" | "countdown" | "playing" | "ended"
  runtimeState: host.runtimeState,
  toggleRuntimeState: host.toggleRuntimeState,
});
```

## One Correct Way (Default Path)

1. Define one `airjam` app config with `createAirJamApp`.
2. On controllers, publish input with `useControllerTick` + `useInputWriter`.
3. On hosts, read input with `getInput` / `useGetInput`.
4. Keep replicated gameplay state in `createAirJamStore`.
5. Dispatch all store actions through `useActions()` zero-arg or payload-object calls.

## Canonical `airjam.config.ts`

Keep one runtime/session declaration and use role wrappers directly in routes.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { gameInputSchema } from "./types";

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input: {
    schema: gameInputSchema,
  },
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

This keeps runtime config, host input schema, and route path ownership in one place.

Optional future-facing game capability metadata should also live here, but the schema is intentionally experimental and lives in `@air-jam/sdk/capabilities`.

## Environment Variables

- `VITE_AIR_JAM_SERVER_URL` / `NEXT_PUBLIC_AIR_JAM_SERVER_URL`
- `VITE_AIR_JAM_APP_ID` / `NEXT_PUBLIC_AIR_JAM_APP_ID`

## Full Docs

- Platform docs: https://air-jam.app/docs
- Monorepo docs index: `docs/docs-index.md`
