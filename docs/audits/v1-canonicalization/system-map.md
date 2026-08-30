# Air Jam 1.0 System Map

Last updated: 2026-08-28
Status: audited current-state map
Readiness owner: `G1-01`

This map describes the implemented repository. The target column records the
canonical direction accepted by the audit; it does not claim those changes are
already implemented.

## Composition Roots

| Surface                 | Current entrypoint                                                       | Current authority                                                                                  | Canonical direction                                                                             |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Game creation           | `create-airjam` in `packages/create-airjam/src/index.ts`                 | One package currently mixes one-shot scaffolding and ongoing project operations                    | Keep `create-airjam` as bootstrap only; install one project CLI for the retained lifecycle      |
| Creator runtime         | `createAirJamApp` in `packages/sdk/src/runtime/create-air-jam-app.tsx`   | Game config composes host/controller runtimes and semantic contract                                | Keep this as the only stable creator composition model                                          |
| Host/controller session | `packages/sdk/src/runtime/session-runtimes.tsx`                          | SDK owns providers, settings, runtime clients, and inspection publication                          | Keep low-level dynamic runtimes on a platform-owned internal leaf                               |
| Realtime server         | `air-jam-server` -> `packages/server/src/cli.ts` -> `createAirJamServer` | Server owns room membership, routing, focus, reconnect, auth, and rate limiting                    | Keep the binary/runtime boundary; remove accidental library and dev-command-bus surfaces        |
| Public platform         | Next App Router under `apps/platform/src/app`                            | Platform owns identity, catalog, dashboard, release records, media, auth, and product telemetry    | Move UI and machine adapters onto actor-aware application services                              |
| Release processing      | CLI/MCP -> devtools -> platform machine routes -> R2/DB/browser worker   | One HTTP finalize request currently coordinates artifact, browser, screenshot, and moderation work | Platform owns durable idempotent jobs; adapters submit and inspect them                         |
| Hosted asset delivery   | Next release/media route -> DB -> R2 -> response rewrite                 | Platform request path is the effective release CDN                                                 | Immutable releases use an isolated static origin/CDN; mutable media gets a bounded cached alias |
| Browser validation      | `air-jam-release-browser-worker`                                         | Worker owns Playwright execution, but auth may fail open                                           | Require explicit private/token authority and readiness that proves Chromium                     |
| External agent control  | `airjam-mcp` -> MCP tools -> `@air-jam/devtools-core`                    | Semantic sessions are canonical; terminal coverage and client installation are incomplete          | Thin CLI/MCP adapters share typed services; client profiles only adapt installation             |
| Repository operations   | `scripts/repo/cli.mjs`                                                   | Repo CLI owns maintainer operations and readiness state                                            | Extend this surface for private production operations with preview/apply and structured results |

## Package Responsibility Map

| Package or area                   | Intended responsibility                                                | Audited status                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@air-jam/sdk`                    | Public creator/runtime/protocol contract                               | Core lanes are coherent; stable root and experimental leaves need an intentional 1.0 cut                         |
| `@air-jam/server`                 | Public realtime server binary and supported project integration        | Runtime authority is sound; accidental root export, copied project CLI, and production dev routes are not        |
| `create-airjam`                   | Public one-shot scaffold bootstrap                                     | Currently also owns an ongoing CLI that generated projects do not install                                        |
| `@air-jam/mcp-server`             | Public MCP adapter over agent-operable domain services                 | Semantic session shape is good; packaging, client profiles, and unreachable tool residue need closure            |
| `@air-jam/devtools-core`          | Private shared project, session, release, quality, and visual services | Correct shared-service direction; adapters and runtime imports still expose ownership inversions                 |
| `@air-jam/harness`                | Private browser/visual evaluation utilities                            | Useful visual proof remains; the old parallel command/snapshot bus is obsolete                                   |
| `@air-jam/runtime-topology`       | Former private topology model                                          | Duplicate authority; delete in favor of `@air-jam/sdk/runtime-topology`                                          |
| `@air-jam/env`                    | Internal typed environment validation                                  | Genuine shared authority; copied project-CLI versions should converge on it                                      |
| `apps/platform`                   | Hosted product and control plane                                       | Correct product owner; application services, security isolation, durable work, and operator paths need hardening |
| `@air-jam/release-browser-worker` | Isolated browser validation executor                                   | Correct process boundary; access and health contracts are incomplete                                             |
| `games/*`                         | First-party examples and scaffold source authority                     | All six expose semantic contracts; real conformance coverage is missing                                          |
| `packages/bot-lab`                | Local experimental bot work                                            | Ignored locally but still present in workspace/lock/Docker assumptions; not a reproducible repo package          |
| `apps/studio`                     | Retired hosted-Studio placeholder                                      | Empty and unreferenced; remove rather than preserve a retired product path                                       |

## Authority Boundaries

| Fact or lifecycle                 | Canonical owner                                                               | Current drift to remove                                                                |
| --------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Runtime topology                  | `@air-jam/sdk/runtime-topology`                                               | Private duplicate package and copied project-runtime helpers                           |
| Gameplay truth                    | Game host through `createAirJamStore`                                         | No competing agent/evaluation state schema                                             |
| Semantic actions and projections  | Game-owned `agentContract`                                                    | Speculative capabilities manifest and legacy visual-harness action map                 |
| Room membership/routing/reconnect | Realtime server                                                               | Direct mutation spread across large gateway handlers; unsafe multi-replica ambiguity   |
| Catalog/release/media truth       | Platform application services and PostgreSQL invariants                       | Generic status setters, adapter-owned workflows, and unenforced active/live invariants |
| Long-running release work         | Durable platform job                                                          | Synchronous HTTP request and in-memory MCP task must not own the job                   |
| Product telemetry                 | Platform telemetry ledger/projection                                          | Keep separate from authoritative runtime usage and release lifecycle data              |
| Runtime usage schema              | One internal shared DB contract; platform retains migrations                  | Hand-maintained platform/server table copies                                           |
| Privileged operations             | Repo CLI over private operator services                                       | UI-only abuse lifecycle and manual production migration commands                       |
| Agent installation                | Portable stdio declaration plus thin client profiles                          | `.mcp.json` currently stands in for unproven Codex/Claude installation                 |
| Project guidance                  | Short project router plus managed versioned references and specialized skills | Repeated policy and updater ownership over user customization surfaces                 |

## Canonical Lifecycle Paths

### Create and develop

Current:

```text
npx create-airjam -> generated project -> air-jam-server dev
                    \-> docs invoke absent `airjam` commands
```

Target:

```text
create-airjam bootstrap -> installed Air Jam project CLI -> shared domain services
                                                   \-> server runtime adapter
                                                   \-> MCP adapter
```

### Control and evaluate

```text
game-owned agentContract
  -> semantic game session
  -> shared devtools service
  -> CLI or MCP adapter
  -> inspect/invoke/read/close evidence
  + browser surface for visual proof
```

The old generic visual-harness HTTP command bus is not part of the target.

### Publish

Current:

```text
CLI/MCP -> platform HTTP finalize request
        -> ZIP extraction -> many R2 writes -> browser capture
        -> screenshot round-trip -> moderation -> DB state
```

Target:

```text
CLI/MCP/UI -> actor-aware platform service -> durable idempotent job
                                      -> bounded worker stages
                                      -> inspect/cancel/retry/result
                                      -> atomic live-release transition
```

### Play

```text
isolated immutable release origin -> embedded creator game
authenticated platform origin     -> shell, identity, dashboard, controller
realtime server                    -> room/routing authority
```

Creator-controlled JavaScript does not share the authenticated platform origin.

### Operate

```text
repo CLI inspect/plan -> explicit approval when required -> apply
                      -> structured evidence -> verify/rollback/repair
```

Private operator capabilities do not need to expand the public game-authoring
MCP surface merely to satisfy agent-first operation.

## Cross-Lane Risks

1. Public API cleanup, project CLI ownership, and generated guidance must land
   as one coordinated change or the clean scaffold remains internally
   contradictory.
2. Origin isolation, browser-worker protection, and removal of the server dev
   command bus are separate fixes under one security proof.
3. Static release delivery, durable finalization, quotas, retention, and rate
   admission are related but distinct scalability owners.
4. A second realtime replica is unsafe until room authority has a directory or
   routing design; 1.0 should enforce and prove the single-replica envelope
   rather than prematurely build distributed rooms.
5. Shared services are the convergence point. A new universal command bus,
   mega-schema, or generic orchestration framework would repeat the complexity
   this audit is removing.

## Cross-Cutting Finding

### CAN-300 — Workspace topology contains local and retired product remnants

- Category: composition
- Complexity: contract-drift
- Severity: medium
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `pnpm-workspace.yaml` includes every `packages/*` directory;
  `packages/bot-lab/package.json` is excluded only by the current checkout's
  `.git/info/exclude`, but `pnpm-lock.yaml` retains its importer and local
  `pnpm -r list --depth -1` includes `@air-jam/bot-lab`; both production
  Dockerfiles contain committed explanations for why that local package is
  absent from Railway. Separately, `apps/studio/.gitkeep` is tracked, empty,
  unreferenced, and conflicts with the ratified retirement of Studio as the 1.0
  product model.
- Current behavior: recursive local quality gates can include an untracked
  experimental package that clean checkouts and CI cannot see, while deploy
  files and lock state encode knowledge of that local-only exception. An empty
  retired app remains in the canonical workspace tree.
- Architectural harm: repository topology is not reproducible from Git and the
  product tree preserves a misleading retired destination. Agents cannot infer
  the real package graph from tracked state alone.
- Canonical end state: tracked Git state completely defines the 1.0 workspace.
  Local experiments are explicitly outside the workspace unless promoted as
  tracked packages, and retired Studio paths are deleted.
- Change: explicitly exclude the local bot lab from the canonical workspace
  without deleting the user's local files, prune its lockfile importer and
  Docker exceptions, and delete the empty `apps/studio` placeholder.
- Dependencies and blast radius: workspace manifest, lockfile, recursive
  quality gates, platform/server Dockerfiles, local experimental workflow, and
  monorepo documentation.
- Validation: a dirty local checkout and a clean Git checkout enumerate the
  same tracked Air Jam workspaces; frozen install and recursive gates pass;
  searches contain no Docker exception or live Studio app path.
