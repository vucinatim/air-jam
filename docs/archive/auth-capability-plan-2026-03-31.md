# Auth Capability Plan

Last updated: 2026-03-26  
Status: active

## Completed Baseline Reset

The initial naming and storage reset is complete.

Done:

1. browser-facing runtime identity now uses `appId`
2. SDK config, env vars, diagnostics, and host lifecycle payloads use `appId`
3. platform dashboard and router APIs use `appId`
4. server verification entrypoint uses `verifyAppId`
5. storage model is renamed to `appIds` / `app_ids`

This plan now continues from that cleaned baseline into the real capability work.

## Current Implemented Baseline

The current runtime now does the first real capability cut.

Done:

1. host sockets must perform a single `host:bootstrap` step before privileged lifecycle actions
2. `host:createRoom`, `host:reconnect`, and `host:registerSystem` no longer carry repeated raw `appId` payload auth
3. verified host authority is now socket-bound after bootstrap for local/static mode
4. child game launch now uses an explicit `launchCapability` object instead of a naked join token
5. embedded child-host runtime URLs now carry `aj_cap` / `aj_cap_exp`
6. app identities can now optionally restrict bootstrap to an allowed origin list
7. optional signed host-grant mode is implemented through `hostGrantEndpoint` + `AIR_JAM_HOST_GRANT_SECRET`
8. active docs now describe the real bootstrap split between local, static, and signed mode
9. static publishable mode now has per-app scoped bootstrap and lifecycle rate limits in addition to the existing socket/IP guardrails

Still pending:
 
1. optional stronger abuse posture beyond the current app-scoped rate limits, for example quotas, analytics-backed anomaly handling, or managed-service policy tiers

## Goal

Add proper production-grade security without damaging the core Air Jam developer experience.

The desired result:

1. static Vite builds remain a first-class deployment path
2. local development always works with zero auth ceremony
3. game code stays auth-unaware
4. privileged authority moves to server-issued capabilities instead of raw browser-sent app identity payloads
5. stronger backend-signed mode exists for teams that need it, but is optional
6. old API-key-oriented naming, schema, and docs are fully replaced instead of lingering in parallel

## Core Product Constraint

Air Jam games should be easily publishable as static sites.

That means:

1. we cannot require every developer to run a custom backend just to ship a game
2. we cannot pretend browser-shipped secrets are truly secret
3. we need an honest layered security model instead of fake client secrecy

## Architectural Position

The security model should have two production tiers:

1. **Static Publishable Mode**
   Default. No custom backend required. Uses publishable app identity plus server-issued short-lived capabilities.

2. **Signed Host-Grant Mode**
   Optional advanced mode. A trusted backend or edge function mints short-lived signed host grants for stronger ownership guarantees.

Local development remains a separate frictionless mode.

## Non-Negotiable DX Rules

### 1. Local Development Must Stay Frictionless

When a developer runs a local dev server, Air Jam should just work.

That means:

1. no custom auth endpoint required in local development
2. no manual token minting
3. no game-level auth code
4. no new ceremony for host/controller joining

The server may run with local-trust auth disabled or equivalent local mode in development.

### 2. Game Code Must Stay Auth-Unaware

Game implementations should not:

1. fetch auth tokens
2. attach secret headers
3. parse capability payloads
4. understand platform auth distinctions

Auth belongs to SDK/bootstrap/runtime boundaries only.

### 3. Controllers Must Stay Frictionless

Controllers should continue to join via room link / QR code with no explicit auth workflow.

Any additional security should be expressed through room/session capabilities behind the scenes, not by adding UI ceremony.

### 4. Migration Must End Cleanly

This auth reset should not leave stale architecture behind.

That means:

1. no permanent dual model where old app-ID payload auth and new capability auth both stay first-class
2. no misleading client/runtime names that still imply browser secrets
3. no stale database/schema naming that keeps the previous mental model alive
4. docs should describe the final model, not the migration history

## Remaining Problem

The most dangerous auth smell is gone, but the architecture is not finished yet.

What remains:

1. static mode now has concrete origin and rate-limit posture, but higher-order abuse policy for large-scale/public hosting is still intentionally future work

## Target Security Model

### Layer 1. Publishable App Identity

The browser may hold a non-secret publishable identifier.

Examples:

1. `appId`
2. `publishableKey`

This is allowed to identify the app, but not to act as a durable privileged secret.

Use it for:

1. app registration lookup
2. quotas and rate limits
3. origin checks / allowlisting
4. capability issuance eligibility

Do not use it as the sole long-lived proof for privileged host authority.

### Layer 2. Host Capability

Privileged host actions should run on short-lived server-validated capability grants.

Examples of host capability scope:

1. create room
2. reconnect room
3. register arcade/system host

This replaces repeated raw `appId` checks on host socket events.

### Layer 3. Room-Scoped Child Capability

Embedded child-host launch should keep using a room/game-scoped short-lived capability.

The runtime now uses an explicit `launchCapability` object for this path and should continue to be treated as a room/game-scoped capability concept.

Scope should include:

1. room id
2. target game or launch instance
3. expiry
4. capability purpose

### Layer 4. Socket-Bound Session Authority

After bootstrap verification, the server should bind authority to the socket/session.

Later events should mostly check:

1. socket role
2. room/session binding
3. capability already granted at bootstrap

not repeated auth material in every payload.

## Deployment Modes

## 1. Local Development Mode

Properties:

1. zero-ceremony
2. local trust
3. no custom backend required
4. host create/reconnect works automatically

Expected DX:

1. run dev server
2. host opens game
3. room creates
4. controller joins
5. arcade works

No one should notice auth here.

## 2. Static Publishable Mode

This is the default production mode for most framework users.

Properties:

1. deploy static frontend anywhere
2. configure publishable app identity
3. optionally configure allowed origins per app identity
4. Air Jam server issues short-lived session capabilities
5. no custom backend required

Security guarantees:

1. app identification
2. per-app quotas/rate limits
3. optional origin allowlisting
4. strong room/session capability control after bootstrap

Non-goal:

1. proving long-term app ownership via browser-held secret material

This mode should be documented as the normal path.

## 3. Signed Host-Grant Mode

Optional stronger production mode for teams that want stricter guarantees.

Properties:

1. trusted backend or edge endpoint mints short-lived signed host grants
2. SDK fetches those grants automatically
3. server verifies grant once and binds capability to socket/session
4. server verification is gated by `AIR_JAM_HOST_GRANT_SECRET`

This should not change game code, only deployment configuration.

### Current Signed Mode Contract

Client/runtime:

1. set `hostGrantEndpoint` in config or `VITE_AIR_JAM_HOST_GRANT_ENDPOINT`
2. host runtime automatically `POST`s to that endpoint before `host:bootstrap`
3. endpoint returns `{ "hostGrant": "..." }`
4. SDK sends `host:bootstrap { hostGrant }`

Server:

1. set `AIR_JAM_HOST_GRANT_SECRET`
2. server verifies HMAC-signed host grants during `host:bootstrap`
3. verified host authority is then bound to the socket like the static appId path

Game code:

1. unchanged
2. no auth logic in host or controller components

## SDK Shape

The SDK should support all modes through runtime/bootstrap config, not per-game auth code.

### Desired Default Experience

This should still feel like:

```ts
createAirJamApp({
  runtime: env.auto(),
})
```

or:

```tsx
<HostSessionProvider />
<ControllerSessionProvider />
```

### Desired Runtime Config Direction

Move toward a clearer runtime identity model:

1. publishable app identity for static mode
2. optional host grant endpoint for signed mode
3. no root-level concept named like a secret API key when it is actually browser-visible

Current browser-facing term:

1. `appId`

Future optional advanced terms may still include:

1. `hostGrantEndpoint`

## Server Shape

### Current State

Implemented today:

1. host lifecycle privilege is acquired through one `host:bootstrap` step
2. server binds verified host authority to the socket/session
3. room child activation uses explicit `launchCapability`

### Target State

Move to:

1. one auth verification step at bootstrap / privilege acquisition
2. room/session capability issuance by the server
3. socket/session-bound authorization afterward

This should reduce repeated auth checks in event handlers and make authority more explicit.

## Capability Types

The architecture should explicitly define these capability classes.

### 1. Host Session Capability

Used by host runtime after successful bootstrap.

Can authorize:

1. room create
2. room reconnect
3. system host registration

May be:

1. opaque token
2. signed token
3. socket-bound server session only

### 2. Child Host Capability

Used by embedded game host runtime.

Can authorize:

1. child host join for one room/game launch

Should be:

1. short-lived
2. room-scoped
3. launch-scoped

### 3. Controller Session Capability

Probably implicit rather than explicit for now.

Controller joins with room link / room code, then the server binds controller authority to the socket/session.

Future tightening may add optional controller capability tokens for stricter public-room protection, but that should not be the default UX.

## Recommended Execution Order

### Phase 1. Auth Vocabulary Reset

Stop conflating browser-visible app identity with secret privileged proof.

Tasks:

1. define the new conceptual vocabulary:
   1. publishable app identity
   2. host capability
   3. child host capability
   4. socket-bound session authority
2. decide naming migration away from ambiguous `apiKey` on the client in favor of `appId`
3. document dev vs static vs signed mode clearly
4. decide which old names are temporary aliases vs fully removed names

Status:

1. completed
2. `appId` is now the canonical browser-facing term
3. old browser-facing `apiKey` naming has been removed from the active SDK/server/platform surface

### Phase 2. Bootstrap Capability Design

Design the exact bootstrap handshake for:

1. local development
2. static publishable mode
3. signed host-grant mode

This phase should define:

1. what the SDK sends initially
2. what the server returns
3. what becomes socket-bound afterward
4. what temporary compatibility, if any, is allowed during rollout

Status:

1. completed for local development and static publishable mode
2. current bootstrap path is `host:bootstrap` -> socket-bound host authority
3. signed-mode bootstrap remains future work

### Phase 3. Socket Authorization Refactor

Refactor host authorization so privileged host events do not depend on repeated raw auth payloads.

Tasks:

1. move verification to one bootstrap path
2. bind verified host authority to socket/session
3. simplify event handlers to rely on socket capability checks
4. remove repeated raw auth payload checks once the new path is live

Status:

1. completed for host lifecycle actions in the current local/static flow

### Phase 4. Child Capability Hardening

Formalize the child launch path as an explicit room-scoped capability model.

Tasks:

1. define expiry/shape/semantics clearly
2. ensure launch/reconnect/close flows are capability-safe
3. keep game/embed runtime auth invisible to game code

Status:

1. completed for the current arcade launch path
2. `launchCapability` now carries `token + expiresAt`
3. runtime URLs now carry `aj_cap` / `aj_cap_exp`
4. game code remains unaware of capability details

1. completed for the current arcade launch path
2. `launchCapability` now carries `token + expiresAt`
3. host reconnect restores active game launch capability through `HostArcadeSessionSnapshot`

### Phase 5. Naming and Schema Replacement

Replace old auth-era naming cleanly across runtime config, protocol, persistence, and docs.

Tasks:

1. replace browser-facing `apiKey` naming with the honest final term `appId`
2. audit protocol payload names and ack names for old auth assumptions
3. audit database schema names and decide:
   1. which tables/columns remain valid
   2. which should be renamed
   3. which should be migrated away entirely
4. remove deprecated naming rather than keeping confusing parallel aliases indefinitely

Examples of things to review:

1. SDK runtime config names
2. env var names
3. server auth service naming
4. platform dashboard/API naming
5. persisted key/grant tables and columns

Status:

1. completed for the current browser-facing identity/storage layer
2. `appIds` / `app_ids` is now the active persistence model
3. remaining future naming work should be capability-specific, not a continuation of the `apiKey` reset

### Phase 6. Static Publishable Mode Productization

Make static deploy the canonical public path.

Tasks:

1. define required frontend config for static mode
2. add origin/quotas/rate-limit hooks on the server
3. keep the setup minimal and honest

### Phase 7. Optional Signed Mode

Add optional stronger host-grant flow for advanced users.

Tasks:

1. define signed host grant payload
2. define verification path
3. define SDK config and automatic fetch behavior
4. ensure it does not affect normal static or local DX

### Phase 8. Documentation and DX

Update docs so developers see:

1. local dev just works
2. static publishable mode is normal
3. signed mode is optional advanced hardening
4. final naming is consistent everywhere

This phase should produce:

1. a short quick-start auth section for normal developers
2. a concise static-deploy guide
3. an advanced signed-mode guide
4. updated SDK/runtime docs using only final terminology
5. removal of stale API-key-oriented examples

### Phase 9. Final Cleanup and Removal

Finish the migration completely and remove the old model.

Tasks:

1. remove deprecated payload fields and unused verification paths
2. remove compatibility shims that were only needed during rollout
3. remove stale env var fallbacks if we decide to hard-cut them
4. remove dead tests, dead comments, and migration notes
5. verify there is one obvious auth path per deployment mode

## Open Design Decisions

These must be resolved before implementation:

1. How much of static publishable mode should remain expressed as `appId` versus future derived capability/session names?
2. Should origin allowlisting be optional, recommended, or default for static mode?
3. Should the server mint a reusable host session capability on first create/reconnect, or keep authority purely socket-bound?
4. How much of the capability model should be opaque token vs signed token vs server-side session state?
5. Do we want an Air Jam–hosted grant endpoint for static apps that do not have their own backend?
6. Which existing database entities should be renamed vs retained for continuity?
7. Should old env var names remain unsupported permanently, or do we need a temporary migration note outside the runtime?

## Quality Bar

Any auth implementation for this plan must satisfy:

1. local development remains frictionless
2. static deployment remains first-class
3. game code does not gain auth responsibilities
4. browser-visible values are named honestly
5. authority is capability/session based, not repeated raw secret payload based
6. auth behavior is explicit at runtime boundaries and invisible during gameplay
7. migration leaves no ambiguous old model behind in code, schema, or docs

## Exit Criteria

This plan is done when:

1. production host authority no longer depends on repeated browser-sent raw app identity payloads
2. local dev still works with zero extra setup
3. static publishable mode is documented and works without a custom backend
4. optional signed mode exists for stricter deployments
5. game implementations remain auth-unaware
6. stale API-key-centric naming has been removed or intentionally migrated with a defined end state
7. database/schema naming is consistent with the final capability model
8. SDK/server/docs all describe the same final auth story
