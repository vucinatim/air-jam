# Air Jam Work Ledger

Last updated: 2026-04-08  
Status: active

This is the single active repo-wide ledger.

Use it to answer:

1. what matters now
2. what is already done
3. which active plans still matter
4. which tracks should be archived or collapsed

## Current Execution Order

Air Jam should now move through prerelease work in one canonical plan:

1. finish the final launch-readiness pass for the three legacy showcase games
2. finish the five-game launch-set proof locally through Arcade
3. resolve the release-critical issues surfaced by real multiplayer playtests
4. prove the hosted release and managed media dashboard flows end to end
5. produce release media, connect official hosting, validate on official servers, and publish

Canonical prerelease plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Anything outside that order should only move in parallel when it does not slow the critical path.

User-directed active parallel track:

1. drive `code-review`, `last-band-standing`, and `the-office` through the release baseline in [Showcase Games Release Readiness Plan](./plans/showcase-games-release-readiness-plan.md)
2. assess and harden the public-release security posture in [Public Release Security Hardening Plan](./plans/public-release-security-hardening-plan.md)
3. define and execute the prerelease SDK clean-swap extraction track in [SDK Extraction Clean-Swap Plan](./plans/sdk-extraction-clean-swap-plan.md)
4. define and execute the shared preview-controller track in [Controller Preview Dock Plan](./plans/controller-preview-dock-plan.md)

Latest status (2026-04-08):

1. Phase 3 feature-completion goals are implemented for all three showcase games:
   1. `code-review` deterministic bot seats + ready-gated host start
   2. `the-office` character picker with image + capability stats and ready gating
   3. `last-band-standing` song/embed validation workflow and host-owned start flow
2. Runtime hygiene hardening landed in this pass:
   1. `code-review` controller fullscreen forcing removed
   2. `last-band-standing` `/youtube-test` is debug-gated and excluded from default production bundles
3. `last-band-standing` media curation baseline is now clean after pruning non-embeddable songs (`77/77` embeddable, no duplicate IDs)
4. the per-game readiness checklist artifact now exists for final sign-off execution:
   1. [Showcase Games Release Readiness Checklist](./plans/showcase-games-release-readiness-checklist.md)
5. `create-airjam` scaffold snapshots were regenerated to keep template behavior aligned with game sources
6. Remaining before sign-off on this parallel track:
   1. per-game manual Arcade runbook and responsive UX verification on target device sizes
   2. final launch-set readiness records (`ready` / `not-ready`) for all five launch games
7. local Arcade integration boot smoke now passes for all five launch-set games:
   1. `pnpm arcade:test --game=pong`
   2. `pnpm arcade:test --game=air-capture`
   3. `pnpm arcade:test --game=code-review`
   4. `pnpm arcade:test --game=last-band-standing`
   5. `pnpm arcade:test --game=the-office`
8. baseline pair validation was refreshed in this pass:
   1. `pnpm --filter pong typecheck && test && build`
   2. `pnpm --filter air-capture typecheck && test && build`
9. browser smoke is green again after capability-aware controller join wiring:
   1. `scripts/repo/smoke/browser-smoke-stack.mjs` now starts `air-capture` via direct `vite` invocation (no invalid `airjam dev --host/--port` call path)
   2. browser smoke specs now read the host runtime `aj_join_url` and join controllers with official capability tokens, matching server controller RPC policy
   3. `pnpm smoke:browser` passed (`4/4`) on 2026-04-07
10. showcase-trio validation is green in this pass:
    1. `pnpm --filter code-review typecheck && test && build`
    2. `pnpm --filter last-band-standing typecheck && test && build`
    3. `pnpm --filter the-office typecheck && test && build`
11. public-release security hardening closed the current Priority 1 release-blocker set:
    1. platform framing policy no longer allows arbitrary embedding
    2. hosted release moderation now fails closed instead of promoting skipped checks to `ready`
    3. server proxy-header trust is now explicit instead of blindly trusting raw `x-forwarded-for`
    4. non-production server runtime now blocks non-local `DATABASE_URL` values unless `AIR_JAM_ALLOW_REMOTE_DATABASE=enabled`
    5. hosted release inspection now uses short-lived release-scoped signed access instead of one reusable global bearer token
    6. server runtime/tests now load only repo-root and server-owned env files, including explicit startup entrypoints
12. the prerelease SDK extraction clean-swap track is now explicitly scoped in:
    1. [SDK Extraction Clean-Swap Plan](./plans/sdk-extraction-clean-swap-plan.md)
13. current intent for that track:
    1. extract only framework-owned runtime and small optional join/connection UI
    2. migrate all repo games and scaffold sources as part of the refactor
    3. leave no deprecated or compatibility-only path behind
14. the preview-controller prerelease track is now explicitly scoped in:
    1. [Controller Preview Dock Plan](./plans/controller-preview-dock-plan.md)
15. current intent for that track:
    1. make desktop/on-screen preview controllers a shared optional feature
    2. keep preview controllers on the same room/session model as phone controllers
    3. avoid any separate preview topology or fake controller simulation path
16. architecture direction is now narrowed further for that track:
    1. preview windows should launch the canonical `host.joinUrl` as real controller clients
    2. the shared reusable layer should live as an optional SDK leaf module, not platform-only glue and not SDK core sprawl
    3. the main prerequisite refactors are a canonical preview URL helper, a split of the platform controller page into cleaner layers, and narrow preview identity isolation
17. default enablement direction is now explicit for that track:
    1. enabled by default in normal local dev for repo games and scaffolded games
    2. production remains opt-in at the host/product layer
    3. scaffold first-run should expose a one-click `Add controller` path without requiring extra setup
18. the preview-controller plan now includes an implementation checklist:
    1. shared preview URL helper
    2. preview identity isolation
    3. shared dock and preview window layer
    4. platform controller-page split
    5. platform plus scaffold integration and validation

## Release-Critical Path

### Priority 1. Release Workflow And CI Hardening

Status: completed baseline  
Reference: [Release Prep Plan (Archived)](./archive/release-prep-plan-2026-03-31.md)

Completed:

1. package publish targeting is explicit
2. CI now enforces the canonical release contract
3. release-visible platform browser console noise was removed from arcade/controller-facing runtime paths

### Priority 2. Browser-Level Product Proof

Status: completed baseline  
Reference: [Release Prep Plan (Archived)](./archive/release-prep-plan-2026-03-31.md)

Completed:

1. one true browser-level host/controller/join/launch smoke path now runs inside `pnpm check:release`
2. the smoke path uses a deterministic local Arcade reference game instead of database-seeded public content

### Priority 3. Migration Proof

Status: completed baseline  
Reference: [V1 Closeout Plan (Archived)](./archive/v1-closeout-plan-2026-03-31.md)

Completed:

1. the concrete migration guide now exists in [Legacy Game Migration Guide](./systems/legacy-game-migration-guide.md)
2. the three legacy ZeroDays games are already on the current bootstrap and route model
3. repo-owned local tarball validation now proves `code-review`, `last-band-standing`, and `the-office` against packaged SDK/server dependencies via `pnpm run repo -- legacy validate-tarball --root /absolute/path/to/air-jam-games` or `AIRJAM_LEGACY_GAMES_ROOT`

### Priority 4. Canonical Prerelease Execution

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Remaining:

1. complete per-game manual Arcade runbook and responsive UX verification on target device sizes
2. finalize launch-set readiness records (`ready` / `not-ready`) for all five launch games
3. run the final hosted release and managed media dashboard proof paths
4. create release media assets
5. connect and deploy all public games on official hosting
6. validate all five games against the official servers
7. merge the release PR, deploy the platform, and publish the launch content
8. enforce explicit ended/game-over phase plus basic host score/result summary contract across all five launch-set games and re-validate checklist row `C13`

Active subsystem plan linked from this phase:

1. [Showcase Games Release Readiness Plan](./plans/showcase-games-release-readiness-plan.md)
2. [Public Release Security Hardening Plan](./plans/public-release-security-hardening-plan.md)
3. [Composition Shell Contract Plan](./plans/composition-shell-contract-plan.md)
4. [Visual Review Harness Plan](./plans/visual-review-harness-plan.md)

Completed baselines now folded into this phase:

1. GitHub-first dashboard auth is already live, with email/password intentionally retained as fallback for the initial release
2. `air-capture` now has a modern host/controller/domain/store/engine/prefab/ui/debug/audio structure
3. SDK runtime ownership is now explicit for host, controller, and audio
4. shared platform settings now propagate cleanly from Arcade/controller surfaces into embedded games
5. public Arcade hosted releases, managed media, and dashboard IA are already implemented at the product-foundation level
6. the strict hosted-artifact route contract and developer-facing release bundle command now exist as real prerelease baselines
7. source docs, generated scaffold docs, template README, and template-local skills are now aligned with the current SDK/runtime/release model
8. `air-capture` has now passed its final prerelease reference-quality audit; the remaining runtime seam narrowing is post-release cleanup, not launch-critical work
9. the three legacy ZeroDays games now have an explicit prerelease posture: migration-proof showcase games only, with `pong` and `air-capture` remaining the only canonical first-party reference implementations
10. the baseline pair now has real local Arcade proof coverage:
    1. `pong` host/controller happy path passes through the local Arcade browser smoke
    2. `air-capture` settings/audio Arcade smoke passes through the local Arcade browser smoke
11. reconnect/resume is now release-proven across the launch-set validation surface:
    1. stable controller device identity
    2. room-scoped resumable controller lease
    3. same-device automatic resume
    4. conflicting-device rejection
    5. `pong`, `air-capture`, and `last-band-standing` have now proven the behavior through real local Arcade product flow
12. controller fullscreen prompting is now explicit and productized at the controller shell boundary, with dedicated browser smoke coverage
13. controller privileged channels now have an explicit room-scoped capability baseline:
    1. official host/controller links carry the capability automatically
    2. `controller:system`, `controller:play_sound`, and `controller:action_rpc` now require it after join
    3. room-code-only joins remain connected for non-privileged flows, while privileged controller RPC channels are intentionally blocked
14. server perf sanity is now a real release-confidence gate:
    1. the canonical perf harness now runs both the input baseline and reconnect churn
    2. committed strict thresholds now back the release path instead of ad hoc warning-only output
    3. `pnpm check:release` now includes `pnpm run repo -- perf sanity --strict`
15. `air-capture`'s first gameplay hardening pass is now in:
    1. analog left-stick movement with right-side actions only
    2. own-flag-carried enemy pickup lockout
    3. stronger large-radius rocket blast tuning
    4. lobby name visibility on host and controller
    5. 3-second rotation-only opening countdown
16. Arcade waiting-state now has a first-pass platform-owned `ping` interaction:
    1. controller waiting shell exposes a `Ping host` action
    2. Arcade host plays a dedicated `piing` SFX with a small visual acknowledgment
    3. the action is host-cooled-down so one controller cannot spam the shell
17. release moderation and enforcement are now split cleanly by audience:
    1. upload finalization now runs automated screenshot + image moderation before a release settles into `ready`
    2. creator release pages keep upload/publish/archive plus release history, but no longer expose moderation or quarantine controls
    3. internal moderation and quarantine actions now live behind a database-backed `ops_admin` role on `/dashboard/ops/releases`
18. the monorepo root now reflects the real product boundary more honestly:
    1. platform-owned product surfaces remain under `apps/`
    2. repo-owned first-party games live under `games/`
19. repo runtime commands now reflect the real three-mode local contract:
    1. `pnpm standalone:dev --game=<id>` runs live standalone workspace dev
    2. `pnpm arcade:dev --game=<id>` runs live Arcade workspace dev
    3. `pnpm arcade:test --game=<id>` builds the selected game once and serves it through the platform under `/airjam-local-builds/<game>/`
    4. secure Arcade validation means `pnpm secure:init` plus `pnpm arcade:test --game=<id> --secure`
20. runtime endpoint handling now has one explicit shared contract instead of scattered origin guessing:
    1. `@air-jam/runtime-topology` is now the shared source of truth for run-mode endpoint modeling
    2. workspace commands emit explicit shell topologies for platform host/controller surfaces
    3. embedded Arcade game iframes now receive explicit child-runtime topology in their URL contract
    4. scaffold/runtime project mode resolution now produces explicit topology internally instead of relying on SDK-side legacy endpoint fallback
    5. platform shell topology is now produced at boot and consumed as required env
    6. the SDK now separates `backendOrigin` from `socketOrigin` internally instead of treating `serverUrl` as one ambiguous field
    7. `pnpm topology --game=<id> --mode=<mode> [--secure]` now prints the resolved topology for trust/debugging
21. Postgres safety and local-dev DB posture are now explicit prerelease baselines:
    1. the repo owns an optional persistent local dev Postgres via `pnpm run repo -- db up`, with data under `.airjam/postgres/dev/`
22. the visual review harness now has a real first proven slice:
    1. `pnpm run repo -- visual capture --game=code-review --scenario=lobby` captures stable host/controller artifacts in built Arcade mode
    2. shared harness helpers now cover standard viewport capture plus basic host/controller text waits
    3. failed scenarios now leave best-effort host/controller failure screenshots and metadata instead of only a timeout stack
    4. `code-review` `playing` capture is now also proven, with screenshots under `.airjam/artifacts/visual/code-review/playing/`
    2. prerelease can still intentionally point `DATABASE_URL` at production for release-state validation
22. the standard lifecycle contract reset is now complete:
    1. `runtimeState` now owns transport pause/play semantics across shared runtime boundaries
    2. `matchPhase` now owns the standard `lobby | countdown | playing | ended` lifecycle contract
    3. all five first-party launch games plus scaffold sources now conform to the standard shell-facing lifecycle model
    4. the visual harness plan can now safely assume standard lifecycle presets by default
23. composition-shell-contract implementation is now underway:
    1. shared SDK UI atoms now exist for join URL controls, lifecycle actions, runtime shell headers, and connection status
    2. shared shell hooks now exist for host lobby state, controller status, lifecycle permissions, lifecycle intents, and lifecycle action modeling
    3. `pong`, `air-capture`, `code-review`, `the-office`, and `last-band-standing` now use the shared host/controller shell contract instead of keeping mixed legacy shell paths
    4. template docs and skills now teach both the composition-first path and the full-custom escape hatch
    5. launch-set typechecks for the shared SDK and all five touched game packages are currently passing
    6. remaining work on this track is now manual Arcade verification plus readiness-checklist evidence, not more code-side shell implementation
24. visual-review-harness planning is now active:
    1. the repo now has a dedicated phase-1 plan for deterministic host/controller screenshot capture
    2. the intended contract is game-owned scenarios plus stable artifact output under `.airjam/artifacts/visual/`
    3. the first implementation target is a `code-review` vertical slice that agents can run repeatedly for UI diagnosis and validation
    4. the visual harness is now unblocked by the lifecycle contract reset and can safely assume standard lifecycle presets by default
25. the first visual-review-harness implementation slice is now real:
    1. `pnpm run repo -- visual capture --game=code-review --scenario=lobby` succeeds in built Arcade mode and writes stable host/controller screenshots plus metadata
    2. `pnpm run repo -- visual capture --game=code-review --scenario=playing` now also succeeds in built Arcade mode
    3. the harness now owns shared viewport/capture helpers plus best-effort failure screenshots for broken scenarios
    4. this already surfaced and helped fix one real product bug: `code-review` controller-side `Play` was wired in the UI but rejected by the store until `startMatch`/`resetToLobby` were made controller-legal
26. the visual-review-harness reset is now materially beyond the initial vertical slice:
    1. the reusable core now lives in internal workspace package `@air-jam/visual-harness`
    2. standalone visual capture now uses dedicated stack boot with isolated per-run ports instead of the human-first local dev path
    3. launch-set host bridges now publish room id, canonical join URL, `matchPhase`, and `runtimeState` for harness consumption
    4. shared harness helpers now include bridge-driven lifecycle waiting, so scenario packs can key off `matchPhase` instead of brittle host copy when staging active states
    5. the harness now also supports optional dev-only host bridge actions for deterministic state setup when a terminal-state scenario would otherwise require long or flaky gameplay simulation
    6. current proven standalone captures are:
       1. `pong` `lobby`
       2. `pong` `playing`
       3. `pong` `ended`
       4. `air-capture` `lobby`
       5. `air-capture` `playing`
       6. `air-capture` `ended`
       7. `code-review` `lobby`
       8. `code-review` `playing`
       9. `code-review` `ended`
       10. `the-office` `lobby`
       11. `the-office` `playing`
       12. `the-office` `ended`
       13. `last-band-standing` `lobby`
       14. `last-band-standing` `playing`
       15. `last-band-standing` `ended`
    7. harness-only selectors are now being added where needed instead of forcing scenario packs to depend on ambiguous repeated UI copy, e.g. `air-capture` bot controls
    8. `ForcedOrientationShell` now derives current orientation from actual viewport geometry before `screen.orientation`, which fixed the previously rotated/incorrect controller screenshots in Playwright-driven portrait captures
    9. the original `@air-jam/sdk` rebuild bottleneck is reduced now that visual capture reuses cached SDK output when sources are unchanged; the remaining bottleneck is no longer lifecycle coverage, but using that coverage to do real UI cleanup and extending prebuild reuse beyond the SDK
27. destructive analytics integration tests now run against an isolated real Postgres path instead of the shared runtime DB contract

### Priority 5. Release PR And Publish

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Remaining:

1. merge the release PR and deploy the platform once the canonical prerelease execution phase is complete
2. publish the release and ZeroDays articles
3. execute the first GTM and community rollout

## Active Product Tracks

### 5. AI-Native Monorepo And Template System

Status: completed baseline  
Reference: [AI-Native Template System Rollout](./archive/ai-native-template-system-rollout-2026-03-29.md)

Current truth:

1. local-first AI pack exists
2. hosted manifest and files exist
3. `create-airjam ai-pack status`, `diff`, and `update` exist
4. scaffold validation and freshness checks exist
5. Pong template structure, docs, skills, and tests were significantly upgraded

### 6. Unified Logging System

Status: completed baseline  
Reference: [Logging System Rollout](./archive/logging-system-rollout-2026-03-29.md)

Current truth:

1. unified dev sink is real
2. scaffolded projects have a log workflow
3. published CLI log command exists
4. generated-project sink behavior is validated
5. workspace toolchain logs now also land in the unified stream
6. `pnpm exec air-jam-server logs` is now the canonical reader across repo and scaffolded projects, with `pnpm run repo -- workspace logs` kept only as a maintainer passthrough
7. workspace process events are now normalized as `workspace.process.started`, `workspace.process.output`, and `workspace.process.exit`, with structured server runtime output no longer duplicated through the workspace sink

### 7. Game-Source Scaffolding

Status: completed baseline  
Reference: [Game Source Scaffolding Plan](./archive/game-source-scaffolding-plan-2026-04-07.md)

Current truth:

1. `games/` is now the honest home for repo-owned games
2. `games/pong` and `games/air-capture` now declare scaffold manifests and serve as the first real source-of-truth scaffoldable games
3. `create-airjam` now snapshots scaffold sources from `games/`, supports `--template=<id>`, and offers interactive template selection when no template is provided
4. the duplicated Pong template source tree has been retired in favor of `games/pong`
5. `pnpm test:scaffold` now proves every scaffoldable game through the shared export path, install, typecheck, test, and build flow

### 8. ZeroDays Game Import And Template Promotion

Status: completed baseline  
Reference: [ZeroDays Game Import And Template Promotion Plan](./archive/zerodays-game-import-template-promotion-plan-2026-04-07.md)

Current truth:

1. `code-review`, `last-band-standing`, and `the-office` now live under `games/` as workspace-native source games
2. obvious standalone clutter and repo-backlink `file:` dependencies were removed on import
3. the root workspace and TS project graph now include all three imported games
4. baseline validation is green for the imported games:
   1. `pnpm --filter code-review typecheck && pnpm --filter code-review build`
   2. `pnpm --filter last-band-standing typecheck && pnpm --filter last-band-standing test && pnpm --filter last-band-standing build`
   3. `pnpm --filter the-office typecheck && pnpm --filter the-office build`
5. all three imported showcase games are now promoted into the scaffold/template catalog with `airjam-template.json` set to `scaffold: true`
6. the shared workspace launcher now supports explicit `pnpm standalone:dev --game=<id>` and `pnpm arcade:dev --game=<id>` flows for repo-owned games
7. all three imported games now have a first-pass repo-native ownership cleanup:
   1. explicit `host/` and `controller/` entry ownership
   2. clearer `game/domain` or `game/stores` seams where they previously leaked through root-level files
   3. thin compatibility re-exports only where they reduce churn during migration
8. `code-review` is now a promoted imported template:
   1. obvious imported garbage such as nested `.git`, `dist`, and local release artifacts was removed
   2. the game now carries a clean README and a minimal domain test seam
   3. `airjam-template.json` is now `scaffold: true`
   4. `pnpm --filter code-review typecheck && pnpm --filter code-review test && pnpm --filter code-review build` is green
   5. `pnpm --filter create-airjam smoke -- --source=workspace --template=code-review` is green
   6. `pnpm --filter create-airjam smoke:tarball -- --template=code-review` is green
9. `last-band-standing` is now a promoted imported template:
   1. the nested standalone `node_modules` install was removed and the game now relies on the workspace contract
   2. the imported README was replaced with a repo-native template-safe README
   3. `airjam-template.json` is now `scaffold: true`
   4. `pnpm --filter last-band-standing typecheck && pnpm --filter last-band-standing test && pnpm --filter last-band-standing build` is green
   5. `pnpm --filter create-airjam smoke -- --source=workspace --template=last-band-standing` is green
   6. `pnpm --filter create-airjam smoke:tarball -- --template=last-band-standing` is green
10. `the-office` is now a promoted imported template:
11. the nested standalone `node_modules` install was removed and the game now relies on the workspace contract
12. the imported README was replaced with a repo-native template-safe README
13. a minimal pure helper seam and helper test now exist around the office game store
14. `airjam-template.json` is now `scaffold: true`
15. `pnpm --filter the-office typecheck && pnpm --filter the-office test && pnpm --filter the-office build` is green
16. `pnpm --filter create-airjam smoke -- --source=workspace --template=the-office` is green
17. `pnpm --filter create-airjam smoke:tarball -- --template=the-office` is green
18. the imported ZeroDays promotion track is now functionally complete; remaining game-specific launch quality work belongs to [Showcase Games Release Readiness Plan](./plans/showcase-games-release-readiness-plan.md)
19. the imported template trio now has a second reference-quality polish pass:
20. all three now use Pong-style Vite build defaults with `base: "./"` and explicit vendor chunking
21. the large Vite chunk warnings were reduced below the warning threshold in targeted local builds for `code-review`, `last-band-standing`, and `the-office`
22. `last-band-standing` now hoists lazy route imports out of the component body so its app entry matches the teaching pattern we want
23. `the-office` now has a small pure helper seam around store mutation logic instead of keeping every store detail trapped inside the zustand wrapper

### 9. Local Runtime Workflow Modes

Status: completed baseline  
Reference: [Local Runtime Workflow Modes Plan](./archive/local-runtime-workflow-modes-plan-2026-04-07.md)

Current truth:

1. the repo now has three explicit local runtime stories:
   1. live standalone workspace dev via `pnpm standalone:dev --game=<id>`
   2. live Arcade workspace dev via `pnpm arcade:dev --game=<id>`
   3. built Arcade validation via `pnpm arcade:test --game=<id>`
2. secure local HTTPS is already the canonical local secure path and already uses Next's `--experimental-https`; the remaining work is product proof inside those modes, not command naming ambiguity
3. standalone secure game dev for repo-owned or exported projects remains `cd games/<id> && pnpm dev -- --secure`

### 10. Runtime Topology And Endpoint Contract

Status: completed baseline  
Reference: [Runtime Topology And Endpoint Contract Plan](./archive/runtime-topology-and-endpoint-contract-plan-2026-04-07.md)

Current truth:

1. `@air-jam/runtime-topology` is now the shared source of truth for run-mode endpoint modeling
2. workspace commands emit explicit shell topologies for platform host/controller surfaces
3. embedded Arcade game iframes now receive explicit child-runtime topology in their URL contract
4. scaffold/runtime project mode resolution now produces explicit topology internally instead of relying on SDK-side legacy endpoint fallback
5. platform shell topology is now produced at boot and consumed as required env
6. the SDK now separates `backendOrigin` from `socketOrigin` internally instead of treating `serverUrl` as one ambiguous field
7. `pnpm topology --game=<id> --mode=<mode> [--secure]` now prints the resolved topology for trust/debugging

### 11. Root Workspace CLI Consolidation

Status: completed baseline  
Reference: [Root Workspace CLI Consolidation Plan](./archive/root-workspace-cli-consolidation-plan-2026-04-04.md)

Current truth:

1. the root `package.json` script surface is reduced to the canonical repo lifecycle and validation commands
2. per-game root aliases and other redundant maintenance aliases were removed
3. monorepo-only orchestration now lives behind one repo-local CLI at `pnpm run repo -- ...`
4. workspace-specific scripts and helpers now live under `scripts/workspace/`
5. `create-airjam` remains focused on public and project-local workflows instead of absorbing monorepo-only commands

### 12. Shared Local Secure Dev

Status: completed baseline  
Reference: [Shared Local Secure Dev Plan](./archive/shared-local-secure-dev-plan-2026-04-03.md)

Current truth:

1. trusted local HTTPS via `mkcert` is now the canonical secure-dev path for the repo and exported projects
2. the shared secure-dev runtime now lives in `packages/create-airjam/runtime/`, not in duplicated per-game helper scripts
3. root workspace Arcade secure mode now supports `pnpm secure:init` followed by `pnpm arcade:test --game=<id> --secure`
4. the platform dev app and all scaffoldable games now honor the same `AIR_JAM_DEV_CERT_FILE` / `AIR_JAM_DEV_KEY_FILE` contract
5. Cloudflare tunnel remains supported only as an explicit fallback mode, not the default teaching path
6. generated projects no longer ship with `cloudflared` as a default dependency
7. the shared scaffold validation gate remains green after the secure-dev transition, so the repo and exported templates are still aligned

### 13. Environment Contract Hardening

Status: completed baseline

Current truth:

1. runtime-owning boundaries now share a small env validation core via `@air-jam/env`
2. server startup/auth env now parses once and fails fast with actionable terminal errors
3. platform release storage/moderation env now uses boundary-owned validated schemas
4. create-airjam runtime commands (`dev`, `secure:init`, `topology`) now use one validated runtime env contract
5. server DB creation now happens at explicit startup/runtime boundaries instead of module-load singleton state
6. env contract documentation now lives in [Environment Contracts](./systems/env-contracts.md)

## Active Framework Tracks

### 14. Visual Harness Reset

Status: active  
Reference: [Visual Review Harness Plan](./plans/visual-review-harness-plan.md)

Current truth:

1. the harness core now lives in the internal `@air-jam/visual-harness` package, with repo commands and stack boot kept as thin adapters
2. all five launch-set games publish the dev-only visual harness bridge snapshot with canonical join URL, `matchPhase`, and `runtimeState`, and the join URL is only exposed once the capability-bearing host URL is actually ready
3. the runner now resolves controller join URLs from the bridge-backed contract instead of scraping host join fields
4. the standalone capture path is now the default and runs on isolated per-run ports with unified backend routing
5. the launch set now has deterministic `lobby`, `playing`, and `ended` capture coverage on disk
6. controller portrait screenshots are trustworthy again after the shared `ForcedOrientationShell` fix
7. the shared controller shell now uses a portrait-safe stacked layout, which removed the worst top-header overflow and crowding across the representative controller captures
8. the standard host capture set now includes a `3016x1504` `mac-desktop` viewport and the harness browser launch is configured so WebGL-heavy gameplay like `air-capture` renders correctly in Playwright
9. the remaining work on this track is no longer architecture rescue; it is using the harness for real UI cleanup and extending build reuse where it materially improves iteration speed

## Documentation Hygiene Tasks

Status: ongoing repo rule

Remaining:

1. use this ledger consistently as the single active execution surface
2. keep the active plan surface minimal as more baselines close
3. keep architecture docs current as product direction evolves

## Recently Completed Baselines

These are done enough that they should not drive the day-to-day work queue:

1. Arcade architecture reset: [Arcade Architecture Reset Summary](./archive/arcade-architecture-reset-summary.md)
2. AI-pack hosted deployment hardening
3. controller-shell haptics baseline
4. workspace-to-unified-log ingestion
5. framework paradigm refresh across runtime, platform, AI-native workflow, analytics, and monetization direction
6. browser-level Arcade happy-path smoke inside the canonical release gate
7. legacy game migration guide plus tarball validation across the three ZeroDays reference games
8. prerelease production observability baseline is now explicit across Better Stack uptime, Vercel Web Analytics, Vercel Speed Insights, and Air Jam's own runtime analytics
9. the platform dashboard now exposes a direct bug-report path to the official GitHub issues surface
10. `air-capture` now teaches the modern reference architecture and has passed manual Arcade validation after the current refactor phases
11. GitHub-first dashboard auth is implemented and production-configured for the initial release posture
12. SDK runtime ownership is explicit and shared platform settings are now deterministic and productized across Arcade, controller surfaces, and embedded games
13. the public Arcade hosted release lane, managed media lane, and dashboard IA reset are implemented at the baseline product level
14. auth capability hardening is complete enough for prerelease and no longer needs active plan tracking
15. the old SDK composability direction has been superseded by the explicit runtime-ownership model and no longer needs active plan tracking
16. controller-to-host RPC actions now enforce the narrow network contract: zero args or one plain-object payload, with runtime diagnostics and protocol validation backing the type surface
17. the dashboard-hosted artifact lane now has an explicit `.airjam/release-manifest.json` contract, fixed `/` + `/controller` route behavior, and a creator-facing `release:bundle` workflow through `create-airjam`
18. the source docs, generated docs pack, Pong template README, and template-local skills now tell the same current prerelease story

## Rules

1. If a repo-level track matters now, it must appear here.
2. If a plan is active, it must be linked here.
3. If a plan is completed, archive it or mark it non-active here immediately.
4. Keep this file ordered by real execution priority, not by category alone.
5. Keep `docs/suggestions.md` limited to durable non-critical follow-ups.
