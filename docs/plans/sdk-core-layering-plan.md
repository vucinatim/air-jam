# SDK Core Layering Plan

Last updated: 2026-10-20
Status: in progress on `claude/sdk-core-layering`; phase 1 built, phase 2's clock built with Pong ported, headless runs next; phases 1, 5 and the game declaration are 1.0 scope

This plan owns giving the SDK a small framework-free core with React as a thin
binding over it, an SDK-owned clock that lets game logic run without drawing,
a written protocol other engines can implement, and agent lanes: a game
declaration, checks and templates that keep agent-written games on the
supported path. The
[vision](../vision.md) owns why: gameplay testing without drawing, replays and
live game settings all depend on it. The
[framework paradigm](../framework-paradigm.md) owns the three runtime lanes and
one owner per fact; this plan keeps both and changes where the runtime lives.

## Why

Air Jam's model is sound and mostly independent of React: rooms and
controllers, input per controller, a networked store whose actions only the
host runs, signals, commands and the agent contract. Pong already runs its
whole match through a pure `stepGame` function on a fixed clock.

The problem is where the runtime is assembled. It lives inside React:

1. the host runtime is a 1,400-line hook and the controller runtime a
   nearly 1,000-line hook
2. the clock is `useHostTick`, which only runs while a component is mounted
3. the store's state and actions are plain, but syncing it to the room happens
   inside a React hook that reads React context
4. input, players and the agent contract are reached through hooks

So no game can run without a browser and a mounted component tree, which
blocks headless tests, faster-than-real-time simulation and replays. Another
engine such as Unity cannot reuse any of it, and the protocol it would need to
speak is defined only by what that code happens to do.

Games add their own coupling on top. Air Capture declares its physics world as
React components (16 files use the React Rapier wrapper) and runs its logic in
the per-frame render hook across 22 files. Rapier itself is plain and
deterministic; the wrapper is what ties physics to drawing. Pong, Code Review
and The Office already use the SDK clock; Last Band Standing and
Minimal are driven by actions alone.

Nearly every Air Jam game will be written by agents with no person reading the
code, so what agents copy and what the tools reject decides game quality more
than any guidance. Today new projects get about 2,000 lines of mostly advisory
guidance (an instructions file, ten skills and fifteen reference docs), while
the Air Capture template demonstrates the pattern that guidance warns against.
The project's instructions file and skills belong to the project once created
and are never updated, so every game keeps the guidance it was born with.
Studio's worker has to be told that project guidance mentioning local session
and dev-server tools does not apply there.

## Decision

1. **A framework-free core.** A plain runtime object per surface, host and
   controller, owns the connection, room, players, input, the networked store
   and its sync, signals, commands, lifecycle and the agent contract. It runs in
   a browser, in Node without drawing, or faster than real time.
2. **React is a binding.** Hooks and components subscribe to the core. The
   friendly plug-and-play API stays; its implementation becomes thin. There is
   one runtime, never a React runtime beside a core runtime.
3. **The SDK owns time.** One fixed-step clock with seeded randomness advances
   game logic and physics; drawing reads state and never advances it.
4. **Games are not forced into a shape.** The one rule is that anything
   deciding the outcome of play advances from the SDK clock, not from the
   renderer. Logic as plain `step(state, inputs)` functions, as in Pong, is the
   recommended shape in templates and agent guidance, not a requirement.
   Rendering code stays as free and messy as games need.
5. **One package.** `@air-jam/sdk` stays a single package. The core is a
   subpath, `@air-jam/sdk/core`, that imports nothing from React, the DOM or UI
   libraries, checked in CI. Splitting packages would add versions and install
   steps for no gain: subpaths already give the boundary, and another engine
   implements the protocol in its own language rather than consuming a
   TypeScript package.
6. **The protocol is a contract.** Rooms, controller messages, input, store
   sync, actions, signals, commands and the agent contract are written down
   with a conformance suite. The TypeScript core is its first implementation;
   a Unity or Godot host would be another.
7. **Agents stay in lanes by construction.** What matters to tools is declared
   in one place, wrong paths fail checks whose errors name the fix, every
   template is exemplary, and the remaining guidance is short, the same in
   Studio and standalone, and updated with Air Jam.

## Expected shape

Sketches agreed on 2026-10-20 as indicators, not final names; phases 1 and 6
settle the exact API.

**Stays the same.** The app config, React components reading state, the
three lanes, host authority, rooms and QR joining. Input does not stay the
same: the [input system plan](./sdk-input-system-plan.md) replaces the input
schema with declared controls that the host applies at each simulation step.

```tsx
const { joinTeam } = usePongStore((s) => s.actions); // controller
const scores = usePongStore((s) => s.scores); // host UI
```

**State is declared, not created as a hook.** Today defining the store creates
a React hook and actions call `set`:

```ts
export const usePongStore = createAirJamStore<PongState>((set) => ({
  ...createInitialPongState(),
  actions: {
    joinTeam: (ctx, { team }) =>
      set((s) => reduceJoinTeam(s, { team, ...ctx })),
  },
}));
```

Next, a plain declaration with pure actions that return the new state; React
gets its hook from the binding:

```ts
export const pongState = defineState({
  initial: createInitialPongState,
  actions: {
    joinTeam: (s, { team }, ctx) => reduceJoinTeam(s, { team, ...ctx }),
  },
});
export const usePongStore = useAirJamState(pongState);
```

**The loop moves from a component into the game.** Today:

```tsx
useHostTick({ mode: "fixed", intervalMs: 16, onTick: ({ deltaSeconds }) => stepGame({ ... }) });
```

Next, the game declares its step, the SDK runs it, and components only read:

```ts
step: (sim, { inputs, dt, random }) => stepGame(sim, inputs, dt, random),
```

```tsx
const sim = useSimulation(); // read-only, interpolated for drawing
```

**One declaration that tools read.** Studio's settings panel, agent knobs,
headless tests and replays all come from it:

```ts
export const airjam = createAirJamApp({
  metadata,
  controllerPath: "/controller",
  input: { schema },
  state: pongState,
  step,
  settings: {
    ballSpeed: setting.number({ min: 200, max: 900, default: 400, live: true }),
  },
  testing: "./testing/profiles.ts",
});
```

**Running without a browser.**

```ts
const run = await runHeadless(airjam, { seats: ["left", "right"], seed: 1 });
run.input("left", { direction: 1 });
run.advance(10_000); // ten seconds of game time in milliseconds of real time
expect(run.state.scores.team1).toBe(1);
```

```ts
import { createHostRuntime } from "@air-jam/sdk/core";
const host = createHostRuntime(airjam); // what seats, tools and the runner use
```

**Air Capture changes most.** Today physics is declared in JSX and moved by
the render loop:

```tsx
<RigidBody ref={body}>
  <Ship />
</RigidBody>;
useFrame((_, dt) => applyThrust(body.current, input, dt));
```

Next, logic owns the physics world and rendering only draws it:

```ts
step: (sim, { inputs, dt }) => {
  applyThrust(sim.ships, inputs, dt);
  sim.world.step();
},
```

```tsx
<Ship position={ship.position} rotation={ship.rotation} />
```

**Expected migration effort.** Action-driven party games such as Code Review
and The Office change little and mechanically; Pong is about an hour of moving
code; Air Capture rewrites its logic layer and keeps its rendering. Everything a
game declares becomes visible to agents and Studio without extra wiring.

## Delivery sequence

Each phase is production-valid on its own and stays in the final system.

### 1. Extract the core

1. `@air-jam/sdk/core` with host and controller runtime objects that own what
   the runtime hooks own today
2. the existing hooks reimplemented as subscriptions to those objects;
   their public API is unchanged unless the core shows a simpler one, in which
   case games and templates move with it in the same change
3. a CI check that the core's module graph has no React, DOM or UI imports

Done when every first-party game and template passes unchanged on the new
implementation, the runtime hooks are thin, and the core check runs in CI.

### 2. Give the SDK the clock

1. the core clock: fixed steps, seeded randomness, an interpolation value for
   drawing, real-time or as fast as possible
2. a headless runner in devtools that runs a game's host core in Node with no
   browser, seats players, sends input, advances time and reads the store
3. the one test interface from the vision, shared by local tools and Studio,
   on that runner; visual checks stay an explicit request for a drawn frame

Done when Pong's scoring profile runs headless in Node at ten times real time
or faster and gives the same verdict as in a browser.

### 3. Port Air Capture

1. its physics world created and stepped by logic from the SDK clock, using
   Rapier directly; drawing reads body transforms
2. flight, weapons, respawn and capture rules advance on the clock; its
   separate stores fold into the networked store or plain runtime state
3. play feels the same in the browser

Done when Air Capture's flight and combat tests run headless with no WebGL at
several times real time, and a played match matches before and after.

### 4. Write down the protocol

1. a public protocol contract covering transport messages and the semantics of
   rooms, input, store sync, actions, signals, commands and the agent contract
2. a conformance suite that drives any host implementation from outside it
3. the TypeScript core passes it; another engine is out of scope until wanted

Done when the suite runs against the TypeScript core from outside the SDK and
fails on a deliberately broken host.

### 5. Tidy the surface

1. audit the 23 subpath exports and the root exports; root keeps the React
   binding and creator conveniences, `core` keeps the runtime, and anything
   unused or duplicated is removed
2. creator docs, templates and the AI pack describe the layering in one place

Done when each export has one documented purpose and the docs show the core
and the React binding as one system.

### 6. Agent lanes

1. **One game declaration.** `airjam.config.ts` becomes the single place a
   game declares what tools rely on: state and actions, the step function,
   settings with their ranges, assets, theme tokens, test profiles and the
   player contract for agents. Tools read only what is declared, so the
   declared path is the one that gets live settings, headless tests, replays
   and Studio panels.
2. **Architecture checks.** `airjam evaluate` and its MCP tool gain an
   architecture gate beside typecheck, lint, tests and build. It fails on
   outcome logic advanced from render hooks, physics owned by rendering
   components, undeclared settings or assets, a missing headless test, or a
   missing player contract. Each failure states what is wrong and the exact
   change that fixes it. Studio runs it after every worker turn.
3. **Exemplary templates.** Every template passes the architecture gate and
   demonstrates the declared path; a template that cannot is not offered.
4. **One short rules file.** The rules move into the Air Jam-managed pack,
   which updates with the CLI. A project's own instructions file shrinks to a
   pointer to those rules plus that project's notes. Skills consolidate into
   the few workflows that need them.
5. **Environment from the tools.** Guidance says to use what the Air Jam tools
   offer; the MCP and CLI advertise which tools exist in the current
   environment, so Studio's embedded room and local development need no
   contradicting instructions.

Done when a fresh agent, given only "make a game like X" in a new project and
in Studio, produces a game that passes the architecture gate with declared
settings and a headless test, and Studio's worker instructions no longer
override project guidance.

## Progress

Built on `claude/sdk-core-layering` (2026-10-20), each step checked by the SDK,
devtools, game and contract suites and by playing Pong in a browser with a phone
controller:

1. `@air-jam/sdk/core` holds `HostRuntime` and `ControllerRuntime` behind
   environment ports; the React hooks bind to them. The SDK typecheck runs a
   boundary check: the core typechecks against web-worker globals only and may
   import only zod, zustand/vanilla, nanoid and socket.io. The built core
   reaches nanoid, zod and zustand/vanilla. Both runtimes run in plain Node in
   tests.
2. Stores are plain core objects from `createAirJamStore`, declared in
   `createAirJamApp({ stores })` and attached by the runtime whether or not a
   component reads them. React reads them with `useAirJamStore(store,
selector)`; dispatch is `store.actions`. Reading an undeclared store throws
   `AJ_STORE_NOT_DECLARED`. All six games, templates and creator docs moved.
3. `SimulationClock` steps a declared `createAirJamApp({ simulation })` with
   seeded randomness; browsers drive it from animation frames and headless code
   calls `advance(ms)`. React draws with `useSimulationFrame` and reacts with
   `useSimulationEvents`. Pong's whole match runs in `pongSimulation`.
4. A simulation declares what agents see with `observe(sim, context)`. The
   host runtime publishes it with the clock's tick, and also owns the agent
   contract registration and the input buffer, so all three work without
   React. A host view adds an image with `useHostAgentCapture`. The host
   environment gains a clock port (`now()`): input leases, command deadlines
   and observation timestamps run on it.
5. Test profiles run headless (`airjam session run start --headless`, MCP
   target `headless`). A child process runs the relay on a loopback port and
   the game's host core, built by `airjam.createHostRuntime` from the game's
   own SDK; players join over the relay as in owned runs. The existing run
   owner plays on a run clock: wall time for a live room, game time for a
   headless one, where waiting advances the simulation. Pong's scoring profile
   passes in a devtools test in about 4 seconds end to end.
6. The Office and Code Review play their whole matches in declared
   simulations, on game time with seeded randomness, and emit events the host
   turns into toasts, sounds and haptics. Their agent views moved into
   `observe`. `useHostTick` is removed. All three of their authored profiles
   pass headless: The Office's two-minute shift in about 17 seconds, Code
   Review's bot round in about 4 and its four-fighter brawl in about 7.

Decisions made while building:

1. `airjam.config.ts` stays the single declaration; tools already load it in
   Node. A separate React-free game definition file was not needed.
2. Store definitions import from `@air-jam/sdk/core`; the root exports only the
   React reading hooks, so there is one import path per concept.
3. Per-store hook objects and `useLiveStateRef` are removed;
   `store.getState()` is always current.
4. The headless room reuses the real relay and the Node controllers rather than
   an in-memory room, so headless and live runs share every protocol path.
5. The game's app builds its own host core. Monorepo games resolve the SDK to
   source through tsconfig paths, so a host built from the tool's SDK copy
   could not see the game's stores.

Measured: headless play runs about 6 to 8 times faster than real time on a
loaded bee, short of the ten times aimed for. Pong's scoring profile decides
every 100 ms, and each decision round costs about eight round trips between
the run owner, the room and the policy and evaluator processes. Profiles that
decide less often run proportionally faster. Fewer round trips per round, for
example observing every seat in one request, would raise it.

Next:

1. Port Air Capture's physics into a simulation (phase 3); its agent view then
   moves into `observe` and `useHostAgentObservation` is removed.
2. Store actions still read wall time (`Date.now()` for match timing); replays
   need them on game time.
3. Owned runs still refuse monorepo games (they need a standalone game with its
   own lockfile), so headless is the only profile run for first-party games.

## Releases and removals

The SDK is at 0.9 and semantic versioning starts at 1.0, so these changes are
clean breaks, not deprecations. No deprecated aliases or parallel old paths
ship. Each break comes with:

1. an architecture-gate or type error that names the replacement
2. a section in the migration guide
3. first-party games and templates already migrated in the same change

Removed along the way:

1. the runtime-owning hook internals, replaced by the core; public hooks keep
   their names only where they remain the right binding
2. root and subpath exports the surface audit finds unused or duplicated
3. logic advanced from render hooks and physics owned by rendering components
   in first-party games and templates, starting with Air Capture
4. the full rulebook in project-owned instructions files and the ten
   project-owned skills, replaced by the managed rules and a pointer; an
   `airjam ai-pack` migration shows the change and keeps the project's own
   notes
5. Studio's worker instructions that override project guidance
6. advisory guidance made redundant by a check

Breaking public exports after 1.0 needs a major release, so on 2026-10-20 Tim
put the API-shaping work in 1.0 scope: phase 1, phase 5 and the declaration
surface of phase 6 are 1.0 readiness items G6-08, G6-09 and G6-10 in the
private release program, and the 1.0 candidate waits for them. The clock, Air
Capture, the protocol suite and the architecture gate extend that API and may
follow 1.0.

## What it unlocks

1. fast gameplay tests without drawing, locally and in Studio
2. replays from a seed and recorded inputs, played back, scrubbed or seen from
   any seat
3. live game settings applied through the core rather than through components
4. Studio test seats and agent tools using the same core as games instead of
   their own clients
5. hosts in other engines through the protocol
6. agent-written games that land on the supported path without a person
   reviewing them

## Stop rules

1. stop if the core needs React, the DOM or a UI library
2. stop before a second runtime: hooks bind to the core, never reimplement it
3. stop before requiring any code structure beyond outcome logic on the clock
4. stop before splitting the SDK into multiple packages
5. stop before building another engine's host before the protocol suite exists
6. stop before keeping a deprecated path alongside its replacement
7. stop before a rule that exists only as guidance when a check can enforce it
