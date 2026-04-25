# Arcade Architecture Reset Summary

Last updated: 2026-03-25  
Status: completed

Architecture baseline: [Framework Paradigm](../framework-paradigm.md)

This is the short summary for the completed Arcade architecture reset. The detailed execution tracker is archived at [Arcade Architecture Reset Tracker (2026-03-26)](./arcade-architecture-reset-tracker-2026-03-26.md).

## What Shipped

Air Jam now runs on one coherent model:

1. Arcade is an Air Jam app around another Air Jam app.
2. `createAirJamStore` is still the canonical replicated-state primitive.
3. The server owns runtime invariants only.
4. Embedded host/controller bridges are transport-only and surface-bound.
5. Host and controller shell derive the active surface from the same replayable Arcade snapshot.

## Final Architecture

### 1. Arcade Shell State

The Arcade shell owns a dedicated replicated store domain:

1. `AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN`
2. canonical `ArcadeSurfaceState`
3. surface `kind`, `gameId`, `controllerUrl`, `orientation`, `overlay`, `epoch`

This state drives:

1. host Arcade rendering
2. controller outer-shell rendering
3. embedded bridge identity

### 2. Embedded Game State

Embedded games keep normal `createAirJamStore(...)` usage.

The SDK/runtime resolves their effective store domain automatically from embedded runtime context:

1. standalone games stay on the default store domain
2. embedded Arcade games get an epoch-bound scoped domain
3. app/game code does not parse Arcade params or choose special domains itself

### 3. Server Ownership

The server owns only hard runtime invariants:

1. room membership
2. controller identity
3. host / child-host authorization
4. focus / routing
5. child launch capability validity
6. reconnect continuity

The server does not own Arcade UI truth.

### 4. Embedded Runtime Contract

Embedded runtimes are now strictly surface-bound:

1. embedded host/controller bootstrap requires `arcadeSurface`
2. bridge request and attach messages require `arcadeSurface`
3. bridge attach validation enforces monotonic surface epochs
4. stale iframes are rejected or closed when surface identity drifts

### 5. Host Intent

The host route expresses host shell intent on boot/reconnect:

1. `/arcade` means browser intent
2. `/arcade/[slug]` means game intent

Reconnect restore is reconciled against that route intent instead of blindly restoring an old game.

## Cleanup Completed

The reset is considered complete because the transitional paths were removed, not just bypassed:

1. `client:loadUi` / `client:unloadUi` were removed from normal flow
2. server `activeControllerUrl` was removed
3. duplicate shell authority was reduced so `ArcadeSurfaceState` owns active game identity
4. embedded runtime store scoping moved into SDK/runtime instead of app code
5. root SDK exports were trimmed to the shipped surface

## Validation

### Automated

Validated with focused package checks during the reset, including:

1. SDK bridge/runtime tests
2. SDK networked-store tests
3. server room/game lifecycle tests
4. platform Arcade tests
5. SDK, server, and platform typechecks
6. SDK build when protocol/export changes required fresh dist output

### Manual

Manual QA passed for the highest-risk flows:

1. controller reconnect during Arcade browser
2. controller reconnect during active game
3. host refresh during active game
4. game to browser return
5. game A to game B switching
6. host route override via `/arcade` and `/arcade/[slug]`

## Remaining Work

There is no active migration work left for this reset.

Optional follow-up hardening is tracked in [docs/suggestions.md](../suggestions.md), especially:

1. bridge transport deduplication
2. single bootstrap owner
3. narrower reconnect adapter ownership
4. smaller SDK public surface over time

## Closeout Rule

This plan should stay short and current.

If a future architectural reset starts, create a clearly named summary or tracker and place completed history in `docs/archive/`.
