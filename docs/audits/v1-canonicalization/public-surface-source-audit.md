# Air Jam Public Surface And Source-Of-Truth Audit

Last updated: 2026-08-28
Status: complete for `G1-02`
Readiness owner: `G1-02`

Related evidence:

1. [Canonicalization audit](./v1-canonicalization-audit.md)
2. [Tooling and public contracts audit](./tooling-contracts-audit.md)
3. [Runtime and framework audit](./runtime-framework-audit.md)
4. [Decision register](./decision-register.md)
5. [Canonicalization execution set](./canonicalization-execution-set.md)
6. [Gate 1 removal approval packet](./gate-1-removal-approval-packet.md)

## Objective

Freeze an evidence-backed inventory of the package graph, public exports,
configuration owners, generated artifacts, and documentation chain before Air
Jam makes its 1.0 compatibility cuts.

This audit does not create another tracker. Existing `CAN-*` findings and
readiness items remain the implementation authority.

## Current Snapshot

The inspected worktree currently contains:

1. 18 pnpm workspaces including the root
2. 4 published packages, all at version `0.9.2`
3. 6 private package workspaces, including a local `@air-jam/bot-lab` that is
   unintentionally selected by the broad workspace glob
4. 1 private platform application and 6 private first-party games
5. 6 game sources opted into scaffolding
6. 5 present scaffold archives because `air-capture.zip` is missing
7. 13 generated AI-pack documentation snapshots, 3 of which are stale
8. 1 downstream hosted AI-pack check that reports fresh even while its upstream
   base-pack documentation check fails

The package and export assertions pass. The complete generated-artifact chain
does not currently pass.

## Published Package Inventory

`scripts/release/public-packages.mjs` is the current release selection
authority. It selects exactly these packages and requires one unified public
version.

| Package               | Current public surface                                                    | Intended 1.0 responsibility                                          | Audit result                                                                     |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `@air-jam/sdk`        | stable root plus 19 subpaths, including CSS                               | creator framework, explicit advanced leaves, shared public contracts | contract is too broad; apply `CAN-003`, `CAN-004`, `CAN-005`, and `CAN-012`      |
| `@air-jam/server`     | `air-jam-server` binary, untyped root, Vite-config leaf                   | realtime server runtime and server diagnostics only                  | root and project-tooling leaf are accidental; apply `CAN-008` and `CAN-200`      |
| `@air-jam/mcp-server` | `airjam-mcp` binary, root, config leaf                                    | portable public MCP adapter over shared application services         | packaging and exported tool contract need `CAN-202`, `CAN-205`, and `CAN-207`    |
| `create-airjam`       | `create-airjam` and `airjam` binaries, templates, runtime copies, AI pack | one-shot project bootstrap only                                      | ongoing CLI and copied runtime ownership must move under `CAN-006` and `CAN-200` |

The release-manifest rewrite correctly converts public workspace dependencies
to registry versions and removes private workspace dependencies. A temporary
manifest proof produced:

1. `@air-jam/server -> @air-jam/sdk@0.9.2`
2. `create-airjam -> @air-jam/sdk@^0.9.2`
3. `create-airjam -> @air-jam/mcp-server@^0.9.2`
4. no published dependency on private `@air-jam/devtools-core`, `@air-jam/env`,
   or `@air-jam/harness`

That rewrite does not close the MCP runtime defect: bundled devtools code still
resolves `tsx` at runtime while the published MCP production dependency set
does not contain it (`CAN-202`).

## SDK Export Decision Inventory

The current SDK export map contains 20 keys. The retained contract should be
classified before implementation rather than inheriting stability from the
current manifest.

| Export group                                                         | Decision direction                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `.` and `./ui`                                                       | retain as the ordinary creator surface after removing leaked runtime composition/inspection symbols            |
| `./protocol`, `./metadata`, `./prefabs`, `./preview`, `./styles.css` | retain and prove from a packed consumer                                                                        |
| `./arcade/*`                                                         | retain as an explicit advanced/platform integration family; do not teach it as a second ordinary creator model |
| `./runtime-topology`                                                 | retain as the sole topology authority and delete the private duplicate package                                 |
| `./runtime-inspection`                                               | add as an explicit experimental machine-inspection leaf and remove its symbols from the stable root            |
| raw host/controller runtimes                                         | move from the stable root to an explicit Arcade/platform composition leaf                                      |
| `./capabilities`                                                     | delete; the executable game-owned agent contract is authoritative                                              |
| `./release`, `./platform-machine`, `./agent-tooling`                 | retain only after intentional public-versus-internal classification and packed-consumer proof                  |

The existing export test passes, but it proves only selected positive and
negative examples. It currently asserts that `./runtime-inspection` is absent
while missing that the same symbols leak through the root. Gate 1 must replace
example-based assertions with an exact approved export snapshot.

## Configuration Authority Matrix

| Configuration                          | Intended authority                                    | Current drift                                                                                | Gate 1 action                                                     |
| -------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| game composition and semantic contract | each game `src/airjam.config.ts`                      | no competing game-level authority found                                                      | retain; add semantic conformance proof                            |
| runtime topology                       | `@air-jam/sdk/runtime-topology`                       | private topology package plus two copied project-runtime modules                             | delete duplicate package and converge project-runtime ownership   |
| project environment validation         | one installed project-tooling owner                   | three byte-identical files share the same SHA-256                                            | retain one implementation; delete copies                          |
| realtime server environment            | `packages/server/src/env/server-env.ts`               | bounded server-specific schema is valid; some direct reads remain outside it                 | keep server boundary explicit and remove legacy aliases/fallbacks |
| platform deployment identity           | `apps/platform/src/lib/platform-deployment-config.ts` | consumers largely converge correctly                                                         | retain as platform deployment authority                           |
| release provider environment           | `apps/platform/src/server/releases/release-env.ts`    | domain-specific and intentionally separate from general deployment identity                  | retain; expose operational inspection later through the repo CLI  |
| portable MCP declaration               | `@air-jam/mcp-server/config`                          | one `.mcp.json` shape is incorrectly treated as client installation                          | split portable declaration from Codex and Claude profiles         |
| maintainer environment/provider access | repo CLI domain commands                              | Railway already has a repo-owned surface; other production operations remain later-gate work | retain repo CLI as the private operator front door                |

The three environment-validation copies and two pairs of project-runtime files
were confirmed byte-identical. They are source duplication, not merely similar
behavior.

## Generated Artifact Authority Matrix

| Authored source                                          | Derived artifact                              | Canonical producer/check                          | Current result                                                                                |
| -------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| opted-in `games/*` workspaces and `airjam-template.json` | scaffold ZIPs and scaffold manifest           | `create-airjam` scaffold source generator/checker | **fail:** `air-capture.zip` missing                                                           |
| public package and template manifests                    | template version manifest                     | `generate-template-version-manifest.mjs`          | source chain exists; included in build                                                        |
| `content/docs`                                           | platform docs registry                        | repo `content docs` generator/check               | pass                                                                                          |
| selected `content/docs` MDX files                        | 13 base-pack Markdown snapshots               | `generate-base-docs-pack.mjs` and `ai-pack:check` | **fail:** `for-agents`, `introduction`, and `quick-start` stale                               |
| base AI pack plus version manifests                      | hosted files and AI-pack manifests            | repo `platform ai-pack` generator/check           | pass against the stale base pack                                                              |
| `content/blog`                                           | platform blog registry and configured exports | repo `content blog` commands                      | generated blog source is modified in the mixed worktree; preserve during baseline preparation |
| package manifests and workspace package versions         | publish-time manifests                        | public package prepack/postpack scripts           | temporary rewrite proof passes                                                                |

## CAN-301 — Hosted generated-artifact validation can report fresh from a stale upstream base pack

- Category: canonicality
- Complexity: contract-drift
- Severity: high
- Release classification: blocks-1.0
- Confidence: high
- Evidence: `pnpm --silent run repo -- platform generated check` and
  `platform ai-pack check` both pass; `pnpm --filter create-airjam
ai-pack:check` fails because `docs/generated/for-agents.md`,
  `introduction.md`, and `quick-start.md` do not match `content/docs`;
  `scripts/platform/lib/platform-generated-prepare.mjs` regenerates platform
  docs/blog registries and copies the current base pack into hosted artifacts
  without first generating or checking base-pack documentation.
- Current behavior: downstream hosted artifacts can exactly match an already
  stale intermediate source. The platform checker reports the hosted copy as
  fresh even though the manifest itself names `content/docs` as the canonical
  documentation source.
- Architectural harm: CI or deployment can publish internally consistent but
  outdated agent guidance. A green downstream check is not transitive proof of
  the authored-to-hosted chain.
- Canonical end state: one composite generated-artifact command validates or
  prepares the complete dependency order: authored docs -> base pack -> hosted
  pack. Every downstream freshness claim includes upstream freshness.
- Change: make base-doc generation/checking an explicit prerequisite of
  platform hosted-pack prepare/check; keep the individual leaf commands for
  focused diagnostics; add a regression test that deliberately stales an
  upstream doc and requires the composite check to fail.
- Dependencies and blast radius: `create-airjam` AI-pack scripts, platform
  generated preparation, root CI, platform build/deploy preparation, hosted
  pack manifests, and documentation authoring workflow.
- Validation: mutate one canonical MDX input in a temporary fixture and prove
  the composite check fails before regeneration, then prepare and prove all
  three layers match byte-for-byte and by manifest hash.

`CAN-301` fits the existing `G1-05` canonicalization implementation and does
not require another readiness item.

## Documentation Ownership Result

The repository documentation taxonomy is sound. The generated-project agent
pack is not yet sound enough for 1.0 ownership:

1. root project instructions, client notes, local docs, generated public docs,
   and skills repeat the same normal-loop rules
2. the required MCP skill lacks standard frontmatter
3. pack updates claim replacement ownership over user-editable files
4. downstream hosted validation does not prove upstream generated docs are
   fresh

The canonical target remains:

1. a short user-owned project contract and router
2. one managed normal Air Jam development loop
3. versioned managed references in an Air Jam-owned namespace
4. user-owned custom instructions and skills outside that namespace
5. client-specific profiles containing only real installation/discovery deltas
6. one transitive authored-to-hosted freshness check

## Current Check Evidence

Passed:

1. canonical repository guard
2. platform docs content freshness
3. hosted platform AI-pack freshness relative to the current base pack
4. SDK export-surface behavior test: 5 tests
5. repo contracts: 16 tests
6. release-manifest rewrite in isolated temporary package directories

Failed and deliberately not repaired during the audit:

1. base AI-pack freshness: 3 stale generated docs
2. scaffold source freshness: missing `air-capture.zip`

The failures are retained as evidence because the current worktree contains
mixed user and program changes. Regenerating before separating the baseline
would obscure ownership and produce misleading Git cleanup numbers.

## G1-02 Conclusion

The public and generated surfaces are now fully classified for the Gate 1
decision. No additional open-ended audit is needed.

The next checkpoint is the single
[Gate 1 removal approval packet](./gate-1-removal-approval-packet.md). After
approval, prepare the clean committed baseline, execute the canonicalization
bundles, and repair the two failing artifact chains inside the relevant bundle
rather than as untracked pre-work.
