# Air Jam AI Studio Architecture

Last updated: 2026-03-26  
Status: active direction

Related docs:

1. [Deployment and Monetization Strategy](./deployment-and-monetization-strategy.md)
2. [Framework Paradigm](./framework-paradigm.md)
3. [Implementation Plan](./implementation-plan.md)
4. [Docs Index](./docs-index.md)

## Purpose

This document defines the intended architecture for Air Jam Studio as a future AI-native game creation product.

It exists to make one thing explicit:

Air Jam Studio should not become a generic cloud IDE.

The correct direction is a local-first, Air Jam-specific creation environment with a trusted cloud publish path.

That means:

1. instant local preview should be the default feeling
2. cloud orchestration should remain the authority for publish and hosted operations
3. the system should be designed around Air Jam project constraints, not arbitrary app support
4. AI agent workflows should use the same project and deploy model as human workflows

## Core Position

Air Jam Studio should be built as an opinionated runtime for Air Jam apps only.

It should not try to support:

1. arbitrary web stacks
2. arbitrary server frameworks
3. arbitrary native build chains
4. general-purpose backend hosting
5. full cloud workstation semantics as a product goal

Its value should come from being deeply specialized:

1. Air Jam-aware agents
2. Air Jam-owned templates and project structure
3. fast preview for known-compatible project shapes
4. one-click publish into Air Jam deployment targets
5. continuity between local creation, cloud build, and hosted release

Specialization is the feature.

## Product Goal

The user experience should feel like:

1. open a project instantly
2. edit manually or with agents
3. keep a warm preview running
4. see changes without waiting for a whole remote machine cycle
5. reload and continue where you left off
6. publish through a trusted hosted pipeline when ready

The system should feel much closer to "live local creative tool" than "remote VM you wait on".

## The Correct Model

Air Jam Studio should have two execution planes and one shared release contract.

### 1. Local Preview Plane

This is the browser-local runtime used for fast creation and iteration.

Responsibilities:

1. restore the project into a local virtual filesystem
2. run the Air Jam dev server locally
3. keep dependencies and runtime warm
4. apply manual edits and agent patches directly to files
5. drive fast preview and feedback loops
6. autosave project changes to the backend

This plane is about speed and responsiveness.

### 2. Cloud Authority Plane

This is the Air Jam hosted control plane.

Responsibilities:

1. authentication and project ownership
2. workspace persistence and history
3. agent orchestration when trust or longer execution is required
4. authoritative builds
5. release creation
6. deployment and hosting
7. analytics, billing, quotas, and moderation
8. secret-bearing operations

This plane is about trust and product authority.

### 3. Shared Release Contract

Both planes must converge into the same release model.

The shared shape should be:

1. workspace snapshot
2. build definition
3. static artifact output
4. versioned `Game Version`
5. deploy target and publication state

This is the most important architecture rule in the whole system.

Local preview and cloud publish may differ in where they run, but they must not differ in what they produce conceptually.

## Minimal Core Architecture

The cleanest system is built from four primary primitives.

Everything else should be an adapter around these, not a parallel architecture.

### 1. Canonical Air Jam Workspace

This is the project contract.

It should define:

1. the allowed directory layout
2. the template lineage
3. the pinned toolchain/runtime contract
4. the supported dependency policy
5. the build target and artifact shape

This must stay narrow.

If the workspace contract stays clear, the rest of the studio stays simple.

### 2. Browser-Local Runtime

This is the fast creation and preview engine.

It should:

1. restore a workspace locally
2. run the Air Jam dev server
3. apply manual edits and agent patches directly to files
4. keep preview warm
5. avoid full environment resets whenever possible

This is the main developer loop.

### 3. Snapshot Store

This is the durable workspace state layer.

It should own:

1. versioned workspace snapshots
2. recovery checkpoints
3. sealed build inputs
4. history suitable for restore and publish

This should not be confused with Git history or with transient realtime session state.

### 4. Authoritative Publish Service

This is the trusted release authority.

It should:

1. build from a specific sealed snapshot
2. validate the output
3. create a new `Game Version`
4. drive deploy and publication state

This is the only place where deploy truth should be finalized.

## Max-DevEx Rule

To maximize developer experience, Air Jam Studio must keep three loops separate.

### 1. Edit Loop

The edit loop should be:

1. local
2. warm
3. patch-based
4. instant by default

### 2. Save Loop

The save loop should be:

1. automatic
2. debounced
3. snapshot-oriented
4. mostly invisible unless recovery or conflict state matters

### 3. Publish Loop

The publish loop should be:

1. explicit
2. trusted
3. cloud-run
4. based on a sealed snapshot

If these loops are allowed to collapse into one another, the product will become sluggish and confusing.

## Source Of Truth Rules

The system should follow these rules strictly.

### 1. Workspace Truth

The current editable project state lives in the local runtime and is durably represented by backend snapshots.

### 2. Collaboration Truth

Live collaborative session state may be realtime, but it is not the same thing as workspace durability.

### 3. Release Truth

Publish and deploy state must come only from an authoritative build of a specific sealed snapshot.

### 4. Integration Truth

External systems such as GitHub are adapters around the workspace model, not replacements for it.

## Why This Must Not Be A Generic Browser IDE

The project becomes much simpler and much stronger if Air Jam Studio only supports Air Jam-compatible apps.

That allows Air Jam to assume:

1. one or a few owned starter templates
2. one known directory layout
3. one known dev-server shape
4. one known build output model
5. one controlled package/toolchain policy
6. static artifact output only

Without these constraints, the studio becomes an infrastructure product.

That is not the goal.

The goal is to make Air Jam creation feel unusually fast, reliable, and coherent.

## Runtime Strategy

The local runtime should be browser-first and Air Jam-specific.

Recommended initial direction:

1. use a browser-local Node-capable runtime
2. ship a pre-baked Air Jam workspace image
3. cache dependencies and tooling aggressively
4. keep the dev server long-lived
5. favor patch-in-place edits over full environment resets

The runtime should be treated as a product primitive, not an implementation detail.

### What The Local Runtime Needs

Minimum capabilities:

1. virtual filesystem
2. Node execution
3. long-lived dev server process
4. file watch and hot-reload support
5. stdout/stderr streaming
6. process lifecycle control
7. snapshot import and export

### What The Local Runtime Should Not Promise

It should not initially promise:

1. arbitrary native binaries
2. arbitrary Linux package installs
3. arbitrary container support
4. SSR or backend process hosting as a product feature
5. compatibility with any npm package in the ecosystem

Those promises would expand scope too early and make reliability worse.

## Workspace Model

Air Jam Studio should operate on a canonical workspace model.

Recommended conceptual entities:

1. project
2. workspace
3. workspace snapshot
4. file operation stream
5. preview session
6. build request
7. `Game Version`

### Project

The durable product-level object.

Owns:

1. identity
2. permissions
3. billing/account linkage
4. template lineage
5. publish history

### Workspace

The editable file tree plus metadata needed for creation.

Owns:

1. current files
2. local runtime metadata
3. dependency/toolchain version
4. draft state
5. unsaved or uncheckpointed changes

### Workspace Snapshot

The sync and recovery primitive.

A snapshot should be sufficient to:

1. restore the local runtime after reload
2. hand work off between local and cloud execution
3. build the project authoritatively in the cloud
4. create version history and recovery points

Snapshots should be cheap, explicit, and frequent.

## Sync Model

The studio should autosave continuously, but without making the product feel remote.

The sync model should separate:

1. local file application
2. background persistence
3. checkpoint creation
4. authoritative publish-time validation

### Recommended Sync Flow

1. user or agent changes files locally
2. file operations are applied immediately to the local filesystem
3. preview updates from the local runtime
4. changed files are debounced and persisted to the backend
5. the backend records snapshots/checkpoints in the background
6. reloading the app restores the last good snapshot into the local runtime

The local edit should never wait on backend acknowledgement before the preview updates.

### Conflict Rule

Air Jam Studio should avoid multi-writer ambiguity early.

The recommended first rule is:

1. one active editing session per project workspace
2. background views are read-only or passive
3. explicit fork/branching can come later if needed

This avoids unnecessary sync complexity in v1.

## Snapshot Contract

Publish correctness depends on snapshot correctness.

Because of that, snapshot identity should be explicit and durable.

Recommended conceptual fields:

1. `workspaceId`
2. `workspaceVersion`
3. `snapshotId`
4. `baseSnapshotId`
5. `localDirtySeq`
6. `createdAt`
7. `publishedFromSnapshotId`

The critical rule is:

Publish should always build a named sealed snapshot, never "whatever the backend has right now".

## Agent Execution Model

Agents should be able to operate in both planes, but not all work belongs in the same plane.

### Local Agent Work

Use the local plane for:

1. code edits
2. UI iteration
3. short analysis
4. local preview-driven refinement
5. cheap fast loops that benefit from instant feedback

In this mode, the agent should modify targeted files directly instead of regenerating the whole project.

### Cloud Agent Work

Use the cloud plane for:

1. trusted publish operations
2. long-running generation or analysis
3. secret-bearing tasks
4. moderation or policy-gated tasks
5. builds that exceed local runtime limits

The user should still experience this as one product, but the authority boundary must stay clear internally.

### The Golden Rule

Agents should operate on the same workspace model as humans.

No separate hidden "agent project format" should exist.

That would create drift and make the product harder to reason about.

## Agent Guardrails

Agent correctness should not depend on prompting alone.

The workspace should expose a machine-checkable contract that agents must obey.

Recommended conceptual constraints:

1. `template`
2. `allowedCommands`
3. `allowedPackages`
4. `buildTarget`
5. `entryFiles`
6. `forbiddenPatterns`

This keeps the agent inside the supported Air Jam workspace model instead of letting it invent its own architecture.

## Preview, Build, And Publish Must Stay Separate

These concepts must not collapse into one lifecycle.

### Preview

Preview is:

1. local by default
2. fast
3. warm
4. tolerant of temporary errors
5. optimized for iteration

### Build

Build is:

1. deterministic
2. environment-pinned
3. suitable for validation
4. capable of producing a deployable static artifact

### Publish

Publish is:

1. hosted
2. authenticated
3. policy-checked
4. tied to release/version creation
5. the source of truth for deploy state

If these are collapsed together, the product will feel slow and confusing.

## Publish Pipeline

The authoritative publish path should always run through the Air Jam backend.

Recommended flow:

1. resolve the latest workspace snapshot
2. run the pinned build definition in a trusted cloud environment
3. validate artifact shape and compatibility
4. create a new `Game Version`
5. assign preview/live URLs and publication metadata
6. update deploy state and rollback history

This keeps deployment trustworthy even if local preview is flexible.

## Realtime Collaboration Boundary

Realtime infrastructure is valuable, but it should not replace the snapshot and publish architecture.

The clean role for realtime infrastructure is live coordination, not durable release truth.

Realtime systems are a good fit for:

1. presence
2. active studio session state
3. preview session metadata
4. agent progress and streamed events
5. live collaboration room state
6. future collaborative file-operation distribution

Realtime systems are not the right primary source for:

1. sealed workspace snapshots
2. publish inputs
3. build artifacts
4. rollback history
5. deploy truth

### Specific Recommendation: SpacetimeDB 2.0

SpacetimeDB 2.0 is a strong candidate for the live collaboration plane.

It appears especially promising for:

1. multiplayer studio presence
2. active shared room state
3. event and progress feeds
4. preview/session orchestration
5. future collaborative game-testing flows

But it should remain a coordination layer around the workspace and release system, not the canonical storage model for files and publishes.

The clean boundary is:

1. SpacetimeDB for live studio coordination
2. snapshot store for durable workspace state
3. publish service for authoritative releases

### Collaboration Scope For V1

True multi-writer code editing should not be the first target.

The recommended first step is:

1. one active editor session
2. presence for observers or collaborators
3. shared preview and agent activity
4. explicit takeover or fork semantics

This keeps collaboration useful without forcing CRDT-level complexity too early.

## GitHub Integration Boundary

GitHub should be an optional integration lane, not the primary live workspace backend.

GitHub is useful for:

1. import
2. export
3. optional sync
4. future Git-connected deploy inputs
5. developer trust and portability

GitHub is not a good core replacement for:

1. local-first autosave
2. temporary draft state
3. silent checkpoints
4. live collaboration state
5. authoritative publish input management

### Recommended Role For GitHub

The clean model is:

1. Air Jam owns the live workspace
2. Air Jam owns workspace snapshots
3. GitHub is a connected source or destination
4. publish normalizes both snapshots and Git revisions into the same release pipeline

This preserves good developer portability without turning the whole studio into a Git client.

## Recovery And Continuity

The studio should feel resilient by default.

Required continuity properties:

1. reload restores the latest project snapshot
2. local crash does not destroy work
3. preview session can be recreated from persisted state
4. publish never depends on one fragile browser process surviving
5. cloud builds can be reproduced from persisted inputs

This is a major reason the workspace snapshot model matters.

## Hard Constraints For V1

Air Jam Studio should be intentionally narrow at first.

Recommended constraints:

1. only Air Jam-owned templates are supported initially
2. only known-compatible dependencies are officially supported
3. builds target static output only
4. no arbitrary backend hosting
5. no SSR support
6. no promise of arbitrary native-node compatibility
7. one active editor session per workspace

These constraints are not weaknesses.

They are the product boundary that keeps the studio fast and reliable.

## Dependency Policy

Dependency freedom has to be treated carefully.

If arbitrary packages are allowed too early, the fast local runtime story will degrade quickly.

Recommended initial policy:

1. first-party templates
2. pinned lockfiles
3. curated compatible package set
4. controlled additions over time

This is not anti-developer.

It is how Air Jam preserves the quality of the local-first studio loop.

### Initial Compatibility Baseline

The initial supported dependency profile should be based on the real dependency surface already proven by the prototype game.

That means Air Jam Studio should fully support the package classes currently used by the prototype game, including:

1. React and React DOM
2. React Router
3. Zustand
4. Zod
5. Tailwind CSS and related Vite integration
6. Radix UI primitives used by the prototype
7. Three.js
8. React Three Fiber
9. Drei
10. Rapier compatibility packages used by the prototype
11. common utility libraries such as `clsx`, `class-variance-authority`, `tailwind-merge`, `nanoid`, and `lucide-react`
12. the Vite plugins required by the prototype game's current build shape

This should be treated as the first official runtime compatibility profile, not as an accidental one-off example.

The important rule is:

If Air Jam Studio cannot support the dependency surface required by the prototype game, then the studio is not yet supporting first-class Air Jam game development.

### Compatibility Profiles

To keep the model extensible without becoming vague, dependency support should be expressed through explicit runtime compatibility profiles.

The recommended first profile is:

1. `prototype-game`

That profile should define:

1. supported packages
2. allowed version ranges
3. supported build plugins
4. local-preview compatibility
5. authoritative-publish compatibility

Over time, Air Jam can add new profiles or expand the existing one deliberately instead of drifting into accidental package support.

## Why A Browser-Local Runtime Is Still Worth It

A browser-local runtime is worth the effort if it delivers:

1. instant startup after template restore
2. warm preview instead of cold rebuild loops
3. direct file edits without remote round-trips
4. dramatically lower perceived latency for agent-assisted creation
5. lower cloud cost for exploratory work

It should be treated as the preview engine, not the source of truth for deployment.

## Known Constraints And Risks

The local-first model still has real constraints.

### Browser Runtime Constraints

Expect friction around:

1. browser memory and CPU ceilings
2. background-tab throttling
3. filesystem size limits
4. cross-origin isolation requirements for some runtimes
5. compatibility issues with native modules and arbitrary binaries

### Product Constraints

Expect complexity around:

1. sync correctness
2. snapshot size and checkpoint policy
3. clear local-vs-cloud state communication
4. fallback rules when local preview cannot handle a task
5. ensuring publish remains deterministic

These are real but manageable if the project stays narrow.

### Recovery And Trust Risks

Silent persistence is correct, but trust still needs visible support.

The product should make recovery reliable through:

1. durable snapshot history
2. clear last-synced indicators when relevant
3. explicit restore points
4. clear publish-from-snapshot semantics

If users ever feel that work may vanish or that publish may build the wrong state, trust will drop immediately.

## Decision Rule For Local vs Cloud Work

When deciding where a task should run, use this rule:

Run it locally when the primary goal is preview speed and it fits the supported Air Jam runtime.

Run it in the cloud when the primary goal is trust, durability, policy enforcement, secret access, or authoritative release creation.

## Recommended Rollout Order

### Phase 1. Canonical Air Jam Workspace

Define the project shape first:

1. directory layout
2. template contract
3. build definition
4. artifact contract
5. snapshot model

### Phase 2. Local Preview Runtime

Ship the minimal browser-local runtime:

1. restore workspace
2. run dev server
3. apply file edits
4. show preview
5. autosave in background

### Phase 3. Agent-Native Editing

Add agent flows that:

1. inspect the workspace
2. patch targeted files
3. explain changes
4. reuse the same running preview loop

### Phase 4. Trusted Publish Pipeline

Add the hosted publish path:

1. authoritative build
2. artifact validation
3. `Game Version` creation
4. managed deploy target

### Phase 5. Cloud Escalation Paths

Add cloud execution only where needed:

1. heavier agent jobs
2. builds beyond local limits
3. policy-gated operations
4. future team or managed workflows

## Non-Goals

Air Jam Studio should not become:

1. a generic no-code website builder
2. a browser VM product
3. a general-purpose cloud IDE
4. a hosting platform for arbitrary backend apps
5. a product where the local and cloud project models diverge

## Closeout Rule

If future studio work creates tension between "general flexibility" and "fast reliable Air Jam creation", prefer the option that:

1. keeps the project model narrow
2. preserves the local-first preview loop
3. keeps cloud publish authoritative
4. reuses the same workspace and release contract for humans and agents
5. avoids turning Air Jam Studio into a generic infrastructure product
