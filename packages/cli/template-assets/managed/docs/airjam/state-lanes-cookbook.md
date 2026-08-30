# State Lanes Cookbook

Use this when you are deciding where a fact or effect belongs.

Air Jam is easiest to reason about when you keep four lanes separate:

1. controller input lane
2. replicated state lane
3. host-only runtime lane
4. signal/result lane

## The Short Rule

1. If a value comes from a controller every frame, keep it in the input lane.
2. If multiple surfaces must render the same durable truth, keep it in replicated state.
3. If only the host runtime needs it locally, keep it in host-only refs or local runtime state.
4. If you only need to notify, reject, or return a one-shot outcome, use signals or action acknowledgements instead of replicated state.

## Worked Example

Imagine a slingshot artillery game.

### Controller Input Lane

Use `useInputWriter(...)` on the controller and `host.getInput(...)` or `useGetInput(...)` on the host for:

1. drag vector
2. aim angle
3. button held state
4. latest joystick direction

These values are transient and per-frame. They should not be replicated store state.

## Replicated State Lane

Use `createAirJamStore(...)` for durable shared truth that host and controllers both render:

1. current phase (`lobby`, `playing`, `ended`)
2. team assignments
3. score
4. cooldown timers that controllers display
5. which players are alive

If the controller HUD or another remote surface must render it, it belongs here.

### Host-Only Runtime Lane

Use host refs, local runtime state, `useLiveStateRef()`, `useHostTick(...)`, and `useHostActionListener(...)` for local host concerns such as:

1. physics world refs
2. particle systems
3. audio handles
4. canvas draw caches
5. interpolated render-only positions

These are often derived from replicated state or semantic actions, but they are not themselves the shared truth.

```tsx
const worldRef = useRef(createPhysicsWorld());
const gameRef = useGameStore.useLiveStateRef();

useGameStore.useHostActionListener((event) => {
  if (event.actionName !== "fire") {
    return;
  }

  worldRef.current.spawnProjectile(event.payload);
});

useHostTick({
  mode: "fixed",
  intervalMs: 16,
  onTick: ({ deltaSeconds }) => {
    worldRef.current.step(deltaSeconds, gameRef.current.playersAlive);
  },
});
```

### Signal And Result Lane

Use signals and action acknowledgements for one-shot outcomes:

1. haptics
2. toast notifications
3. “action rejected because player is dead”
4. “action accepted and returned a result payload”

Do not push these through replicated state just to trigger an effect once.

## Anti-Patterns

Avoid these:

1. storing per-frame joystick movement in replicated state
2. storing host-only sim refs or particle instances in replicated state
3. creating fake replicated booleans just to trigger a one-shot sound
4. driving semantic game actions by browser clicks when the game already has an agent contract

## Fast Placement Test

Ask these in order:

1. Does this change every frame from a controller? Input lane.
2. Do host and controllers both need to render it later? Replicated state lane.
3. Does only the host runtime need it to simulate or render locally? Host-only runtime lane.
4. Is it just a one-shot notification or outcome? Signal/result lane.
