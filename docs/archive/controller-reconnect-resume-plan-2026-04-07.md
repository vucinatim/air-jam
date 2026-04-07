# Controller Reconnect And Resume Plan

Last updated: 2026-04-01  
Status: archived completed baseline

Archived on 2026-04-07 after the reconnect/resume baseline was validated through real local Arcade product flow in `pong`, `air-capture`, and `last-band-standing`.
Current release execution now lives in [Work Ledger](../work-ledger.md) and [V1 Release Launch Plan](../plans/v1-release-launch-plan.md).

Related docs:

1. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
2. [Work Ledger](../work-ledger.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Arcade Surface Contract](../systems/arcade-surface-contract.md)

## Purpose

Define the smallest clean reconnect/resume baseline that makes live multiplayer sessions trustworthy without turning Air Jam into a persistence-heavy framework.

This plan exists because real playtests exposed a release-critical problem:

1. a disconnected controller cannot reliably resume its player slot during live gameplay
2. reconnect attempts can destabilize host state in at least one flagship game

The goal is to solve that at the SDK/server/runtime level so games do not invent their own reconnect systems.

## Core Position

Reconnect and resume should be a built-in Air Jam capability.

Game authors should not need to manually:

1. stash player IDs in local storage
2. rebuild player-slot binding after refresh
3. implement room-specific reconnect registries
4. special-case controller refresh behavior in game logic

The framework should provide one default resume story that is simple enough to be the obvious choice for both humans and LLMs.

## Non-Goals

This plan is not for:

1. building a broad cross-device account system
2. adding durable cloud save or long-lived player profiles
3. persisting arbitrary game state on the controller
4. inventing a second replicated state model
5. adding a migration or compatibility layer for older prerelease behavior

## Desired End State

Air Jam should support this baseline experience:

1. controller gets a stable local device identity
2. controller joins a room and is bound to a player/session slot by the host/runtime
3. controller disconnects or refreshes
4. controller rejoins the same room from the same device
5. Air Jam attempts to resume the previous binding automatically when policy allows it
6. host state remains authoritative and stable throughout

The default experience should be:

1. automatic where safe
2. explicit where policy matters
3. hard to misuse from game code

## Architecture Direction

### 1. Stable Controller Device Identity

Each controller client should have one stable local device token.

Rules:

1. generated locally and persisted in browser storage
2. scoped to Air Jam, not to one room
3. treated as a reconnect hint, not as an authority credential
4. server still validates room, session epoch, and host authority

This should be the anchor that makes reconnect attempts deterministic instead of anonymous.

### 2. Host-Owned Resumable Binding

The host/runtime should own the mapping between:

1. controller connection
2. player slot / participant identity
3. resumable lease state

Rules:

1. resume is allowed only when the host/runtime says the previous binding is still valid
2. controller cannot claim arbitrary player state by itself
3. reconnect should update the existing binding when valid instead of creating a duplicate player
4. stale or conflicting reconnect attempts must fail safely without corrupting host state

### 3. Narrow Policy Surface

Games should not implement reconnect mechanics manually.

The policy surface should stay minimal.

Target shape:

1. default behavior works with no game-specific reconnect code
2. host can optionally choose a small resume policy such as:
   1. resume allowed always
   2. resume allowed before gameplay only
   3. resume allowed during gameplay for a short grace window

Avoid a large callback-heavy lifecycle API unless the simple policy surface proves insufficient.

### 4. Readable Session Semantics

The runtime should make these distinctions explicit:

1. controller connection identity
2. resumable player/session binding
3. active transport connection

Those are not the same thing and should not stay conflated.

## Proposed SDK And Runtime Shape

The feature should be mostly implicit for app authors.

### Default behavior

1. controller runtime always carries a stable local device identity
2. reconnect to the same room automatically attempts resume
3. host runtime restores the previous participant binding when valid

### Optional host policy

Keep the app-facing surface small.

Possible shape:

1. a host option in runtime/bootstrap config
2. or a store/runtime policy option like `controllerResume`

Example policy vocabulary:

1. `"always"`
2. `"pre_game_only"`
3. `"grace_window"`

If a grace-window mode is needed, keep the config tiny:

1. enabled mode
2. one timeout value

Do not expose low-level slot-rebinding callbacks unless proven necessary.

### Runtime observability

The system should log the important lifecycle edges:

1. device identity created / loaded
2. resume attempt received
3. resume accepted
4. resume rejected
5. duplicate/expired/conflicting attempt

## Server And Protocol Work

Expected work areas:

1. controller handshake payload needs stable device identity
2. room/session authority needs resumable binding tracking
3. reconnect path needs safe rebinding semantics
4. host-facing runtime state must not fan out duplicate participants during resume attempts

Important rule:

1. the server remains owner of room membership and reconnect continuity
2. the host remains owner of gameplay truth and player-slot semantics

The reconnect layer should coordinate those two authorities instead of smearing them together.

## Game-Level Expectations

Games should benefit without deep rewrites.

Desired result:

1. `pong` and `air-capture` work without custom reconnect code
2. legacy showcase games do not need bespoke reconnect plumbing
3. existing player-facing gameplay logic stays focused on game state, not transport recovery

If a game still needs custom reconnect handling after this baseline lands, that is a sign the feature is too weak or too leaky.

## Risks To Avoid

1. letting the controller self-assert player ownership
2. introducing a giant persistence subsystem just to solve refresh/reconnect
3. exposing too much low-level policy to game code
4. adding hidden heuristics that are hard to reason about
5. allowing reconnect attempts to duplicate players or poison host state

## Test Plan

### SDK / runtime

1. stable controller device identity is created once and reused on refresh
2. reconnect to the same room attempts resume automatically
3. accepted resume restores the previous participant binding instead of creating a duplicate
4. rejected/conflicting resume fails safely and leaves host state valid
5. reconnect attempts do not corrupt the host replicated state surface

### Product / Arcade

1. controller refresh during lobby resumes cleanly
2. controller refresh during gameplay resumes according to the configured policy
3. host does not need a manual refresh after a controller reconnect attempt
4. multiple controllers in the same room do not steal each other’s bindings

### Launch-set games

1. `pong` survives controller refresh/reconnect cleanly
2. `air-capture` survives controller refresh/reconnect cleanly
3. `last-band-standing` survives controller refresh/reconnect cleanly

## Release Scope

### Required before v1

1. stable local controller identity
   Status: landed
2. automatic resume attempt on reconnect
   Status: landed
3. safe host/runtime rebinding for the common same-device reconnect case
   Status: landed
4. no host-state corruption on failed or conflicting attempts
   Status: landed and validated in real local Arcade product flow
5. enough observability and tests to trust the feature
   Status: landed for the baseline server/runtime contract

### Explicitly after v1

1. richer long-lived player-device save systems
2. device transfer between different phones
3. account-linked controller identity
4. large policy/configuration surface for unusual game rules

## Done When

1. reconnect/resume is a real SDK/runtime capability rather than ad hoc game logic
2. same-device refresh or brief disconnect can resume the previous controller binding without duplicating players
3. explicit leave still removes a controller immediately
4. room-scoped leases expire cleanly when no resume happens
5. `pong`, `air-capture`, and `last-band-standing` prove the behavior in real local Arcade product flow
6. the common refresh/disconnect/rejoin case works without game-specific plumbing
7. the feature is simple enough that it becomes the obvious path for new games and LLM-generated code

## Current Baseline

The baseline implemented in this pass is intentionally narrow:

1. every standalone controller gets one stable local device identity
2. the SDK remembers the last controller binding per room
3. the server keeps a disconnected controller binding alive for a short room-scoped resume lease
4. reconnecting from the same device to the same room automatically attempts to resume that binding
5. a different device cannot claim an existing controller binding during the lease window
6. explicit `controller:leave` still removes the controller immediately

What is intentionally not part of the baseline:

1. device transfer between different phones
2. long-lived cross-room player save
3. account-linked player continuity
4. a large per-game reconnect policy API
