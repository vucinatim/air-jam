# Air Jam SDK Plan: Contract-First Networked Actions (Event-Safe by Design)

## Context

Current networked action flow in `createAirJamStore` is permissive:

- Controller side proxies actions as `(...args) => emit("controller:action_rpc", { actionName, args, controllerId })`
- Server forwards payload as-is to host (`airjam:action_rpc`)
- Host executes `actionFn(...args, controllerId)`

Relevant files:

- `packages/sdk/src/store/create-air-jam-store.ts`
- `packages/sdk/src/protocol.ts`
- `packages/server/src/index.ts`

This design is flexible but allows non-intended arguments (for example React click events) to leak into RPC payloads and break logic during refactors.

## Problem

With extracted UI components, developers naturally write:

```tsx
<button onClick={actions.startMatch}>Start</button>
```

React passes the click event as the first argument. The SDK currently forwards it over RPC as an action arg. This is a system-design hole, not just an app bug.

## Goals

1. Prevent UI-event arg leakage by design (not only by warnings).
2. Keep API ergonomic for fast game prototyping.
3. Preserve backward compatibility during migration.
4. Improve debuggability when action invocation payloads are invalid.
5. Keep runtime overhead low.

## Non-goals

1. Rewriting the whole networking model.
2. Introducing complex codegen as a hard requirement.
3. Breaking existing games in one release.

## Design Options Considered

## Option A: Keep current `...args` model + better warnings

Pros:

- Minimal implementation effort.
- No API changes.

Cons:

- Core issue still possible in production.
- Relies on discipline and linting.

Verdict: Useful as immediate safety layer, not final architecture.

## Option B: Auto-drop event-like first arg heuristically

Pros:

- Fixes common `onClick={action}` class immediately.
- Mostly non-breaking.

Cons:

- Heuristic and implicit behavior.
- Still allows other invalid payload shapes.

Verdict: Good transitional guardrail, not final contract model.

## Option C (Recommended): Contract-first action transport

Define each action’s network contract explicitly:

- `void` action (no payload), or
- single typed payload object validated by Zod.

Transport becomes payload-oriented, not raw variadic args.

Pros:

- Eliminates event leakage class at architecture level.
- Clear, explicit, and validateable contracts.
- Better docs, tooling, and testability.

Cons:

- Requires incremental migration path.
- Slightly more upfront typing for action definitions.

Verdict: Best long-term architecture.

## Recommended Architecture

## 1) Introduce action contracts in SDK

Add a new API variant (non-breaking addition first):

```ts
const useGameStore = createAirJamStoreWithContracts({
  state: { phase: "lobby" },
  actions: {
    startMatch: action.void(({ set, controllerId }) => {
      // host-only mutation
    }),
    joinTeam: action.payload(
      z.object({ team: z.enum(["team1", "team2"]) }),
      ({ payload, set, controllerId }) => {
        // payload.team available and validated
      },
    ),
  },
});
```

Design rules:

1. Networked action input is either `void` or exactly one payload object.
2. `controllerId` is context, not part of payload.
3. Controller proxy only serializes validated payload, never raw callback args.

## 2) Update protocol for typed payload mode

Current:

```ts
{ actionName: string; args: unknown[]; controllerId: string }
```

Planned addition:

```ts
{
  actionName: string;
  payload?: unknown; // absent for void
  controllerId: string;
  version: 2;
}
```

Keep legacy `args` support temporarily for backward compatibility.

## 3) Host execution path uses contract registry

Host resolver logic:

1. Find action by `actionName`.
2. Resolve action mode: `void` or `payload(schema)`.
3. Parse payload with Zod when schema exists.
4. Execute handler with `{ payload?, controllerId, set, get }`.
5. Emit actionable error telemetry in dev when parse fails.

## 4) Controller proxy behavior

For `void` actions:

- Always emit no payload.
- Ignore all accidental runtime args.

For `payload` actions:

- Require one payload object.
- Validate before emitting.
- Reject non-object/event-like values with descriptive dev error.

## 5) Transitional compatibility layer

Maintain `createAirJamStore` (legacy) during migration:

1. Add strict dev warnings in legacy mode:
   - Non-serializable arg values
   - Event-like values (`nativeEvent`, `preventDefault`, etc.)
2. Add optional guard:
   - If action arity is 0 and first arg is event-like, drop arg and warn.
3. Keep legacy server path accepting `args`.

## Concrete Implementation Plan

## Phase 0: Safety now (fast patch)

Files:

- `packages/sdk/src/store/create-air-jam-store.ts`

Tasks:

1. Add `isEventLikeArg` utility.
2. Add `isSerializable` utility (safe JSON-ish check).
3. Legacy proxy warnings for bad args.
4. Zero-arity + event-like first arg auto-drop (dev warning).

Outcome:

- Immediate protection for current users with minimal risk.

## Phase 1: Introduce contract-based API (additive)

Files:

- `packages/sdk/src/store/` (new files: `action-contracts.ts`, `create-air-jam-store-contract.ts`)
- `packages/sdk/src/index.ts`
- `packages/sdk/src/protocol.ts` (versioned RPC payload type)

Tasks:

1. Add `action.void` and `action.payload(schema, handler)` helpers.
2. Add `createAirJamStoreWithContracts`.
3. Add new v2 RPC envelope (`payload`, `version`).
4. Keep backward compatibility with legacy envelopes.

Outcome:

- New games use safe-by-default architecture.

## Phase 2: Server compatibility + validation plumbing

Files:

- `packages/server/src/index.ts`

Tasks:

1. Forward v2 payload unchanged.
2. Keep v1 `args` forwarding for legacy games.
3. Add dev logs for malformed envelopes.

Outcome:

- No breakage; both modes supported.

## Phase 3: Migrate templates and docs

Files:

- `packages/create-airjam/templates/pong/src/store.ts`
- `packages/create-airjam/templates/pong/airjam-docs/sdk/networked-state/page.md`
- `apps/platform/src/app/docs/sdk/networked-state/page.mdx`

Tasks:

1. Convert template store to contract API.
2. Document payload-only action design.
3. Add explicit “don’t pass raw actions directly as DOM handlers in legacy mode” note.

Outcome:

- New developers land on correct model immediately.

## Phase 4: Deprecation strategy

Tasks:

1. Mark legacy `createAirJamStore` as deprecated in docs (not removed yet).
2. Emit dev-only deprecation warning when legacy RPC args contain non-serializable values.
3. After adoption window, decide if hard deprecation/removal is needed.

Outcome:

- Controlled migration without forced churn.

## API Details (Recommended)

## Action helper types

```ts
type ActionContext<TState> = {
  set: (updater: Partial<TState> | ((state: TState) => Partial<TState>)) => void;
  get: () => TState;
  controllerId: string;
};

const action = {
  void: <TState>(handler: (ctx: ActionContext<TState>) => void) => ...,
  payload: <TSchema extends z.ZodTypeAny, TState>(
    schema: TSchema,
    handler: (args: {
      payload: z.infer<TSchema>;
      context: ActionContext<TState>;
    }) => void,
  ) => ...,
};
```

## Developer ergonomics

1. `void` actions are always called as `actions.startMatch()`.
2. Payload actions are always called with exactly one object:
   - `actions.joinTeam({ team: "team1" })`
3. `controllerId` never appears in controller call sites; it is host context.

## Testing Plan

## SDK unit/integration tests

1. Legacy mode: `onClick={action}` sends event arg -> warning + safe handling.
2. Contract mode void action: extraneous arg is ignored and does not travel.
3. Contract mode payload action: invalid payload rejected before emit.
4. Host side: invalid v2 payload fails schema parse and does not mutate state.
5. Cross-version: v1 and v2 payloads can coexist in same runtime.

## Server tests

1. v1 envelope pass-through remains stable.
2. v2 envelope pass-through remains stable.
3. Malformed envelope rejected safely.

## Migration Risks and Mitigations

Risk: Dev confusion between legacy and contract APIs.
Mitigation:

1. Name new API clearly (`createAirJamStoreWithContracts` initially).
2. Provide before/after examples in docs.
3. Add migration checklist.

Risk: Runtime overhead from schema parsing.
Mitigation:

1. Parse only on action invocation (not render).
2. Keep payload schemas small and focused.

Risk: Subtle behavior differences for legacy actions.
Mitigation:

1. Keep legacy unchanged except guarded dev behavior.
2. Gate aggressive sanitation behind dev-only path first.

## Rollout Recommendation

1. Ship Phase 0 immediately in next patch release.
2. Ship Phase 1–2 behind additive API in minor release.
3. Migrate templates/docs in same minor.
4. Reassess legacy deprecation after 1-2 release cycles.

## Success Criteria

1. No reported “button click passed event and broke RPC action” regressions in contract mode.
2. Template apps use contract mode by default.
3. Legacy mode emits actionable warnings for invalid args.
4. RPC action failures become explicit and diagnosable.

## Suggested Next Steps

1. Implement Phase 0 now (small, high-impact guardrails).
2. Open an RFC PR for Phase 1 API shape with 2-3 example stores.
3. Migrate `create-airjam` template once API is approved.
