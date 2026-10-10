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
