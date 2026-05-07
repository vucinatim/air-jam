# Air Jam Work Ledger

Last updated: 2026-05-08  
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

## Historical Baseline Before The Reset

Before the 2026-05-08 repo operating system reset, the repo already had these major milestones behind it:

1. the framework, platform, realtime server, and browser-worker topology were already in place
2. the hosted release dashboard lane and managed media lane were already implemented
3. the hosted release CLI and MCP flows were already proven locally end to end
4. the on-demand full-stack preview lane had already been validated live against Vercel and Railway
5. the Railway CLI dependency for hosted preview orchestration had already been replaced by a direct Railway API control surface
6. the launch set and late prerelease hardening work were already largely complete

For the detailed pre-reset execution story, use the archived ledger snapshot above.

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
  - collapsed the remaining live plan surface down to one canonical release plan at [plans/v1-release-plan.md](./plans/v1-release-plan.md)
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
