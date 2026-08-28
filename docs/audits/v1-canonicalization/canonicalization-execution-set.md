# Air Jam 1.0 Canonicalization Execution Set

Last updated: 2026-08-28
Status: implementation active; `R1`, `R2`, and `R3` complete
Implementation owner: `G1-05`
Approval checkpoint: `G1-04`

Related evidence:

1. [Codebase assessment](./codebase-assessment.md)
2. [Canonicalization audit](./v1-canonicalization-audit.md)
3. [Decision register](./decision-register.md)
4. [System map](./system-map.md)

## Objective

Make the repository smaller, singular, reproducible, and easier to operate
before adding product capabilities.

This is one canonicalization program implemented as coherent Git-measured
bundles. Audit IDs preserve evidence; readiness items preserve execution state.
This document does not create a second tracker.

## Expansion Freeze

Until Gate 1 closes:

1. do not add user-facing product features
2. do not add speculative abstractions or future-client frameworks
3. do not preserve obsolete internal paths for compatibility
4. add production code only when it is the smallest retained owner needed to
   delete duplicate or unsafe paths
5. add tests, contract guards, and machine evidence in the same bundle as the
   canonicalization they protect

Security findings that expose a current unsafe control plane may be fixed during
Gate 1 when the fix is removal, fail-closed configuration, or boundary
correction. Larger reliability and operational systems remain in Gates 3-5.

## Git Baseline Contract

Canonicalization line evidence uses one exact committed base.

The pre-canonicalization roadmap, telemetry, generated-content, blog, audit,
and readiness state was reviewed and preserved in one explicit snapshot before
`G1-05` implementation began.

Canonicalization base commit:
`18ca38957c19c7ee5d9e39aac2bb91f0393a8902`

The baseline deliberately retains the two audit-observed generated-artifact
failures: the missing `air-capture.zip` and three stale base AI-pack docs. Their
repair therefore remains visible in the Gate 1 delta and is reported as
generated/binary churn rather than production-source cleanup.

All canonicalization claims compare against this SHA. Do not compare Gate 1
against an older commit and claim unrelated pre-baseline changes as cleanup.

## Git Delta Evidence

Every completed bundle records its exact `<base>..<head>` range and retains:

```bash
git diff --shortstat --find-renames=90% <base>..<head>
git diff --numstat --find-renames=90% <base>..<head>
git diff --summary --find-renames=90% <base>..<head>
```

Report additions and deletions separately for:

1. production and operational source
2. tests and contract guards
3. documentation and agent guidance
4. generated or binary artifacts, excluded from the source-code claim

Recommended source-only measurement:

```bash
git diff --numstat --find-renames=90% <base>..<head> -- \
  apps packages games scripts package.json pnpm-workspace.yaml pnpm-lock.yaml \
  ':(exclude,glob)**/*.test.*' \
  ':(exclude,glob)**/tests/**' \
  ':(exclude,glob)**/dist/**' \
  ':(exclude,glob)**/generated/**' \
  ':(exclude,glob)**/template-assets/**' \
  ':(exclude,glob)**/scaffold-templates/**' \
  ':(exclude,glob)**/*.md'
```

Recommended test measurement:

```bash
git diff --numstat --find-renames=90% <base>..<head> -- \
  ':(glob)**/*.test.*' ':(glob)**/tests/**'
```

Recommended documentation and guidance measurement:

```bash
git diff --numstat --find-renames=90% <base>..<head> -- \
  docs content packages/create-airjam/template-assets/base \
  packages/cli/template-assets/managed \
  packages/cli/template-assets/bootstrap \
  apps/platform/public/ai-pack AGENTS.md README.md
```

Line counts are evidence, not the acceptance criterion. Moving code between
files, deleting tests, hiding code in generated output, or compressing readable
logic does not count as architectural improvement.

The important companion counts are:

1. duplicate source owners removed
2. packages, routes, commands, exports, and files deleted
3. public contracts deliberately reduced or clarified
4. remaining canonical owners
5. focused and clean-checkout validation passed

## Bundle R1: Reproducible Workspace And Dead Surface Purge

Primary findings: `CAN-001`, `CAN-013`, `CAN-115`, `CAN-300`.

Scope:

1. make `@air-jam/sdk/runtime-topology` the only topology implementation
2. remove the private duplicate topology package and repoint its live consumer
3. exclude the user's local bot lab from the canonical workspace without
   deleting its local files
4. prune the lockfile and Docker knowledge of the local-only package
5. delete the empty `apps/studio` placeholder
6. delete proven unreferenced files opportunistically when consumer searches
   and focused checks are clear

Expected Git shape:

1. production/source lines materially net-negative
2. packages and tracked files deleted
3. additions limited to tiny import/config changes and guards

Acceptance:

1. dirty local and clean Git checkouts enumerate the same tracked workspaces
2. one topology implementation remains
3. frozen install, topology tests, workspace list, and canonical guard pass
4. user-local bot-lab files remain untouched

Completion evidence:

1. commit: `958e071829dc9794484ded4f8cdc9f98b3af6217`
2. range: `3159913..958e071`
3. production and operational source: `+17 / -1,951` (`-1,934` net)
4. tests and contract guards: `+5 / -403` (`-398` net)
5. documentation and guidance: `+9 / -20` (`-11` net)
6. focused proof: frozen install, SDK and harness typecheck/tests, workspace
   enumeration, and canonical guard passed
7. retained owner: `@air-jam/sdk/runtime-topology`; removed owners include the
   duplicate topology package, dormant SDK agent seams, empty Studio
   placeholder, and tracked bot-lab workspace knowledge

## Bundle R2: Runtime And Agent-Control Surface Purge

Primary findings: `CAN-002`, `CAN-005`, `CAN-012`, `CAN-207`.

Scope:

1. remove the obsolete server visual-harness HTTP command bus and registry
2. remove unreachable visual MCP definitions and published type/doc residue
3. delete the unused speculative capabilities manifest
4. remove deprecated config aliases and fallback inference while preserving the
   canonical topology `publicHost`
5. retain browser visual proof and semantic game sessions as separate valid
   capabilities

Expected Git shape:

1. strongly net-negative production/source diff
2. routes, schemas, types, tests for obsolete behavior, and docs deleted
3. replacement code should be exceptional and narrowly justified

Acceptance:

1. production route inventory contains no generic development command bus
2. public MCP schema contains only registered supported tools
3. semantic sessions and browser visual capture still pass focused proof
4. no deprecated runtime alias or capabilities-manifest consumer remains

Completion evidence:

1. commit: `408fdbf45c123dc60e4721e137f7fa43e955fb60`
2. range: `958e071..408fdbf`
3. production and operational source: `+358 / -4,308` (`-3,950` net)
4. tests and contract guards: `+271 / -1,482` (`-1,211` net)
5. documentation and guidance: `+27 / -35` (`-8` net)
6. focused proof: SDK `259` tests, devtools `45` tests, server `135` passing
   tests (`2` explicitly skipped), MCP `6` tests, harness visual-proof tests,
   Air Capture `83` tests and production build, repo contract tests, lint, and
   canonical guard passed
7. retained owners: semantic game sessions for state/actions, runtime
   inspection for mounted-runtime facts, and browser scenario capture for
   visual proof
8. removed surfaces include `5` production HTTP command routes, `4` unreachable
   MCP definitions, the browser bridge/action runtime, the speculative SDK
   capabilities leaf, incomplete topology inference, config/socket aliases,
   legacy settings migration, null action normalization, and game compatibility
   accessors
9. no compatibility adapter was introduced; visual scenario modules now have
   one canonical `visualScenarios` export

## Bundle R3: Project CLI And Public Contract Convergence

Primary findings: `CAN-003`, `CAN-004`, `CAN-006`, `CAN-007`, `CAN-008`,
`CAN-200`, `CAN-201`, `CAN-202`, `CAN-203`, `CAN-204`, `CAN-205`, `CAN-301`.

Scope:

1. keep `create-airjam` as one-shot bootstrap
2. establish one installed project CLI owner for the retained lifecycle
3. converge copied project-runtime and environment-validation implementations
4. make CLI and MCP thin adapters over shared typed services without a universal
   command bus
5. cut SDK/server exports and composition leaves deliberately
6. fix isolated MCP production packaging
7. prove all shipped game semantic contracts against real stores/actions
8. distinguish portable MCP declaration from Codex and Claude client profiles
9. reduce repeated agent policy and separate managed references from user-owned
   project instructions and skills
10. make generated freshness transitive from authored docs through base-pack
    snapshots to hosted AI-pack artifacts

Expected Git shape:

1. copied runtime and guidance lines deleted
2. one small retained CLI composition root may add source lines
3. tests may grow substantially because clean-pack, client, and semantic
   conformance proof is required
4. production-source net reduction is preferred but not a quota; every positive
   seam must replace more than one old owner in the same bundle

Acceptance:

1. a registry-only clean scaffold installs and discovers the documented CLI
2. terminal reads/mutations used by agents have stable structured output
3. no copied project-runtime implementation remains
4. SDK/server/MCP packed surfaces match their documented stability contract
5. Codex and Claude profiles discover the same stdio server contract
6. every scaffoldable game passes semantic contract conformance
7. user-owned instructions survive managed guidance updates

Completion evidence:

1. commit: `bf7d0630097638deec919f01f5bbc4e3e50a627d`
2. range: `4c6466d..bf7d063`
3. production and operational source, excluding docs, tests, generated
   templates, and binaries: `+4,755 / -5,735` (`-980` net)
4. tests and contract guards: `+598 / -246` (`+352` net)
5. documentation and guidance, with old and new ownership roots included for
   rename detection: `+1,086 / -1,062` (`+24` net)
6. generated scaffold archives: `6` binary artifacts, excluded from line
   claims
7. retained owners: `create-airjam` for one-shot bootstrap, `@air-jam/cli` for
   installed project lifecycle, `@air-jam/server` for signal-server start and
   logs, `@air-jam/mcp-server` for the portable MCP adapter, and
   `@air-jam/sdk/arcade/runtime` for explicit platform-only raw composition
8. removed surfaces include the `airjam` alias and ongoing lifecycle from the
   bootstrap package, all server-owned project CLI commands, the duplicated
   server project-runtime tree, duplicated environment validators, and raw
   runtime components from the SDK root
9. machine proof: stable JSON for local status, MCP setup, AI-pack operations,
   and persistent semantic sessions; all six scaffold games pass real
   store/action conformance
10. packed clean-room proof: registry-isolated Pong scaffold installation,
    CLI/MCP discovery, raw MCP initialize and tool listing, semantic session
    open/read/close, typecheck, `22` tests, and production build
11. full proof: frozen install, generated-artifact freshness, repo contracts,
    CLI `50` tests, MCP `8` tests, devtools `46` tests, server `134` tests with
    `2` explicit skips, SDK `260` tests, platform `202` tests, full workspace
    build, and performance sanity passed
12. clean-build correction: repo contract tests now establish SDK output before
    parallel tests instead of rebuilding and cleaning shared `dist` state from
    inside one test file

## Bundle R4: Platform Application Authority Convergence

Primary findings: `CAN-103`, `CAN-104`, `CAN-107`, `CAN-111`, `CAN-112`,
`CAN-114`.

Scope:

1. remove generic release/media status mutations that bypass trusted lifecycle
2. put UI and machine adapters over actor-aware application services
3. enforce one-live-release and active-media invariants in PostgreSQL
4. establish one internal shared runtime-usage DB contract while platform keeps
   sole migration authority
5. extract a testable Arcade lifecycle orchestrator without creating a second
   replicated-state model

Expected Git shape:

1. duplicate adapter workflows and schema declarations deleted
2. service/invariant tests add lines
3. production diff may be neutral or modestly positive, but duplicate paths must
   disappear in the same commits

Acceptance:

1. UI and machine routes cannot perform different semantic transitions
2. PostgreSQL rejects invalid concurrent live-release/media states
3. platform/server compile against one shared physical-table declaration
4. deterministic Arcade scenarios cover launch, restore, back, failure, and exit
5. complete consumer searches show the bypass paths are gone

## Bundle R5: Clean-Checkout Crystallization

Primary readiness owner: `G1-06`.

Scope:

1. remove final stale docs, generated artifacts, exports, aliases, and manifests
   exposed by the preceding bundles
2. run the entire canonical, package, scaffold, release, and clean-checkout
   matrix
3. record the final Git delta from the canonicalization base

Expected Git shape:

1. minimal source additions
2. final deletions and contract corrections only
3. generated churn reported separately

Acceptance:

1. canonical guard, typecheck, lint, tests, build, scaffold, release doctor, and
   generated-artifact checks pass from a clean checkout
2. every accepted Gate 1 finding has removal/refactor proof
3. the final Git delta report names the base/head SHAs and source/test/docs
   additions, deletions, and net values
4. Gate 1 closes before feature expansion begins

## Explicitly Outside Gate 1

These remain in their existing roadmap gates rather than being smuggled into
canonicalization:

1. isolated release CDN/origin implementation beyond boundary corrections
2. durable release-job and queue infrastructure
3. quotas, retention, cleanup, load, and multi-provider recovery
4. operational events, GitHub incidents, runbooks, and self-healing
5. full threat-model closure, abuse controls, and residual-risk acceptance
6. new public game, creator, monetization, or hosted-Studio features

Gate 1 may shape the service boundaries these systems will use. It does not
implement their future product behavior.

## Final Evidence Shape

At Gate 1 closure, report:

| Evidence            | Required value                             |
| ------------------- | ------------------------------------------ |
| Base                | exact commit SHA before `G1-05`            |
| Head                | exact clean canonicalization commit SHA    |
| Source delta        | additions, deletions, net                  |
| Test delta          | additions, deletions, net                  |
| Docs/guidance delta | additions, deletions, net                  |
| Deleted surfaces    | packages, files, routes, commands, exports |
| Canonical owners    | one owner for every affected capability    |
| Validation          | clean-checkout command evidence            |

The goal is visible reduction and clearer ownership, not winning a line-count
contest.
