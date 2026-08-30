# Air Jam Gate 1 Removal And Compatibility Approval Packet

Last updated: 2026-08-28
Status: approved for `G1-04`
Readiness owner: `G1-04`

Decision: approved by the maintainer on 2026-08-28 with authorization to
proceed autonomously and consult only when a material ambiguity or decision is
encountered.

Related evidence:

1. [Public surface and source-of-truth audit](./public-surface-source-audit.md)
2. [Canonicalization execution set](./canonicalization-execution-set.md)
3. [Decision register](./decision-register.md)
4. [Codebase assessment](./codebase-assessment.md)

## Decision Requested

Approve the following set as one pre-1.0 compatibility cut.

Approval authorizes `G1-05` implementation. It does not authorize feature
expansion, release publication, production deployment, or deletion of the
user's local bot-lab files.

## Recommended Batch

### 1. Establish a real installed project CLI

Approve:

1. add one public `@air-jam/cli` package that installs the `airjam` binary
2. install it in every generated project
3. make `create-airjam` bootstrap-only and remove its ongoing `airjam` binary
4. make `@air-jam/server` own only server runtime and server diagnostics
5. move project dev, topology, secure setup, status, reset, AI-pack, MCP setup,
   semantic-session, hosted game/media, and release commands to the project CLI
6. keep CLI and MCP as thin adapters over the same private typed services
7. require stable JSON output for machine reads and mutations

Reason: installing `create-airjam` permanently would preserve the current
bootstrap/lifecycle ownership error and package every template with ongoing
tooling. A fifth small public package is cleaner than repurposing the server or
keeping the scaffolder as a permanent dependency.

### 2. Cut the SDK contract to one creator model

Approve:

1. keep `createAirJamApp` as the ordinary stable composition root
2. remove runtime-inspection publication symbols and raw host/controller
   runtimes from the stable root
3. add an explicit experimental runtime-inspection leaf
4. move raw dynamic runtimes to an explicit Arcade/platform composition leaf
5. delete the unused capabilities manifest and `AirJamApp` option
6. delete deprecated pre-1.0 aliases and fallback inference
7. replace loose export assertions with one exact approved export snapshot

### 3. Narrow server and MCP package surfaces

Approve:

1. delete the accidental untyped `@air-jam/server` root export
2. move Vite/project-tooling configuration out of the server package
3. retain the server binary for server runtime and log operations only
4. delete unreachable visual MCP definitions, types, schemas, and docs
5. retain only registered supported MCP tools and intentional construction or
   configuration exports
6. package every MCP runtime dependency and prove the packed package in
   isolation
7. distinguish the portable stdio declaration from explicit Codex and Claude
   registration profiles

### 4. Purge duplicate and obsolete implementation owners

Approve deletion of:

1. the private `@air-jam/runtime-topology` package after repointing its final
   consumer
2. copied project-runtime and environment-validation implementations after the
   installed CLI owner exists
3. the server visual-harness command bus, registry, and unreachable browser
   bridge/action model
4. the empty `apps/studio` placeholder
5. deprecated runtime aliases, dead exports, stale generated declarations, and
   proven unreferenced files exposed by the refactor

Retain semantic game sessions, SDK runtime inspection, browser visual proof,
prefab utilities, and internal repo visual testing through their canonical
paths.

### 5. Make agent guidance managed without owning user policy

Approve:

1. root `AGENTS.md` and client notes are created once and user-owned thereafter
2. Air Jam-managed references move under an explicit `.airjam`-owned namespace
3. managed client skills use namespaced Air Jam locations and never overwrite
   unrelated user skills
4. normal development policy has one concise owner; other surfaces link to it
5. malformed or purely repetitive skills and docs are deleted
6. Codex and Claude files contain only genuine client-specific installation or
   discovery differences
7. pack updates modify only declared managed paths

### 6. Converge platform application authority

Approve:

1. delete generic release/media state mutations that bypass trusted lifecycle
2. put UI and machine adapters over shared actor-aware application services
3. enforce one-live-release and active-media invariants in PostgreSQL
4. establish one shared physical-table declaration while platform remains sole
   migration authority
5. extract a testable Arcade lifecycle orchestrator without introducing a
   second state model

### 7. Make generated freshness transitive

Approve:

1. one composite check/prepare order from authored docs to base AI pack to
   hosted AI pack
2. focused leaf checks remain diagnostic but cannot back a global freshness
   claim alone
3. repair the currently stale three documentation snapshots within this chain
4. regenerate or deliberately remove `air-capture` from scaffold eligibility;
   the current recommendation is to retain it and regenerate its missing ZIP
5. report generated/binary churn separately from production-source cleanup

### 8. Make workspace topology reproducible

Approve:

1. exclude local `packages/bot-lab` from the canonical workspace, lockfile, and
   production Docker knowledge
2. preserve the user's local bot-lab directory and files untouched
3. require clean and dirty checkouts to enumerate the same tracked workspaces

## Explicit Non-Approvals

This batch does not approve:

1. a hosted Studio or embedded code editor
2. a universal command bus, mega-schema, or generic orchestration framework
3. distributed room authority before measured capacity requires it
4. compatibility wrappers for removed pre-1.0 internal surfaces
5. durable release jobs, quotas, alerts, self-healing, or other later-gate
   capability work during Gate 1
6. deleting user-owned local files
7. publishing packages or deploying the resulting changes

## Approval Evidence

When approved, record one readiness evidence value:

```text
decision:maintainer-approved-gate-1-removal-and-compatibility-batch
```

Any exception must be written into this packet before implementation so the
Git baseline and deletion claims remain unambiguous.
