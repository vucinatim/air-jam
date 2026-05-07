# Air Jam Capability Inventory

Last updated: 2026-05-03  
Status: current reference

## Purpose

This document inventories the capabilities Air Jam currently exposes as a framework,
platform, and agent-development system.

It is intentionally an inventory, not a plan.

Use it to understand:

1. what the system can do today
2. where each capability lives
3. which surface is canonical for that capability

Do not use this file to infer roadmap promise.
It describes what is currently present, not what is merely intended.

## Core Product Capability

Air Jam lets web games use phones as multiplayer controllers with no app
install.

The core loop is:

1. host opens a game on a computer, TV, projector, or embedded Arcade surface
2. players scan a QR code or open a join URL
3. phones become controllers
4. host reads typed controller input and owns gameplay authority
5. shared state, signals, analytics, and release tooling stay machine-readable

## Runtime And Multiplayer

Air Jam provides the real-time runtime needed for local and hosted multiplayer
games.

Current capabilities:

1. room creation with short room codes
2. QR-code and join-URL based controller entry
3. host and controller socket roles
4. controller join, leave, and reconnect handling
5. room-scoped controller identity and resume leases
6. host authority bootstrap
7. child host launch authorization for Arcade-embedded games
8. input routing from controllers to the active host
9. host-to-controller signals
10. runtime pause, resume, and explicit state controls
11. controller profile updates, including player labels and avatars
12. server-owned room membership and routing invariants

Key implementation areas:

1. `packages/server`
2. `packages/sdk/src/runtime`
3. `packages/sdk/src/protocol`
4. `packages/sdk/src/hooks/use-air-jam-host.ts`
5. `packages/sdk/src/hooks/use-air-jam-controller.ts`

## Three Runtime Lanes

Air Jam has three explicit lanes. Keeping them separate is one of the most
important framework capabilities.

### Input Lane

Use this for high-frequency transient control input.

Capabilities:

1. typed input schemas with Zod
2. controller-side input publishing
3. host-side per-player input reads
4. low-render host reads through `useGetInput`
5. fixed-cadence controller publishing through `useControllerTick`
6. input behavior modes: `pulse`, `latest`, and `hold`
7. tap-safe boolean handling for fast actions

Main APIs:

1. `createAirJamApp({ input: { schema } })`
2. `useInputWriter`
3. `useAirJamHost().getInput`
4. `useGetInput`
5. `useControllerTick`
6. `useHostTick`

### Replicated State Lane

Use this for replayable authoritative state.

Capabilities:

1. host-owned shared stores
2. controller-dispatched semantic actions
3. server-injected actor identity
4. state sync from host to controllers
5. host-side semantic action dispatch as a specific player through `asPlayer`
6. accepted and rejected action outcomes
7. automatic store-domain resolution for Arcade-embedded games
8. Zustand-compatible selectors for local rendering

Main APIs:

1. `createAirJamStore`
2. `useStore.useActions()`
3. `useStore.asPlayer(controllerId)`
4. `acceptAirJamAction`
5. `rejectAirJamAction`

### Signal And Command Lane

Use this for explicit coarse effects and runtime commands.

Capabilities:

1. haptic feedback signals
2. toast signals
3. broadcast or targeted signals
4. host lifecycle commands such as pause and resume
5. platform and Arcade commands such as menu, QR, close, and exit intents
6. explicit one-shot effects without making signals own gameplay truth

Main APIs:

1. `useSendSignal`
2. `useAirJamHost().sendSignal`
3. signal protocol types under `packages/sdk/src/protocol/signals`
4. Arcade platform action protocol types under `packages/sdk/src/protocol`

## Game Authoring SDK

Air Jam exposes a React and TypeScript SDK for building host and controller
surfaces.

Current capabilities:

1. canonical app setup through `createAirJamApp`
2. host runtime boundary through `airjam.Host` or `AirJamHostRuntime`
3. controller runtime boundary through `airjam.Controller` or `AirJamControllerRuntime`
4. route-aware controller path resolution
5. Vite and Next-style runtime environment helpers
6. scoped runtime providers
7. connection status hooks
8. room and player hooks
9. lifecycle action helpers
10. controller shell status helpers
11. join URL and QR helpers
12. platform settings inheritance
13. shared UI primitives for common host and controller shell composition
14. runtime error boundaries
15. diagnostics hooks

Main APIs:

1. `createAirJamApp`
2. `env`
3. `AirJamHostRuntime`
4. `AirJamControllerRuntime`
5. `useAirJamHost`
6. `useAirJamController`
7. `usePlayers`
8. `useRoom`
9. `useConnectionStatus`
10. `useControllerLifecycleIntents`
11. `useControllerLifecyclePermissions`
12. `useLifecycleActionGroupModel`
13. SDK components under `packages/sdk/src/components`

## Controller UI And Host Shell

Air Jam provides reusable pieces for consistent multiplayer surfaces without
forcing games into one visual style.

Current capabilities:

1. host lobby join context
2. room QR code rendering
3. join URL field
4. copy and open join URL actions
5. host mute controls
6. controller status header
7. lifecycle action clusters
8. player avatar and identity components
9. controller primary action component
10. surface viewport and orientation layout helpers
11. connection status pill

Main components:

1. `RuntimeShellHeader`
2. `ConnectionStatusPill`
3. `LifecycleActionGroup`
4. `JoinUrlField`
5. `JoinUrlActionButtons`
6. `JoinUrlControls`
7. `RoomQrCode`
8. `HostMuteButton`
9. `SurfaceViewport`
10. `SurfaceViewportLayout`
11. `SurfaceOrientationLayout`

## Audio, Music, Feedback, And Settings

Air Jam includes shared runtime support for game audio and platform-level
settings.

Current capabilities:

1. sound manifests
2. category-based sound playback
3. music playlists
4. audio runtime controls and status hooks
5. category and music volume hooks
6. platform audio settings
7. platform accessibility settings
8. platform feedback settings
9. inherited read-only settings for embedded games
10. controller haptics through signals

Main APIs:

1. `AudioRuntime`
2. `useAudio`
3. `useAudioRuntimeControls`
4. `useAudioRuntimeStatus`
5. `MusicPlaylist`
6. `useAudioCategoryVolume`
7. `useMusicVolume`
8. `PlatformSettingsRuntime`
9. `PlatformSettingsBoundary`
10. `useInheritedPlatformSettings`

## Arcade And Embedded Runtime

Air Jam supports both standalone games and Arcade-hosted games with one runtime
model.

Current capabilities:

1. standalone host and controller mode
2. platform Arcade mode
3. persistent platform controller wrapper
4. embedded host iframe launch
5. embedded controller iframe launch
6. surface-bound bridge identity using epoch, kind, and game ID
7. stale iframe and stale bridge rejection
8. browser-to-game and game-to-browser transitions
9. shell-owned platform overlay state
10. game-owned gameplay state
11. parent-authoritative platform settings
12. child launch capability propagation
13. local build URL support for Arcade testing

Key docs and implementation areas:

1. `docs/contracts/arcade-surface-contract.md`
2. `packages/sdk/src/arcade`
3. `packages/sdk/src/runtime/embedded-runtime-adapters.ts`
4. `apps/platform/src/components/arcade`
5. `apps/platform/src/app/controller`

## Platform And Dashboard

Air Jam includes a first-party hosted platform around the open framework.

Current capabilities:

1. public landing and documentation site
2. game catalog and Arcade browser
3. play pages for hosted releases
4. dashboard game management
5. game settings pages
6. media management
7. release management
8. release analytics pages
9. account and CLI auth surfaces
10. operator release pages
11. BetterAuth-based authentication
12. PostgreSQL and Drizzle persistence
13. tRPC APIs for dashboard surfaces
14. machine API routes for CLI release operations

Key implementation areas:

1. `apps/platform/src/app`
2. `apps/platform/src/server`
3. `apps/platform/src/db`
4. `apps/platform/src/components/arcade`
5. `apps/platform/src/components/releases`
6. `apps/platform/src/components/game-analytics`

## Hosted Release Pipeline

Air Jam can validate, bundle, submit, inspect, and publish hosted game releases.

Current capabilities:

1. local release doctor checks
2. local hosted release validation
3. hosted release zip bundling
4. `.airjam/release-manifest.json` generation
5. controller and host route contract validation
6. remote font vendoring for release bundles
7. platform machine authentication
8. release draft creation
9. upload target request
10. artifact upload finalization
11. release publishing
12. release inspection
13. artifact validation checks
14. screenshot capture checks
15. image moderation checks
16. release status tracking: draft, uploading, checking, ready, live, failed, quarantined, archived

Main tools:

1. `pnpm exec airjam release doctor`
2. `pnpm exec airjam release validate`
3. `pnpm exec airjam release bundle`
4. `airjam.release_doctor`
5. `airjam.release_validate`
6. `airjam.release_bundle`
7. `airjam.release_submit`
8. `airjam.release_publish`
9. `airjam.release_inspect`
10. `airjam.release_list`

## Local Development Workflows

Air Jam has repo-level and project-level workflows for local development.

Current repo capabilities:

1. standalone game dev stack
2. live Arcade dev stack
3. built Arcade test stack
4. secure local HTTPS setup
5. runtime topology inspection
6. managed local dev status
7. local reset
8. unified log reading
9. optional repo-owned local Postgres
10. repo quality gates

Main repo commands:

1. `pnpm standalone:dev --game=<id>`
2. `pnpm arcade:dev --game=<id>`
3. `pnpm arcade:test --game=<id>`
4. `pnpm topology --game=<id> --mode=<mode>`
5. `pnpm logs --view=signal`
6. `pnpm run status`
7. `pnpm run reset:local`
8. `pnpm run repo -- db up`
9. `pnpm run repo -- db url`
10. `pnpm run repo -- db reset`

Main MCP/devtools tools:

1. `airjam.start_dev`
2. `airjam.stop_dev`
3. `airjam.status`
4. `airjam.reset_local`
5. `airjam.topology`
6. `airjam.read_logs`
7. `airjam.run_quality_gate`

## Runtime Topology

Air Jam has a single explicit topology contract so every surface resolves the
same runtime facts.

Current capabilities:

1. standalone dev topology
2. Arcade live topology
3. Arcade built topology
4. secure local topology
5. app origin resolution
6. backend origin resolution
7. socket origin resolution
8. public host resolution
9. asset base path resolution
10. runtime mode resolution
11. surface role resolution
12. proxy strategy resolution
13. host URL and controller base URL inspection
14. local build URL and browser build URL support

Key implementation areas:

1. `packages/runtime-topology`
2. `packages/devtools-core/src/dev.ts`
3. `packages/sdk/src/runtime/runtime-session-params.ts`

## Unified Debugging And Logs

Air Jam has a canonical local debugging stream.

Current capabilities:

1. unified server, browser, runtime, platform, and workspace process logs
2. NDJSON log stream under `.airjam/logs/dev-latest.ndjson`
3. signal-oriented log view
4. filters by trace, room, controller, runtime, process, source, event, level,
   epoch, and console category
5. windowed event summaries
6. browser log sink integration
7. server log sink integration
8. MCP-readable log access

Main entrypoints:

1. `pnpm logs --view=signal`
2. `pnpm exec air-jam-server logs --view=signal`
3. `airjam.read_logs`

## Agent And MCP Capabilities

Air Jam exposes machine-usable development tools for agents.

Current capabilities:

1. project inspection
2. game discovery
3. game inspection
4. game agent contract inspection
5. semantic game session opening
6. semantic controller input sending
7. game session snapshot reading
8. semantic game and host action invocation
9. game session closing
10. quality gate execution
11. release operations
12. dev stack management
13. topology inspection
14. log reading

Main MCP tools:

1. `airjam.inspect_project`
2. `airjam.list_games`
3. `airjam.inspect_game`
4. `airjam.inspect_game_agent_contract`
5. `airjam.open_game_session`
6. `airjam.send_game_session_input`
7. `airjam.read_game_session`
8. `airjam.invoke_game_session_action`
9. `airjam.close_game_session`
10. `airjam.run_quality_gate`

## Agent Contracts

Games can publish semantic contracts for agent-readable state and actions.

Current capabilities:

1. typed agent contract declarations
2. named agent stores
3. participant-targeted actions
4. host-targeted actions
5. payload metadata
6. allowed value metadata
7. action availability descriptions
8. result descriptions
9. runtime snapshot context
10. semantic action outcome classification

Main APIs:

1. `defineAirJamAgentContract`
2. `defineAirJamAgentStores`
3. `agentStore`
4. `agentAction`
5. `agentActionInput`

## Runtime Inspection Contracts

Air Jam can publish and read runtime inspection contracts for tooling.

Current capabilities:

1. host runtime inspection contract publishing
2. controller runtime inspection contract publishing
3. runtime contract reads from tooling
4. current room and player state inspection
5. action metadata exposure
6. integration with isolated runtime owners and game sessions

Main APIs:

1. `createHostRuntimeInspectionContract`
2. `createControllerRuntimeInspectionContract`
3. `publishRuntimeInspectionContract`
4. `readRuntimeInspectionContract`
5. `useHostRuntimeInspectionContract`
6. `useControllerRuntimeInspectionContract`

## Visual Harness And Preview Tooling

Air Jam includes an experimental visual harness for deterministic visual
capture and agent-facing UI interaction.

Current capabilities:

1. visual scenario packs
2. scenario listing
3. host and controller harness sessions
4. harness action descriptors
5. harness action invocation
6. published visual snapshots
7. visual capture artifact writing
8. capture summary listing and reading
9. prefab visual contracts
10. preview controller workspaces
11. host preview controller windows

Main APIs and tools:

1. `@air-jam/harness`
2. `@air-jam/harness/visual`
3. `airjam.list_visual_scenarios`
4. `airjam.capture_visuals`
5. `airjam.list_visual_capture_summaries`
6. `airjam.read_visual_capture_summary`
7. `HostPreviewControllerWorkspace`
8. `PreviewControllerWorkspace`
9. `PreviewControllerWindow`

## Game Metadata And Catalog Contracts

Air Jam has a typed metadata contract for catalog and platform presentation.

Current capabilities:

1. stable game slug
2. display name
3. tagline
4. category
5. min and max player counts
6. input modality declarations
7. supported SDK range
8. maintainer metadata
9. age rating
10. tags
11. schema validation and parsing helpers

Main APIs:

1. `defineAirJamGameMetadata`
2. `parseAirJamGameMetadata`
3. `airJamGameMetadataSchema`

## Scaffolding And Templates

Air Jam includes project generation and template packaging through
`create-airjam`.

Current capabilities:

1. standalone game scaffolding
2. template source generation
3. template registry smoke testing
4. tarball smoke testing
5. generated AI docs pack
6. generated scaffold source checks
7. template version manifest generation
8. published CLI aliases: `create-airjam` and `airjam`

Key implementation areas:

1. `packages/create-airjam`
2. `packages/create-airjam/scaffold-templates`
3. `packages/create-airjam/runtime`
4. `apps/platform/public/ai-pack`

## AI Pack And Documentation Delivery

Air Jam ships local and hosted docs intended for both humans and agents.

Current capabilities:

1. generated public docs
2. generated AI pack
3. docs manifest endpoint
4. docs search index endpoint
5. `llms.txt`
6. agent-focused documentation entrypoint
7. framework paradigm docs
8. development loop docs
9. controller UI docs
10. state and rendering docs
11. debug and log docs
12. prefab authoring docs
13. Air Jam-specific skills for generated projects

Key implementation areas:

1. `apps/platform/public/ai-pack`
2. `apps/platform/src/features/docs`
3. `apps/platform/src/app/docs`
4. `docs/framework-paradigm.md`
5. `docs/current-state.md`
6. `docs/working-agreements.md`

## Analytics

Air Jam has an implemented hosted analytics foundation based on authoritative
runtime events.

Current capabilities:

1. server-side runtime usage publisher
2. stable runtime analytics identity
3. append-only raw runtime usage ledger
4. deterministic projection into normalized segments
5. controller, game, and eligibility segments
6. game-session metrics
7. daily aggregate metrics
8. platform analytics API
9. dashboard analytics panels
10. operator rebuild path for ledger replay
11. trust guards and analytics debug visibility

Key implementation areas:

1. `packages/server/src/analytics`
2. `apps/platform/src/server/analytics`
3. `apps/platform/src/components/game-analytics`
4. `docs/architecture/analytics-architecture.md`

## Platform Security And Auth

Air Jam has separate auth concepts for browser users, machine CLI sessions, and
runtime host authority.

Current capabilities:

1. BetterAuth user auth
2. dashboard access checks
3. machine device flow for CLI auth
4. stored platform machine sessions
5. platform machine APIs for games, media, and releases
6. host bootstrap verification
7. optional signed host grants
8. allowed-origin checks for static apps
9. socket authorization policies
10. rate-limit policies and services

Key implementation areas:

1. `apps/platform/src/server/auth`
2. `apps/platform/src/app/api/cli/auth`
3. `packages/server/src/services/auth-service.ts`
4. `packages/server/src/policies/socket-authorization.ts`
5. `packages/server/src/services/rate-limit-service.ts`

## Media And Game Presentation

Air Jam supports hosted game presentation assets and media management.

Current capabilities:

1. game media uploads through platform machine APIs
2. media assignment
3. media finalization
4. media archive routes
5. public media URLs
6. local reference game presentation mapping
7. Arcade game browser presentation
8. release screenshots
9. cover, thumbnail, and preview media conventions in games

Key implementation areas:

1. `apps/platform/src/server/media`
2. `apps/platform/src/app/api/cli/games/[slugOrId]/media`
3. `apps/platform/src/lib/games/game-media-contract.ts`
4. `apps/platform/src/components/arcade/game-browser.tsx`

## Reference Games

The repo includes first-party games that demonstrate framework capabilities.

Current examples:

1. `games/pong` demonstrates the canonical starter-scale 2D game structure
2. `games/air-capture` demonstrates advanced 3D gameplay, physics, teams,
   prefabs, bots, debug overlays, and visual tooling
3. `games/last-band-standing` demonstrates music/video-driven party gameplay
4. additional repo-owned and showcase games exercise migration and release paths

These games are not just demos. They are regression surfaces for framework
architecture, SDK ergonomics, shell contracts, release readiness, and agent
tooling.

## Quality Gates

Air Jam has repo and project-level quality gates.

Current capabilities:

1. type checking
2. linting
3. tests
4. builds
5. format checks
6. scaffold smoke tests
7. release checks
8. browser smoke tests
9. server integration tests
10. platform tests
11. SDK tests

Main commands:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. `pnpm format:check`
6. `pnpm test:scaffold`
7. `pnpm check:release`
8. `pnpm smoke:browser`

## Current Gaps Worth Tracking Separately

This inventory also exposes a few high-impact cleanup opportunities.

1. The capability surface is broad enough that public docs, AI-pack docs, and
   repo docs need a single generated capability map eventually.
2. Visual harness tooling is powerful but still marked internal experimental in
   MCP descriptions; it should either graduate into a stable contract or stay
   explicitly internal.
3. Hosted release, media, and analytics capabilities are spread across platform,
   devtools, SDK contracts, and strategy docs; a generated API matrix would make
   these easier to keep aligned.
4. Agent contracts, runtime inspection contracts, and visual harness contracts
   are adjacent but distinct; future docs should keep their boundaries crisp so
   agents know which control surface to use for each job.
