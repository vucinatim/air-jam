# Standalone Server and Hosted Composition

The open Air Jam server keeps rooms: it seats phones, carries their controls to
the game's host and the host's channels to the phones, holds seats while a
phone is away and keeps the latest copy of every channel. Local games need no
Air Jam account or product database. An application can embed the same server
and decide who may open rooms through its own gate.

The rooms themselves are plain synchronous code in `@air-jam/server/room`; the
Node server is one host for them. The protocol between devices and rooms is the
[room protocol contract](../contracts/room-protocol-contract.md).

## Standalone development

The `air-jam-server` command is the standalone front door. Local development
admits every host. In production, authentication defaults to required: a host
must present the server's master key (`AIR_JAM_MASTER_KEY`), or the server is
composed with a gate of its own. The master key suits a private server whose
hosts you run yourself; it is not a public authentication backend.

The generic Docker image and its Railway configuration run
`node ./bin/air-jam-server.mjs`. An intentionally open self-hosted server must
explicitly set `AIR_JAM_AUTH_MODE=disabled`; it logs a production warning
because any host can open rooms.

The server reads no hosted database and constructs no account, quota or usage
services. Those belong to the application that operates a hosted service.

## Application composition

Arcade is Air Jam's first-party library and launcher, not a prerequisite for
running a game. The public runtime and standalone server can serve compatible
browser games inside other launchers and embedded browser shells. Device
compatibility and platform approval still need validation for each target.

Import `createRoomServer` from `@air-jam/server/room-server` and the gate and
room types from `@air-jam/server/room`, never from unshipped source paths.

- **`gate`** decides whether a host may open a room, before the room exists:
  open it with its limits and labels, queue it (`wait` with a position), or
  refuse it (`unauthorised` or `try-later`). It sees the host's hello,
  including its opaque `credential`, and the connection's origin. A host
  returning to its room with its key needs no gate.
- **`limits`** are the limits the environment's own gates open rooms with
  (`DEFAULT_ROOM_LIMITS` otherwise). A custom gate states limits per room.
- **`allowedOrigins`** restricts which page origins may connect.
- **`otherRequests`** answers HTTP paths the room server does not own, as when
  one origin serves a built game beside its rooms.

`createServerLogging(options, envConfig)` provides the logger and collector for
composition. Give its logger to your gate and pass the same logger and
collector to `createRoomServer`, so gate and room events share the unified
local dev stream. The room server logs every room fact (opened, seat taken,
left, closed) through that logger.

`stop()` closes every room as `restarting`, so its devices reconnect to the
next process, then closes the server.

## What a room bounds

Each room enforces its limits on every connection; nothing reaches a handler
before it parses against the protocol's schemas. A connection that sends more
than `strikesPerSecond` frames that do not parse is closed `limits-broken`.

| Limit                                 | Default   |
| ------------------------------------- | --------- |
| Seats                                 | 16        |
| Channels                              | 8         |
| One channel's document or state frame | 64 KB     |
| Any other text frame                  | 8 KB      |
| One phone's control state             | 64 bytes  |
| Input frames per phone per second     | 120       |
| State frames per second               | 60        |
| Other text frames per second          | 60        |
| Seat hold while a phone is away       | 2 minutes |
| Room wait for its host                | 1 minute  |
| A room's longest life                 | 24 hours  |

A socket that stops reading while still answering pings is cut off once 4 MB
wait to leave for it; its seat or host is held, and its return is served from
the room's copies. The front door also counts connection attempts per address
(`AIR_JAM_RATE_LIMIT_WINDOW_MS`, `AIR_JAM_HOST_REGISTRATION_RATE_LIMIT_MAX`,
`AIR_JAM_CONTROLLER_JOIN_RATE_LIMIT_MAX`). Behind a proxy on a private or
loopback address, the address counted is the one its `X-Forwarded-For` names.

`GET /health` reports uptime, open rooms and seats; `GET /ready` answers 503
while `AIR_JAM_MAINTENANCE_MODE` is on.

## Package qualification

Pack a candidate with `pnpm run repo -- pack local`. Then run:

```bash
pnpm --silent run repo -- pack verify-server <setDir> --json
```

The verifier installs the SDK and server tarballs into a fresh temporary
consumer, checks strict TypeScript usage without workspace links, inspects
shipped server artifacts for hosted database code, opens a real room with a
host and a phone over WebSockets, checks that a published channel reaches the
phone, and checks health and readiness. It reports tarball hashes and
structured checks, then removes its owned temporary consumer.

This proof is separate from fast local checks. It verifies installed package
behaviour, not the private product build, UI, hosted policy or production
rollout.
