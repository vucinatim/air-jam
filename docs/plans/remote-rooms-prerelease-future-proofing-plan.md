# Remote Rooms Prerelease Future-Proofing Plan

Last updated: 2026-04-24  
Status: prerelease guardrail

Related docs:

1. [Remote Rooms And Display Surfaces Plan](./remote-rooms-and-display-surfaces-plan.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Vision](../vision.md)
4. [Work Ledger](../work-ledger.md)

## Purpose

Define the small set of prerelease decisions that keep Air Jam easy to evolve later into:

1. shareable remote rooms
2. a separate distributed-screen play mode
3. optional display and spectator surfaces
4. future server-authoritative or external authority adapters

This document is intentionally narrow.

It is not a second release tracker.
It is not an Air Jam 2.0 implementation plan.
It is a bounded prerelease guardrail so v1 does not accidentally create unnecessary migration pain.

## Core Rule

Before release, Air Jam should preserve the future by:

1. keeping the v1 product framing honest
2. avoiding new abstractions that blur the controller lane with future distributed-screen play
3. keeping game state and input contracts explicit
4. not rewriting the runtime around speculative future architecture

## Do Before Release

### 1. Keep public product framing honest

Before v1, Air Jam should keep saying what it actually is:

1. shared-screen multiplayer
2. phones as controllers
3. one host screen as the primary play surface

Do not broaden public product language before the new mode exists.

### 2. Avoid premature abstraction in new APIs

Any new prerelease API, prop, helper, metadata field, or doc wording should avoid forcing future distributed-screen play into today's controller model.

Good direction:

1. keep `Controller` as the existing phone-native second-screen lane
2. reserve future names such as `Display` or `RemotePlayer` for later surfaces
3. avoid introducing "generic browser controller" abstractions before they are real

Existing `Host` and `Controller` public concepts are acceptable for v1.
The goal is to avoid making the next layer awkward, not to rename stable concepts prematurely.

### 3. Keep input contracts device-agnostic

Games should continue to define gameplay input in game terms, not device terms.

Good direction:

1. move
2. steer
3. aim
4. boost
5. confirm

Avoid gameplay contracts that are tightly named after one physical control method when a device-neutral action would be cleaner.

This keeps the future distributed-screen mode easier to add without changing core gameplay logic.

### 4. Keep game state explicit and portable

First-party games should keep important gameplay state in explicit game-owned logic and state layers rather than burying it inside render-only component state, visual refs, or ad hoc effect chains.

This does not mean preparing remote display support now.

It means avoiding architecture that would make future display snapshots awkward or expensive to derive.

### 5. Keep replicated state and display state conceptually separate

Air Jam already has shared or replicated state concepts.

Before release, the important guardrail is to avoid implying that:

1. every replicated state lane is a remote display lane
2. every game can automatically mirror itself from arbitrary local runtime state

Future display support should remain an explicit game-authored view contract, not an accidental side effect of existing state APIs.

### 6. Keep the authority model simple

Before release, the default truth model should stay:

1. host owns gameplay authority
2. server owns room membership, routing, and trust boundaries
3. controllers send input

Do not introduce prerelease work that partially pivots the system toward:

1. multi-host sync
2. peer-to-peer authority
3. database-owned authority by default
4. server-authoritative runtime as a new mandatory base model

### 7. Keep first-party examples structurally clean

The best prerelease preparation is not speculative infrastructure.

It is making sure first-party games and examples continue to demonstrate:

1. explicit game input contracts
2. explicit game state ownership
3. clean separation between host gameplay and controller UI
4. no hidden assumption that future remote-screen play must be implemented through the controller lane

## Do Not Do Before Release

1. Do not build `Display` as a third public SDK surface yet.
2. Do not promise automatic mirrored game rendering for arbitrary games.
3. Do not rewrite Air Jam around SpacetimeDB or any other external authority backend.
4. Do not refactor the whole room model around speculative participant capabilities before v1 proves the need.
5. Do not rename stable public concepts only to anticipate a future that is not implemented yet.
6. Do not soften the public phone-controller story before the distributed-screen mode actually exists.

## External Authority Adapter Rule

Systems like SpacetimeDB may become useful later as optional authority adapters or external shared-state backends.

They should not be treated as the default Air Jam architecture before release because:

1. they force a different authoring model
2. they make simple browser-first games harder too early
3. they solve a later class of online-scale problems, not the immediate v1 product problem

The prerelease requirement is only to avoid closing that door.
It is not to walk through it now.

## Release Readiness Check For This Track

Before calling v1 structurally ready relative to this future direction, confirm:

1. public docs and marketing still honestly describe the v1 phone-controller product
2. new prerelease APIs do not force future distributed-screen play into the controller lane
3. first-party games still keep gameplay state reasonably explicit
4. the host-authoritative model remains the clear default
5. no release messaging promises distributed-screen play or automatic remote mirroring
6. the long-term remote-rooms plan remains linked from the docs index

## Practical Summary

The prerelease job here is simple:

1. preserve optionality
2. avoid misleading promises
3. keep boundaries clean
4. do not overbuild

If Air Jam ships v1 with those guardrails intact, the later remote-rooms evolution can be added as a deliberate product expansion instead of a painful rewrite.
