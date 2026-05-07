# Controller And Platform Settings Ownership Plan

Last updated: 2026-05-03  
Status: active  
Owner: platform / sdk / controller runtime

## Why This Exists

The current controller settings bug exposed an architectural gap, not just a UI
bug.

Today the controller menu tries to present one combined settings surface, but
the underlying state model is not explicit enough about ownership:

1. some settings are truly host / room / Arcade owned
2. some settings are truly controller-local
3. the implementation currently mixes those two stories in one UI without a
   clean contract split

That ambiguity creates two bad outcomes:

1. interaction bugs become hard to reason about because it is unclear whether a
   field is local, remote, mirrored, or optimistic
2. the code starts drifting toward ad hoc patches instead of a durable
   ownership model

This plan defines the proper split and the bounded refactor needed to make it
real.

## Correct Product Model

The intended product model is valid and should be preserved.

There are **two different settings domains**.

### 1. Host / Room / Arcade settings

These affect the host surface or the shared room experience.

Examples:

1. master volume
2. music volume
3. sfx volume
4. preview controller opacity
5. any future room-level accessibility or presentation settings

Authoritative owner:

1. the Arcade host / platform shell

Controller role:

1. remote editor only

### 2. Controller-local settings

These affect only one controller device or one controller session.

Examples:

1. haptics enabled
2. future controller-local accessibility preferences
3. any future controller comfort or input preferences

Authoritative owner:

1. that controller runtime / device

Host role:

1. none, unless a future feature explicitly asks for room policy over
   controller-local behavior

## Current Problem

The UI shape implies the model above, but the implementation does not express
it cleanly.

Today:

1. host-owned settings are persisted in the platform-owned settings runtime
2. embedded games inherit those settings through the existing platform-settings
   bridge
3. controller settings editing tries to send host-owned patches through Arcade
   action RPC
4. controller UI also tries to render from a controller-side settings source
   that is not a true authoritative mirrored remote snapshot

That creates an awkward hybrid:

1. some controller UI is local
2. some controller UI is pretending to be remote
3. there is no explicit first-class remote settings snapshot contract for
   controllers

This is why the slider bug felt architecturally suspicious: the controller was
trying to act like a remote host-settings editor without a clean remote state
model.

## Non-Goals

This refactor should **not** do any of the following:

1. rewrite the general Air Jam runtime or controller paradigm
2. collapse controller-local and host-owned settings into one store
3. loosen ownership rules to “whatever updates first”
4. invent a broad settings system with speculative complexity
5. preserve the current ambiguous plumbing for backward compatibility

The goal is smaller:

1. make ownership explicit
2. make data flow explicit
3. keep the code minimal

## Target Architecture

## A. Host-owned platform settings

These should be modeled as a real remote-owned contract.

### Authoritative source

1. `PlatformSettingsRuntime persistence="local"` in the Arcade host / platform
   shell

### Controller read model

1. controllers receive a mirrored snapshot of host-owned settings
2. controller UI renders host-owned fields from that snapshot only

### Controller write model

1. controller sends a typed patch request
2. host validates and applies it
3. host rebroadcasts the updated snapshot
4. controller rerenders from the new authoritative snapshot

This is standard remote-editor behavior and should be treated as such.

## B. Controller-local settings

These should be modeled as fully local controller preferences.

### Authoritative source

1. controller-owned local runtime state
2. optionally persisted locally on that device when appropriate

### Host involvement

1. none for normal operation

### UI behavior

1. changes should be immediate
2. no RPC required
3. no remote mirrored snapshot required

## UI Model

The controller menu should stop presenting these as one undifferentiated
bucket.

Recommended structure:

### Section 1. Room settings

Short descriptor:

1. “Affects the host room”

Contains:

1. master volume
2. music volume
3. sfx volume
4. any future host-owned room settings

### Section 2. This controller

Short descriptor:

1. “Only affects this device”

Contains:

1. haptics enabled
2. future controller-local preferences

This removes a large amount of user and implementation ambiguity.

## Contract Refactor

The key missing piece is a first-class controller-facing host settings
snapshot.

### Required new concept

Add an explicit mirrored host-settings snapshot for controller surfaces.

It does not need to be broad or overengineered.

It only needs:

1. current host-owned settings snapshot
2. optional version or monotonic update identity
3. typed patch command from controller to host

### Recommended shape

Keep it scoped to Arcade / platform settings instead of over-generalizing it
prematurely.

Good shape:

1. host publishes `arcadePlatformSettingsSnapshot`
2. controller reads `arcadePlatformSettingsSnapshot`
3. controller sends `updatePlatformSettings` patch

Bad shape:

1. generic mega-settings replication framework
2. shared mutable store pretending to work everywhere
3. hidden fallback between local and remote ownership

## Refactor Workstreams

### Workstream 1. Explicit settings taxonomy

Create one clear classification for all current settings:

1. host-owned
2. controller-local
3. unsupported / remove

Current expected classification:

1. `audio.*` -> host-owned
2. `previewControllers.*` -> host-owned
3. `feedback.hapticsEnabled` -> controller-local on the controller surface
4. `accessibility.*` -> deferred decision; only keep fields that actually work
   and have a real owner

Open decision:

1. whether `accessibility` stays host-only on Arcade and separate on
   controller, or is split now

### Workstream 2. Controller host-settings snapshot contract

Introduce a real controller-visible mirrored snapshot for host-owned settings.

Requirements:

1. host remains authoritative
2. controller gets a real snapshot
3. controller does not render host-owned controls from fake local state

Possible implementation lanes:

1. extend controller state payload shape
2. add a dedicated server event for Arcade platform settings snapshot
3. add a targeted side-channel only for Arcade controller settings

Preferred direction:

1. a dedicated targeted contract, not stuffing unrelated platform data into
   generic controller state unless it genuinely belongs there

### Workstream 3. Controller-local settings runtime

Make controller-local settings explicit on the controller route.

Requirements:

1. haptics and similar preferences update immediately
2. no host round-trip required
3. code does not pretend these fields are part of host-owned platform settings

Preferred shape:

1. one small controller-local settings hook or runtime
2. clear persistence policy
3. separate API from host-owned patch APIs

### Workstream 4. UI split in the controller sheet

Refactor the settings panel surface so the ownership split is visible.

Requirements:

1. room settings section for host-owned fields
2. controller section for local fields
3. concise labels
4. no duplicate affordances

Non-goal:

1. redesign the whole controller sheet visually

### Workstream 5. Host bridge and embedded inheritance alignment

Verify the host-owned settings path still cleanly feeds:

1. Arcade host shell
2. embedded hosted game surfaces
3. preview controllers only where appropriate

The point here is to avoid fixing controller editing in a way that breaks the
already-valid host-to-embedded inheritance model.

## Migration Strategy

Do this in bounded passes.

### Phase 1. Taxonomy and naming cleanup

1. classify each current setting explicitly
2. rename ambiguous props and helpers so host-owned vs controller-local is
   visible in code
3. stop adding new code on the old ambiguous path

### Phase 2. Controller-local extraction

1. move controller-local fields to explicit controller-owned state
2. make local controller interactions work immediately and predictably

### Phase 3. Host snapshot contract

1. add the mirrored host-settings snapshot
2. rewire controller room-settings UI onto it
3. keep host as the only authority for host-owned fields

### Phase 4. UI split and cleanup

1. separate the controller menu sections
2. remove any dead unsupported settings from this surface
3. tighten naming and copy

### Phase 5. Validation

1. host Arcade settings work locally on the host
2. controller-local settings work immediately on the controller
3. host-owned controller edits propagate correctly through the host
4. embedded game inheritance still works
5. preview controller route still works

## Acceptance Criteria

This plan is complete when all of the following are true:

1. every settings field exposed on controller has one explicit owner
2. controller-local settings do not rely on host RPC
3. host-owned settings do not rely on fake local controller state
4. the controller menu UI makes the ownership split understandable
5. sliders and toggles are interactable on real device/controller surfaces
6. there is no remaining ambiguous “shared platform settings” naming in this
   lane

## Recommended Files / Surfaces

Expected primary touch points:

1. `apps/platform/src/app/controller/controller-page-content.tsx`
2. `apps/platform/src/app/controller/controller-page-layout.tsx`
3. `apps/platform/src/components/controller-menu-sheet.tsx`
4. `apps/platform/src/components/platform-settings-panel.tsx`
5. `apps/platform/src/components/arcade/arcade-system.tsx`
6. `apps/platform/src/components/arcade/arcade-platform-settings-store.ts`
7. `packages/sdk/src/settings/platform-settings-runtime.tsx`
8. any Arcade action / controller state contract files that currently carry
   host-owned settings

## Open Decisions

These should be answered during implementation, not before starting:

1. whether host-owned mirrored settings should travel inside existing controller
   state or through a dedicated targeted channel
2. whether any accessibility settings should exist on controller at all in this
   prerelease surface
3. whether `previewControllers.opacity` belongs in the same room-settings group
   long term or should move into a narrower preview/dev-only surface later

## Recommendation

Do not keep patching this through one-off local controller fixes.

The correct move is:

1. formalize the ownership split
2. introduce one explicit host-settings mirror contract
3. keep controller-local settings fully local
4. reflect the same split in the UI

This is a bounded refactor, not a framework rewrite, and it is the cleanest
minimal path that preserves the product model you actually want.
