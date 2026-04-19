# @air-jam/sdk

Core SDK for building Air Jam hosts and mobile controllers.

## Stability And Compatibility Policy

Air Jam SDK follows semver. What that means concretely for creators building
against v1:

1. **Durable v1 surface.** `@air-jam/sdk`, `@air-jam/sdk/ui`, and
   `@air-jam/sdk/styles.css` are the stable authoring and UI lanes. Breaking
   changes on these require a major version bump, and v1 will be kept working
   for games for **at least 12 months** after v1.0.0 ships.
2. **Non-breaking v1.x.** Within the `1.x` line we commit to: no removals,
   no incompatible type changes, and no silent behavior changes on the stable
   lanes above. New functionality lands as additive APIs.
3. **Experimental leaves.** `@air-jam/sdk/preview`, `@air-jam/sdk/arcade*`,
   `@air-jam/sdk/protocol`, `@air-jam/sdk/capabilities`,
   `@air-jam/sdk/metadata`, and `@air-jam/sdk/prefabs` are intentionally
   unstable future-facing seams. They may change within `1.x` — each carries
   a documented purpose in its leaf, and changes are noted in release notes.
   The machine-facing `runtime-control`, `runtime-inspection`,
   `runtime-observability`, and `contracts/v2` seams exist in-source but are
   **not exported publicly** until a first-party consumer lands; they will be
   re-exported as explicit experimental leaves when that happens.
4. **v2 migration.** When v2 ships, we commit to publishing a codemod (or
   migration notes if the surface is too narrow to automate) alongside the
   release. v1 games will not be silently broken — the v1 SDK will remain
   installable.
5. **Metadata and capability contracts.** The `defineAirJamGameMetadata` and
   `defineAirJamGameCapabilities` helpers produce versioned, frozen objects.
   Contract versions are bumped explicitly so the platform can accept mixed
   versions during a transition window.

Games built against v1 should declare `supportedSdkRange: "^1.0.0"` in their
metadata unless they intentionally pin tighter.

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

Use `defineAirJamGameMetadata` for catalog-facing identity and
`createAirJamApp` for runtime/session wiring. Platform submissions can still
edit metadata in the dashboard; the code export gives tooling a typed default
to prefill, validate, and compare against release artifacts.

```tsx
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { z } from "zod";

const inputSchema = z.object({
  vector: z.object({ x: z.number(), y: z.number() }),
  action: z.boolean(),
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
import { SurfaceViewport } from "@air-jam/sdk/ui";

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
    <SurfaceViewport orientation="portrait">
      <section>
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
    </SurfaceViewport>
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

## Runtime Contract Seams (In-Source, Not Public Exports)

Air Jam also carries machine-facing runtime seams for control, inspection, and
observability. Those modules still exist in-source, but they are **not public
package exports in v1**, so consumers should not import:

1. `@air-jam/sdk/runtime-control`
2. `@air-jam/sdk/runtime-inspection`
3. `@air-jam/sdk/runtime-observability`
4. `@air-jam/sdk/contracts/v2`

Current policy:

1. keep these seams private until a real first-party consumer lands
2. treat them as future machine-facing homes for bots, tests, previews, and agent tooling
3. re-export them later as explicit experimental leaves instead of implying they are stable root-SDK contracts

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
