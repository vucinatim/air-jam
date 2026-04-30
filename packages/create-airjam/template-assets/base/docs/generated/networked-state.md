<!-- Generated from content/docs/sdk/networked-state/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://air-jam.app/docs/sdk/networked-state -->

# Networked State

`createAirJamStore` is the canonical shared-state lane for Air Jam:

- Host is the only source of truth.
- Controllers dispatch actions through RPC.
- Host applies actions, then state sync is broadcast back.

Use this lane for replicated game state, not per-frame input.

## Canonical Action Model

Actions always use this shape on the host:

1. First argument: `ctx` (identity and role)
2. Second argument: `payload` (either `undefined` or one typed plain-object payload)

Controller-side dispatch always uses:

1. `const actions = useGameStore.useActions()`
2. `actions.someAction()` or `actions.someAction({ ...payload })`

No trailing `controllerId` arguments and no multi-argument action payloads.
No primitive, array, or event-like root payloads.

## Create a Store

This example uses a starter-friendly `stores/` folder shape.
The important contract is the action model and ownership boundary, not the exact filename.

```tsx filename="src/game/stores/game-store.ts"
import { createAirJamStore } from "@air-jam/sdk";

type Team = "team1" | "team2";

interface GameState {
  phase: "lobby" | "playing";
  teamAssignments: Record<string, Team>;
  scores: { team1: number; team2: number };
  actions: {
    joinTeam: (
      ctx: { actorId: string; role: "controller" | "host" },
      payload: { team: Team },
    ) => void;
    scorePoint: (
      _ctx: { actorId: string; role: "controller" | "host" },
      payload: { team: Team },
    ) => void;
    setPhase: (
      _ctx: { actorId: string; role: "controller" | "host" },
      payload: { phase: "lobby" | "playing" },
    ) => void;
  };
}

export const useGameStore = createAirJamStore<GameState>((set) => ({
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

## Use on Controller

This controller example matches the starter template surface layout.
It assumes your app has already mounted `airjam.Controller` or `AirJamControllerRuntime`.

```tsx filename="src/controller/index.tsx"
import { useAirJamController } from "@air-jam/sdk";
import { useGameStore } from "../game/stores/game-store";

export const ControllerView = () => {
  const controller = useAirJamController();
  const actions = useGameStore.useActions();
  const teamAssignments = useGameStore((state) => state.teamAssignments);

  const myTeam = controller.controllerId
    ? teamAssignments[controller.controllerId]
    : null;

  return (
    <div>
      <p>My team: {myTeam ?? "unassigned"}</p>
      <button onClick={() => actions.joinTeam({ team: "team1" })}>
        Join Team 1
      </button>
    </div>
  );
};
```

## Use on Host

This host example also matches the starter template surface layout.
It assumes your app has already mounted `airjam.Host` or `AirJamHostRuntime`.

```tsx filename="src/host/index.tsx"
import { useGameStore } from "../game/stores/game-store";

export const HostView = () => {
  const phase = useGameStore((state) => state.phase);
  const scores = useGameStore((state) => state.scores);
  const actions = useGameStore.useActions();

  return (
    <div>
      <p>Phase: {phase}</p>
      <p>
        {scores.team1} - {scores.team2}
      </p>
      <button onClick={() => actions.setPhase({ phase: "playing" })}>
        Start
      </button>
      <button onClick={() => actions.scorePoint({ team: "team1" })}>
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
2. Always dispatch via `useActions()`; do not call `state.actions.*` directly.
3. Use one payload object per action for stable evolution.
4. Root payloads must be omitted or plain objects.
5. `T | undefined` payload unions are not valid roots. If an action has no payload, omit it entirely.
6. Nested values must stay RPC-serializable.
7. Use `ctx.actorId` for identity-aware actions (team join, ownership, etc.).
8. `ctx.actorId` is always the dispatcher identity. If host code dispatches through `useActions()`, then `ctx.actorId` is the host.
9. If the host intentionally needs to run the same semantic player action as controller `X`, use `useStore.asPlayer("X")` instead of inventing a target payload for an actor-owned action.
10. Keep per-frame gameplay input in `useInputWriter` / `host.getInput`, not in this store.

## Accept And Reject Examples

If a store action returns `void`, Air Jam treats it as accepted.

Return `rejectAirJamAction(...)` when the semantic action should fail with a clear machine-readable reason, and return `acceptAirJamAction(result)` when the semantic action should succeed with explicit result data:

```tsx
import {
  acceptAirJamAction,
  createAirJamStore,
  rejectAirJamAction,
} from "@air-jam/sdk";

export const useGameStore = createAirJamStore((set) => ({
  aliveByPlayerId: {} as Record<string, boolean>,
  cooldownMsByPlayerId: {} as Record<string, number>,
  actions: {
    fire: ({ actorId }) =>
      set((state) => {
        if (!actorId || state.aliveByPlayerId[actorId] === false) {
          return rejectAirJamAction(
            "player_dead",
            "Dead players cannot fire.",
          );
        }

        const cooldownMs = 4500;
        return acceptAirJamAction({ cooldownMs });
      }),
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

`createAirJamStore<T>(initializer)` returns:

1. Zustand-compatible hook for selectors.
2. `useActions()` dispatch map with `() => void` or `(payloadObject) => void` signatures.
3. `asPlayer(controllerId)` host-only dispatch map for explicit player impersonation of semantic actions.

`T` must include an `actions` object with host handlers `(ctx, payload) => void`, where `payload` is `undefined` or a plain object.
