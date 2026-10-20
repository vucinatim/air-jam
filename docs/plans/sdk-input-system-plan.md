# SDK Input System Plan

Last updated: 2026-10-20
Status: direction agreed with Tim, not started; follows the core layering plan's game clock; phases 1 and 2 are 1.0 scope

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

## Removals

Pre-1.0 removals are clean breaks, per the core layering plan: the input
config's behavior lists, `useInputWriter` as a game-facing API, input send
loops in games, and wall-clock fields in input shapes.

## Stop rules

1. stop before a second path by which input reaches a game
2. stop before any game-specific device code in the SDK, or device code in a
   game
3. stop before a source that cannot be recorded into the input log
