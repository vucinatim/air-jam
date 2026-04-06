# Runtime Topology And Endpoint Contract Plan

Last updated: 2026-04-06  
Status: active baseline and purge implemented

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [Local Runtime Workflow Modes Plan](./local-runtime-workflow-modes-plan.md)
5. [Arcade Surface Contract](../systems/arcade-surface-contract.md)

## Purpose

Define one clean, explicit, reusable runtime topology model for all Air Jam run modes.

This plan exists because endpoint and transport decisions are currently too implicit across:

1. SDK runtime config
2. platform pages
3. workspace commands
4. secure local helpers
5. scaffolded projects created by `create-airjam`

The result is ambiguity around:

1. which origin serves the page
2. which origin owns realtime sockets
3. which host is shown to phones
4. when proxying is in play
5. what changes between standalone, Arcade, secure local, and hosted release

The goal is to replace scattered inference with one explicit topology contract.

## Core Position

Air Jam should have:

1. one canonical runtime topology model
2. one canonical endpoint vocabulary
3. one shared resolver layer
4. multiple run modes implemented as named topology presets

That shared model must cover both:

1. repo-only workspace flows
2. projects created with `create-airjam`

The framework should standardize the model, not force every project to support every repo workflow.

## Non-Goals

This plan is not for:

1. adding more hidden heuristics to infer runtime behavior from `window.location`
2. making Cloudflare tunnel the default local workflow
3. introducing a large management layer before the runtime model is clear
4. forcing scaffolded projects to carry all monorepo-only workflow complexity
5. preserving today's ambiguous env names and implicit fallbacks forever

## Problems To Eliminate

### 1. Ambiguous "server URL"

Today, "server URL" can mean different things in different places:

1. direct backend origin
2. current platform origin with proxy rewrites
3. inferred page origin with a port swap

That ambiguity is too expensive for a realtime framework.

### 2. Runtime Inference Is Too Scattered

Different layers currently infer runtime behavior from:

1. env variables
2. `window.location`
3. query params
4. embed context
5. workspace command wiring

That should converge into one explicit resolved object.

### 3. Secure Local Mode Lacks A First-Class Backend Topology

Secure local mode currently gives us secure pages, but the backend/socket story is not modeled cleanly enough.

That is exactly why secure local Arcade can feel special or fragile.

### 4. Repo And Scaffolds Share Concepts But Not One Explicit Contract

The repo and `create-airjam` projects already use the same framework, but they do not yet consume one fully explicit runtime topology model.

That means bugs get rediscovered in different forms across:

1. repo workspace flows
2. scaffolded standalone games
3. self-hosted deployments
4. platform-hosted release flows

## Desired End State

Air Jam should resolve a single object for every runtime surface before the SDK begins normal session work.

That object should tell the truth about:

1. what this runtime surface is
2. where it was loaded from
3. where realtime traffic should go
4. what public host should be advertised
5. whether it is embedded or standalone
6. whether proxying is involved
7. whether the transport is secure

No critical session behavior should depend on late guesses from page origin if the topology can be known earlier.

## Canonical Endpoint Vocabulary

The framework should standardize these meanings:

### 1. `appOrigin`

The origin currently serving the runtime document.

Examples:

1. standalone game dev server
2. platform controller shell
3. published hosted release page

### 2. `backendOrigin`

The origin responsible for Air Jam HTTP-side backend duties.

Examples:

1. auth-adjacent API paths
2. browser dev log ingest
3. explicit backend HTTP endpoints

### 3. `socketOrigin`

The origin responsible for realtime Air Jam session sockets.

This must be treated as a first-class value, not as an incidental byproduct of `appOrigin`.

### 4. `publicHost`

The phone-facing public host used for join URLs and QR flows.

This is not necessarily the same thing as `backendOrigin` or `socketOrigin`.

### 5. `assetBasePath`

The effective base path for static assets in the current runtime surface.

This is especially important for:

1. local built Arcade routes
2. published release subpaths
3. embedded runtime loading

### 6. `embedParentOrigin`

When embedded, the parent origin that owns the outer shell.

This is not needed for standalone runtime surfaces.

## Canonical Topology Object

The durable shared shape should be something like:

```ts
interface ResolvedAirJamRuntimeTopology {
  runtimeMode:
    | "standalone-dev"
    | "standalone-secure"
    | "arcade-live"
    | "arcade-built"
    | "self-hosted-production"
    | "hosted-release";
  surfaceRole: "host" | "controller" | "platform-host" | "platform-controller";
  appOrigin: string;
  backendOrigin: string;
  socketOrigin: string;
  publicHost: string;
  assetBasePath: string;
  secureTransport: boolean;
  embedded: boolean;
  embedParentOrigin?: string;
  proxyStrategy: "none" | "platform-proxy" | "dev-proxy";
}
```

This exact field list can still evolve, but the structural idea should stay:

1. explicit
2. serializable
3. debuggable
4. valid for both repo and scaffolded projects

## Run Modes Should Be Topology Presets

The framework should treat run modes as named presets over the same topology model.

### Repo Runtime Modes

The repo should standardize these modes:

1. `standalone-live`
2. `arcade-live`
3. `arcade-built`

Transport security stays separate:

1. `http`
2. `https`

### Scaffolded Project Modes

Projects created with `create-airjam` should standardize these modes:

1. `standalone-dev`
2. `standalone-secure`
3. `self-hosted-production`
4. `hosted-release`

Important:

1. scaffolded projects do not need repo-only Arcade workflow complexity
2. but they should still use the same endpoint vocabulary and topology resolution model

## Proposed Structure

### 1. Shared Runtime Topology Module

Introduce one shared package/runtime module that owns topology modeling and resolution.

The likely home is:

1. `packages/create-airjam/runtime/runtime-topology.mjs`
2. plus a typed SDK-facing counterpart where needed

This module should own:

1. topology types
2. endpoint vocabulary
3. mode presets
4. env-to-topology resolution
5. secure local topology helpers
6. validation and helpful error messages

### 2. Shared Resolver Inputs

The resolver should accept:

1. declared runtime mode
2. declared transport mode
3. current surface role
4. known env/config values
5. optional embedding context

It should not rely on arbitrary late page-origin inference unless that is the documented fallback for a specific mode.

### 3. SDK Consumes Resolved Topology

The SDK should consume resolved topology values instead of making transport-critical guesses itself.

That means:

1. `SocketManager` should be given a resolved `socketOrigin`
2. browser log sink should use resolved backend information
3. join/public URL logic should use resolved `publicHost`
4. embedded runtime handling should know whether it is in proxy mode or direct mode

### 4. Platform Produces Explicit Topology For Embedded Runtimes

When the platform hosts embedded games, it should inject explicit topology data rather than requiring the child to infer too much.

That should cover:

1. embed role
2. app origin
3. socket origin
4. asset base path
5. parent origin
6. secure transport state

### 5. Workspace Commands Produce Topology, Not Ad Hoc Env Soup

Repo commands should become topology producers.

That means commands such as:

1. `pnpm dev`
2. `pnpm arcade:test`
3. future `pnpm arcade:dev`

should compute a mode-specific topology and pass that through intentionally.

### 6. `create-airjam` Should Scaffold Against The Same Contract

Scaffolded projects should use the same topology concepts, but only expose the subset of modes they actually support.

That means:

1. same vocabulary
2. same validation rules
3. same secure-local semantics
4. less workflow surface than the repo

## Implementation Phases

### Phase 1. Vocabulary And Topology Contract

Define and document:

1. endpoint vocabulary
2. topology object
3. supported mode matrix
4. repo versus scaffold mode mapping

Deliverables:

1. topology plan and docs
2. one typed/shared topology module skeleton

### Phase 2. Centralize Repo Runtime Resolution

Move repo runtime resolution into one shared path.

Deliverables:

1. workspace commands produce explicit topology
2. secure local helpers resolve topology, not ad hoc origins
3. platform and SDK stop independently guessing critical origins in repo modes

### Phase 3. Refactor SDK Runtime Consumption

Make SDK session and log/runtime paths consume resolved topology explicitly.

Deliverables:

1. `socketOrigin` becomes first-class
2. `publicHost` use becomes more explicit
3. browser logging and join URL logic use the same resolved contract

### Phase 4. Refactor Platform Embedded Runtime Injection

Platform-owned Arcade flows should inject explicit topology to embedded host/controller runtimes.

Deliverables:

1. cleaner embedded startup contract
2. less dependency on page-origin guessing
3. easier debugging of Arcade-only issues

### Phase 5. Align `create-airjam` Scaffolds

Move scaffolded projects onto the same standardized runtime topology model.

Deliverables:

1. clearer generated env/docs contract
2. explicit supported modes for generated games
3. no drift between repo and exported project semantics

## Debugging And Tooling

Tooling should come after the topology contract exists, not before.

The first useful tooling addition should be a topology inspector, not more hidden magic.

The likely shape is:

```bash
pnpm run repo -- workspace topology --game=pong --mode=arcade-built --secure
```

That command should print the resolved topology so developers can see:

1. `appOrigin`
2. `backendOrigin`
3. `socketOrigin`
4. `publicHost`
5. `assetBasePath`
6. proxy strategy

This is small but high-leverage once the runtime model is clean.

## Success Criteria

This plan is successful when:

1. Air Jam run modes are described through one shared topology model
2. the SDK no longer makes transport-critical origin guesses in important modes
3. repo runtime modes and scaffolded project modes share one endpoint vocabulary
4. secure local behavior is explicit and trustworthy
5. Arcade embedded behavior is easier to reason about than today
6. endpoint/port/origin bugs become easier to localize and rarer to introduce

## Immediate Next Step

The next concrete move should be:

1. finalize the shared endpoint vocabulary
2. define the exact `ResolvedAirJamRuntimeTopology` contract
3. map every current repo mode and every scaffolded-project mode onto it before changing runtime code

That keeps the refactor architectural instead of reactive.
