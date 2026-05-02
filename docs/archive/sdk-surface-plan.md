# SDK Surface Plan

Last updated: 2026-03-25  
Status: active

## Goal

Make the public SDK feel like a small, obvious product instead of a dump of internal modules.

The desired result:

1. `@air-jam/sdk` is the normal developer path.
2. advanced embedding and platform helpers are clearly separated.
3. naming is domain-first and human-readable.
4. internal transport/runtime machinery stops leaking into app-facing API.

## Problem

The current SDK surface still mixes several abstraction levels:

1. app-facing concepts like `useAirJamHost`
2. advanced platform/arcade concepts like bridge helpers
3. protocol/schema types
4. internal runtime plumbing
5. historical refactor helpers

This causes three problems:

1. developers cannot easily tell what is “normal” to use
2. awkward implementation names leak into public API
3. future compatibility gets harder because too much internal surface is implicitly public

## Target Shape

### 1. Root Package: `@air-jam/sdk`

This should be the default path for almost all game developers.

It should include only:

1. app bootstrap
2. session providers
3. primary host/controller hooks
4. read-only session hooks
5. input/signal/store primitives
6. common diagnostics
7. common public types needed by app code

Examples:

1. `createAirJamApp`
2. `env`
3. `HostSessionProvider`
4. `ControllerSessionProvider`
5. `useAirJamHost`
6. `useAirJamController`
7. `useHostSession`
8. `useControllerSession`
9. `useGetInput`
10. `useInputWriter`
11. `useSendSignal`
12. `createAirJamStore`

### 2. UI Package: `@air-jam/sdk/ui`

UI-only exports:

1. avatars
2. QR/join presentation
3. controller shell helpers
4. shared visual components

### 3. Protocol Package: `@air-jam/sdk/protocol`

Shared contracts for server and low-level integrations:

1. event payloads
2. schemas
3. notices
4. error codes
5. URL policy helpers if they remain protocol-level

This package is allowed to be lower-level than the root package.

### 4. Arcade Package: `@air-jam/sdk/arcade`

Advanced platform embedding API only.

It may include an umbrella entrypoint, but advanced consumers should prefer concept-level subpaths:

1. `@air-jam/sdk/arcade/bridge`
2. `@air-jam/sdk/arcade/surface`
3. `@air-jam/sdk/arcade/url`
4. `@air-jam/sdk/arcade/host`

These may include:

1. bridge contracts
2. bridge handshake helpers
3. arcade surface identity/types
4. embedded iframe URL helpers
5. advanced runtime types needed by the platform shell

This package should be considered advanced, not default.

### 5. Non-Public Internals

These should not be part of any normal public entrypoint:

1. socket manager internals
2. realtime client factories
3. embedded runtime param readers
4. runtime ownership plumbing
5. low-level helper functions that only exist because of implementation details

## Naming Rules

Public API naming should sound like domain language, not implementation debris.

### Good

1. `useControllerSession`
2. `useHostSession`
3. `arcadeSurfaceRuntimeUrlParams`
4. `isArcadeSurfaceMismatch`
5. `createArcadeBridgeHandshake`

### Bad

1. `arcadeBridgeRequestSurfaceMismatchesActive`
2. names that include both mechanism and call-site history
3. names that only make sense if you know the refactor story

### Rule

For every public name, ask:

1. would a normal developer understand this without knowing the internals?
2. is this naming the domain concept, not the implementation accident?
3. would we be comfortable documenting this as stable?

If not, rename it or hide it.

## Export Rules

### Root Export Rule

An export belongs on `@air-jam/sdk` only if:

1. a normal game developer would reasonably use it
2. it represents a stable concept
3. it is intended to be documented and supported

### Advanced Subpath Rule

An export belongs on `@air-jam/sdk/arcade` or `@air-jam/sdk/protocol` if:

1. it is real and useful
2. but it is too low-level or specialized for the root path

### Internal Rule

If something is only used by SDK internals or monorepo platform code and does not need external consumers, do not export it publicly.

## Execution Plan

### Phase 1. Surface Inventory

Create a categorized list of all current exports:

1. keep on root
2. move to `arcade`
3. move to `protocol`
4. keep only internal
5. rename before keeping

This should cover:

1. `packages/sdk/src/index.ts`
2. `packages/sdk/package.json` exports
3. any monorepo imports from `@air-jam/sdk`
4. any monorepo deep imports from `@air-jam/sdk/...`

### Phase 2. Define the Stable Root API

Lock a short explicit root surface and stop using `export *` where it blurs intent.

Root should read like a clean product API:

1. providers
2. primary hooks
3. session readers
4. common store/input/signal primitives
5. app bootstrap helpers
6. common public types

### Phase 3. Separate Advanced Arcade Surface

Move platform-specific bridge/runtime helpers behind `@air-jam/sdk/arcade`.

Tasks:

1. move platform imports off the root package
2. group advanced helpers by concept instead of one flat Arcade bag
3. keep only advanced embedding helpers there
4. rename awkward helpers into cleaner domain names where necessary
5. avoid exposing raw transport helpers unless they are truly needed

### Phase 4. Hide Internals

Stop exporting things that are merely implementation plumbing.

Candidates:

1. realtime client factories
2. embedded runtime session readers
3. internal config resolution helpers
4. runtime ownership helpers
5. id/network utility helpers that are not real SDK concepts

### Phase 5. Naming Cleanup

Rename public exports that are technically useful but badly presented.

Priority rule:

1. prefer domain-first names
2. prefer shorter names
3. prefer names that describe the outcome rather than the implementation step

### Phase 6. Docs and Examples

Update public docs/examples to reinforce the intended structure:

1. root package for normal use
2. `ui` for UI
3. `protocol` for server/shared contracts
4. `arcade` for advanced platform embedding only
5. `arcade/bridge`, `arcade/surface`, `arcade/url`, and `arcade/host` for clearer advanced imports

### Phase 7. Lock It with Tests

Keep export-surface tests strict.

Add assertions for:

1. what must stay exported on root
2. what must not be exported on root
3. what package subpaths exist
4. what internal paths must not become public

## Migration Rules

While doing this cleanup:

1. do not break working app/platform behavior just to make names prettier
2. prefer moving monorepo platform code to a more specific subpath before deleting exports
3. avoid deep-import drift from unstable internal file paths
4. each removed root export must have one of three outcomes:
   1. deleted entirely
   2. moved to a better subpath
   3. renamed to a cleaner public concept

## Exit Criteria

This plan is done when:

1. `@air-jam/sdk` reads like a minimal app-facing API
2. advanced platform embedding helpers live under `@air-jam/sdk/arcade`
3. `@air-jam/sdk/protocol` remains the low-level contract surface
4. obvious runtime plumbing is no longer publicly exposed
5. public naming is clean enough to document without apology
6. export-surface tests lock the intended boundary
7. docs/examples reflect the final structure

## Non-Goals

This plan is not:

1. a rewrite of the runtime architecture
2. a protocol redesign
3. a new Arcade migration
4. a broad monorepo import cleanup unrelated to the SDK boundary

The goal is a cleaner public surface, not a second internal refactor spree.
