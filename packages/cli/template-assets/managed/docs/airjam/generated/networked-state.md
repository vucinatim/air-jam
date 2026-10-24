<!-- Generated from content/docs/sdk/networked-state/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/sdk/networked-state -->

# Networked State

`createAirJamStore` is the canonical shared-state lane for Air Jam:

- Host is the only source of truth.
- Controllers dispatch actions through RPC.
- Host applies actions, then state sync is broadcast back.

Use this lane for replicated game state, not per-frame input.

A store is a plain object from `@air-jam/sdk/core`, so game logic can use it
without React. Components read it with `useAirJamStore`.

## Canonical Action Model

Actions always use this shape on the host:

1. First argument: `ctx` (identity, role, connected players and game time `now`)
2. Second argument: `payload` (either `undefined` or one typed plain-object payload)

Dispatch always goes through the store's `actions`:

1. `gameStore.actions.someAction()`
2. `gameStore.actions.someAction({ ...payload })`

No trailing `controllerId` arguments and no multi-argument action payloads.
No primitive, array, or event-like root payloads.

## Create a Store

This example uses a starter-friendly `stores/` folder shape.
The important contract is the action model and ownership boundary, not the exact filename.

```tsx filename="src/game/stores/game-store.ts"
import { createAirJamStore, type AirJamActionContext } from "@air-jam/sdk/core";

type Team = "team1" | "team2";

interface GameState {
  phase: "lobby" | "playing";
  teamAssignments: Record<string, Team>;
  scores: { team1: number; team2: number };
  actions: {
    joinTeam: (ctx: AirJamActionContext, payload: { team: Team }) => void;
    scorePoint: (ctx: AirJamActionContext, payload: { team: Team }) => void;
    setPhase: (
      ctx: AirJamActionContext,
      payload: { phase: "lobby" | "playing" },
    ) => void;
  };
}

export const gameStore = createAirJamStore<GameState>((set) => ({
  phase: "lobby",
  teamAssignments: {},
  scores: { team1: 0, team2: 0 },
  actions: {
    joinTeam: ({ actorId }, { team }) =>
      set((state) => ({
        teamAssignments: {
          ...state.teamAssignments,
          [actorId]: team,
        },
      })),
    scorePoint: (_ctx, { team }) =>
      set((state) => ({
        scores: {
          ...state.scores,
          [team]: state.scores[team] + 1,
        },
      })),
    setPhase: (_ctx, { phase }) => set({ phase }),
  },
}));
```

## Declare the Store

The host and controllers sync a store only when the app declares it:

```ts filename="src/airjam.config.ts"
import { createAirJamApp, env } from "@air-jam/sdk";
import { gameStore } from "./game/stores/game-store";

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  controllerPath: "/controller",
  stores: [gameStore],
});
```

A declared store syncs for as long as the host or controller runs, whether or
not any component is reading it. Reading a store the app does not declare
throws `AJ_STORE_NOT_DECLARED`.

## Use on Controller

This controller example matches the starter template surface layout.
It assumes your app has already mounted `airjam.Controller`.

```tsx filename="src/controller/index.tsx"
import { useAirJamController, useAirJamStore } from "@air-jam/sdk";
import { gameStore } from "../game/stores/game-store";

export const ControllerView = () => {
  const controller = useAirJamController();
  const teamAssignments = useAirJamStore(
    gameStore,
    (state) => state.teamAssignments,
  );

  const myTeam = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : null;

  return (
    <div>
      <p>My team: {myTeam ?? "unassigned"}</p>
      <button onClick={() => gameStore.actions.joinTeam({ team: "team1" })}>
        Join Team 1
      </button>
    </div>
  );
};
```

## Use on Host

This host example also matches the starter template surface layout.
It assumes your app has already mounted `airjam.Host`.

```tsx filename="src/host/index.tsx"
import { useAirJamStore } from "@air-jam/sdk";
import { gameStore } from "../game/stores/game-store";

export const HostView = () => {
  const phase = useAirJamStore(gameStore, (state) => state.phase);
  const scores = useAirJamStore(gameStore, (state) => state.scores);

  return (
    <div>
      <p>Phase: {phase}</p>
      <p>
        {scores.team1} - {scores.team2}
      </p>
      <button onClick={() => gameStore.actions.setPhase({ phase: "playing" })}>
        Start
      </button>
      <button onClick={() => gameStore.actions.scorePoint({ team: "team1" })}>
        Team 1 +1
      </button>
    </div>
  );
};
```

## Action Flow

1. Controller calls `actions.someAction()` or `actions.someAction({ ...payload })`.
2. SDK emits `controller:action_rpc`.
3. Server validates and injects actor identity from socket ownership.
4. Host receives `airjam:action_rpc` with `{ actor, payload }`.
5. Host executes action handler `(ctx, payload)` and updates state.
6. Host emits `host:state_sync`; controllers receive `airjam:state_sync`.

## Rules

1. Keep all networked mutations inside `actions`.
2. Always dispatch via `store.actions`; do not call `store.getState().actions.*` directly.
3. Use one payload object per action for stable evolution.
4. Root payloads must be omitted or plain objects.
5. `T | undefined` payload unions are not valid roots. If an action has no payload, omit it entirely.
6. Nested values must stay RPC-serializable.
7. Use `ctx.actorId` for identity-aware actions (team join, ownership, etc.).
8. `ctx.actorId` is always the dispatcher identity. If host code dispatches through `store.actions`, then `ctx.actorId` is the host.
9. Read time as `ctx.now`, never `Date.now()`: it is game time, the simulation's when the game declares one, so headless runs and replays see the same time. Store deadlines in it and let the simulation act on them; phones show what the host writes to the store, such as whole seconds left, because they cannot read the host's clock.
10. If the host intentionally needs to run the same semantic player action as controller `X`, use `store.asPlayer("X")` instead of inventing a target payload for an actor-owned action.
11. Keep per-frame gameplay input in declared controls, read in simulation steps, not in this store.
12. For a host-only side effect of an action, such as a sound, use `useHostActionListener(store, listener)`.

## Accept And Reject Examples

If a store action returns `void`, Air Jam treats it as accepted.

Return `rejectAirJamAction(...)` when the semantic action should fail with a clear machine-readable reason, and return `acceptAirJamAction(result)` when the semantic action should succeed with explicit result data:

```tsx
import {
  acceptAirJamAction,
  createAirJamStore,
  rejectAirJamAction,
} from "@air-jam/sdk/core";

export const gameStore = createAirJamStore((set, get) => ({
  aliveByPlayerId: {} as Record<string, boolean>,
  cooldownMsByPlayerId: {} as Record<string, number>,
  actions: {
    fire: ({ actorId }) => {
      if (!actorId || get().aliveByPlayerId[actorId] === false)
        return rejectAirJamAction("player_dead", "Dead players cannot fire.");
      const cooldownMs = 4500;
      set((state) => ({
        cooldownMsByPlayerId: {
          ...state.cooldownMsByPlayerId,
          [actorId]: cooldownMs,
        },
      }));
      return acceptAirJamAction({ cooldownMs });
    },
  },
}));
```

Use this pattern when the caller needs a real semantic outcome.

## Embedded Arcade Runtimes

When a game runs inside Arcade, `createAirJamStore` still works the same way in game code.

The SDK/runtime automatically resolves the correct replicated store domain from the embedded runtime context, so you should:

1. keep normal `createAirJamStore(...)` usage in games
2. not parse Arcade URL params in app/game code
3. not pick custom store domains in game code just to work when embedded

## API Summary

`createAirJamStore<T>(initializer)` from `@air-jam/sdk/core` returns a store to
declare in `createAirJamApp({ stores })`. It provides:

1. `actions`, dispatching with `() => Promise` or `(payloadObject) => Promise` signatures.
2. `getState()` and `subscribe()` for logic outside React.
3. `asPlayer(controllerId)`, a host-only dispatch map for explicit player impersonation of semantic actions.

React reads it with `useAirJamStore(store, selector)` and listens to host-applied
actions with `useHostActionListener(store, listener)`.

`T` must include an `actions` object with host handlers `(ctx, payload) => void`, where `payload` is `undefined` or a plain object.
