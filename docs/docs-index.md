# Air Jam Docs Index

Last updated: 2026-08-30
Status: current navigation

This is the canonical navigation entry for the Air Jam repository.

## Read First

Use this order for fast orientation:

1. [../README.md](../README.md)
2. [current-state.md](./current-state.md)
3. [working-agreements.md](./working-agreements.md)
4. [documentation-taxonomy.md](./documentation-taxonomy.md)
5. the relevant active plan
6. [work-ledger.md](./work-ledger.md) only if historical context is needed

Default agent loop:

1. orient from the read-first path
2. open only the relevant active plan
3. implement and validate
4. update history or current-state only if the operating rules require it

## Active Now

The 1.0 release roadmap is the governing product track:

1. [plans/v1-release-roadmap-plan.md](./plans/v1-release-roadmap-plan.md)

The machine-backed subordinate execution plan owns dependency-aware work
packages, evidence, and the batched checkpoint model:

1. [plans/v1-release-execution-plan.md](./plans/v1-release-execution-plan.md)

Agents inspect the live execution state through:

```bash
pnpm --silent run repo -- readiness status --json
pnpm --silent run repo -- readiness next --json
```

The evidence-backed architecture and simplicity baseline for Gate 1 is:

1. [audits/v1-canonicalization/v1-canonicalization-audit.md](./audits/v1-canonicalization/v1-canonicalization-audit.md)
2. [audits/v1-canonicalization/codebase-assessment.md](./audits/v1-canonicalization/codebase-assessment.md)
3. [audits/v1-canonicalization/canonicalization-execution-set.md](./audits/v1-canonicalization/canonicalization-execution-set.md)
4. [audits/v1-canonicalization/public-surface-source-audit.md](./audits/v1-canonicalization/public-surface-source-audit.md)
5. [audits/v1-canonicalization/gate-1-removal-approval-packet.md](./audits/v1-canonicalization/gate-1-removal-approval-packet.md)

The assessment preserves the architectural judgment. The execution set owns
the deletion-first bundles and Git measurement contract. The readiness manifest
remains the execution-state authority.

The canonical Gate 2 external-agent proof is defined by:

1. [contracts/external-agent-golden-path-contract.md](./contracts/external-agent-golden-path-contract.md)
2. [audits/v1-golden-path/public-bootstrap-audit.md](./audits/v1-golden-path/public-bootstrap-audit.md)
3. [audits/v1-golden-path/primary-agent-run-audit.md](./audits/v1-golden-path/primary-agent-run-audit.md)
4. the machine-readable scenario and prompt exposed through
   `pnpm --silent run repo -- golden-path spec --json`

The ranked Gate 5 public, privileged, artifact, runtime, agent, provider,
privacy, and supply-chain security baseline is:

1. [audits/v1-security/threat-model-audit.md](./audits/v1-security/threat-model-audit.md)

The audit owns evidence and decisions. `G5-02` and `G5-03` in the readiness
manifest own implementation and proof; the document is not a parallel backlog.

The detailed discoverability checklist remains a subordinate launch reference:

1. [plans/discoverability-and-launch-promotion-plan.md](./plans/discoverability-and-launch-promotion-plan.md)

The completed first-party telemetry work is preserved in the
[2026-08-26 telemetry archive](./archive/2026-08-26-first-party-product-telemetry-plan.md),
and the completed Android Auto work is preserved in the
[2026-07-24 road-trip archive](./archive/2026-07-24-android-auto-road-trip-plan.md).
Their durable improvements now feed into the v1 release proof rather than
competing as parallel product architectures.

## Planned Next

The roadmap gates define the product sequence and the readiness manifest derives
the currently executable queue. The next independent work is:

1. external-agent public installation and bootstrap proof
2. production capacity, cost, lifecycle, and recovery inventory
3. dedicated untrusted-content origin isolation and the remaining ranked Gate 5
   security closures
4. durable operational-event delivery, alerts, incidents, and bounded runbook
   execution against the canonical operations contract
5. post-v1 architecture work is intentionally non-current and now lives in:
   1. [strategy/post-v1-topology-roadmap.md](./strategy/post-v1-topology-roadmap.md)
6. do not treat future topology work as a second live execution plan while the
   [1.0 roadmap](./plans/v1-release-roadmap-plan.md) is still current

## Core Docs

1. [vision.md](./vision.md)
2. [discoverability-vision.md](./discoverability-vision.md)
3. [framework-paradigm.md](./framework-paradigm.md)
4. [capability-inventory.md](./capability-inventory.md)
5. [monorepo-operating-system.md](./monorepo-operating-system.md)

## Operating Surfaces

1. [current-state.md](./current-state.md)
2. [working-agreements.md](./working-agreements.md)
3. [documentation-taxonomy.md](./documentation-taxonomy.md)
4. [work-ledger.md](./work-ledger.md)
5. [suggestions.md](./suggestions.md)

## Reference Directories

1. `docs/plans/`
2. `docs/architecture/`
3. `docs/contracts/`
4. `docs/guides/`
5. `docs/strategy/`
6. `docs/content/`
7. `docs/audits/`
8. `docs/archive/`

Use the capability inventory for breadth and these directories for the cleaner
explanatory layer around the same implemented surface.

## Rule

Keep this file compact.
It should point to the right surfaces, not re-list every file in the repo.
