# SDK Input System Plan

Last updated: 2026-10-24
Status: phases 1 and 2 built on `claude/sdk-input-system`, on top of the core layering branch; phases 3 and 4 next; phases 1 and 2 are 1.0 scope

This plan owns how players' input gets from any device into a game: one
declaration of what a game reads, one set of meanings for buttons and sticks,
pluggable sources for phones, keyboards, gamepads, agent seats and replays, and
one host-side lane on the game clock. The
[core layering plan](./sdk-core-layering-plan.md) owns the clock, the core
runtimes and the game declaration this extends; where its expected shape says
the input schema stays the same, this plan replaces that. The
[framework paradigm](../framework-paradigm.md) owns input as one of the three
runtime lanes; this plan keeps it one lane.

## Why

Input works, but each piece was added on its own:

1. a game declares a zod schema and, separately, lists of field names that are
   read as tap-safe, sticky or latest
2. every controller runs its own send loop: Air Capture writes its whole input
   every 16 ms from a local store, and stamps it with the phone's wall clock
3. agent seats write the same buffer through leases, with their own expiry
4. there is no keyboard or gamepad player; the only key handling in games is a
   host-side debug camera
5. input is not recorded, so a match cannot be replayed from its inputs

Nearly every Air Jam game will be written by agents. Without an SDK path,
keyboard play means each agent writing its own key listeners in the host
screen, outside players, teams, tests and replays. With one, every game gets
keyboard and gamepad play, Studio testing becomes immediate and tactile, and
phones turn the same feel into multiplayer.

## Decision

Input is a declared set of typed controls. Every device is a source that fills
those controls for one player seat. The host applies them on the game clock,
with fixed meanings per control kind, and records them.

1. **Controls, not schemas.** A game declares named controls of a few kinds:
   `button`, `axis` (one number from -1 to 1) and `stick` (two). The zod
   schema, the wire shape, the agent description and the default bindings all
   derive from that declaration. The tap-safe, sticky and latest lists go away.
2. **Meanings live in the kind.** A button is either held (true while down) or
   pressed (true for exactly one step per press). Presses travel as a counter,
   so a tap between two packets or two steps is never lost or doubled. A stick
   can keep its last direction for games such as snake. Games never debounce or
   latch input themselves.
3. **Sources are modules.** Phone controls, keyboard layouts, gamepads, agent
   seats and the replay log each implement one source interface: bind to a
   seat, report control values, release. Adding a source, such as device tilt,
   adds bindings to the vocabulary and changes no game.
4. **Every source is a seat.** A keyboard layout or gamepad joins the room as a
   real controller through the core controller runtime: it appears in the
   lobby, joins teams with the same actions as a phone and leaves like one.
   Local players use the game's own controller screen as a preview phone for
   menus and lobby buttons; keys and buttons drive play.
5. **Input meets the game at a step.** The host samples each seat's latest
   values once per simulation step, applies the kind's meaning and hands the
   step `ctx.input(playerId)`. Only changes are recorded, by tick, into the
   input log that headless runs and replays feed back.
6. **The SDK sends.** Phone controls send on change, coalesced to the display
   frame, with a slow keepalive; games no longer run send loops, and nothing
   stamps input with a device clock.
7. **Game code never reads devices.** Key listeners, gamepad polling and motion
   events belong to sources. Host-local view controls that never change game
   state, such as a debug camera, stay ordinary host UI.
8. **Sticks are y down.** A stick's y grows towards the bottom of its surface,
   like screen space and the browser Gamepad API. Most Air Jam games draw in
   screen space, so the common case needs no flip and a gamepad source passes
   its axes through; a game that wants y up, such as Air Capture's climbing
   flier, flips once where input enters its own model. Decided in the review of
   vucinatim/air-jam#135 after The Office had to flip a y-up stick.

## Expected shape

Indicators, not final names; phase 1 settles the API.

```ts
export const pongInput = defineAirJamInput(
  { direction: axis() },
  {
    keyboard: [
      { direction: keys("KeyW", "KeyS") },
      { direction: keys("ArrowUp", "ArrowDown") },
    ],
    gamepad: { direction: "leftStickY" },
  },
);

export const shipInput = defineAirJamInput(
  { move: stick(), fire: button("pressed"), boost: button("held") },
  {
    keyboard: [{ move: wasd(), fire: "Space", boost: "ShiftLeft" }],
    gamepad: { move: "leftStick", fire: "south", boost: "rightTrigger" },
  },
);
```

```tsx
<Stick control={shipInput.move} />
<PressButton control={shipInput.fire}>Fire</PressButton>
```

```ts
step: (sim, { input }) => {
  for (const player of players)
    steer(sim, player.id, input(player.id)?.move);
},
```

## Delivery sequence

Each phase is production-valid on its own. Phases 1 and 2 change the public
API and land before 1.0, as the 1.0 roadmap records; phases 3 and 4 only add
and may follow it.

### 1. Declared controls on the clock

1. `defineAirJamInput` with `button`, `axis` and `stick`, deriving the schema,
   wire shape and agent input description
2. the host input buffer applies each kind's meaning per simulation step, on
   the host clock, with press counters
3. agent leases become a source of the same controls
4. the input log records changes by tick; headless runs read and write it
5. all games migrate; the behavior lists and Air Capture's timestamp field are
   removed

Done when every game declares controls, a headless Pong run records its input
log, and replaying that log reproduces the match's final score.

### 2. Phone controls

1. SDK controller components bound to controls: stick, axis slider or pad,
   pressed and held buttons
2. the SDK owns sending; `useControllerTick` send loops and hand-written input
   writers in games are removed
3. controls stay styleable through the game's theme tokens

Done when Pong's and Air Capture's controllers contain no send loop and play
the same on a phone.

### 3. Local players

1. keyboard layouts and gamepads as sources, from the bindings the game
   declares; the standard gamepad layout is the vocabulary
2. each layout in use joins as a seat on first input; Studio shows local seats
   and lets the creator move one to another player
3. keys count only while the game has focus, so typing in Studio never moves a
   paddle; Studio and the Arcade grant their game frames the browser's
   `gamepad` permission
4. on by default in local development and Studio, opt-in in the Arcade

Agents prove mappings with SDK tests over simulated key and gamepad states and
key presses in a local game page. Tim proves real gamepads in his own browser.

Done when in Studio the creator presses W and joins Pong as "Keyboard 1", a
gamepad joins as a second player, both play against a phone, and Air Capture
flies from a gamepad stick.

### 4. Agent lanes

1. every template declares controls and keyboard and gamepad bindings; agent
   guidance requires bindings for any game with continuous input
2. the architecture gate fails on game code that reads keys, gamepads or
   motion itself, runs its own send loop, or reads input outside a step

Done when a fresh agent asked for a racing game produces one that plays from
the keyboard, a gamepad and a phone without being asked.

## Progress

Built on `claude/sdk-input-system` (2026-10-24), checked by the SDK, devtools,
game and contract suites:

1. **Declared controls (phase 1).** `defineAirJamInput` with `button("held")`,
   `button("pressed")`, `axis()` and `stick({ keepDirection })` from
   `@air-jam/sdk/core` derives the wire schema, the agent schema and the
   input description agents read. The host's input lane (`HostInput`)
   samples every seat before each simulation step: presses travel as a
   counter, a pressed button reads true for exactly one step per press, a
   held button also catches a tap shorter than a step, and a source that
   restarts counts from zero again. `input(playerId)` always returns every
   control, released and centred before any input. Input reaches a game only
   in its steps: `InputManager`, the behavior lists, `useGetInput` and the
   host's `getInput` are gone, and declaring input without a simulation
   fails fast.
2. **Agents as a source.** Leases set values (a button `true` or `false`, an
   axis a number, a stick `{ x, y }`) and a button's rising edge is one press.
   The raw `send_game_session_input` path converts the same way.
3. **Input log and replay.** A host started with `{ record: true }` keeps
   everything that reached its game, stamped with the step it reached it
   before: joins, leaves, profile updates, runtime state, store actions
   applied between steps and each seat's controls when they changed. Actions
   a step dispatches replay with the simulation and are not recorded.
   `replayAirJamInputLog` plays a log on a fresh host through an in-memory
   room. Headless runs record it into their evidence, and
   `airjam session run replay <run-id>` (MCP `airjam.replay_game_run`)
   replays it and compares where it ends with the run's final observation.
   A headless Pong scoring run records 42 entries over 275 steps and its
   replay ends with the same score, simulation state and step.
4. **Phone controls (phase 2).** The controller runtime holds its player's
   controls and sends them once per display frame when they change, after
   joining and on a one-second keepalive; nothing stamps input with a device
   clock. `ControlButton`, `AxisButton` and `Stick` in `@air-jam/sdk/ui` bind
   phone UI to controls, set `data-active` for styling and release when the
   page loses focus. The stick reads its own frame from corner markers, so
   a rotated controller surface needs no game code. `useInputWriter` and
   `useControllerTick` are gone, and the canonical guard rejects
   hand-written input sending in games.
5. **Games.** Pong (`direction` axis), Air Capture (`vector` stick, held
   `action`, pressed `ability`), Code Review (two axes, two pressed punches,
   held guard) and The Office (4-way `move` stick, held `action`) declare
   controls and use the SDK's controls. Air Capture's input timestamp is gone
   and its turn deadzone moved into the simulation. Code Review's tilt mode
   drives the declared axes through the controller's input lane. Last Band
   Standing and Minimal read no input and declare none.

Next:

1. Phase 3, local players: keyboard layouts and gamepads as sources.
2. Code Review reads device tilt in game code; it becomes an SDK tilt source
   in phase 3.
3. The hosted product's input flow diagram still shows schemas and send loops.

## Removals

Pre-1.0 removals are clean breaks, per the core layering plan: the input
config's behavior lists, `useInputWriter` as a game-facing API, input send
loops in games, and wall-clock fields in input shapes.

## Stop rules

1. stop before a second path by which input reaches a game
2. stop before any game-specific device code in the SDK, or device code in a
   game
3. stop before a source that cannot be recorded into the input log
