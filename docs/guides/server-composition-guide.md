# Standalone Server and Hosted Composition

The open Air Jam server owns room lifecycle, controller input, game launch,
replicated state, origin checks, rate limits and draining. Local games do not
require Air Jam accounts or a product database. An application can embed the
same server and supply its own identity, admission and reporting services.

The library entrypoint described here is an unreleased separation change. Use
the exact local candidate package set until it is published; the existing
registry version must not be assumed to contain the new exports.

## Standalone development

The existing `air-jam-server` command remains the standalone front door. Local
development defaults to local room/controller admission and disabled identity
checks. In production, authentication defaults to required and needs an explicit
adapter; a local master key is not a production authentication backend.

The generic Docker image and its Railway configuration run
`node ./bin/air-jam-server.mjs`. That command has no hosted authentication
adapter. An intentionally open self-hosted server must explicitly set
`AIR_JAM_AUTH_MODE=disabled`; it emits a production warning because any host
can create rooms. For authenticated production hosting, compose the library
with your own adapter instead. Do not disable authentication to recover the
private hosted product; its deployment configuration belongs to that product.

The server does not read a hosted database URL or automatically construct Air
Jam's managed account, quota or usage services. Those belong to the application
that operates the hosted service. This changes the previous managed-server env
integration and must be called out in the package release migration notes.

## Application composition

Arcade is Air Jam's first-party library and launcher, not a prerequisite for
running a game. The public runtime and standalone server can serve compatible
browser games inside other launchers and embedded browser shells. A proprietary
first-party client is a separate distribution choice; it must not require a
private variant of the game runtime. Device compatibility and platform approval
still need validation for each target; source ownership alone proves neither.

Import `createAirJamServer` and contract types from `@air-jam/server`, never from
unshipped source paths. Supply `authService` for host verification,
`realtimeAdmissionService` for authoritative capacity/leases,
`runtimeUsagePublisher` for usage facts and `operationalEventPublisher` for
runtime failure reports. Reuse the SDK protocol; these adapters do not create
another transport or game runtime.

Hosted composition must require its authoritative adapters rather than falling
back to local admission on a configuration failure. It owns database creation
and cleanup; the runtime owns sockets, rooms and its admission service lifecycle.
An injected database remains caller-owned. Stop the runtime and close an owned
database even if one cleanup fails, retaining both errors when necessary.

`createServerLogging(options, envConfig)` provides the logger and collector for
composition. Give its logger to hosted adapters and pass the same logger and
collector to `createAirJamServer`; use `false` when collection is disabled.
The helper returns that same `false` sentinel, so its result can be spread
directly into the server options without converting values.
This keeps adapter and runtime events in the unified local dev stream instead
of creating disconnected logging paths.

## Socket ingress

`clientSocketEvents` in `@air-jam/sdk/protocol` declares the shared Zod schema,
payload lane and acknowledgement policy for every client event. The server's
socket middleware validates arguments and parses that schema before dispatch;
handlers receive parsed values and retain their room/identity authority checks.
Unknown events are rejected too. Adding a client event requires its ingress
contract in the same map.

`SOCKET_PAYLOAD_BOUNDS` exposes the serialized UTF-8 byte, nesting depth,
keys per object, string length and events-per-window limits for controller,
host-state and lifecycle messages. An iterative walk checks the complete input,
including unknown fields, before Zod inspects nested values. Socket.IO's explicit
`maxHttpBufferSize` equals `SOCKET_MAX_HTTP_BUFFER_SIZE`; frames above it are
disconnected by Engine.IO before event dispatch. The wire envelope also uses
part of that buffer.

The limits were selected from the current games on 2026-11-16. Measurements
include the whole event payload, with depth counted from zero at the root:

| Payload measured                                                                               | UTF-8 bytes | Depth | Keys/object | Longest string |
| ---------------------------------------------------------------------------------------------- | ----------: | ----: | ----------: | -------------: |
| Pong, four players, started                                                                    |         592 |     4 |           7 |             49 |
| The Office, four players, populated task statistics                                            |       1,661 |     4 |          11 |             49 |
| Odd One Out, six players, ten rounds, two clue laps, public state plus private restore entries |       8,046 |     5 |          28 |             49 |
| Odd One Out, one phone's private entry                                                         |         293 |     2 |           6 |             49 |
| Largest measured controller input/action (Pong)                                                |         139 |     3 |           3 |             49 |
| Join with a 24-character name and 128-character resume token                                   |         336 |     1 |           5 |            128 |
| Hosted bootstrap with a canonical signed grant (fixture identities)                            |         533 |     1 |           2 |            490 |

Pong and The Office use reducer fixtures; Odd One Out uses its exact exported
source, playing the reducers through a complete match with maximum settings,
24-character multibyte names and 20-character multibyte clues. These are current
payload measurements, not a claim about every possible game. The limits retain
room for larger games and action objects while keeping work per event bounded:

| Lane       | UTF-8 bytes | Depth | Keys/object | String length | Events/second/socket |
| ---------- | ----------: | ----: | ----------: | ------------: | -------------------: |
| Controller |       4,096 |     8 |          64 |         1,024 |                  240 |
| Host state |      65,536 |    12 |         256 |         4,096 |                  480 |
| Lifecycle  |       8,192 |     8 |          64 |         4,096 |                   30 |

Host state has over eight times the largest measured payload; its event allowance
covers a six-phone game's public and private updates with headroom. Controller
and lifecycle allowances cover normal frame-rate input, actions and reconnects.
A game that exceeds these bounds needs a measured contract review, rather than
an unbounded payload or a silent increase.

The existing limiter counts each socket's lanes independently over
`SOCKET_INGRESS_WINDOW_MS`. Invalid and excessive messages are dropped without
calling their handlers. A supplied acknowledgement receives the event's typed
invalid-payload or rate-limit response. After `SOCKET_INGRESS_ABUSE_LIMIT`
rejections in one window, the server emits `server:error` with `SOCKET_ABUSE`
and disconnects that socket. One `socket.ingress_rejected` warning per socket
per window summarizes rejected and rate-limited counts in the unified log stream;
it never includes the rejected payload.

## Controller-only gateways

A trusted gateway can admit controllers to one existing room without granting
host registration. Set `AIR_JAM_CONTROLLER_GATEWAY_KEY` (at least 32 characters)
or pass `controllerGatewayKey` to `createAirJamServer`. `/health` then reports
`controllerIngressVersion: 1`. Without that configuration the capability is
unavailable and ordinary standalone connections keep their existing behavior.

The gateway supplies SDK protocol headers `CONTROLLER_INGRESS_KEY_HEADER`
(`x-airjam-controller-key`) and `CONTROLLER_INGRESS_ROOM_HEADER`
(`x-airjam-controller-room`) on every Engine.IO polling request and WebSocket
upgrade. It must overwrite client-supplied values and keep the key private.
Partial, forged or changing scope is denied, including attempts to reuse a
polling session under another room. Scoped sockets can join only their bound
room and cannot register hosts or create rooms. Existing controller capabilities,
input authority, origin validation and rate limits still apply.

The integrating product owns guest invitations, HTTPS delivery, expiry and
connection revocation. Serve validated built controller assets rather than
exposing a game's development server. Studio's implementation and operations
belong to the private product repository.

## Package qualification

Pack a candidate with `pnpm run repo -- pack local`. Then run:

```bash
pnpm --silent run repo -- pack verify-server <setDir> --json
```

The verifier installs the SDK/server tarballs into a fresh temporary consumer,
checks strict TypeScript usage without workspace links, inspects shipped server
artifacts for hosted database code and exercises a real room, controller,
child-game launch, state synchronization, readiness and draining. It reports
tarball hashes and structured checks, then removes its owned temporary consumer.

This proof is separate from fast local checks. It verifies installed package
behavior, not the private product build, UI, hosted policy or production rollout.
