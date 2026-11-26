<!-- Generated from content/docs/for-agents/state-and-rendering/page.mdx. Do not edit directly. -->
<!-- Canonical public doc: https://airjam.io/docs/for-agents/state-and-rendering -->

# State and Rendering

Air Jam projects often combine React, Zustand, per-frame gameplay logic, and sometimes R3F or Three.

That stack works well only when state ownership is explicit.

## Core State Rules

1. keep authoritative gameplay state separate from local UI state
2. avoid one mega store for unrelated concerns
3. use narrow selectors when consuming Zustand state
4. keep store writes intentional and coarse
5. keep per-frame mutable values out of React state when React rendering is not needed

These are framework-level rules about ownership and performance.
They do not require one exact store or engine file layout.

## React Rules

1. do not run simulation through React rerenders
2. keep business logic out of presentational components
3. use refs for hot mutable runtime values
4. keep component boundaries small and purposeful

## Starter Template Reference

The starter Pong template demonstrates one good starter implementation of the state/rendering split:

1. `src/game/stores/pong-store.ts` owns Air Jam store wiring
2. `src/game/stores/pong-store-state.ts` owns pure state transitions
3. `src/game/engine/runtime-state.ts` owns per-frame mutable values
4. `src/game/engine/simulation.ts` owns update ordering and orchestration
5. `src/game/ui/` owns reusable game-facing presentation that host and controller surfaces can share

That split is a recommended starter pattern, not a mandatory framework contract.
If the game needs a different module layout, preserve the same ownership boundaries rather than copying the filenames literally.

## Starter Testing Pattern

The starter template also mirrors those boundaries in tests:

1. `tests/game/domain/` for pure gameplay rules
2. `tests/game/stores/` for pure state transitions
3. `tests/game/engine/` for focused runtime helpers
4. `tests/game/adapters/` for transport-facing mapping
5. `tests/game/ui/` for shared game-facing UI modules that do not require full host/controller shells

The default order is:

1. test pure logic first
2. test thin adapter boundaries second
3. add heavier runtime or browser-facing coverage only where the integration boundary actually matters

## R3F and Three Rules

1. avoid rerendering scene components on every frame
2. mutate refs in frame loops when visual updates do not require React state
3. keep rendering integration separate from pure game rules
4. use instancing when repeated objects justify it

## Loading and the Reveal

In the Arcade and the Studio, the page around a game keeps its own cover up
until the game's host says it is ready, so players never watch a game assemble
itself. The host is ready once it has mounted, its fonts have loaded and its
room is connected. Anything still loading after that holds the reveal with
`<HoldReveal />` from `@air-jam/sdk`:

1. render it in every Suspense fallback on the host, including the route-level
   fallback around a lazy host view: `<Suspense fallback={<HoldReveal />}>`
2. put a Suspense boundary with that fallback around R3F content that loads
   models or textures (`useGLTF`, `useTexture`), so the scene appears whole
3. render it conditionally for any other loading the host waits on:
   `{!ready && <HoldReveal />}`

A fallback can draw its own placeholder and include `<HoldReveal />` inside it.
The reveal happens once; holding again later changes nothing, and outside a
host it does nothing.

## Air Jam Lane Rules

Keep the framework lanes separate:

1. input lane for high-frequency player control input
2. replicated state lane for replayable shared truth
3. signal lane for coarse UX and system events

Do not use replicated store actions as a substitute for per-frame input handling.

## Common Pitfalls

1. putting gameplay logic directly in render components
2. using React state as the simulation engine
3. selecting whole stores across many components
4. mixing debug state into hot runtime paths
5. solving every state problem with more component state
