# SDK Input System Plan

Last updated: 2026-10-25
Status: phases 1 and 2 merged into `release/1.0` (vucinatim/air-jam#135); phase 3 designed and in progress on `claude/sdk-local-players`; phases 1 and 2 are 1.0 scope

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
export const pongInput = defineAirJamInput({ direction: axis() });
export const pongInputBindings = defineAirJamInputBindings(pongInput, {
  keyboard: [
    { direction: keyAxis("KeyW", "KeyS") },
    { direction: keyAxis("ArrowUp", "ArrowDown") },
  ],
  gamepad: { direction: "leftStickY" },
});

export const shipInput = defineAirJamInput({
  move: stick(),
  fire: button("pressed"),
  boost: button("held"),
});
export const shipInputBindings = defineAirJamInputBindings(shipInput, {
  keyboard: [{ move: wasd(), fire: "Space", boost: "ShiftLeft" }],
  gamepad: { move: "leftStick", fire: "south", boost: "rightTrigger" },
});
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

A keyboard layout or a gamepad is a player without a phone. It gets a real
seat, a preview phone running the game's own controller screen, so it joins,
picks teams and answers menus like any player. Its keys or buttons drive that
seat's controls.

1. **Bindings declared for the controls.** `defineAirJamInputBindings(input,
bindings)` takes `keyboard`, a list of layouts (one local player each),
   and `gamepad`, one mapping every connected gamepad uses, checks them
   against the controls' kinds, and goes to `createAirJamApp({ input,
inputBindings })`. Keys are `KeyboardEvent.code` values. A button binds
   one or more keys. An axis binds `keyAxis(negative, positive)`. A stick
   binds `wasd()`, `arrows()` or `keyStick({ up, left, down, right })`. Gamepad names come from the standard
   layout: `south`, `east`, `west`, `north`, bumpers, triggers, `select`,
   `start`, stick presses and the d-pad for buttons; `leftStickX`/`Y` and
   `rightStickX`/`Y` for axes; `leftStick`, `rightStick` or `dpad` for
   sticks. Sticks pass the Gamepad API's axes through, since both are y down.
2. **Sources are pure.** A keyboard source turns key downs and ups into
   operations on a seat's controls, and a gamepad source turns each polled
   snapshot into the same operations, with a radial deadzone on sticks and a
   threshold on analog triggers bound to buttons. Both drive the
   `ControllerInput` interface (`press`, `hold`, `set`) and live in the core,
   so SDK tests check every mapping in Node.
3. **Sources run where focus is.** The host page listens to keys and polls
   gamepads only while its document has focus, so typing in Studio chat never
   moves a paddle. Repeated key events never count as presses, keys aimed at
   the page's own buttons and fields stay theirs, losing focus releases every
   local seat, and an unplugged gamepad releases its own.
4. **Seats on first input.** The first bound key of a layout, or the first
   button of a gamepad, asks for a seat named "Keyboard 1", "Keyboard 2" or
   "Gamepad 1", queuing its operations until the seat is ready. The seat stays
   until its phone is removed; a refused or closed seat is asked for again on
   the next input.
5. **One sender per seat.** The host page forwards a seat's operations to its
   preview phone, which applies them to the `ControllerInput` its own screen
   uses. The phone stays the seat's only input sender, so keepalives, the
   input log and replays need nothing new. A phone takes local input only from
   its parent, and only when it was launched as a local seat: the parent
   origin its topology declares, else its own origin, as the preview
   workspace launches it.
6. **Whoever owns the phones provides seats.** In standalone local
   development the SDK's preview workspace launches them, a seat's phone
   being the session launched for its key. An embedded host first asks its
   parent whether it provides seats (`airjam.local-seat.query`, answered with
   `available`) and takes keys and gamepads only after a yes; it then
   requests seats, and the parent answers `opened`, `refused` or later
   `closed`. Studio answers with Studio phones, relays operations to the
   phone's frame or, through a page of its own, its window, and grants its
   game frame the `gamepad` permission. The Arcade doesn't answer until a game
   opts in, so its keys stay its own. Games configure nothing.

Agents prove mappings with SDK tests over simulated keys and gamepad
snapshots, and seats with key presses in a local game page. Tim proves real
gamepads in his own browser.

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

6. **Local players, framework side (phase 3).**
   `defineAirJamInputBindings(input, bindings)` takes keyboard layouts and a
   gamepad mapping, checked against control kinds when declared, and goes to
   `createAirJamApp` as `inputBindings`.
   `KeyboardSource` and `GamepadSource` in the core turn key edges and polled
   snapshots into `press`, `hold` and `set` on a seat. Repeats never press,
   diagonals stay unit length, sticks get a radial deadzone, an analog trigger
   presses past half, and an untouched gamepad sends nothing. The host runtime
   runs them for every game that declares bindings: first input opens a seat,
   operations queue until its phone reports ready, a removed phone frees the
   seat for the next input, and losing focus, visibility or a gamepad
   releases what it held. The preview workspace provides seats in standalone
   development by launching a preview phone named "Keyboard 1" or "Gamepad
   1"; an embedded host asks its parent with `airjam.local-seat.*` messages,
   exported from `@air-jam/sdk/preview` for products, and starts only once
   the parent says it provides seats. Pong, The
   Office, Air Capture and Code Review declare bindings. In a local Pong page,
   pressing W opened "Keyboard 1", the phone joined a team with its own
   buttons, and holding S drove its paddle down.

Next:

1. Phase 3, product side: Studio answers seat requests with Studio phones,
   relays operations to the phone's frame or window, and grants its game frame
   the `gamepad` permission; Tim proves a real gamepad.
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
