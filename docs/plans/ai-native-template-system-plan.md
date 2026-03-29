# Air Jam AI-Native Template System Plan

Last updated: 2026-03-29  
Status: active

Implementation status:

1. Phases 1 through 4 are implemented.
2. Phase 5 is partially implemented:
   1. the platform now publishes a hosted AI pack manifest at `/ai-pack/manifest.json`
   2. channel and version manifests now exist under `/ai-pack/<channel>/...`
   3. the scaffold AI/dev files are now published as stable hosted artifacts under `/ai-pack/<channel>/<packVersion>/files/...`
   4. those hosted files are generated build output, not canonical tracked source
3. Phase 7 is partially implemented:
   1. scaffold smoke coverage exists
   2. generated project file presence is validated
   3. the local docs export is now freshness-checked through `create-airjam` AI pack validation
4. Phase 6 is partially implemented:
   1. `create-airjam ai-pack status` exists
   2. `create-airjam ai-pack diff` exists
   3. both commands compare local managed files against the hosted AI pack
5. the remaining Phase 6 work is the explicit update write path

Related docs:

1. [AI-Native Development Workflow](../ai-native-development-workflow.md)
2. [Documentation Architecture](../documentation-architecture.md)
3. [Development Loop](../development-loop.md)
4. [Docs Index](../docs-index.md)

## Purpose

This plan defines how Air Jam should ship an AI-native project operating system through `create-airjam`.

The goal is to make new game projects immediately usable by humans and coding agents, while still preserving a clean long-term update path for projects created from older template versions.

This plan exists because the right model is not:

1. remote-only docs and guidance
2. static local copies with no update path
3. duplicated guidance scattered across templates

The correct model is:

1. one canonical source for public docs content
2. one canonical source for scaffold-only AI/dev assets
3. one packaged local snapshot in every created project
4. one explicit versioned update path for existing projects

## Decision Lock

These decisions are now considered the intended direction unless a better architecture clearly emerges.

### 1. Local-First Runtime Contract

Every scaffolded Air Jam project should include, immediately:

1. `AGENTS.md`
2. `plan.md`
3. `suggestions.md`
4. `skills/`
5. a minimal local `docs/` pack

This is required so the project is usable:

1. instantly
2. offline
3. without custom tooling
4. by multiple LLM products, not only one

### 2. Canonical Source Split

The intended ownership model is:

1. `content/docs/` is the canonical source for public framework docs content
2. `packages/create-airjam/template-assets/base/` is the canonical source for scaffold-only AI/dev assets

That base pack should own:

1. `AGENTS.md`
2. `plan.md`
3. `suggestions.md`
4. `skills/`
5. template-local docs export output
6. AI pack manifest files

### 3. Skills Stay Scaffold-Owned

Skills should not live under `content/docs/`.

They are operational repo assets, not public docs pages.

The canonical skill source should live under the scaffold system.

### 4. Packaged Snapshot Is The Default

`create-airjam` should ship with a packaged AI/dev snapshot in the npm artifact.

Scaffold should not depend on network access to get usable docs or skills.

### 5. Hosted Source Is For Search And Updates

The platform should still host the canonical public docs and, later, hosted AI pack metadata/artifacts.

Hosted distribution exists to support:

1. search
2. retrieval
3. version inspection
4. explicit sync/update flows

It should not be the only source for initial project usability.

### 6. No Silent Automatic Mutation

Existing scaffolded projects should not have `AGENTS.md`, `skills/`, or local docs silently rewritten behind the developer's back.

The update path should be:

1. explicit
2. visible
3. version-aware
4. ideally diffable

## Scope

This plan is for:

1. the AI/dev asset architecture for scaffolded projects
2. local docs and skills packaging strategy
3. update/versioning strategy for old scaffolded projects
4. `create-airjam` behavior needed to support that system

This plan is not for:

1. a full AI Studio implementation
2. cloud-only project orchestration
3. replacing the public docs system
4. introducing a generic plugin marketplace

## Architecture Overview

The system should have three layers.

### 1. Canonical Authoring Layer

This is where Air Jam maintainers edit the source of truth.

Ownership:

1. public docs content in `content/docs/`
2. scaffold-only AI/dev files in `packages/create-airjam/template-assets/base/`

### 2. Packaged Snapshot Layer

This is what ships inside the `create-airjam` package.

Responsibilities:

1. provide an immediately usable local copy of the AI/dev pack
2. avoid network dependence during scaffold
3. preserve version alignment with the installed `create-airjam` package

### 3. Hosted Update Layer

This is the future platform-served layer.

Responsibilities:

1. expose canonical docs and metadata publicly
2. publish versioned AI pack manifests and artifacts
3. support update checks and explicit sync flows for older projects

## Deliverables

The full system should eventually include all of the following.

### Local Project Deliverables

Each generated project should contain:

1. root `AGENTS.md`
2. root `plan.md`
3. root `suggestions.md`
4. `skills/`
5. local `docs/`
6. `.airjam/ai-pack.json` or equivalent manifest

### Canonical Source Deliverables

The repository should contain:

1. `content/docs/` as canonical public docs content
2. `packages/create-airjam/template-assets/base/` as canonical scaffold AI/dev assets
3. an export/build step that produces the local docs subset from `content/docs/`

### Future Update Deliverables

The platform and/or CLI should eventually support:

1. AI pack version status
2. AI pack diff awareness
3. AI pack explicit update flows
4. docs search and sync

## File Ownership Model

### `content/docs/`

Owns:

1. public framework guidance
2. platform-served docs pages
3. agent-readable public docs content

Does not own:

1. `AGENTS.md`
2. `plan.md`
3. `suggestions.md`
4. `skills/`
5. scaffold-only repo operating contracts

### `packages/create-airjam/template-assets/base/`

Owns:

1. root operational files
2. skill folders
3. AI pack manifests
4. template-local docs export output
5. any small helper metadata needed for scaffold/update flows

## Phase Plan

### Phase 0: Contract Freeze

Goal:

1. define the ownership and distribution model before implementing files in the wrong places

Tasks:

1. keep [AI-Native Development Workflow](../ai-native-development-workflow.md) as the core architecture doc
2. capture this implementation plan as the active rollout tracker
3. freeze the source split:
   1. `content/docs/`
   2. `packages/create-airjam/template-assets/base/`
4. freeze the initial Phase 1 skill set
5. freeze the rule that scaffold output must be fully usable offline

Acceptance criteria:

1. there is no ambiguity about where docs vs skills vs root operating files live
2. future implementation work does not need another architecture pass first

### Phase 1: Base AI Pack Source

Goal:

1. create one canonical scaffold-owned AI/dev pack source

Tasks:

1. add `packages/create-airjam/template-assets/base/`
2. add canonical root files:
   1. `AGENTS.md`
   2. `plan.md`
   3. `suggestions.md`
3. add `skills/` with the Phase 1 skill set:
   1. `plan-ledger`
   2. `airjam-docs-workflow`
   3. `game-architecture`
   4. `game-state-and-rendering`
   5. `controller-ui`
   6. `debug-and-test`
4. add a pack manifest file shape for version/source metadata

Acceptance criteria:

1. all scaffold-owned AI/dev files exist in one canonical source location
2. the base pack can evolve without duplicating edits across templates

### Phase 2: Local Docs Export From `content/docs/`

Goal:

1. generate the local template docs pack from the canonical public docs source

Tasks:

1. define the first curated local docs subset
2. implement an export/build step that copies or transforms the selected docs into template-local files
3. ensure exported docs remain concise and operational
4. preserve source traceability back to `content/docs/`
5. avoid manually maintaining duplicated docs text where possible

The initial local docs subset should cover:

1. framework paradigm
2. development loop
3. game structure guidance
4. controller UI guidance
5. host UI guidance
6. state/store guidance
7. prefab guidance
8. debug/logging guidance
9. testing guidance

Acceptance criteria:

1. local scaffold docs come from a reproducible pipeline
2. the local docs pack is small enough to stay maintainable
3. docs drift is reduced because source ownership is explicit

### Phase 3: Scaffold Overlay Integration

Goal:

1. make every new scaffold include the AI/dev pack automatically

Tasks:

1. update `create-airjam` so template copy and base-pack copy are separate explicit steps
2. overlay `template-assets/base/` onto the generated project
3. write the AI pack manifest into the generated project
4. ensure template-specific files can still override base files intentionally when needed
5. keep scaffold behavior deterministic for workspace, tarball, and published package flows

Acceptance criteria:

1. every new project contains the same baseline AI/dev pack
2. the pack is version-aligned with the installed `create-airjam`
3. scaffold remains fully usable without network access

### Phase 4: Project Discovery And Generic Agent Compatibility

Goal:

1. make the local pack easy for multiple LLM products to discover

Tasks:

1. ensure root `AGENTS.md` points clearly to:
   1. `plan.md`
   2. `suggestions.md`
   3. `skills/`
   4. `docs/docs-index.md`
2. add a small `skills/index.md` or equivalent if helpful for generic agents that do not understand skill folders natively
3. keep the root contract short and authoritative
4. avoid depending on one vendor-specific skill loader as the only discovery path

Acceptance criteria:

1. generic agents can still find the local guidance without special runtime support
2. Codex-style skill tooling still works cleanly

### Phase 5: Hosted Manifest And Update Surface

Goal:

1. give older scaffolded projects a clean update path

Tasks:

1. define a hosted AI pack manifest format
2. publish versioned pack metadata to the platform
3. publish a stable file/artifact surface for pack retrieval
4. define compatibility rules between scaffold version and pack version
5. decide update channels such as stable/canary if needed

The manifest should eventually include fields such as:

1. AI pack version
2. template version
3. SDK compatibility
4. file manifest
5. checksums
6. source URLs
7. release date

Acceptance criteria:

1. older repos can inspect whether their local pack is outdated
2. pack upgrades can be intentional instead of ad hoc copy-paste

Current status:

1. implemented:
   1. hosted root manifest at `/ai-pack/manifest.json`
   2. hosted channel manifest at `/ai-pack/stable/manifest.json`
   3. hosted version manifest and file surface under `/ai-pack/stable/<packVersion>/...`
   4. deterministic hosted artifact generation and freshness checking
2. still remaining:
   1. richer compatibility rules beyond the current package/version metadata
   2. multi-version retention beyond the single current stable pack
   3. consumer logic that actually uses the hosted manifest for status/diff/update flows

### Phase 6: Update CLI

Goal:

1. make pack maintenance practical for real users over time

Tasks:

1. define commands such as:
   1. `airjam ai-pack status`
   2. `airjam ai-pack diff`
   3. `airjam ai-pack update`
   4. `airjam docs search`
   5. `airjam docs sync`
2. make update behavior explicit, never silent
3. preserve local modifications where possible or at least surface conflicts clearly
4. ensure the CLI can explain what changed before applying updates

Acceptance criteria:

1. existing projects have a realistic path to adopt newer guidance
2. updates are visible and controlled
3. local customization is not casually destroyed

Current status:

1. implemented:
   1. `create-airjam ai-pack status`
   2. `create-airjam ai-pack diff`
   3. `create-airjam ai-pack update`
   4. local vs hosted file-level comparison against the latest published pack
   5. explicit overwrite-only replacement of managed AI pack files
2. still remaining:
   1. richer conflict policy for locally modified older packs
   2. clearer user-facing guidance for when to overwrite vs preserve drift
   3. optional preview/dry-run UX if it proves necessary

### Phase 7: Validation And Release Hardening

Goal:

1. treat the AI/dev pack as a real product surface, not a sidecar afterthought

Tasks:

1. add scaffold smoke coverage for the base AI/dev pack
2. verify the generated project contains the expected local files
3. verify local docs export remains reproducible
4. verify package publishing includes the required base assets
5. verify scaffold output works in workspace, tarball, and registry paths

Acceptance criteria:

1. the AI/dev pack is release-validated, not manually assumed
2. scaffolds do not regress silently

Current status:

1. implemented:
   1. scaffold smoke coverage for generated AI/dev files
   2. tarball/workspace validation through `smoke-test.mjs`
   3. `ai-pack:check` for AI pack completeness and generated docs freshness
2. still worth adding later:
   1. stronger registry-path validation in release automation
   2. broader manifest/schema validation once hosted manifests exist

## Recommended Build Order

The recommended order is:

1. Phase 1: base AI pack source
2. Phase 2: local docs export
3. Phase 3: scaffold overlay integration
4. Phase 4: generic agent discovery
5. Phase 7: validation hardening
6. Phase 5: hosted manifest
7. Phase 6: update CLI

This order preserves the most important constraint first:

New projects must be fully usable immediately, even before the update system exists.

## Open Design Constraints

These constraints should guide implementation choices:

1. local-first usability matters more than clever remote retrieval
2. the same guidance should not be hand-maintained in multiple places
3. skill files should stay small and operational
4. docs exports should be curated, not a dump of the whole docs site
5. update surfaces must be explicit and trustworthy
6. vendor-specific features should not become the only discovery path

## Success Condition

This plan is complete when:

1. every new Air Jam scaffold contains a clean local AI/dev pack
2. that pack is authored from explicit canonical sources
3. projects remain fully usable even with no network access
4. old projects have a future path to inspect and adopt newer pack versions
5. the system stays simple enough that maintainers can actually keep it current
