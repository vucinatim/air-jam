# Room Protocol Contract

Last updated: 2026-11-24
Status: built, not yet served. The room core and this protocol exist beside
today's socket.io server; a Node host and the Durable Object host serve it in
later phases, and the SDK switches to it in one change that deletes socket.io.

Related docs:

1. [Runtime topology](./runtime-topology-contract.md)
2. [Framework paradigm](../framework-paradigm.md)

## Purpose

This is the wire protocol between a game's screen (the host), the players'
phones and the room that joins them, and the rules every room enforces. It is
written for anyone implementing a client or a host in another engine. Three
things in the public packages are its executable form and win over this text:

1. `@air-jam/sdk/room-protocol`: the zod schema of every frame, close codes,
   limits, the state patch and the binary input codec.
2. `packages/sdk/tests/fixtures/room-protocol-golden-frames.json`: the
   canonical encoding of every frame, including binary input as hex.
3. `@air-jam/server/room`: the `Room` every host runs.

## Addressing

One WebSocket per device. Role and room are in the path, so a front door or
relay routes and restricts without reading a frame. The path's `v1` is the
protocol's major version.

| Who                     | Path            |
| ----------------------- | --------------- |
| A host opening a room   | `/v1/host`      |
| A host returning to one | `/v1/host/CODE` |
| A phone                 | `/v1/play/CODE` |

Codes are 4 to 8 characters of `A-Z0-9`. Front doors assign four from
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, which has no look-alikes. A local host
that wants a particular code, such as `GAME`, connects to `/v1/host/GAME`
without an `instance`; a local server opens the room with that code when no
room holds it. Hosted front doors always choose the code.

## Keys, join and resume

A client generates a key of 128 random bits and stores it before it first
connects. Its first frame is `hello` with that key. The same key always means
the same host or seat, so a join is idempotent: a `welcome` lost in transit is
recovered by saying hello again.

A `hello` carrying `instance` is a resume: the client names the room instance
its key belongs to. A resume never creates a seat. If the room is a different
instance (its code was reused) or the seat is gone, the room closes the
connection as `not-found` and the client asks its player to join again.

When a key arrives on a new connection while its old one is still open (two
tabs, Wi-Fi to cellular with the old socket silently dead), the new
connection takes over at once and the old one is closed as `replaced`, which
tells it not to reconnect. Nothing without the key can take a live seat.

## Frames

Text frames are JSON objects with a `type`. Binary frames are input. The
literal text frames `ping` and `pong` are the heartbeat: clients send `ping`
every 20 seconds and the room answers `pong`.

Within a version change is additive. Receivers ignore frame types and fields
they do not know; `hello` and `welcome` list optional `features`. A breaking
change is `/v2`, served beside `/v1`.

### From a host

| Frame      | Fields                                                         | Meaning                                                                                                                          |
| ---------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `hello`    | `key`, `instance?`, `sdk`, `features?`, `credential?`, `seats` | Open or reclaim the room. `credential` is for the gate; `seats` the players its game takes (1–16), which the room never guesses. |
| `state`    | `channel`, `revision`, `document`, `fingerprint?`, `private?`  | A channel's whole document.                                                                                                      |
| `state`    | `channel`, `revision`, `base`, `set`, `unset`                  | A patch from revision `base` to `revision`.                                                                                      |
| `response` | `seat`, `id`, `result`                                         | The answer to a phone's request.                                                                                                 |
| `signal`   | `seat?`, `kind`, `payload?`                                    | A one-shot message to one seat or every phone: haptics, toasts, sounds.                                                          |
| `room`     | `seats?`, `locked?`                                            | Players wanted; whether new players are admitted at all.                                                                         |
| `remove`   | `seat`                                                         | Free a seat and close its phone for good.                                                                                        |
| `drop`     | `channel`                                                      | Discard a channel.                                                                                                               |
| `activity` | `activity` (string or null)                                    | What is on screen; only where the gate allows it, as for a launcher.                                                             |
| `end`      | —                                                              | Close the room now.                                                                                                              |

### From a phone

| Frame     | Fields                                                     | Meaning                                                  |
| --------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| `hello`   | `key`, `instance?`, `sdk`, `features?`, `kind`, `profile?` | Join or resume. `kind` is `phone`, `preview` or `agent`. |
| binary    | input frame                                                | The seat's whole control state.                          |
| `request` | `id`, `channel`, `name`, `payload?`                        | A store action or other call the host answers.           |
| `profile` | `label?`, `avatarId?`                                      | Change name or avatar.                                   |
| `leave`   | —                                                          | Give the seat up now.                                    |

A profile is `label` (1–24 characters), `avatarId` (1–48) and
`localSeatLabel` (1–32), a label shown instead of the player's own while a
local seat plays through the phone.

### From the room

| Frame      | To     | Fields                                                                                                                                       |
| ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `welcome`  | host   | `code`, `instance`, `seats`, `channels` (whole, with `fingerprint` and `private`), `limits`, `features`, `seatsWanted`, `locked`, `activity` |
| `welcome`  | phone  | `code`, `instance`, `seat`, `seats`, `channels` (as this seat may see them), `limits`, `features`, `host`                                    |
| `wait`     | host   | `position`, while admission is queued                                                                                                        |
| `seat`     | all    | `seat`: `id`, `label`, `color`, `avatarId?`, `kind`, `connected`                                                                             |
| `left`     | all    | `seat`, freed                                                                                                                                |
| `host`     | phones | `present`: the screen went away or came back                                                                                                 |
| binary     | host   | one or more input records                                                                                                                    |
| `state`    | phones | a document or patch, without other seats' private entries                                                                                    |
| `need`     | host   | `channel`: send the whole document                                                                                                           |
| `request`  | host   | `seat`, `id`, `channel`, `name`, `payload?`                                                                                                  |
| `response` | phone  | `id` with `result`, or `refused: "host-away"` when the room answered itself                                                                  |
| `signal`   | phones | `kind`, `payload?`                                                                                                                           |
| `drop`     | phones | `channel`                                                                                                                                    |

`hello` is acknowledged by `welcome`; nothing else is. A request is answered
by `response`. If the connection drops first the caller treats the request as
unconfirmed and decides whether to try again; the room keeps no list of
pending requests.

## Input

Input is binary and the room never decodes it. A game's declared controls fix
the layout, in declaration order:

| Control | Bytes | Encoding                                                              |
| ------- | ----- | --------------------------------------------------------------------- |
| stick   | 2     | x then y, each a signed byte in hundredths (−100 to 100)              |
| axis    | 1     | a signed byte in hundredths                                           |
| button  | 1     | the top bit is down; the low seven bits count presses and wrap at 128 |

A phone frame is the kind byte `1` and those bytes: a stick and two buttons
are 5 bytes. The host unwraps press counters against the state it last
decoded for the seat, so a tap is never lost or doubled.

The room checks the frame's length and rate and forwards a host frame: the
kind byte `1`, then per record two bytes of seat number (big-endian), one byte
of length and the control bytes. A host that pays per message may join records
that arrive together into one frame; the room never waits to batch. Input is
dropped while the host is away and never stored.

Phones send on change, at most once per `limits.inputIntervalMs`. Button edges
go at once; stick movement waits for the interval and counts only when it
moves two hundredths, except to the centre and the rim. A phone re-sends its
controls once after joining and when the host returns.

## State

A channel is a named JSON document the host alone writes: a game's store, a
launcher's shell, the SDK's presentation state. The room keeps a copy of each.

- A document frame replaces the copy. A patch applies to the copy only when
  its `base` is the copy's revision; otherwise the room drops it and sends
  `need` once, until a document arrives.
- A patch's `unset` paths are removed, then its `set` pairs assigned. Paths
  descend only through plain objects; arrays and other values are replaced
  whole, and a value may be `null`. A patch that removes a missing key or runs
  a path through anything but a plain object does not fit.
- Phones receive the same revisions as the host sent. A phone that sees a
  patch whose base is not its own revision ignores patches until a document
  arrives.
- `private` names a top-level field keyed by seat id. Each phone sees only its
  own entry, in `welcome`, documents and patches; a patch that only touched
  others' entries still reaches it, empty, so its revisions stay whole.
- A joining or returning phone is served its copies in `welcome` without the
  host. A returning host gets every copy whole with its `fingerprint`, the
  store's shape, and takes its state back only when the fingerprint matches.
- State is never echoed to the host.

A document weighs the JSON bytes of its keys and of every value that is not a
plain object; punctuation is not counted. A channel may weigh at most
`limits.stateBytes`, and a host whose copy would outgrow it is closed.

## Rules

| Rule       | What the room does                                                                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seats      | Ids `p1`, `p2`… in join order, never reused in a room. A free colour, the profile, or "Player N".                                                                                                                    |
| Admission  | A new player is refused as `full` before the host has said how many seats it wants, beyond them (held seats count) or while `locked`; a returning key is not.                                                        |
| Seat hold  | A dropped phone's seat is shown disconnected and held for `seatHoldMs` (two minutes; zero for agents), then freed.                                                                                                   |
| Host grace | A dropped host keeps its room for `hostGraceMs` (60 seconds); phones are told the screen is away. Then the room closes.                                                                                              |
| Routing    | Input and requests go to the host stamped with the seat; responses and signals go to the seats they name.                                                                                                            |
| Limits     | Per connection and lane, in one-second windows: over-rate and malformed frames are dropped and counted, and more than `strikesPerSecond` closes the connection. A frame or document over its size closes it at once. |
| Lifecycle  | The host's `end`, the host grace, `maximumAgeMs` and the operator's stop close the room and every connection.                                                                                                        |

Deadlines are applied whenever the room is called, so a late timer never lets
a device do something the rules say has expired.

### Close codes

Terminal codes tell the client not to reconnect. Every other close, including
a code missing from this table such as a lost network, is retried with backoff
and jitter, and at once when the device comes back online or the page becomes
visible.

| Reason                | Code | Terminal | When                                                |
| --------------------- | ---- | -------- | --------------------------------------------------- |
| `replaced`            | 4000 | yes      | A newer connection presented the key                |
| `removed`             | 4001 | yes      | The host removed the seat                           |
| `left`                | 4002 | yes      | The phone gave up its seat                          |
| `closed`              | 4003 | yes      | The room closed                                     |
| `not-found`           | 4004 | yes      | No such room instance, or the seat is gone          |
| `full`                | 4005 | yes      | No seat for a new player                            |
| `unauthorised`        | 4006 | yes      | The host key or credential is wrong                 |
| `unsupported-version` | 4007 | yes      | The `hello` could not be read                       |
| `limits-broken`       | 4008 | yes      | Too large, or too many dropped frames               |
| `restarting`          | 4100 | no       | The server is shutting down or cannot read its room |
| `try-later`           | 4101 | no       | Admission is unavailable for now                    |

### Limits

Fixed when the room opens; `welcome` carries them. Hosted policy may tighten
them per account or app.

| Limit              | Default    |
| ------------------ | ---------- |
| `seats`            | 16         |
| `channels`         | 8          |
| `inputIntervalMs`  | 16         |
| `inputBytes`       | 64         |
| `inputsPerSecond`  | 120        |
| `stateBytes`       | 65,536     |
| `statesPerSecond`  | 60         |
| `frameBytes`       | 8,192      |
| `framesPerSecond`  | 60         |
| `strikesPerSecond` | 64         |
| `seatHoldMs`       | 120,000    |
| `hostGraceMs`      | 60,000     |
| `maximumAgeMs`     | 86,400,000 |

## Hosts

A host runs `Room` and does only transport:

1. Route by path. A host opening a room (on `/v1/host`, or on
   `/v1/host/CODE` without an `instance` where codes may be asked for)
   passes its `hello` to the gate first:
   open (with limits, labels, the starting activity and whether the host may
   change it), wait (send `wait` and ask again), or refuse (close
   `unauthorised` or `try-later`). On open it calls `Room.open` with a code
   and instance of its choosing and the host's key.
2. Call `connect(connection, role, hello, now)` with the first frame and the
   role from the path, `receive` for each later frame, `disconnect` when a
   socket closes, and `wake` at `nextWake()`. Answer `ping` itself if it can.
3. Apply each returned effect in order: send, close with the reason's code,
   or record the fact. A `closed` fact means the room is finished.
4. Persist `save()`'s changes if rooms must survive the process; on restart
   call `Room.restore` with the merged state and the connections still open.
   Saved state carries a schema number; a room saved by a newer release
   closes its connections as `restarting` and does not come back.

The core takes no clock, timer, randomness or storage. The gate, the limits
object and the facts stream are the only seams for policy: facts are
`opened`, `seat-joined`, `seat-dropped`, `seat-left`, `activity` and
`closed`, each with the time, room code, instance and the gate's labels. The
public package ships two gates, open to all and a shared master key.
