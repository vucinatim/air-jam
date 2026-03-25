# Air Jam Framework Paradigm

Last updated: 2026-03-25  
Status: active

## Purpose

This document defines the intended Air Jam architecture.

It replaces the earlier "vNext" framing that pushed Arcade too far into a special runtime product model.

The correct direction for Air Jam is:

1. one core framework paradigm
2. one clean lane model
3. Arcade built from the same primitives as every other Air Jam app
4. transport bridges used only where embedding requires them
5. deterministic replayable state instead of transient UI pulses

## North Star

Air Jam should feel like one coherent system:

1. Standalone games use the normal Air Jam model.
2. Arcade is a first-party Air Jam app built with that same model.
3. Embedded games inside Arcade still use Air Jam, but through bridge transports instead of direct socket ownership.
4. Controllers never drift because host and controller derive their visible surface from the same replicated snapshot.
5. The server owns hard invariants, not app-level UI decisions.

## The Core Model

Air Jam has three lanes. They must stay separate.

### 1. Input Lane

Use for high-frequency transient control input.

Examples:

1. stick vectors
2. button presses
3. aiming / movement / throttle

Rules:

1. controller writes with `useInputWriter`
2. host reads with `getInput` / `useGetInput`
3. never use replicated store actions for per-frame input

### 2. Replicated State Lane

Use for authoritative shared app state.

Examples:

1. scores
2. teams
3. match phase
4. Arcade browser state
5. which controller surface should be active

Rules:

1. host is the source of truth
2. state is replayable from snapshot on join/reconnect
3. every state slice has one owner only
4. `createAirJamStore` is the canonical primitive for this lane

### 3. Signal / Command Lane

Use for coarse intent and UX/system messages.

Examples:

1. haptics
2. toast notifications
3. exit game
4. show QR
5. open menu

Rules:

1. commands are explicit and coarse
2. signals do not own authoritative gameplay state
3. no toggle-heavy hidden semantics for platform behavior when an explicit command is possible

## The Correct Arcade Model

Arcade is not a separate paradigm.

Arcade is an Air Jam app around another Air Jam app.

That means there are two legitimate app domains:

1. the Arcade app domain
2. the active embedded game domain

They may both use Air Jam primitives, but they must not own the same facts.

### Arcade Owns

Arcade owns platform state such as:

1. browser selection
2. current platform surface (`browser` or `game`)
3. active game metadata
4. controller-facing surface metadata
5. platform overlay state
6. platform-level pause/exit/menu intent

This state belongs in Arcade's replicated state lane, not in ad hoc server UI events.

### The Embedded Game Owns

The embedded game owns game-local state such as:

1. lobby/readiness
2. teams and assignments
3. scores
4. match phase
5. gameplay-only controller UX

This state belongs in the game's own host-owned replicated state lane.

### The Server Owns

The server owns only hard runtime invariants:

1. room membership
2. controller identity
3. host authorization
4. child-host attach authorization
5. routing target / focus
6. reconnect continuity
7. runtime epochs / tokens needed to reject stale embedded runtimes

The server should not be the primary owner of Arcade browser/controller UI state.

## Bridge Philosophy

The bridge is necessary because embedded iframes cannot share the parent React tree or Zustand instance.

But the bridge must stay dumb.

Its job is:

1. swap transport across iframe boundaries
2. validate handshake / version / capability
3. forward input/state/signal traffic
4. reject stale or invalid runtime attachments

Its job is not:

1. invent a second lifecycle model
2. own Arcade UI semantics
3. replace replicated snapshots with transient events
4. hide runtime mode inside generic hooks

The bridge is transport plumbing, not the center of the product architecture.

## Deterministic Arcade Sync

The current drift problem exists when host, controller, and server each store some version of "what UI is active".

That must stop.

### The Rule

There must be exactly one authoritative source for the Arcade controller/host surface.

The recommended shape is a host-owned Arcade replicated state snapshot, for example:

1. `surface.kind`: `browser | game`
2. `surface.gameId`
3. `surface.controllerUrl`
4. `surface.orientation`
5. `surface.epoch`
6. `overlay.kind`

Host Arcade UI and controller outer UI should both derive from that same snapshot.

### Why This Fixes Drift

1. Join and reconnect replay the full snapshot automatically.
2. No `loadUi` / `unloadUi` pulse can be missed because pulses are not the source of truth.
3. The controller outer shell knows exactly whether to render browser UI or embedded game UI.
4. The host Arcade surface knows the same thing from the same state.
5. The bridge can reject stale iframes by comparing `surface.epoch`.

### Epoch Requirement

Every surface switch must increment a runtime epoch.

Examples:

1. browser -> game
2. game A -> game B
3. game -> browser

That epoch should be included in bridge bootstrap/attach contracts so stale controller or host iframes cannot keep talking after a switch.

## Ownership Rules

These rules are non-negotiable.

### 1. One Owner Per Fact

If Arcade store owns active controller surface, neither the server nor local page state also owns that fact.

### 2. Snapshot Over Pulse

If the state matters after reconnect, it must exist in a replayable snapshot.

### 3. No Hidden Runtime Inference In Core Hooks

Default host/controller hooks should not silently become "arcade mode" because of URL params.

Arcade embedding should be explicit adapter behavior.

### 4. No Per-Frame Store Abuse

Input remains input lane only.

### 5. No Platform Special Cases Inside Gameplay APIs

Platform commands should be explicit instead of leaking through accidental gameplay channels.

## Practical Architecture Consequences

This paradigm implies the following work:

1. Define a clean Arcade state domain and store contract.
2. Make controller outer shell derive from Arcade replicated state.
3. Make host Arcade derive from the same replicated state.
4. Keep server authority limited to routing/auth/session invariants.
5. Add runtime epoch checks to embedded host/controller bridge handshakes.
6. Remove transient UI events as primary truth in Arcade flows.
7. Move hidden arcade runtime behavior out of generic SDK hooks into explicit adapters over time.

## What "Air Jam In Air Jam" Means

This phrase is useful only if we are precise about it.

It means:

1. the outer app and inner app both use Air Jam primitives
2. they can be nested without inventing a new framework model
3. their domains stay separate
4. the bridge adapts transport, not architecture

It does not mean:

1. everything is shoved into one giant store
2. parent and child own the same state
3. the server should stop enforcing runtime invariants

## Acceptance Criteria

This paradigm is working when all of these are true:

1. Arcade browser and controller are always in sync after reconnect.
2. A controller can rejoin mid-session and render the correct surface from snapshot alone.
3. Switching games cannot leave a stale embedded runtime attached.
4. Arcade remains a demonstration of core Air Jam primitives, not a special exception to them.
5. The server enforces hard invariants without becoming the owner of app-level UI state.
