# Air Jam Work Ledger

Last updated: 2026-04-06  
Status: active

This is the single active repo-wide ledger.

Use it to answer:

1. what matters now
2. what is already done
3. which active plans still matter
4. which tracks should be archived or collapsed

## Current Execution Order

Air Jam should now move through prerelease work in one canonical plan:

1. decide the final launch posture of the three legacy showcase games
2. finish the five-game launch-set proof locally through Arcade
3. resolve the release-critical issues surfaced by real multiplayer playtests
4. prove the hosted release and managed media dashboard flows end to end
5. produce release media, connect official hosting, validate on official servers, and publish

Canonical prerelease plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Anything outside that order should only move in parallel when it does not slow the critical path.

User-directed active parallel track:

1. import the three ZeroDays showcase games into `games/`, normalize them to the modern workspace contract, and promote them toward template quality using [ZeroDays Game Import And Template Promotion Plan](./plans/zerodays-game-import-template-promotion-plan.md)

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

1. finish the local Arcade proof for the three remaining showcase games: `code-review`, `last-band-standing`, and `the-office`
2. land the release-critical playtest hardening stack:
   1. prove the controller reconnect/resume baseline in real launch-set gameplay
   2. `air-capture` high-priority gameplay fixes
3. rerun the baseline pair after those fixes and confirm they remain launch-trustworthy
4. run the final hosted release and managed media dashboard proof paths
5. create release media assets
6. connect and deploy all public games on official hosting
7. validate all five games against the official servers
8. merge the release PR, deploy the platform, and publish the launch content

Active subsystem plan linked from this phase:

1. [Controller Reconnect And Resume Plan](./plans/controller-reconnect-resume-plan.md)
2. [Local Runtime Workflow Modes Plan](./plans/local-runtime-workflow-modes-plan.md)
3. [Runtime Topology And Endpoint Contract Plan](./plans/runtime-topology-and-endpoint-contract-plan.md)

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
11. a longer real playtest of `air-capture` and `last-band-standing` surfaced the next honest prerelease gate:
   1. reconnect/resume now has a real SDK/server baseline:
      1. stable controller device identity
      2. room-scoped resumable controller lease
      3. same-device automatic resume
      4. conflicting-device rejection
   2. Pong now has local Arcade browser proof for reconnect/resume after controller refresh; the remaining reconnect gate is live gameplay proof in `air-capture` and `last-band-standing`
   3. controller fullscreen prompting is now explicit and productized at the controller shell boundary, with dedicated browser smoke coverage
12. controller privileged channels now have an explicit room-scoped capability baseline:
   1. official host/controller links carry the capability automatically
   2. `controller:system`, `controller:play_sound`, and `controller:action_rpc` now require it after join
   3. room-code-only joins still work for ordinary play/input flows without those elevated powers
   4. implementation details live in [Controller Capability And Perf Hardening Plan](./archive/controller-capability-and-perf-hardening-plan-2026-04-04.md)
13. server perf sanity is now a real release-confidence gate:
   1. the canonical perf harness now runs both the input baseline and reconnect churn
   2. committed strict thresholds now back the release path instead of ad hoc warning-only output
   3. `pnpm check:release` now includes `pnpm run repo -- perf sanity --strict`
   4. implementation details live in [Controller Capability And Perf Hardening Plan](./archive/controller-capability-and-perf-hardening-plan-2026-04-04.md)
   4. `air-capture`'s first gameplay hardening pass is now in:
      1. analog left-stick movement with right-side actions only
      2. own-flag-carried enemy pickup lockout
      3. stronger large-radius rocket blast tuning
      4. lobby name visibility on host and controller
      5. 3-second rotation-only opening countdown
   5. the remaining gate for that slice is another real Arcade playtest, not more blind refactoring
   6. Arcade waiting-state now has a first-pass platform-owned `ping` interaction:
      1. controller waiting shell exposes a `Ping host` action
      2. Arcade host plays a dedicated `piing` SFX with a small visual acknowledgment
      3. the action is host-cooled-down so one controller cannot spam the shell
   7. couch-readability and menu-affordance polish still need explicit prioritization after the next proof pass
12. release moderation and enforcement are now split cleanly by audience:
   1. upload finalization now runs automated screenshot + image moderation before a release settles into `ready`
   2. creator release pages keep upload/publish/archive plus release history, but no longer expose moderation or quarantine controls
   3. internal moderation and quarantine actions now live behind a database-backed `ops_admin` role on `/dashboard/ops/releases`
13. the monorepo root now reflects the real product boundary more honestly:
   1. platform-owned product surfaces remain under `apps/`
   2. repo-owned first-party games can now live under `games/`
   3. `air-capture` has been moved from `apps/air-capture` to `games/air-capture` as the first clean example of that split
14. repo runtime commands now reflect the real three-mode local contract:
   1. `pnpm standalone:dev --game=<id>` runs live standalone workspace dev
   2. `pnpm arcade:dev --game=<id>` runs live Arcade workspace dev
   3. `pnpm arcade:test --game=<id>` builds the selected game once and serves it through the platform under `/airjam-local-builds/<game>/`
   4. secure Arcade validation now means `pnpm secure:init` plus `pnpm arcade:test --game=<id> --secure`
   5. repo games still share the SDK router-basename contract so platform-served local build routes stay honest without per-game hacks
15. runtime endpoint handling now has one explicit shared contract instead of scattered origin guessing:
   1. `@air-jam/runtime-topology` is now the shared source of truth for run-mode endpoint modeling
   2. workspace commands emit explicit shell topologies for platform host/controller surfaces
   3. embedded Arcade game iframes now receive explicit child-runtime topology in their URL contract
   4. scaffold/runtime project mode resolution now produces explicit topology internally instead of relying on SDK-side legacy endpoint fallback
   5. platform shell topology is now produced at boot and consumed as required env, instead of deriving a legacy fallback inside runtime code
   6. the SDK now separates `backendOrigin` from `socketOrigin` internally instead of treating `serverUrl` as one ambiguous field
   7. `pnpm topology --game=<id> --mode=<mode> [--secure]` now prints the resolved topology for trust/debugging
15. Postgres safety and local-dev DB posture are now explicit prerelease baselines:
   1. the repo owns an optional persistent local dev Postgres via `pnpm run repo -- db up`, with data under `.airjam/postgres/dev/`
   2. prerelease can still intentionally point `DATABASE_URL` at production for release-state validation
   3. destructive analytics integration tests now run against an isolated real Postgres path instead of the shared runtime DB contract

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
Reference: [Game Source Scaffolding Plan](./plans/game-source-scaffolding-plan.md)

Current truth:

1. `games/` is now the honest home for repo-owned games
2. `games/pong` and `games/air-capture` now declare scaffold manifests and serve as the first real source-of-truth scaffoldable games
3. `create-airjam` now snapshots scaffold sources from `games/`, supports `--template=<id>`, and offers interactive template selection when no template is provided
4. the duplicated Pong template source tree has been retired in favor of `games/pong`
5. `pnpm test:scaffold` now proves every scaffoldable game through the shared export path, install, typecheck, test, and build flow

### 8. ZeroDays Game Import And Template Promotion

Status: active  
Reference: [ZeroDays Game Import And Template Promotion Plan](./plans/zerodays-game-import-template-promotion-plan.md)

Current truth:

1. `code-review`, `last-band-standing`, and `the-office` now live under `games/` as workspace-native source games
2. obvious standalone clutter and repo-backlink `file:` dependencies were removed on import
3. the root workspace and TS project graph now include all three imported games
4. baseline validation is green for the imported games:
   1. `pnpm --filter code-review typecheck && pnpm --filter code-review build`
   2. `pnpm --filter last-band-standing typecheck && pnpm --filter last-band-standing test && pnpm --filter last-band-standing build`
   3. `pnpm --filter the-office typecheck && pnpm --filter the-office build`
5. repo-owned games now declare a tiny `airjam-template.json` manifest even before template promotion, with `scaffold: false` keeping non-template games out of `create-airjam`
6. the shared workspace launcher now supports explicit `pnpm standalone:dev --game=<id>` and `pnpm arcade:dev --game=<id>` flows for repo-owned games
7. `code-review` has already been proven through the shared workspace launcher path with platform on `:3000`, server on `:4000`, and the game on `:5173`
8. all three imported games now have a first-pass repo-native ownership cleanup:
   1. explicit `host/` and `controller/` entry ownership
   2. clearer `game/domain` or `game/stores` seams where they previously leaked through root-level files
   3. thin compatibility re-exports only where they reduce churn during migration
9. `code-review` is now the first promoted imported template:
   1. obvious imported garbage such as nested `.git`, `dist`, and local release artifacts was removed
   2. the game now carries a clean README and a minimal domain test seam
   3. `airjam-template.json` is now `scaffold: true`
   4. `pnpm --filter code-review typecheck && pnpm --filter code-review test && pnpm --filter code-review build` is green
   5. `pnpm --filter create-airjam smoke -- --source=workspace --template=code-review` is green
   6. `pnpm --filter create-airjam smoke:tarball -- --template=code-review` is green
10. `last-band-standing` is now the second promoted imported template:
   1. the nested standalone `node_modules` install was removed and the game now relies on the workspace contract
   2. the imported README was replaced with a repo-native template-safe README

### 9. Local Runtime Workflow Modes

Status: active  
Reference: [Local Runtime Workflow Modes Plan](./plans/local-runtime-workflow-modes-plan.md)

Current truth:

1. the repo now has three explicit local runtime stories:
   1. live standalone workspace dev via `pnpm standalone:dev --game=<id>`
   2. live Arcade workspace dev via `pnpm arcade:dev --game=<id>`
   3. built Arcade validation via `pnpm arcade:test --game=<id>`
   4. standalone secure game dev via `cd games/<id> && pnpm dev -- --secure`
2. secure local HTTPS is already the canonical local secure path and already uses Next's `--experimental-https`; the remaining problem is workflow clarity, not basic HTTPS support
3. the command surface is now explicit enough that the remaining work is behavioral polish, not naming ambiguity

### 9. Root Workspace CLI Consolidation

Status: completed baseline  
Reference: [Root Workspace CLI Consolidation Plan](./archive/root-workspace-cli-consolidation-plan-2026-04-04.md)

Current truth:

1. the root `package.json` script surface is reduced to the canonical repo lifecycle and validation commands
2. per-game root aliases and other redundant maintenance aliases were removed
3. monorepo-only orchestration now lives behind one repo-local CLI at `pnpm run repo -- ...`
4. workspace-specific scripts and helpers now live under `scripts/workspace/`
5. `create-airjam` remains focused on public and project-local workflows instead of absorbing monorepo-only commands
   4. `pnpm --filter last-band-standing typecheck && pnpm --filter last-band-standing test && pnpm --filter last-band-standing build` is green
   5. `pnpm --filter create-airjam smoke -- --source=workspace --template=last-band-standing` is green
   6. `pnpm --filter create-airjam smoke:tarball -- --template=last-band-standing` is green
11. `the-office` is now the third promoted imported template:
   1. the nested standalone `node_modules` install was removed and the game now relies on the workspace contract
   2. the imported README was replaced with a repo-native template-safe README
   3. a minimal pure helper seam and helper test now exist around the office game store
   4. `airjam-template.json` is now `scaffold: true`
   5. `pnpm --filter the-office typecheck && pnpm --filter the-office test && pnpm --filter the-office build` is green
   6. `pnpm --filter create-airjam smoke -- --source=workspace --template=the-office` is green
   7. `pnpm --filter create-airjam smoke:tarball -- --template=the-office` is green
12. the imported ZeroDays promotion track is now functionally complete; the remaining obligation is keeping the shared five-template scaffold gate green
13. the imported template trio now has a second reference-quality polish pass:
   1. all three now use Pong-style Vite build defaults with `base: "./"` and explicit vendor chunking
   2. the large Vite chunk warnings were reduced below the warning threshold in targeted local builds for `code-review`, `last-band-standing`, and `the-office`
   3. `last-band-standing` now hoists lazy route imports out of the component body so its app entry matches the teaching pattern we want
   4. `the-office` now has a small pure helper seam around store mutation logic instead of keeping every store detail trapped inside the zustand wrapper

### 9. Shared Local Secure Dev

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

### 10. Environment Contract Hardening

Status: active baseline

Current truth:

1. runtime-owning boundaries now share a small env validation core via `@air-jam/env`
2. server startup/auth env now parses once and fails fast with actionable terminal errors
3. platform release storage/moderation env now uses boundary-owned validated schemas
4. create-airjam runtime commands (`dev`, `secure:init`, `topology`) now use one validated runtime env contract
5. env contract documentation now lives in [Environment Contracts](./systems/env-contracts.md)

## Active Framework Tracks

Status: none beyond the canonical release plan

## Documentation Hygiene Tasks

Status: ongoing repo rule

Remaining:

1. use this ledger consistently as the single active execution surface
2. archive completed plans more aggressively
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
