# Air Jam SDK Runtime Ownership Reset Plan

Last updated: 2026-03-31  
Status: active

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Work Ledger](../work-ledger.md)
3. [SDK Composability Plan (Archived)](./sdk-composability-plan-2026-03-31.md)
4. [SDK RPC Action Contract Plan](./sdk-rpc-action-contract-plan-2026-03-31.md)
5. [Air Capture Reference Refactor Plan](./air-capture-reference-refactor-plan.md)

## Purpose

Reset the SDK around explicit runtime ownership before prerelease.

The current headless-owner-hook model made singleton systems too easy to misuse:

1. `useAirJamHost()` and `useAirJamController()` look like ordinary read hooks even though they are runtime owners
2. owner-level hooks are too easy for LLMs to mount in arbitrary child components
3. docs and lint are not strong enough to prevent this class of mistake
4. the SDK currently still allows multiple public patterns for singleton systems

The goal of this plan is to make the correct ownership model explicit, obvious, and difficult to misuse.

## Architecture Decision

Air Jam should use one canonical pattern for singleton framework systems:

1. runtime ownership is created explicitly at the host/controller boundary
2. ownership is mounted through explicit runtime components or explicit runtime objects wrapped by thin components
3. child code consumes read-only context hooks only
4. no deprecated or compatibility owner-hook path remains in normal app-facing usage

This means the SDK should stop teaching "call the owner hook in the right place" and instead teach "mount the runtime once, then read from it everywhere below."

## Scope

This plan covers singleton framework systems that currently rely on owner hooks or similarly easy-to-misuse creation patterns:

1. host runtime ownership
2. controller runtime ownership
3. audio runtime ownership
4. `createAirJamApp()` and the session-provider ownership layer that currently participate in runtime creation implicitly
5. low-level owner helpers such as `useAudioManager()` that still expose direct creation paths too easily
6. any adjacent runtime bridge that should follow the same explicit-owner rule before v1

This plan is not for:

1. cosmetic API cleanup without ownership impact
2. optional UI primitives that do not own runtime state
3. backwards compatibility layers kept only for migration comfort

## End State

Done means all of the following are true:

1. host and controller runtime ownership are mounted through explicit SDK runtime components or equivalent explicit runtime wrappers
2. audio ownership follows the same model and no longer exposes the current owner-hook pattern as the normal path
3. `createAirJamApp()` and session providers have one explicit, coherent role in the runtime ownership stack instead of an implied split with public owner hooks
4. low-level owner helpers are removed from the normal app-facing surface or clearly relocated behind internal-only paths
5. app-facing child code uses consumer hooks only
6. Pong, `air-capture`, docs, and templates all teach the same single pattern
7. legacy/deprecated owner-hook usage is removed from normal examples, templates, and recommended public APIs
8. there is no parallel "old but still available" runtime-owner story left behind for prerelease

## Canonical Shape

The target API model is:

1. explicit runtime owners
   - e.g. `HostRuntime`, `ControllerRuntime`, `HostAudioRuntime`, `ControllerAudioRuntime`
2. consumer-only hooks below them
   - e.g. `useHostSession()`, `useControllerSession()`, `useAudio()`
3. optional explicit runtime factories behind the scenes where needed
   - creation can be object/service based internally, but app code should see one obvious mounted runtime boundary

The important rule is not whether internals use objects or providers.

The important rule is:

1. creation/ownership must be explicit
2. consumption must be ergonomic
3. misuse must be structurally difficult

## Replacement Strategy

### Phase 1. Define The Final Runtime Ownership API

1. Freeze the canonical SDK shape for:
   - host runtime
   - controller runtime
   - audio runtime
2. Decide the final public component names and consumer-hook names.
3. Remove ambiguity between owner creation and child consumption.
4. Ensure owner creation is impossible or clearly invalid in arbitrary child components.

Decision rule:

1. prefer explicit runtime components in public app code
2. allow runtime objects/services internally when they simplify lifecycle and cleanup
3. do not expose low-level owner hooks from the normal app-facing barrel if they remain necessary internally

### Phase 2. Replace Host/Controller Owner Hooks

1. Replace the current public `useAirJamHost()` owner model with an explicit host runtime boundary.
2. Replace the current public `useAirJamController()` owner model with an explicit controller runtime boundary.
3. Keep read-only child access hooks for data and actions.
4. Remove the current pattern where child components are expected to avoid owner hooks by convention alone.

Done when:

1. app code can no longer reasonably mount a second host/controller runtime by accident
2. child code has one obvious read path
3. templates no longer import owner hooks directly in arbitrary modules

### Phase 2A. Resolve `createAirJamApp()` And Session-Provider Ownership

1. Decide whether `createAirJamApp()` and scoped session providers remain the public runtime boundary or become implementation details behind the new explicit runtime components.
2. Remove the ambiguous split where session providers own part of lifecycle while public owner hooks appear to own the rest.
3. Ensure the runtime-owner registry and scoped-provider rules support the final public runtime model instead of preserving a transitional headless-owner story.
4. Make the bootstrap story explicit enough that an LLM can tell where runtime ownership begins without reading internal docs.

Done when:

1. `createAirJamApp()`, session providers, and runtime components tell one coherent public ownership story
2. the SDK no longer implies that owner hooks are the real runtime boundary while providers are just invisible plumbing
3. templates and first-party apps show one obvious bootstrap path

### Phase 3. Replace Audio Ownership Fully

1. Fold the recent `air-capture` audio ownership work into the final SDK model.
2. Replace owner-hook usage with explicit audio runtime boundaries in the SDK itself.
3. Make consumer audio access use one read hook only.
4. Remove the public ambiguity between "owner hook" and "consumer hook."

Done when:

1. audio has one canonical public ownership model
2. no app code needs to understand manifest ownership details outside the runtime boundary
3. `air-capture` and Pong use the same final pattern

### Phase 3A. Remove Low-Level Owner Back Doors

1. Audit low-level owner helpers such as `useAudioManager()` and any similar direct-creation primitives that remain publicly easy to import.
2. Remove them from the normal SDK barrel or relocate them behind clearly internal or advanced-only entry points.
3. Ensure public app code cannot casually bypass the explicit runtime boundary and recreate the old misuse pattern through a different helper.

Done when:

1. no low-level owner helper remains part of the normal app-facing SDK story
2. public imports push app code toward explicit runtime boundaries and consumer hooks only
3. the old ownership model cannot re-enter through a lightly renamed helper

### Phase 4. Migrate First-Party Apps And Template

1. Migrate Pong to the final runtime ownership model.
2. Migrate `air-capture` from its transitional audio/runtime ownership wrappers to the final SDK shape.
3. Update `create-airjam` template outputs so newly generated projects cannot learn the old pattern.
4. Remove any first-party examples that still imply owner-hook usage as a normal child-access pattern.

### Phase 5. Remove Legacy Paths Completely

1. Remove deprecated owner-hook APIs from the normal public SDK barrel if they are still exposed.
2. Remove or relocate low-level owner helpers that still provide back doors into the old ownership style.
3. Remove compatibility docs and examples that keep the old model alive.
4. Remove transitional notes that imply both patterns are valid.
5. Prefer a clean break over carrying compatibility-only SDK surface into v1.

Prerelease rule:

1. if a runtime-owner API is not the final intended model, do not keep it around just for comfort

## Validation

Run before considering this track complete:

1. SDK typecheck
2. SDK tests
3. Pong typecheck, tests, and build
4. `air-capture` typecheck, tests, and build
5. `create-airjam` validation and scaffold smoke proof
6. one browser-level host/controller smoke path using the final runtime ownership pattern

Manual acceptance:

1. it is obvious where host runtime ownership is mounted
2. it is obvious where controller runtime ownership is mounted
3. it is obvious where audio runtime ownership is mounted
4. child modules no longer have tempting owner hooks available as the normal path
5. an LLM following surface-level cues is much more likely to do the right thing than the wrong thing

## Documentation Requirements

Update in the same change:

1. SDK README
2. framework docs that describe runtime ownership
3. Pong README/template guidance
4. `createAirJamApp()` and session-provider docs/examples
5. any generated docs or internal guidance that still describe the headless-owner-hook story as the intended public model

## Closeout Rule

This plan is complete only when:

1. one canonical runtime ownership model exists
2. first-party apps and template use it
3. `createAirJamApp()`, session providers, and runtime boundaries tell one coherent public story
4. the old owner-hook story is gone from recommended public usage
5. no low-level public back door remains for recreating the same misuse pattern
6. no deprecated compatibility layer remains in the prerelease SDK surface
