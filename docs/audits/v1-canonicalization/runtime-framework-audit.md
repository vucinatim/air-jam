# Runtime and Framework Canonicalization Audit

Last updated: 2026-08-28
Status: complete; cross-reviewed
Finding range: `CAN-001` through `CAN-099`

This report follows [audit-contract.md](./audit-contract.md). It records this
lane's evidence and proposed end states; the decision register and readiness
graph remain authoritative for acceptance and execution.

## Lane Map

### Composition roots

1. `packages/sdk/src/runtime/create-air-jam-app.tsx` is the creator-facing
   composition root. It resolves one `AirJamApp` config and creates host and
   controller wrappers around the session runtimes.
2. `packages/sdk/src/runtime/session-runtimes.tsx` composes session providers,
   platform settings, runtime-owner APIs, and runtime-inspection publication.
3. `packages/server/src/index.ts#createAirJamServer` composes Express,
   Socket.IO, rooms, authentication, rate limiting, usage publication,
   development logging, and development-harness routes.
4. `packages/server/src/gateway/register-socket-handlers.ts` builds the socket
   authorization/rate-limit context and registers the host, controller,
   realtime, and disconnect adapters.
5. `packages/harness/src/visual/runner.ts#runVisualHarness` composes the legacy
   visual scenario/capture stack and can attach a semantic game session.
6. Each `games/*/src/airjam.config.ts` is a first-party game composition root.
   All six current games publish `createAirJamApp(...)` configuration and a
   game-owned semantic `agentContract`.
7. `packages/create-airjam/scripts/generate-scaffold-sources.mjs` derives
   packaged template archives from game workspaces whose
   `airjam-template.json` opts into scaffolding. Game source is the intended
   template authority.

### Authority boundaries

| Concern                                    | Intended authority                                | Main adapters and consumers                                             |
| ------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------- |
| Runtime topology                           | `@air-jam/sdk/runtime-topology`                   | SDK runtime config, platform, server project CLI, create-airjam runtime |
| Host/controller session wiring             | `createAirJamApp` and SDK session runtimes        | game routes; platform shell runtimes                                    |
| High-frequency input                       | SDK input writer/manager and server input routing | controller publisher and active host                                    |
| Replicated game state                      | game-owned `createAirJamStore` instance           | SDK transport; server snapshot routing/cache                            |
| Signals and coarse commands                | SDK signal APIs and shared protocol               | server authorization/routing; host/controller UX                        |
| Room membership, routing, focus, reconnect | runtime server                                    | `RoomManager`, room domain, gateway handlers                            |
| Semantic game actions and projections      | game-owned `agentContract`                        | devtools game session and MCP adapters                                  |
| Runtime inspection publication             | SDK host/controller runtimes                      | visual and devtools browser readers                                     |
| Visual proof                               | browser session/capture runner                    | repo visual tooling and devtools                                        |
| Scaffold runtime source                    | opted-in `games/*` source                         | deterministic ZIP generator and create-airjam                           |

### Public and operational surfaces

1. `@air-jam/sdk` publishes a stable root/UI lane plus experimental Arcade,
   protocol, metadata, prefab, preview, capabilities, release,
   platform-machine, agent-tooling, and runtime-topology subpaths.
2. `@air-jam/server` publishes a binary, a Vite-config leaf, and a JavaScript
   root entry with no declarations or documented programmatic contract.
3. Game projects use `air-jam-server` commands for dev, topology, status,
   reset, secure initialization, and logs.
4. Semantic control is adapted by devtools/MCP as open, read, input, invoke,
   and close operations; the game-owned contract remains the semantic source.

## What Is Already Canonical

1. The input, replicated-state, and signal/command lanes are explicitly
   separate. Server integration tests exercise routing, state sync, lifecycle,
   authorization, and reconnect at real Socket.IO boundaries.
2. `createAirJamStore` is one creator-facing authoritative-state primitive,
   including typed payload rules, host execution, acknowledgements, reconnect
   replay, and action-observation hooks.
3. `packages/server/src/domain/room-session-domain.ts` already extracts and
   tests important lifecycle transitions, capability expiry, focus changes,
   controller leases, and snapshot construction.
4. SDK protocol schemas are shared by SDK clients and the server. Export tests
   deliberately keep raw protocol internals off the stable SDK root.
5. Direct and embedded runtimes implement the same internal
   `AirJamRealtimeClient`; the iframe bridge remains transport adaptation.
6. Runtime inspection is mounted automatically by both canonical session
   runtimes rather than requiring game-specific debug components.
7. All six first-party games publish semantic actions that target normal
   authoritative store actions rather than a second gameplay implementation.
8. Scaffold ZIPs are deterministically generated from real game sources, and
   the checker prevents private visual-scenario declarations from leaking into
   generated projects.
9. SDK/server coverage is strong around state RPC, sync, reconnect, ownership,
   embedded bridges, topology, exports, lifecycle, routing, and security.

## Findings

The findings below distinguish current strengths from release-relevant
canonicalization work.

### CAN-001 — A deprecated private package duplicates runtime topology

- Category: canonicality
- Complexity: duplicated-capability
- Severity: medium
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/sdk/src/runtime-topology.ts` (569 lines) and
  `packages/runtime-topology/index.mjs` (450 lines) independently implement the
  same modes, roles, proxy strategies, validation, resolution, and
  environment/window/query carriers. `rg -n '@air-jam/runtime-topology'` finds
  only `packages/harness/src/visual/runtime.ts` and its test as live consumers
  of the private package; platform, server project CLI, create-airjam, and SDK
  tests use `@air-jam/sdk/runtime-topology`. No generator or parity check links
  the sources, and the private package's former npm surface is deprecated.
- Current behavior: two source files can independently change a routing- and
  security-relevant contract; the obsolete private authority remains a root
  dependency for one harness import.
- Architectural harm: agents must inspect both before knowing which behavior
  is real, and silent validator drift can change embedded/runtime routing.
- Canonical end state: `packages/sdk/src/runtime-topology.ts` is the only model,
  consumed through `@air-jam/sdk/runtime-topology` internally and publicly.
- Change: move the harness import to the SDK leaf, delete
  `packages/runtime-topology/`, and remove its root/lockfile entries.
- Dependencies and blast radius: harness runtime/tests, root manifest, lockfile,
  SDK build/export, package checks.
- Validation: search contains no old package/path; SDK topology tests cover all
  modes/carriers; package, typecheck, and scaffold smoke gates pass.

### CAN-002 — The production server carries an unused parallel visual-harness control plane

- Category: agent-operability
- Complexity: obsolete-complexity
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/server/src/index.ts#createAirJamServer` always constructs
  `DevHarnessRegistry` and mounts unauthenticated
  `/__airjam/dev/harness/register`, `sessions`, `commands`, and `invoke` routes
  without an environment guard. `packages/harness/src/visual/runtime.ts`
  publishes a second snapshot/action map and polls that HTTP bus. Search finds
  no game/platform mount of `VisualHarnessRuntime` or
  `defineVisualHarnessBridge`, while
  `packages/create-airjam/scripts/check-scaffold-sources.mjs` rejects
  `visualScenariosModule`. All games instead publish semantic `agentContract`
  definitions, and `docs/contracts/agent-session-contract.md` names semantic
  sessions as canonical.
- Current behavior: a roughly 3,000-line private harness, server command
  registry, browser globals, and devtools fallback coexist with semantic game
  sessions even though first-party products do not mount the browser runtime.
- Architectural harm: this is a second action-description, snapshot, and
  session-discovery model. It expands production attack/maintenance surface and
  leaks browser implementation details into agent tooling.
- Canonical end state: semantic sessions own machine state/actions; SDK runtime
  inspection owns mounted-runtime facts; browser tooling owns visual proof. The
  production server has no generic development command bus.
- Change: after tooling cross-review proves no unique need, delete the server
  harness routes/registry, `VisualHarnessRuntime`, global bridge/action keys,
  HTTP client, and `visual-harness` session fallback. Retain browser capture,
  viewport/scenario, and prefab utilities only through semantic sessions and
  normal browser surfaces.
- Dependencies and blast radius: server bundle/tests, harness, devtools
  visual/session adapters, MCP `harnessSessionId`, repo visual tooling.
- Validation: production route inventory has no harness command endpoints;
  visual capture uses one semantic session and captures both surfaces; server,
  visual, and clean-room agent-session tests pass.

### CAN-003 — Runtime inspection leaks from a stable root while documented private

- Category: public-contract
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/sdk/src/index.ts` exports the runtime-inspection key,
  create/read/publish helpers, contracts, and hooks, making them part of the
  stable `.` bundle. The “Runtime Contract Seams (In-Source, Not Public
  Exports)” section of `packages/sdk/README.md` says runtime inspection is not public;
  `packages/sdk/tests/export-surface.behavior.test.ts` only checks that its
  subpath is absent and misses the root symbols. First-party harness/devtools
  readers now consume them from the root, and
  `docs/contracts/runtime-inspection-contract.md` calls inspection first-class.
- Current behavior: docs, package policy, export tests, and emitted root API
  disagree about stability and ownership.
- Architectural harm: 1.0 would accidentally promise stable semver for an API
  described as private; later extraction would be a breaking change.
- Canonical end state: inspection is an explicit experimental
  `@air-jam/sdk/runtime-inspection` leaf; the stable authoring root does not
  expose publication internals.
- Change: add the leaf, migrate consumers, remove root symbols, and align the
  README, public docs, type/export tests, and stability table.
- Dependencies and blast radius: SDK manifest/tsup/typesVersions, session
  runtimes, harness/devtools readers, package smoke and docs.
- Validation: root assertions prove symbols absent; the leaf imports from a
  packed tarball; publication/read tests pass; all stability docs agree.

### CAN-004 — The stable SDK teaches two runtime composition models

- Category: composition
- Complexity: duplicated-capability
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/sdk/src/index.ts` exports both `createAirJamApp` and raw
  `AirJamHostRuntime`/`AirJamControllerRuntime`. The SDK README's “One Correct
  Way” and all six games use `airjam.Host`/`airjam.Controller`; public pages
  including `content/docs/sdk/hooks/page.mdx` and
  `content/docs/how-it-works/host-system/page.mdx` teach raw runtime mounting as
  equal. Outside SDK/docs, direct raw-runtime consumers are dynamic platform
  shell pages.
- Current behavior: creators see two stable ways to own topology, input config,
  boundaries, and role wrappers. The lower-level shell primitive is mixed into
  ordinary game authoring.
- Architectural harm: two composition roots enlarge the semver contract and
  let games bypass the config object agent tooling imports for metadata and
  semantic contracts.
- Canonical end state: `createAirJamApp` is the only stable creator model; raw
  dynamic shell runtimes live on an explicit internal/experimental composition
  leaf used by the platform.
- Change: move raw runtimes off the stable root, migrate platform imports, and
  rewrite public guides around the one app-config path.
- Dependencies and blast radius: SDK exports, platform Arcade/controller pages,
  generated/base docs, examples, export tests.
- Validation: games and a clean scaffold use one root; stable root tests exclude
  raw runtimes; platform embedded/reconnect browser tests pass via the leaf.

### CAN-005 — The public capabilities manifest is speculative and overlaps the semantic contract

- Category: simplicity
- Complexity: duplicated-capability
- Severity: medium
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/sdk/src/capabilities/manifest.ts` defines action, state,
  and evaluation descriptors; `createAirJamApp` carries `capabilities`; and
  `@air-jam/sdk/capabilities` is public. Search finds no first-party game,
  platform, devtools, MCP, or scaffold consumer—only source/tests/docs. Each
  game instead owns a live `agentContract` describing stores, projected state,
  actions, payloads, availability, and results for semantic sessions.
- Current behavior: two schemas can describe agent-visible actions/state, but
  only one connects to executable behavior.
- Architectural harm: creators cannot tell whether `capabilities` or `agent` is
  authoritative, and the disconnected schema can drift without failure.
- Canonical end state: the executable semantic agent contract is the only
  game-control/state declaration. Evaluation metadata joins it only when a real
  evaluator consumes it.
- Change: delete the capabilities leaf/schema/tests and `AirJamApp` option;
  remove current-capability claims from docs.
- Dependencies and blast radius: SDK exports/app types/docs/tests; no live
  product consumer was found.
- Validation: search contains no capability-manifest symbols/leaf; SDK tarball
  tests pass; retained semantic metadata has executable coverage.

### CAN-006 — Project dev/runtime orchestration is maintained as source copies

- Category: ownership
- Complexity: duplicated-capability
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: eight modules under `packages/server/src/project-cli/` and
  `packages/create-airjam/runtime/` total 4,431 lines.
  `runtime-topology.mjs`, `vite-config.mjs`, `vite-https.mjs`, and
  `dev-utils.mjs` are byte-identical; `game-dev.mjs`, `secure-dev.mjs`, and
  `topology.mjs` differ primarily in command branding and environment labels.
  The two local `internal/env-validation.mjs` files and
  `packages/env/index.mjs` are also byte-identical. No generator/parity check
  connects the copies. Server CLI, create-airjam, games, and workspace commands
  consume different sides, while `@air-jam/env` is already a genuine shared
  authority used by platform, release worker, and server.
- Current behavior: process, secure-dev, topology, Vite, and environment fixes
  need manual duplicate edits; adapter branding is embedded in copied cores.
- Architectural harm: the main human/agent dev front door can differ depending
  on which binary launches it, and repair ownership is ambiguous.
- Canonical end state: one internal project-runtime implementation owns these
  capabilities; `air-jam-server` and `airjam` are thin branded adapters. Shared
  environment behavior reuses/bundles the existing internal authority.
- Change: parameterize only identity/labels, migrate both CLIs, delete copies,
  and bundle the shared code into public packages without publishing a fifth
  package.
- Dependencies and blast radius: server/create-airjam builds and tarballs,
  workspace commands, game scripts, secure state, Vite types, release packaging.
- Validation: one implementation exists per capability; both packed CLIs pass
  one contract suite plus adapter snapshots; scaffold, secure, topology,
  status/reset, and `pnpm run dev` smokes pass.

### CAN-007 — Game-owned semantic contracts have no first-party conformance proof

- Category: testability
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: all six `games/*/src/game/contracts/agent.ts` modules manually map
  store domains, action IDs/names, payload transforms, and snapshot projection.
  Search under every `games/*/tests` finds no import/execution of
  `agentContract`. Devtools/MCP tests use synthetic contracts, proving adapters
  but not current game/store parity. Scaffold generation packages these
  unverified contracts as the canonical agent surface.
- Current behavior: a renamed store action or projection drift can leave
  discovery healthy but make a generated project's session fail at invocation.
- Architectural harm: the defining agent-first promise depends on manual
  mappings outside game test gates.
- Canonical end state: every scaffoldable game has executable conformance proof
  at the actual store/runtime boundary, with one packed external session proof.
- Change: add one shared suite that imports every opted-in config, verifies
  store domains/target actions, projects JSON state, validates payload metadata,
  and invokes safe representative actions through a real session. Reuse it for
  source and scaffold smoke.
- Dependencies and blast radius: all game contracts/stores/tests, devtools
  loader, scaffold archives, MCP proof, browser/runtime setup.
- Validation: enumeration fails on unknown targets or unserializable state; one
  packed clean-room project completes open/read/invoke/close through CLI/MCP.

### CAN-008 — The public server package exposes an accidental untyped root

- Category: public-contract
- Complexity: unclear-ownership
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `packages/server/package.json` publishes `.` as `dist/index.js` and
  sets `main`, while `packages/server/tsup.config.ts` sets `dts: false`; built
  output has no `index.d.ts`. No server README/public guide documents importing
  `createAirJamServer`; all non-test consumers use the binary and
  `@air-jam/server/vite-config`. Root imports are internal source tests/CLI.
- Current behavior: JavaScript users can import a large server factory and
  incidental exports, while TypeScript users receive no contract or stability
  story.
- Architectural harm: 1.0 appears to promise an API that cannot be maintained
  honestly under semver and bypasses the intended operational CLI.
- Canonical end state: based on current consumers, the package deliberately
  exposes its binary and Vite-config leaf; factory code stays internal. A typed
  library should exist only if synthesis finds a concrete supported embedding
  story.
- Change: remove the root export/`main`, or replace it only after an explicit
  typed/documented product decision; add package-surface assertions.
- Dependencies and blast radius: server manifest/build/bin, tarball smoke,
  self-host docs, release checks.
- Validation: packed inspection exposes exactly the decided contracts;
  TypeScript/JavaScript smokes agree; no undocumented root import resolves.

### CAN-009 — Room authority is bound to one in-memory server process

- Category: composition
- Complexity: necessary-complexity
- Severity: high
- Release classification: before-scale
- Confidence: high
- Evidence: `packages/server/src/services/room-manager.ts` stores rooms and
  host/controller indexes in process-local `Map` objects;
  `createAirJamServer` creates one manager per process; Socket.IO uses its
  default in-memory adapter with no shared directory/adapter dependency.
  Timers, snapshots, focus, leases, and capabilities also live on mutable
  `RoomSession` in `packages/server/src/types.ts`.
- Current behavior: one process correctly owns each room, but a second generic
  replica would split discovery, routing, reconnect state, and timers.
- Architectural harm: ordinary horizontal autoscaling would create correctness
  failures rather than merely lower efficiency, conflicting with launch-influx
  planning.
- Canonical end state: retain one writer per room while making placement
  explicit: a room directory/admission layer plus sticky or deterministic
  routing to its owner, cross-node socket/event support, and bounded recovery.
  Gameplay state must not become multi-writer distributed state.
- Change: measure/publish safe single-node capacity and enforce one replica
  until a room-owner design exists; add explicit placement/routing before
  horizontal scale.
- Dependencies and blast radius: deployment, Socket.IO adapter, room lifecycle,
  reconnect, health/capacity, load tests, Gate 3 recovery/cost work.
- Validation: deployment rejects unsafe replicas; load proof establishes the
  single-node envelope; later multi-node tests keep a room on one authority
  through join, reconnect, active-game routing, and owner failure.

### CAN-010 — The replicated-store implementation combines too many responsibilities

- Category: boundary
- Complexity: accidental-complexity
- Severity: medium
- Release classification: before-scale
- Confidence: high
- Evidence: `packages/sdk/src/store/create-air-jam-store.ts` is 1,141 lines and
  contains the public authoring types, payload detection, acknowledgement
  normalization, host listener registry, Zustand creation, serialization,
  realtime selection, host/controller action dispatch, sync/replay,
  diagnostics, and React binding. Its main behavior test exceeds 1,300 lines.
- Current behavior: one good public primitive hides one equally large private
  unit; payload, transport, lifecycle, and replication changes touch it together.
- Architectural harm: local reasoning/targeted tests are difficult, and future
  transport work is likely to grow the central module.
- Canonical end state: retain one public `createAirJamStore` facade composed
  from private action normalization, authoritative runtime, replication codec,
  realtime adapter, listener registry, and React binding modules.
- Change: behavior-preserving internal extraction with no alternate public API;
  move cases to the narrowest boundary while keeping end-to-end tests.
- Dependencies and blast radius: SDK store/hooks/clients, every game store,
  agent host actions, state-sync protocol/tests.
- Validation: public type/API snapshot remains intentional; focused pure/service
  tests plus existing store, reconnect, Arcade, server sync, and game gates pass.

### CAN-011 — Server lifecycle authority is split across mega-handlers

- Category: boundary
- Complexity: accidental-complexity
- Severity: high
- Release classification: before-scale
- Confidence: high
- Evidence:
  `register-host-lifecycle-handlers.ts` is 1,716 lines, controller handlers are
  953, realtime handlers 889, and disconnect handling 271. They combine parse,
  authorization, rates, domain mutation, timers, Socket.IO effects, usage, and
  logs. Direct `RoomSession` assignments remain across handlers even though
  `room-session-domain.ts` also owns transitions. Host lifecycle alone registers
  eleven event groups spanning creation, reconnect, reset, controller removal,
  child launch/attach, embedded activation, and close.
- Current behavior: integration tests cover outcomes, but transition authority
  is shared between domain functions and event-handler closures.
- Architectural harm: focus, lifecycle, game, capability, timer, index,
  analytics, and snapshot facts can update in different combinations.
- Canonical end state: handlers parse/authorize, call one domain/application
  command, and emit declared effects. Pure transitions own related field
  changes; a small orchestration service owns timers/indexes/effects.
- Change: split by domain command, not merely file sections; eliminate direct
  lifecycle/focus/capability mutation outside transition authority while
  preserving one Socket.IO composition root.
- Dependencies and blast radius: gateway handlers, RoomManager/domain/types,
  usage/logging, integration/churn tests.
- Validation: architecture checks restrict transition mutations; pure tests
  cover transitions/effects; lifecycle, routing, reconnect, disconnect, sync,
  and churn suites pass.

### CAN-012 — Pre-1.0 runtime code preserves explicit legacy paths

- Category: debt
- Complexity: obsolete-complexity
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `AirJamConfig` retains deprecated `serverUrl`/`publicHost` aliases
  and host code still reads the latter; `SocketManager#getServerUrl` is another
  alias; `runtime-session-params.ts#resolveLegacyEmbeddedTopology` accepts URLs
  without the full topology contract and is covered by old-shape tests;
  `platform-settings.ts#readLegacyAudioSettings` migrates old storage;
  `controller-realtime-client.ts` normalizes legacy `null` action payloads; and
  Air Capture's abilities store retains explicit backward/UI-compat accessors.
- Current behavior: new contracts coexist with inference/alias branches, and
  some canonical code depends on the aliases it deprecates.
- Architectural harm: runtime resolution/action semantics remain less
  deterministic before 1.0 and contradict the zero-backcompat refactor rule.
- Canonical end state: first-party producers emit complete current topology,
  action, and settings contracts; consumers accept only those; games expose
  only their current model.
- Change: migrate consumers/producers/tests, then purge aliases, legacy topology
  inference, storage migration, null normalization, and unused game accessors.
- Dependencies and blast radius: SDK config/context/settings/bridges, platform
  URLs/settings, action RPC, Air Capture UI/tests, docs.
- Validation: search finds no affected legacy/deprecated branch; strict tests
  reject incomplete topology/invalid payloads; platform, settings, game, and
  scaffold gates pass.

### CAN-013 — Dormant agent-control and observability seams remain as source

- Category: simplicity
- Complexity: obsolete-complexity
- Severity: medium
- Release classification: blocks-1.0
- Confidence: high
- Evidence: SDK `runtime-control.ts` plus control contract/hook and
  `runtime-observability.ts` plus observability contract/hook have no product
  consumer outside their own tests. The README says they remain in source but
  unexported pending a future consumer. Current canonical paths are semantic
  sessions, explicit inspection, and unified NDJSON logs.
- Current behavior: speculative APIs are implemented/tested indefinitely even
  though package consumers cannot reach them.
- Architectural harm: private dead code creates refactor/test obligations and
  preserves the old assumption that each agent concern needs a bespoke layer.
- Canonical end state: no dormant implementation; introduce only the smallest
  adapter when a concrete future consumer proves a gap.
- Change: delete control/observability modules, hooks, tests, and placeholder
  docs/inventory claims.
- Dependencies and blast radius: SDK source/tests/docs only; no live consumer
  was found.
- Validation: search contains none of the dormant symbols/modules; SDK build,
  typecheck, tests, tarball exports, semantic session, inspection, and logs pass.

## Open Questions and Cross-Lane Dependencies

1. **Tooling — visual harness:** challenge `CAN-002` by identifying any current
   capability that cannot be semantic session setup plus browser
   inspection/capture. Isolate a unique capability rather than retaining a
   generic command bus.
2. **Tooling — shared project runtime:** deduplicate `CAN-006` with its
   create-airjam/CLI finding and choose the internal owner/bundling strategy;
   do not create a fifth public package.
3. **Tooling — semantic conformance:** align `CAN-007` with clean-room external
   proof so one suite covers source games, scaffolds, packed CLI, and MCP.
4. **Platform — raw runtimes:** confirm dynamic shell pages are the only valid
   direct consumers before `CAN-004` moves them to an explicit leaf.
5. **Platform — legacy carriers:** confirm all current embedded URLs/settings
   producers emit modern contracts before accepting `CAN-012` deletion.
6. **Reliability — scale:** merge `CAN-009` with Gate 3 capacity/provider work.
   The immediate safe invariant is one replica, not an unmeasured rewrite.
7. **Security — development routes:** assess `CAN-002` with all dev-only HTTP
   surfaces and prove production composition cannot expose them.
8. **Public contracts — server root:** ratify `CAN-008`'s CLI-only proposal or
   provide a concrete typed/documented embedding use case.
9. **Synthesis — scope:** keep `CAN-001`, `CAN-006`, and `CAN-012` as separate
   execution items only if their dependency graphs justify it.
10. **Trivial deletion:**
    `packages/server/apps/platform/drizzle/.keep` and
    `packages/server/packages/server/drizzle/.keep` are tracked empty-directory
    placeholders with no consumer or migration. Delete them during the nearest
    accepted server canonicalization change; they do not justify a standalone
    readiness item.
