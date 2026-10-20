# SDK Core Layering Plan

Last updated: 2026-10-20
Status: direction agreed with Tim, not started; phases 1, 5 and the game declaration are 1.0 scope

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
