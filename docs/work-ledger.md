# Air Jam Work Ledger

Last updated: 2026-08-29
Status: historical memory

This file is the append-only historical memory for the repo.

Use it for:

1. milestone closures
2. major validations
3. notable decisions
4. durable execution history

For the current snapshot, use [current-state.md](./current-state.md).

The pre-reset overloaded ledger has been preserved at:

1. [archive/2026-05-08-work-ledger-pre-os-reset.md](./archive/2026-05-08-work-ledger-pre-os-reset.md)

## 2026-08-29 - Golden-Path Staging Authority Became Provider-Owned

- stopped the next `G2-03` replay before external-agent startup because the old
  PR-52 hostname returned platform health while Railway reported no remaining
  ephemeral environment
- removed URL-only staging trust from `golden-path run-primary`
- made the canonical CLI require Railway project and environment identities,
  reject the primary/base environment, resolve the canonical platform service
  and a domain distinct from production, verify environment identity plus
  distinct Postgres and release-storage resources, require a successful
  deployment and health response, and retain that non-secret provider
  attestation
- kept Railway credentials in the controller boundary; the isolated Codex child
  receives only the verified staging URL
- left environment provisioning separate and explicit so the proof harness
  cannot silently create recurring infrastructure cost

## 2026-08-29 - Independent Review Re-Proved Public Bootstrap Provenance

- reopened `G2-02` after review showed the original registry proof checked
  versions and configured registry state but did not positively bind installed
  bytes to the exact tarballs packed by that run
- added SHA-512 provenance checks across packed artifacts, run-scoped registry
  metadata, direct generated-project resolutions, and pnpm lockfile integrity
- required all generated lifecycle scripts, all `24` standalone MCP tools, and
  the lint gate instead of filtering/reporting partial capability
- replaced duplicate unsafe MCP stream readers with one bounded shared probe
  that rejects malformed output without leaking its child process
- bounded bootstrap commands and workspace-build locks and made managed-dev
  cleanup eligible before parsing command output
- discovered and fixed a public topology defect where Vite honored a custom
  `VITE_PORT` but `airjam topology` still advertised `5173`
- passed the full strengthened clean-registry bootstrap with managed
  start/status/stop plus generated-project typecheck, lint, tests, and build

## 2026-08-29 - Independent Review Reopened G2-03 And Fixed The Merge Model

- accepted the independent review finding that the original primary-run
  verifier could trust agent-authored proof and retained its only detailed run
  bundle in an ignored local path
- reopened `G2-03` instead of preserving a completion claim that another
  reviewer could not reproduce
- hardened controller-owned isolation, quality, cleanup, release-verification,
  packaged-helper, machine-session, and readiness contracts on the cumulative
  branch
- passed the complete local CI gate on the corrected head and retained the
  review correction in the canonical primary-run audit
- established that pull requests `#52` through `#60` remain focused review
  slices but will close through one corrected cumulative integration pull
  request because the fixes cross the original stack boundaries
- separated incremental production delivery from the coordinated 1.0 launch:
  code and hidden/prerelease surfaces are exercised before launch, while stable
  package promotion, public visibility, final docs, the article, and
  distribution remain one exact-candidate event
- recorded the remaining policy checkpoint: automated issue comments are not
  formal GitHub approvals, and the solo-repository approval rule must be
  satisfied legitimately or changed explicitly rather than silently bypassed

## 2026-08-29 - Gate 2 Retained The Primary External-Agent Run

- ran nine clean-room controller attempts and retained every material failure
  instead of converting partial execution into a success claim
- proved that a credential-free Codex process can discover the public packages,
  canonical CLI, generated guidance, SDK contracts, MCP, semantic sessions, and
  release surface from an empty directory with repository reads denied
- independently built a polished, host-authoritative Signal Relay game with a
  pure domain core, stable semantic actions, presentation-only host/controller
  surfaces, and the exact `WIN_SCORE = 3` contract
- passed typecheck, lint, five focused domain tests, and production build in the
  final retained attempt, then started and safely stopped managed local dev
- fixed the clean-room defects exposed along the way: controller permissions,
  workspace/caches, durable evidence mirroring, helper launch transport,
  canonical scaffold lint and pnpm metadata, single-writer install guidance,
  disclosed evidence schemas, and classified-blocker verification
- independently verified `g2-03-20260829-a9` as `blocked` at the one remaining
  local boundary: macOS denied Mach-port registration to both bundled Chromium
  and system Chrome inside the managed Codex permission profile
- retained twenty-five manifest-indexed artifacts plus the verifier report,
  removed the run-scoped registry and credentials, and preserved the workspace
  for inspection
- handed the canonical browser-runtime/broker solution, run-scoped staging
  identity, and exact passing replay to `G2-05`; no staging or production
  release was submitted

## 2026-08-28 - Gate 2 Proved The Exact Candidate Bootstrap Outside The Monorepo

- built and packed the canonical five-package public release graph, then
  published the exact tarballs to an authenticated run-scoped loopback registry
- disabled upstream fallback for all Air Jam packages so a missing candidate
  package fails instead of resolving an old public release
- scaffolded and installed a clean minimal project with no `workspace:`,
  `link:`, `file:`, or private monorepo path resolution
- discovered the installed project CLI, root development lifecycle, semantic
  session and release commands, portable MCP declaration, and project-scoped
  Codex profile
- initialized the packaged MCP server over raw STDIO, verified all `24` tools,
  and exercised managed dev start, status, and stop
- passed the generated project's typecheck, tests, and production build, then
  removed the run-owned workspace, registry, credentials, and processes
- fixed MCP identity drift by deriving the announced server version from its
  shipped package manifest and added client-level regression coverage
- aligned the local candidate set with the public release graph so
  `@air-jam/cli` cannot silently disappear from clean-room proofs
- kept the registry harness compatible with the repository's Node 20 CI floor
- measured `create-airjam` at `87,264,734` packed bytes; this is functional but
  material launch friction, and Gate 6 retains the explicit package-size and
  cold-install decision
- passed `33` repository contract tests, the full workspace typecheck, the
  MCP server's `8` tests, lint with one pre-existing ignored vendored warning,
  and the complete isolated-registry proof at implementation commit `511ee85`
- published no npm package and changed no production infrastructure

## 2026-08-28 - Gate 2 Received A Replayable External-Agent Proof Contract

- fixed one machine-readable Signal Relay scenario across ten ordered stages:
  preflight, create, discover, build, control, inspect, repair, evaluate,
  release, and verify
- separated the supported-client claim into Codex's complete lifecycle proof
  and Claude Desktop's independent local MCP installation, discovery, and
  semantic-session proof
- defined a strict clean room: registry packages only, no monorepo/private
  paths or docs, run-scoped identities/configuration, and no maintainer-authored
  product edits after the agent starts
- added one deterministic `WIN_SCORE` mutation so inspect-diagnose-repair is
  repeatable without turning the release claim into an unbounded self-healing
  promise
- required a normalized, digest-indexed evidence bundle with commands,
  sessions, logs, quality, visuals, release facts, retained failures, redaction,
  cleanup disposition, and independent verification
- structurally disabled production publishing and required isolated hidden
  staging for the release stage
- aligned client assumptions with current official vendor guidance: Codex's
  project-scoped STDIO MCP configuration is supported, while Claude Desktop's
  preferred Desktop Extension path still needs independent Air Jam proof
- exposed the contract through `pnpm run repo -- golden-path spec|validate`
  with stable JSON and tests that reject unsafe publication or stage drift
- passed canonical guard, full typecheck, lint with one pre-existing ignored
  vendored warning, and all `32` repository contract tests
- published nothing and changed no production infrastructure; Gates `G2-02`
  through `G2-05` retain responsibility for actually passing the scenario

## 2026-08-28 - Gate 1 Closed From An Exact Clean Checkout

- closed canonicalization bundle `R5` at
  `da835f650d929c5873bf55e8e5db2e8df5c74f81`
- found and removed five populated-worktree assumptions: ignored CLI build
  output, runtime-heavy help discovery, ignored hosted generated artifacts,
  undeclared hoisted contract-runner dependencies, and a browser smoke path
  that could not honor the canonical executable override
- made all three independently published CLI wrappers execute packaged output
  when installed and bootstrap only their owning package when run from a clean
  source checkout
- proved the complete clean-checkout matrix: frozen install, generated
  determinism, canonical guard, lint, `29` repo contracts, hermetic platform
  deployment, all typechecks/tests/builds, strict realtime performance, `17`
  server smoke tests, `4` real-browser scenarios, and all six packed scaffolds
- measured strict realtime at `20,553` events sent and received, `0%` loss,
  `227.10` events/second, and `2.04 ms` p95 latency
- measured the exact Gate 1 authored delta at `+10,872 / -16,922` (`-6,050`
  net) across production source, tests/guards, and docs/guidance
- reported `6,170` generated Drizzle snapshot lines and six binary scaffold
  archives separately; generated churn is why the raw numeric repository diff
  is slightly positive despite the authored reduction
- recovered from local disk exhaustion by removing only ignored build/test
  output in the disposable proof checkout, then passed browser and scaffold
  gates against the same commit
- published no packages and changed no production infrastructure

## 2026-08-28 - Gate 1 R4 Established Platform Application Authority

- completed the six-commit implementation range `f7eff9d..fb59754`
- removed generic release/media status writers and placed creator UI, ops UI,
  and machine HTTP over shared actor-aware application services
- made PostgreSQL authoritative for one-live-release and active-ready-media
  invariants, including explicit concurrent and invalid-write integration proof
- extracted `@air-jam/database-contract` so platform and realtime server compile
  against one physical runtime-usage schema while platform remains the only
  migration owner
- replaced Arcade launch/close callback-ref synchronization with one stateless
  semantic event/effect orchestrator without adding another state model
- covered room reset, launch/ack/failure, restore, history back, explicit exit,
  and server child close with deterministic scenarios
- verified the visible local lifecycle through the canonical `pnpm run dev`
  path: deep-link launch, embedded game render, Back-to-browser server close,
  and browser-card relaunch all converged
- passed platform typecheck/lint, `211` platform tests, `28` repo contracts, and
  `3` explicitly configured real-PostgreSQL invariant tests
- measured the non-generated implementation at `+2,131 / -1,469` production
  and operational lines, with `+777 / -1` test/contract lines
- left no R4-scoped debt; R5 now owns final clean-checkout crystallization

## 2026-08-28 - Gate 1 R3 Made The Public Harness Actually Agent-Operable

- completed bundle `R3` at
  `bf7d0630097638deec919f01f5bbc4e3e50a627d`
- followed with clean-checkout corrections `4980af1` and `59d5657` so the
  CLI-owned AI-pack manifest is committed and `pnpm run dev` remains the
  executable default agent/human development front door
- turned `create-airjam` back into a one-shot bootstrap package and created one
  installed `@air-jam/cli` owner for ongoing project lifecycle
- removed all project lifecycle commands and copied runtime implementations
  from `@air-jam/server`; its binary now owns server start and unified logs only
- added persistent JSON semantic sessions to the CLI over the same typed
  devtools services used by MCP, including safe broker inspection and shutdown
- separated portable MCP declaration from Codex and Claude Desktop profiles
  without mutating global client configuration implicitly
- moved managed framework references into `docs/airjam/` and made generated
  root instructions and local skills project-owned after scaffolding
- narrowed the SDK root to the intended framework API and isolated raw platform
  composition under the explicit `@air-jam/sdk/arcade/runtime` leaf
- added real semantic conformance for all six scaffoldable games
- proved the packed public boundary from an isolated Pong scaffold: dependency
  install, CLI and MCP discovery, raw MCP initialize/tool listing, semantic
  session open/read/close, typecheck, `22` tests, and production build
- found and fixed two failures that workspace-only checks had hidden:
  - the published MCP ESM bundle had inlined a CommonJS ZIP dependency that
    crashed on `require("fs")`
  - one parallel repo test rebuilt and cleaned shared SDK output while another
    test imported it
- closed with frozen install, generated freshness, all focused package tests,
  `134` server tests (`2` skipped), `260` SDK tests, `202` platform tests, full
  workspace build, and performance sanity
- recorded an implementation shape of `-980` net production/operational source
  lines, `+352` net test/guard lines, and `+24` net documentation/guidance lines;
  six generated scaffold archives remain outside line-count claims
- removed `2.6 GB` of old reproducible local tarball-set cache after the disk
  filled during the production build; no source, database, or user-authored
  content was removed
- published nothing and changed no production infrastructure

## 2026-08-28 - Gate 1 Canonicalization Removed Two Duplicate System Families

- established exact baseline `18ca38957c19c7ee5d9e39aac2bb91f0393a8902`
  so cleanup claims exclude earlier roadmap, telemetry, story, and audit work
- completed bundle `R1` at `958e071829dc9794484ded4f8cdc9f98b3af6217`:
  removed the duplicate runtime-topology package, dormant SDK control and
  observability seams, empty Studio placeholder, and bot-lab workspace coupling
- completed bundle `R2` at `408fdbf45c123dc60e4721e137f7fa43e955fb60`:
  removed the production visual command bus, browser action bridge, unreachable
  MCP visual definitions, speculative capability manifest, and pre-1.0 runtime
  compatibility paths
- made semantic game sessions the only state/action automation model, runtime
  inspection the source of mounted-runtime facts, and browser scenario capture
  visual proof only
- recorded a combined bundle shape of `+687 / -8,199` lines across production
  source, tests, and docs, with exact category evidence retained in the
  [canonicalization execution set](./audits/v1-canonicalization/canonicalization-execution-set.md)
- preserved the user's local bot-lab files and performed no package publish or
  production deployment

## 2026-08-28 - Gate 0 Ratified The Air Jam 1.0 Product And Operating Contract

- ratified `Air Jam` as the one public product name and retired `Air Jam
Studio` as a primary 1.0 name
- defined the shipped capability as the free agent-operable development
  harness, with terminal and MCP profiles as the portable client contract
- selected Codex for the complete external-agent lifecycle proof and Claude
  Desktop for the independent desktop MCP proof
- kept 1.0 completely free without payments, checkout, credit cards, player
  paywalls, or expiring trials
- set generous shadow-first hobby allowances and made active gameplay the last
  lane degraded under pressure
- bounded variable infrastructure at `$100` in an ordinary month and `$150` in
  the 1.0/HN launch billing cycle against a measured Railway baseline of about
  `$8` per month
- selected a `100`-room sustained launch target with a required three-times
  burst proof before it becomes a public support claim
- allowed only bounded, reversible, verified stateless/provider recovery for
  1.0; production code promotion and budget increases remain approval-gated
- recorded the maintainer approval as canonical `G0-03` decision evidence and
  aligned the live vision, framework, operations, hosting, and release
  references with the ratified terminology

## 2026-08-26 - The 1.0 Roadmap Became A Machine-Operable Execution Program

- added the subordinate
  [1.0 release execution plan](./plans/v1-release-execution-plan.md) without
  weakening the release roadmap as the product and gate authority
- created one versioned machine execution manifest with 42 dependency-aware
  work packages across all eight gates and a `285-520` agent-hour planning
  envelope
- concentrated maintainer judgment into six batched checkpoints instead of
  making normal implementation repeatedly wait for informal validation
- kept production publication behind explicit approval items while allowing
  local, preview, staging, audit, test, and evidence work to continue
  autonomously
- added the canonical `pnpm run repo -- readiness` surface for stable JSON
  status, ready-work selection, inspection, validation, and preview/apply status
  transitions
- required ownership for active work, typed blockers, retained evidence for
  completion, explicit decision evidence for human checkpoints, and terminal
  evidence for production work
- made ready state dependency-derived so a blocked external or human item does
  not stop independent lanes
- aligned `AGENTS.md`, working agreements, documentation taxonomy, monorepo OS,
  docs navigation, current state, roadmap, and README with the new operating
  contract

## 2026-08-26 - The Free Product Economics Were Bounded Without Paywalling Creation

- ratified that the framework and complete agent-operable development harness remain
  free, with creators normally bringing their own model client, compute, or
  cloud account
- preserved self-hosting and bring-your-own-cloud as first-class escape hatches
  so adoption does not automatically become an Air Jam infrastructure liability
- defined the official free cloud as genuinely useful for ordinary hobby use
  while bounded by an explicit monthly learning budget, quotas, queues, spend
  alerts, safe degradation, and kill switches
- rejected an arbitrary signup count such as 1,000 as the monetization trigger;
  future paid experiments instead follow measured activation, retention,
  provider cost, repeated play, real limit pressure, and user requests for
  professional value
- established the emotional contract that normal hobby use should feel
  generous and an active social session should never be interrupted by a
  surprise paywall
- prioritized eventual revenue from event capacity, agencies and support,
  managed-cloud convenience, teams/private/analytics, and only later a proven
  premium Arcade catalog or marketplace
- prohibited maintainer-funded creator payout liabilities; any reward pool must
  be capped and funded by realized revenue or sponsors before playtime can
  allocate it
- retired speculative fixed price points until actual unit economics and demand
  are measured
- recorded the full durable policy in the
  [deployment and monetization strategy](./strategy/deployment-and-monetization-strategy.md)
  and made the remaining numeric decisions part of Gate 0 in the
  [1.0 release roadmap](./plans/v1-release-roadmap-plan.md)

## 2026-08-26 - The 1.0 Release Track Was Re-Baselined Around The External-Agent Harness

- replaced the narrow final-proof-and-publish v1 plan with the
  [Air Jam 1.0 release roadmap](./plans/v1-release-roadmap-plan.md)
- preserved the superseded plan as the
  [pre-roadmap snapshot](./archive/2026-08-26-v1-release-plan-pre-roadmap.md)
- recorded the clarified development-harness thesis:
  - Air Jam owns the complete creation, runtime, inspection, evaluation, and
    release harness
  - Codex, Claude Desktop, T3 Code, terminal agents, and future clients connect
    through public CLI, MCP, and typed contracts
  - the hosted UI is an optional control room, not a mandatory authoring model
- defined a public 1.0 promise centered on a clean-machine external agent
  completing the full create/run/control/inspect/fix/evaluate/publish lifecycle
- expanded the release bar into evidence-backed gates for:
  - product and architecture re-baselining
  - codebase and contract canonicalization
  - external-agent golden-path proof
  - launch-scale reliability and recovery
  - event-driven incident automation and bounded remediation
  - security, abuse, privacy, and supply-chain trust
  - public packages, docs, demo, article, rehearsal, and launch
- explicitly separated approximate product telemetry, authoritative
  lifecycle/runtime events, and operational incidents so future autonomy does
  not use discovery analytics as a correctness authority
- kept full code-changing self-healing, a mandatory hosted AI editor, universal
  agent integration, and speculative million-user topology outside the 1.0
  blocking scope

## 2026-08-26 - First-Party Product Telemetry Replaced The Dormant Analytics Path

- replaced the unused external website-analytics adapter with one small,
  platform-owned telemetry plane shaped around Air Jam's discovery questions
- landed a closed, versioned event contract for canonical page views, quick
  start, scaffold copy, Arcade entry, GitHub/npm intent, and server-observed
  agent-resource reach
- kept anonymous session identity ephemeral and memory-only, with no cookies,
  browser storage, fingerprinting, raw IP persistence, full user-agent storage,
  full URLs, query strings, raw referrers, or arbitrary metadata
- added hardened same-origin ingestion, trusted-proxy-aware transient
  throttling, append-only evidence, idempotent transactional projection,
  deterministic rebuild, and explicit 90-day raw/session-contribution
  retention
- added an ops-only 7/30/90-day report that visibly separates approximate
  product telemetry from authoritative platform lifecycle and runtime usage
  facts
- exposed the full telemetry operator lifecycle through the canonical repo CLI:
  authority-separated overview, storage/retention health, deterministic rebuild,
  and retention, with stable JSON and explicit preview/apply mutation semantics
- made agent-first operability a durable repo rule: UI-only operator features
  are incomplete, and future machine surfaces must share domain services with
  their human presentations
- removed the obsolete script component, browser adapter, environment contract,
  layout mount, and CSP allowance instead of keeping two analytics models
- closed with a fresh PostgreSQL migration/ingest/replay/dedupe/rebuild proof,
  202 passing platform tests, 11 passing repo CLI contract tests, clean
  typecheck/lint/build gates, and local browser
  proof across landing, Arcade, agent resources, auth protection, and the ops
  report

## 2026-08-26 - First Organic AI-Mediated Discovery Signal Recorded

- preserved the quantified timeline, production-usage evidence, public traffic
  signals, measurement caveats, and release-story interpretation in the
  [organic discovery retrospective](./archive/2026-08-26-organic-discovery-retrospective.md)
- recorded that Air Jam had been publicly playable for 101 days when an
  external developer reported that Claude had recommended it for an
  independently formed "open-source Jackbox" idea
- treated the message as organic positioning and agent-discoverability evidence,
  not as product-market fit or established user adoption
- confirmed that the formal v1 release remained incomplete despite the public
  prerelease, `airjam.io` Arcade, `0.9.2` packages, and May launch content
- identified a real observability gap: production had authoritative runtime
  usage analytics but no active website-traffic authority because the optional
  external analytics path was never configured
- recorded the preferred follow-up direction as first-party, typed product
  telemetry that remains separate from runtime accounting and fully replaces
  the inactive external path when implemented

## Historical Baseline Before The Reset

Before the 2026-05-08 repo operating system reset, the repo already had these major milestones behind it:

1. the framework, platform, realtime server, and browser-worker topology were already in place
2. the hosted release dashboard lane and managed media lane were already implemented
3. the hosted release CLI and MCP flows were already proven locally end to end
4. the on-demand full-stack preview lane had already been validated live against Vercel and Railway
5. the Railway CLI dependency for hosted preview orchestration had already been replaced by a direct Railway API control surface
6. the launch set and late prerelease hardening work were already largely complete

For the detailed pre-reset execution story, use the archived ledger snapshot above.

## 2026-07-24 - Android Auto Platform Foundation Closed

- completed Goal 1 of the active
  [Android Auto road-trip plan](./archive/2026-07-24-android-auto-road-trip-plan.md)
- kept public on-screen controllers as a zero-setup demo while making their
  launcher contextual:
  - full discovery in an empty Arcade
  - compact fallback when appropriate
  - hidden during phone-connected gameplay
- made semantic agent sessions resolve Arcade's authoritative active surface and
  epoch-scoped embedded store domain without changing portable game contracts
- re-proved local app-ID bootstrap and explicit 16-player Arcade room capacity
- measured the connected Galaxy S24 fullscreen safe area and kept the
  controller menu tear top-center below its camera cutout
- installed and visually confirmed the canonical Air Jam Android launcher icon
- closed the phase with:
  - SDK typecheck/build and 270 tests
  - devtools typecheck/build and 50 tests
  - Platform typecheck/lint/build and 162 tests
  - Android unit/lint/debug/release gates
- recorded the newly found missing root `pnpm run dev` contract as GitHub issue
  #40 instead of expanding the road-trip scope
- left all implementation local and unpublished pending explicit user approval

## 2026-05-08 - Railway Consolidation Simplified The Deploy Model

- finished the Block 1 deployment reset in practice:
  - the platform now runs on Railway alongside the realtime server and release browser worker
  - Railway native PR environments are now the canonical preview model
  - the repo no longer treats Vercel plus Railway plus a custom preview control plane as one deploy system
- removed the repo-owned full-stack preview control plane from the active surface:
  - deleted the preview workflows
  - deleted the repo preview command and preview helper modules
  - deleted the preview-specific runtime contract tests
- replaced the old preview-oriented inspection story with a simpler Railway-first one:
  - kept the direct Railway API client
  - added `pnpm run repo -- railway doctor` as the canonical deploy inspection front door
- removed stale Vercel-specific runtime assumptions from the deployable platform surface:
  - removed `VERCEL_URL` fallback identity logic
  - removed Vercel Speed Insights integration
  - removed the leftover full-stack preview host guard
- rewrote the live deployment docs around one simpler truth:
  - Railway is now the deploy and preview provider for the first-party app surfaces
  - the repo should own validation and config clarity, not a second preview lifecycle

## 2026-05-08 - Repo Operating System Reset Closed

- closed the repo operating-system reset by separating:
  - the current snapshot into [current-state.md](./current-state.md)
  - stable rules into [working-agreements.md](./working-agreements.md)
  - navigation into [docs-index.md](./docs-index.md)
  - docs category and naming rules into [documentation-taxonomy.md](./documentation-taxonomy.md)
  - history into this ledger
- tightened the doc surface further after the reset:
  - renamed the capability reference to [capability-inventory.md](./capability-inventory.md)
  - normalized the environment contract doc into [contracts/environment-contracts.md](./contracts/environment-contracts.md)
  - replaced the overly broad `systems/` live surface with explicit `docs/architecture/`, `docs/contracts/`, and `docs/guides/` categories
  - kept `docs/strategy/` and `docs/content/` as explicit live categories without leaving folder-level README files scattered across the tree
  - moved architecture, contracts, and guides into their own semantically correct directories instead of forcing them all into `systems/`
  - moved future or exploratory system docs out of the live reference surface
  - reduced `content/` to real article drafts instead of draft-plus-plan-plus-outline sprawl
  - moved the dated [Project Review (2026-04-15)](./archive/2026-04-15-project-review.md) out of the live strategy surface
  - removed duplicate file-list sprawl from [docs-index.md](./docs-index.md) so it points at canonical folder entrypoints instead of trying to re-list every live doc
  - normalized live status labels so stable references stop pretending to be active execution tracks
  - compacted the settings-ownership work into the archived [2026-05-03-landing-arcade-controller-polish-plan.md](./archive/2026-05-03-landing-arcade-controller-polish-plan.md) and archived the separate settings plan
  - archived the now-superseded prerelease agent dev-loop hardening plan after its durable rules were absorbed into the repo operating surfaces
  - collapsed the remaining live plan surface down to the release plan now
    preserved as the
    [2026-08-26 pre-roadmap snapshot](./archive/2026-08-26-v1-release-plan-pre-roadmap.md)
  - archived the subordinate prerelease, polish, packaging, and future-architecture plans so they stop competing with the final v1 closeout path
- preserved the old overloaded ledger as [archive/2026-05-08-work-ledger-pre-os-reset.md](./archive/2026-05-08-work-ledger-pre-os-reset.md) instead of deleting execution memory
- centralized plan-role and category rules in [documentation-taxonomy.md](./documentation-taxonomy.md) so they stop living only in chat memory
- slimmed [monorepo-operating-system.md](./monorepo-operating-system.md) so it now matches the actual repo memory model instead of the older ledger-centric doctrine
- updated [AGENTS.md](../AGENTS.md) so the documentation discipline now reflects:
  - `docs/current-state.md` for the quick current snapshot
  - `docs/work-ledger.md` for history
  - `docs/working-agreements.md` for stable repo operating system rules
- audited the plan surface and archived the clearly completed tracks that should no longer compete with current execution:
  - [archive/2026-04-20-code-review-reference-cleanup-plan.md](./archive/2026-04-20-code-review-reference-cleanup-plan.md)
  - [archive/2026-04-27-game-structure-alignment-plan.md](./archive/2026-04-27-game-structure-alignment-plan.md)
  - [archive/2026-05-05-public-package-surface-rationalization-plan.md](./archive/2026-05-05-public-package-surface-rationalization-plan.md)
  - [archive/2026-05-08-hosted-release-cli-and-mcp-plan.md](./archive/2026-05-08-hosted-release-cli-and-mcp-plan.md)
  - [archive/2026-05-06-shared-preview-deployment-plan.md](./archive/2026-05-06-shared-preview-deployment-plan.md)
  - [archive/2026-05-07-railway-api-foundation-and-agentic-os-plan.md](./archive/2026-05-07-railway-api-foundation-and-agentic-os-plan.md)
  - [archive/2026-05-07-repo-operating-system-reset-plan.md](./archive/2026-05-07-repo-operating-system-reset-plan.md)
- the repo now has one cleaner read path:
  - `README.md`
  - `docs/docs-index.md`
  - `docs/current-state.md`
  - `docs/documentation-taxonomy.md`
  - relevant active plan
  - `docs/work-ledger.md` only for history

## 2026-05-08 - Capability Surface Explanation Tightened

- kept [capability-inventory.md](./capability-inventory.md) as the breadth map instead of turning it into a second strategy or architecture doc
- expanded the stable reference layer so the Air Jam ecosystem is easier to understand through focused explanatory docs rather than through one giant inventory:
  - architecture:
    - [architecture/platform-control-plane-architecture.md](./architecture/platform-control-plane-architecture.md)
    - [architecture/agent-tooling-architecture.md](./architecture/agent-tooling-architecture.md)
    - [architecture/hosted-release-pipeline-architecture.md](./architecture/hosted-release-pipeline-architecture.md)
    - [architecture/platform-identity-and-auth-architecture.md](./architecture/platform-identity-and-auth-architecture.md)
    - [architecture/documentation-and-ai-pack-architecture.md](./architecture/documentation-and-ai-pack-architecture.md)
  - contracts:
    - [contracts/runtime-topology-contract.md](./contracts/runtime-topology-contract.md)
    - [contracts/runtime-inspection-contract.md](./contracts/runtime-inspection-contract.md)
    - [contracts/agent-session-contract.md](./contracts/agent-session-contract.md)
    - [contracts/game-metadata-contract.md](./contracts/game-metadata-contract.md)
    - [contracts/media-presentation-contract.md](./contracts/media-presentation-contract.md)
  - guides:
    - [guides/local-development-guide.md](./guides/local-development-guide.md)
    - [guides/hosted-release-guide.md](./guides/hosted-release-guide.md)
    - [guides/agent-development-guide.md](./guides/agent-development-guide.md)
- the live docs surface now explains the same ecosystem through three complementary layers:
  - inventory for breadth
  - architecture and contracts for structure
  - guides for operational usage

## 2026-05-08 - Platform And AI-Pack Docs Audit Tightened

- audited the platform-facing docs and AI-pack-facing docs and found the main missing gap was not broad vision but concrete delivery-surface explanation
- added:
  - [architecture/platform-docs-surface-architecture.md](./architecture/platform-docs-surface-architecture.md)
  - [contracts/ai-pack-manifest-contract.md](./contracts/ai-pack-manifest-contract.md)
  - [guides/ai-pack-workflow-guide.md](./guides/ai-pack-workflow-guide.md)
- tightened [architecture/documentation-and-ai-pack-architecture.md](./architecture/documentation-and-ai-pack-architecture.md) so it now explains the hosted docs registry, machine endpoints, hosted AI-pack manifests, and local AI-pack workflow more explicitly
- updated [apps/platform/README.md](../apps/platform/README.md) so the platform app now points at the real public docs and AI-pack reference surfaces instead of leaving those contracts mostly implicit in code

## 2026-05-08 - Public Story Alignment Tightened

- aligned the release plan's public-surface closeout around one primary story:
  - Air Jam is an open AI-native framework for multiplayer games controlled by phones
- tightened the public docs intro and agent entrypoint so they now lead with the AI-native framework model instead of a more generic platform/framework phrasing
- tightened the framework launch article draft so it now foregrounds:
  - shared human-and-agent runtime contracts
  - AI-native development as the actual differentiator
  - the clearer split between self-hosting and hosted Arcade publishing
- lightly reinforced the same story in the origin-story article draft so the long-form content does not drift back toward a simpler but weaker "just a framework" explanation

## 2026-05-08 - Public Creator Attribution Added

- added a shared public creator-attribution registry and presentation layer for Arcade and landing cards
- public game cards now support real GitHub-linked avatar attribution stacks instead of only a flat creator label
- the current curated data is intentionally owned in one file so zerodays game attribution can be adjusted without touching multiple UI surfaces

## 2026-05-08 - Post-V1 Topology Roadmap Written

- wrote [strategy/post-v1-topology-roadmap.md](./strategy/post-v1-topology-roadmap.md) as the canonical post-v1 application-topology roadmap
- locked the intended sequencing instead of treating deployment simplification, Arcade isolation, and API/auth extraction as one blended future refactor:
  - Block 1: move the current platform stack fully onto Railway
  - Block 2: isolate Arcade into its own app boundary
  - Block 3: extract API and auth into a dedicated backend service
- explicitly kept this roadmap out of `docs/plans/` so the repo still has one active release plan while the future architecture direction remains visible and non-current
- recorded the current recommendation on service boundaries:
  - do not remove tRPC during the Railway migration
  - revisit tRPC only once a real separate API service exists
  - use `yu-gi-ai` as the stronger long-term reference for a split API/app/auth package shape, not as a signal to do all of that immediately

## 2026-05-08 - Full-Stack Preview System Verified From `main`

- ran a real hosted smoke test from `main` itself through a temporary PR
- verified that hosted preview create succeeded end to end:
  - Railway created `preview-pr-10`
  - the server came up
  - the browser worker came up
  - the full-stack alias responded at `full-pr-10.preview.airjam.io`
- verified that hosted destroy succeeded end to end:
  - the Railway environment was removed
  - the PR-specific preview alias was removed
  - provider state returned to `production` only
- fixed the final semantic gap so destroyed `full-pr-*` hosts no longer pretend to be live:
  - inactive full-stack preview hosts now return `404`
  - they include an explicit `x-airjam-preview-state: inactive` signal
- upgraded workflow actions to Node 24-capable versions so the preview system is not quietly heading toward a future GitHub Actions runtime deprecation problem

## 2026-05-07 - Railway Preview Control Surface Validated

- proved that Railway API tokens were valid at the public API layer even when Railway CLI auth and project-link flows rejected the same tokens
- replaced the preview lane's critical Railway transport with a direct API-backed control surface
- reran hosted preview automation and reduced the remaining blockers down to Vercel auth and workflow parsing issues instead of provider ambiguity
- confirmed that the correct long-term lesson was:
  - the preview architecture was sound
  - the Railway CLI was the unreliable layer
  - the clean fix was a native Railway control surface rather than more token or workflow guesswork

## 2026-05-07 - Preview Architecture Conclusion Locked

- validated that pure Railway-native PR environments were not clean enough for Air Jam because they:
  - duplicated database services and volumes
  - inherited unsealed production variables before repo-owned preview overrides could take control
  - did not solve the cross-provider orchestration problem by themselves
- validated that the empty-environment plus selected-service-sync idea was also not ready because Railway's available primitive created global copy-services instead of reusing the canonical project services
- locked the architectural conclusion:
  - the repo-owned ephemeral full-stack preview lane remains the canonical implementation until Railway exposes a cleaner supported primitive we can prove end to end

## 2026-07-24 - Android Auto Road Trip Goal 2 Closed

- completed Last Band Standing's correctness and results milestone:
  - every song now has one canonical quiz category and a curated difficulty
  - every four-option round stays inside that category with unique visible
    labels
  - the host reveal reports every player's result, time, round gain, and total
  - ten-player controller standings scroll while the lobby action remains
    pinned
  - lobby category selection is explicit on host and controller
- proved complete ten-round matches with two, six, and ten players
- passed the exact car reveal layouts at `800x480` and `1920x720`
- passed standings bottom-reachability at all four supported phone sizes
- opened Air Jam issue #42 for incorrect agent-contract inference when
  game-session tooling receives a game-local `cwd` without `gameId`
- moved the active road-trip plan to Goal 3: user-reviewed harder-song curation
  and focused visual polish

## 2026-07-24 - Android Auto Road Trip Release Closed

- completed and archived the
  [Android Auto road-trip plan](./archive/2026-07-24-android-auto-road-trip-plan.md)
- merged Air Jam PR #41 after the full release doctor, GitHub CI, and Railway
  preview checks passed
- deployed the platform, realtime server, and release browser worker
  successfully to Railway production
- repaired two release-time platform defects:
  - platform previews now use their own Postgres service reference
  - the release browser worker now exposes one stable authenticated `/ws`
    endpoint across deploys
- published Last Band Standing `0.2.1` as the live hosted release:
  - 206 canonical songs
  - unique same-category answer options
  - controller-owned between-round rankings
  - scrollable final standings
  - responsive Android Auto and phone layouts
  - chrome-free YouTube playback
  - successful artifact validation and canonical screenshot capture
- merged the Android wrapper PR and published signed GitHub Release `v1.0.2`
  with a checksum while retaining `v1.0.0` for rollback
- verified the production platform and realtime health endpoints, public Arcade
  listing, hosted release render, and authenticated browser-worker connection
- left only non-blocking human clip-start listening and tuning for later polish
