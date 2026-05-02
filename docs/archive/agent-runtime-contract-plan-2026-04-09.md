# Agent Runtime Contract Plan

Last updated: 2026-04-09  
Status: archived

Archived on: 2026-04-09  
Archive reason: prerelease runtime-control, runtime-inspection, runtime-observability, and capability namespace alignment are now explicit enough to stop treating this as an active implementation track

Related docs:

1. [Vision](../vision.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Work Ledger](../work-ledger.md)
4. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
5. [AI Studio Architecture](../systems/ai-studio-architecture.md)
6. [AI-Native Development Workflow](../systems/ai-native-development-workflow.md)
7. [Controller Preview Dock Plan (Archived)](../archive/controller-preview-dock-plan-2026-04-09.md)
8. [Suggestions](../suggestions.md)

## Purpose

Define the prerelease architecture-alignment work needed so Air Jam can grow into a fully agent-operable game creation and evaluation system without forcing a painful public-contract rewrite after v1.

This plan exists to answer one narrow but important question:

What is the smallest amount of canonicalization we should do before release so the public SDK and framework do not stabilize around the wrong abstractions?

## Why This Matters Before Release

If Air Jam launches before this direction is made explicit, there is a real risk that v1 will accidentally present the wrong surfaces as stable:

1. browser-first control paths instead of machine-usable control contracts
2. UI-only inspection flows instead of runtime inspection contracts
3. scattered game-local state reading instead of canonical evaluation surfaces
4. preview UI as the de facto automation path instead of a future agent/runtime protocol
5. scaffolds that teach human-only flows even where the framework really needs machine-operable seams

That would create a bad choice later:

1. preserve awkward APIs and carry structural debt for a long time
2. or do the proper refactor and break early adopters

The goal of this plan is to reduce that future pain without trying to build the entire Studio/agent future before release.

## Core Position

Air Jam should eventually support a future where:

1. a user can ask for a game at a very high level
2. Studio can orchestrate multiple specialized agents in parallel
3. agents can generate code, assets, music, sound, tuning, and polish
4. agents can boot and run games directly
5. agents can control players, inspect runtime state, inspect visuals, inspect logs, and keep iterating
6. the whole system can drive toward a genuinely polished result instead of stopping at a rough prototype

That future should be built on the same framework/runtime contracts humans already use, not on a second hidden automation architecture.

## What This Plan Is Not

This plan is not for:

1. building the whole multi-agent Studio before release
2. building the full agent gameplay harness before release
3. building final asset-generation pipelines before release
4. building a complete scenario runner and evaluation service before release
5. expanding the public SDK surface casually without a clear stability story

This plan is for aligning the architecture now so later implementation can be additive instead of destructive.

## Current Assessment

### What Is Already Pointed In The Right Direction

The repo already has several strong foundations for this future:

1. explicit runtime lanes for input, replicated state, and signals
2. a strong ownership model where one owner owns one fact
3. a clear separation between framework, platform, control plane, and Studio direction
4. preview-controller work that is now being turned into reusable contracts instead of platform-only glue
5. a unified dev log stream and a real visual harness
6. scaffold/template discipline that already treats contracts and docs as first-class

These are the kinds of boundaries the future system needs.

### What Is Critically Missing

The main missing pieces are:

1. no first-class machine control protocol for joining and driving host/controller sessions directly
2. no canonical runtime inspection contract for authoritative lifecycle/state evaluation
3. no canonical observability contract that unifies runtime logs, traces, and machine-readable events
4. no scenario/evaluation contract for repeated agent-driven gameplay loops
5. no game capability contract that tells an agent what actions/state concepts matter for a specific game
6. no clear stability classification for current SDK surfaces that are likely to evolve

These are the seams that can create public API pain later if they stay implicit through release.

## Long-Term Contract Families

Air Jam should eventually converge on five explicit contract families.

### 1. Runtime Control Contract

This should eventually let trusted tools or agents:

1. boot host/runtime stories
2. join controller sessions directly
3. send controller actions and control inputs
4. disconnect and reconnect clients
5. reset, restart, or reseed scenarios
6. drive the same session model used by human controllers

This must not create a second gameplay path separate from the real runtime.

### 2. Runtime Inspection Contract

This should eventually expose machine-usable inspection of:

1. runtime lifecycle state
2. authoritative replicated state
3. room membership and player/session identity
4. shell state and active surface state
5. game-defined evaluation state and progress facts

This should be authoritative, structured, and not dependent on scraping UI text.

### 3. Runtime Observability Contract

This should eventually expose structured access to:

1. logs
2. traces
3. runtime events
4. warnings and invariant violations
5. errors
6. possibly visual-harness or runtime-render lifecycle events

The existing log stream is a strong base, but it is not yet the full future contract.

### 4. Scenario And Evaluation Contract

This should eventually support:

1. repeatable scenario setup
2. controlled seeds and test conditions
3. repeated evaluation runs
4. capture of outputs across logs/state/visuals
5. scoring or qualitative evaluation loops
6. replayable agent-driven test stories

This is how Air Jam becomes a serious agent feedback harness rather than just an editor plus browser automation.

### 5. Game Capability Contract

Each game should eventually be able to expose structured metadata for:

1. meaningful action families
2. important state concepts
3. success and failure conditions
4. important evaluation facts
5. optional guidance for automation or bots

Without this, generic controller input alone will be too weak and too opaque for high-quality agent iteration.

## Systems That Should Converge On The Same Contracts

These should not all invent separate control paths:

1. phone controllers
2. preview/on-screen controllers
3. bot players
4. future agent players
5. automated gameplay tests
6. visual-harness-driven evaluation stories
7. replay/simulation tooling
8. future Studio orchestration tools

The rule should be:

1. one runtime model
2. one ownership model
3. one set of contract families
4. multiple consumers on top of them

## Pre-Release Scope Lock

Before release, the goal is not full implementation.

The goal is to:

1. define the future contract spine clearly
2. classify current surfaces by stability
3. add the minimum internal seams needed so future work extends known boundaries
4. avoid blessing the wrong public APIs as stable

## Required Decisions Before Release

### 1. Stability Classification

We need an explicit classification for current surfaces:

1. stable enough to teach publicly
2. prerelease but likely durable
3. experimental and intentionally unstable
4. internal only

This especially matters for:

1. preview surfaces
2. future agent-facing utilities
3. runtime control helpers
4. game evaluation hooks

### 2. Namespace Strategy

We need to decide where future-facing surfaces should live.

Current best direction:

1. keep them inside the SDK as explicit leaf surfaces rather than new packages by default
2. use subpaths such as `@air-jam/sdk/preview`
3. reserve the option for future subpaths such as `@air-jam/sdk/agent` or `@air-jam/sdk/runtime-control`
4. keep experimental machine-facing surfaces out of the core root export until their shape is strong enough

### 3. Contract Ownership

We need to keep a strong ownership story:

1. framework runtime owns session/control/state primitives
2. platform owns hosted product concerns
3. Studio orchestrates projects and agents
4. machine control should sit on framework/runtime contracts, not on platform-only UI surfaces

### 4. Release Messaging

We need to be honest about what v1 is and is not:

1. preview/on-screen controllers are product features and devex helpers
2. they are not yet the full future agent control contract
3. future machine-facing control and evaluation surfaces should remain intentionally prerelease/experimental until the contract settles

## Current SDK Surface Audit And Stability Map

The current published `@air-jam/sdk` surface should be treated as the following set of lanes.

### Classification Terms

1. `stable` means safe to present as a long-term contract shape now
2. `prerelease but intended durable` means safe to teach with normal prerelease caveats and unlikely to need conceptual rewrites
3. `experimental` means public but intentionally unstable and not yet the canonical long-term contract
4. `internal` means not part of the published SDK surface and free to move

### Published Surface Map

#### 1. `@air-jam/sdk`

Classification: `prerelease but intended durable`

Scope:

1. game app creation
2. store creation
3. host/controller runtimes and session hooks
4. lifecycle helpers and core runtime types
5. platform settings and audio runtime primitives
6. runtime error boundary and router-basename helpers

Why:

1. this is the main game-authoring/runtime surface and already matches the repo's ownership model reasonably well
2. it should remain the home for framework essentials that most games need
3. it should not become a dumping ground for product-specific preview or future machine-facing leaf contracts

#### 2. `@air-jam/sdk/ui`

Classification: `prerelease but intended durable`

Scope:

1. reusable human-facing React UI primitives
2. shell helpers and shell status hooks
3. join URL controls, QR code, player avatar, and volume/mute controls

Why:

1. this is a clean opt-in leaf for human UI composition
2. it is a reasonable long-term home for shared human-facing shell ergonomics
3. future machine control or inspection APIs should not be added here

#### 3. `@air-jam/sdk/preview`

Classification: `experimental`

Scope:

1. preview controller identity and launch helpers
2. preview session manager
3. preview controller surface and dock UI

Why:

1. this is intentionally a product/devex feature leaf
2. it is useful and worth shipping, but it is not the future canonical agent/runtime control contract
3. it should stay opt-in and clearly unstable while the larger machine-facing contract spine is being defined

#### 4. `@air-jam/sdk/arcade` and `@air-jam/sdk/arcade/*`

Classification: `experimental`

Scope:

1. Arcade host helpers
2. Arcade bridge helpers
3. iframe bridge helpers
4. Arcade surface helpers
5. Arcade URL helpers

Why:

1. these are product/platform integration surfaces, not universal runtime contracts
2. they are still useful for current platform work, but they are too product-shaped to bless as long-term machine-control foundations
3. future runtime control and inspection work must not route itself through Arcade-only abstractions

#### 5. `@air-jam/sdk/protocol`

Classification: `experimental`

Scope:

1. low-level protocol payloads
2. socket events
3. notices and errors
4. URL policy
5. dev-log event shapes

Why:

1. this export is useful for advanced tooling and internal alignment
2. its current shape is transport-oriented and mixed-purpose, not yet the clean future machine contract
3. it should stay available but not be taught as the canonical agent/runtime API

#### 6. `@air-jam/sdk/contracts/v2`

Classification: `experimental`

Scope:

1. bridge and handshake contract variants

Why:

1. this is still transitional and version-shaped
2. it should not be broadened or treated as the final long-term surface without a clearer contract story

#### 7. `@air-jam/sdk/styles.css`

Classification: `prerelease but intended durable`

Scope:

1. shared styling baseline for SDK UI primitives

Why:

1. it is a narrow leaf with a clear purpose
2. it is safe to use when consuming SDK UI, but it should stay separate from future machine-facing namespaces

### Key Collision Risks

1. `preview` is the nearest thing to automation today, but it must remain a human/devex feature leaf rather than becoming the long-term runtime control contract
2. `arcade` exports are useful product bridges, but they are the wrong layer for general machine session control
3. `protocol` contains useful low-level shapes, but it is too transport-shaped and mixed-purpose to present as the future agent API
4. the root SDK should remain focused on durable game-authoring/runtime essentials instead of absorbing preview, platform, or future machine-contract concerns

## Namespace And Stability Rules

The prerelease namespace strategy should be:

1. keep `@air-jam/sdk` root focused on durable game-authoring/runtime primitives
2. keep human-facing shared React UI in explicit opt-in leaves like `@air-jam/sdk/ui`
3. keep product/devex helpers such as preview and Arcade integrations in explicit experimental leaves
4. keep future machine-facing work out of the root export until its contract is clearly strong enough
5. prefer capability-based names over LLM-branded names so the system remains useful for bots, tests, previews, and future agents equally

### Reserved Future Leaf Directions

If prerelease implementation adds the first machine-facing seams, they should land under explicit leaves such as:

1. `@air-jam/sdk/runtime-control`
2. `@air-jam/sdk/runtime-inspection`
3. `@air-jam/sdk/runtime-observability`
4. `@air-jam/sdk/capabilities`
5. later, if needed, `@air-jam/sdk/scenarios` or `@air-jam/sdk/evaluation`

The important rule is not the exact final naming.
The important rule is that future machine-facing contracts should live in explicit capability leaves instead of being smuggled into `preview`, `arcade`, or the root SDK.

## Implemented Prerelease Seams

The first prerelease internal seams now exist.

### 1. Runtime Control Contract Seams

The SDK now has explicit experimental `@air-jam/sdk/runtime-control` seams that sit directly on the mounted runtime APIs instead of inventing a second transport or store:

1. host runtime control contract
2. controller runtime control contract

Current shape:

1. host control normalizes reconnect, runtime-state control, state broadcast, and signal sending
2. controller control normalizes reconnect, system commands, local profile draft updates, and profile patching

Important boundary:

1. these remain experimental leaves, not root-SDK contracts
2. they are additive adapters over the real `useAirJamHost()` and `useAirJamController()` runtime owners
3. they do not make `preview` or `arcade` the automation contract

### 2. Runtime Inspection Contract Seams

The SDK now has explicit experimental `@air-jam/sdk/runtime-inspection` seams that project mounted runtime state into machine-usable snapshots:

1. host runtime inspection snapshot
2. controller runtime inspection snapshot

Current shape:

1. host inspection exposes room, join URL, join URL status, connection status, players, run mode, runtime state, and last error
2. controller inspection exposes room, controller identity, connection status, runtime state, orientation, host state message, players, self player, and last error

Important boundary:

1. these are structural snapshots, not UI scraping
2. they are intentionally narrower than the full runtime APIs
3. they are the first step toward future machine-readable evaluation and orchestration contracts
4. they remain experimental leaves instead of widening the root SDK

### 3. Runtime Observability Contract Seam

The SDK now has an explicit experimental `@air-jam/sdk/runtime-observability` seam built directly on the existing runtime custom-event stream.

Current shape:

1. runtime events still originate from the canonical `AIRJAM_DEV_RUNTIME_EVENT` stream
2. the new seam normalizes those events into machine-readable observability records with timestamp, event name, role, room, controller, and structured data
3. the seam supports scoped filtering by event, level, role, room, and controller

Important boundary:

1. this does not create a second logging system
2. it is an adapter over the current runtime event stream, not a replacement for provider logs or runtime analytics
3. provider-mounted and bridge-postMessage affordances remain transport helpers; the canonical local observability seam is the runtime event stream itself
4. it remains an experimental leaf instead of being folded into root or `protocol`

### 4. Game Capability Metadata Direction

The first canonical home for game capability metadata now exists.

Current shape:

1. the declaration site is `airjam.config.ts` inside `createAirJamApp({ game: { ... } })`
2. the capability schema itself lives in the explicit experimental leaf `@air-jam/sdk/capabilities`
3. the initial manifest is intentionally narrow and only describes:
4. action capabilities
5. state capabilities
6. evaluation capabilities

Important boundary:

1. this keeps game capability metadata next to the canonical runtime/game metadata declaration instead of scattering it across hosts, stores, or docs
2. the schema remains explicitly experimental so it can evolve without muddying the durable root SDK surface
3. this is a home and shape decision, not a requirement that every existing game fill out a large manifest before release

## Concrete Pre-Release Workstreams

### Workstream A. Contract Definition

1. define the runtime control contract family
2. define the runtime inspection contract family
3. define the runtime observability contract family
4. define the scenario/evaluation contract family
5. define the game capability contract family

Done when:

1. the future spine is explicit enough that implementation can target it without re-arguing fundamentals

### Workstream B. Surface Audit

1. inventory current SDK and framework surfaces that would likely be affected later
2. classify each as stable, prerelease, experimental, or internal
3. identify which currently public APIs are safe to stabilize and which should stay leaf-only or clearly experimental

Done when:

1. the release does not accidentally freeze the wrong abstractions

### Workstream C. Minimal Seams

Add only the minimum prerelease seams that reduce future rewrite pain.

Likely examples:

1. explicit runtime control entrypoints for non-UI session driving
2. explicit runtime inspection seams
3. canonical machine-readable event surfaces on top of existing logs/traces
4. a place for game capability metadata to live without every game inventing it later

Done when:

1. future implementation can be additive over known internal boundaries instead of requiring a deep public API break

### Workstream D. Docs And Stability Story

1. document the future direction clearly
2. document which surfaces are experimental
3. align SDK docs, scaffold docs, and release-facing language with that reality

Done when:

1. users are not misled about which abstractions are durable

## Implementation Checklist

This is the concrete execution order for the prerelease alignment pass.

### 0. Scope Lock

- [x] Confirm that this plan is prerelease canonicalization, not full Studio implementation
- [x] Confirm which future contract families must be explicit before v1
- [x] Confirm which parts of the future remain intentionally post-release

Done when:

1. the team is aligned on "define the spine now, build the whole future later"

### 1. Surface Audit

- [x] Inventory current SDK root exports, SDK subpath exports, and major runtime-facing helper surfaces
- [x] Identify which currently public APIs are likely to collide with the future control/inspection/evaluation direction
- [x] Mark each relevant surface as stable, prerelease, experimental, or internal

Done when:

1. the release surface has an explicit stability map

### 2. Namespace And Stability Rules

- [x] Decide where future machine-facing surfaces should live
- [x] Keep experimental machine-facing work out of the SDK root unless there is a strong reason otherwise
- [x] Document the current intended subpath strategy for future control/agent surfaces

Done when:

1. new future-facing work has a clear place to live without muddying the public root SDK

### 3. Runtime Control Seam

- [x] Define the first internal runtime control seam for non-UI session driving
- [x] Ensure it sits on the real runtime/session model rather than a second automation path
- [x] Keep the initial seam narrow and additive

Done when:

1. future agent/session control can extend a known internal boundary

### 4. Runtime Inspection Seam

- [x] Define the first internal runtime inspection seam
- [x] Decide which lifecycle/state facts are canonical enough to expose structurally
- [x] Avoid coupling the first inspection seam to product-specific UI

Done when:

1. future agent evaluation has an authoritative state-reading boundary to build on

### 5. Observability Alignment

- [x] Define how future machine-readable runtime events should relate to the existing log stream
- [x] Keep logs, traces, and runtime events converging instead of splitting into parallel systems
- [x] Identify the minimum observability seam needed before release

Done when:

1. observability is clearly on the path toward a machine-usable contract instead of remaining only human-oriented logs

### 6. Game Capability Metadata Direction

- [x] Decide where game-defined action/state/evaluation capability metadata should live
- [x] Keep the declaration model optional and narrow in the initial form
- [x] Avoid forcing every existing game into a large schema before release

Done when:

1. there is a canonical home for future game capability metadata

### 7. Release Messaging And Docs

- [x] Document what is stable now
- [x] Document what remains experimental
- [x] Make sure preview/on-screen controllers are not presented as the final future agent control contract

Done when:

1. users are not misled about the long-term meaning of the current SDK surfaces

## Likely Early Implementation Sequence

After this plan is written, the first implementation steps should probably be:

1. add the stability classification and namespace rules
2. inventory current runtime/preview APIs against the future contract families
3. design the first internal runtime control and runtime inspection seams
4. decide how game capability metadata should be declared
5. only then start implementing the smallest internal protocol surfaces

## Validation Contract

Validation for this plan should focus on architecture and API discipline, not only tests:

1. docs and public exports should align
2. experimental surfaces should be clearly isolated
3. new seams should not duplicate existing runtime logic
4. implementation should reduce future rewrite cost rather than just move code around

## Exit Criteria

This plan is complete enough for prerelease alignment when:

1. the future agent/runtime contract spine is explicitly documented
2. current surfaces are classified by stability
3. the repo has the minimum internal seams needed to avoid a painful post-release rewrite
4. release-facing docs do not accidentally promise the wrong long-term abstractions

The plan is not complete only when the entire future Studio exists.
That is intentionally out of scope.
