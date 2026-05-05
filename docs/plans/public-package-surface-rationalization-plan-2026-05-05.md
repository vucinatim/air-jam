# Public Package Surface Rationalization Plan

Last updated: 2026-05-05  
Status: completed  
Owner: packaging / architecture / release

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Docs Index](../docs-index.md)
3. [NPM Public Release And Automation Plan](./npm-public-release-and-automation-plan-2026-05-03.md)
4. [Monorepo Operating System](../monorepo-operating-system.md)
5. [Framework Paradigm](../framework-paradigm.md)

## Purpose

This plan narrows the public npm surface of Air Jam to the product-shaped packages we actually want to support long term:

1. `@air-jam/sdk`
2. `@air-jam/server`
3. `@air-jam/mcp-server`
4. `create-airjam`

It also defines the cleanup path for packages that should no longer be treated as public products:

1. `@air-jam/harness`
2. `@air-jam/devtools-core`
3. `@air-jam/env`
4. `@air-jam/runtime-topology`

The goal is not only to fix this release. The goal is to make the package graph match the product story so future releases, docs, and consumer installs stay simple.

## Final Package Contract

### Public supported packages

These are the only packages we should publish, document, version as public products, and keep stable as external install surfaces:

1. `@air-jam/sdk`
2. `@air-jam/server`
3. `@air-jam/mcp-server`
4. `create-airjam`

### Private internal packages

These should remain shared inside the monorepo but stop existing as public npm products:

1. `@air-jam/harness`
2. `@air-jam/devtools-core`
3. `@air-jam/env`
4. `@air-jam/runtime-topology`
5. `@air-jam/release-browser-worker`

### Rule

Public packages must be things users intentionally choose.

Private packages can be shared freely inside the monorepo, but they must not remain published runtime dependencies of public packages.

That rule is the whole plan.

## Implementation Outcome

The repo now matches the intended product contract:

1. `scripts/release/public-packages.mjs` only publishes `@air-jam/sdk`, `@air-jam/server`, `@air-jam/mcp-server`, and `create-airjam`
2. `@air-jam/harness`, `@air-jam/devtools-core`, `@air-jam/env`, and `@air-jam/runtime-topology` are private workspace packages
3. scaffolded projects no longer depend on `create-airjam` after creation
4. generated project scripts now use `air-jam-server` and `airjam-mcp` as the long-lived runtime CLI surfaces
5. scaffolded Vite configs now resolve through `@air-jam/server/vite-config`
6. public tarballs sanitize internal `workspace:` references during pack/publish and restore the source manifest afterward
7. full tarball scaffold smoke passed against all packaged templates with only the four intended public packages installed
8. `@air-jam/env@0.9.0` and `@air-jam/runtime-topology@0.9.0` are now deprecated on npm with guidance toward the supported four-package public surface

## Architectural Decision

We should keep the internal modules as private workspace packages first, not immediately flatten them into random source folders.

Why:

1. `harness` and `devtools-core` already express real internal boundaries
2. private workspace packages are a clean monorepo pattern
3. collapsing them into public package internals right now would create churn without solving a real problem

So the intended architecture is:

1. keep internal packages shared inside the repo
2. mark them private
3. bundle or internalize their runtime code into the public packages that ship to npm
4. publish only product-shaped packages

## Product Boundary Decisions

### `@air-jam/harness`

Decision:

1. keep as a private workspace package
2. treat it as internal test/dev/automation infrastructure
3. never publish it as part of the supported npm surface

### `@air-jam/devtools-core`

Decision:

1. keep as a private workspace package
2. treat it as shared implementation for repo CLIs, MCP tooling, and scaffold support
3. never document it as a user-facing install target

### `@air-jam/env`

Decision:

1. stop treating it as a public low-level utility package
2. keep the code internal to the repo
3. remove it from the published dependency graph over time

Reason:

1. it is an implementation helper, not part of the product story
2. users should not need to learn a standalone Air Jam env package to use Air Jam

### `@air-jam/runtime-topology`

Decision:

1. stop treating it as a public low-level utility package
2. keep the code internal to the repo
3. remove it from the published dependency graph over time

Reason:

1. it is a framework implementation detail right now
2. publishing it creates conceptual surface area without a clear user need

## Implementation Strategy

We should do this in three passes, in this order.

### Pass 1. Freeze the product contract

Goal:

1. make the intended public surface explicit in docs and release config

Changes:

1. update `scripts/release/public-packages.mjs` so only the four supported public packages remain
2. update release docs and README/package docs so they no longer advertise internal packages
3. update any repo automation that assumes every workspace package is publishable

Acceptance:

1. the release manifest is product-shaped
2. docs never imply that `harness`, `devtools-core`, `env`, or `runtime-topology` are public products

### Pass 2. Remove private packages from published runtime dependency graphs

Goal:

1. public packages install cleanly from npm without requiring any private workspace package names

Required rule:

1. no published `dependencies` entry in a public package may point at a private Air Jam workspace package

Concrete package work:

1. `@air-jam/server`
   1. remove published runtime dependency on `@air-jam/harness`
   2. remove published runtime dependency on `@air-jam/env`
   3. either bundle the needed code into `dist` or move the needed code into an internal source seam owned by `server`
2. `@air-jam/mcp-server`
   1. remove published runtime dependency on `@air-jam/devtools-core`
   2. bundle the needed code into `dist` or move it behind an internal source seam owned by `mcp-server`
3. `create-airjam`
   1. remove published runtime dependency on `@air-jam/devtools-core`
   2. remove published runtime dependency on `@air-jam/env`
   3. remove published runtime dependency on `@air-jam/runtime-topology`
   4. decide whether `@air-jam/mcp-server` should stay a real runtime dependency or whether the scaffold CLI should ship its own internal MCP support bundle
4. `@air-jam/sdk`
   1. remove published runtime dependency on `@air-jam/runtime-topology`
   2. either inline the tiny topology helper seam into `sdk` or bundle it without leaving a public dependency reference

Decision guidance:

1. if a private module is tiny and only used by one public package, move it into that package
2. if it is genuinely shared by multiple public packages, keep it as a private workspace package and bundle it at publish time

### Pass 3. Make the internal packages truly private

Goal:

1. preserve clean internal reuse while preventing future accidental publication drift

Changes:

1. set `"private": true` in the package manifests for:
   1. `packages/harness`
   2. `packages/devtools-core`
   3. `packages/env`
   4. `packages/runtime-topology`
2. remove public `publishConfig` expectations from those packages
3. update smoke/build/release scripts that currently assume tarball or registry treatment for those package names
4. keep local workspace import paths working for repo development and tests

Acceptance:

1. repo builds still work
2. public package tarballs and npm installs do not require private package names
3. private packages cannot accidentally be selected by the release workflow

## Bundling Policy

This change should not rely on accidental bundler behavior.

We need one explicit policy:

1. public package build outputs must be standalone with respect to private Air Jam workspace code

That means:

1. verify `tsup` does not externalize private workspace imports
2. inspect built `dist` output for remaining `@air-jam/harness`, `@air-jam/devtools-core`, `@air-jam/env`, or `@air-jam/runtime-topology` references
3. fail prepublish if those references remain in published JS or `package.json`

If bundling becomes awkward for a given package, the fallback is not to republish the private dependency.
The fallback is to move the needed code into the owning public package.

## External Install Proof

Internal monorepo green checks are not enough.

The correct proof is outside the workspace.

We should add a release verification pass that:

1. packs each public package
2. installs it in a temp directory with no workspace context
3. runs the relevant CLI or entrypoint smoke

Minimum proof:

1. `npm pack` or local tarball install of `@air-jam/sdk`
2. tarball install and CLI boot smoke for `@air-jam/server`
3. tarball install and CLI boot smoke for `@air-jam/mcp-server`
4. tarball install and scaffold smoke for `create-airjam`

The release is not structurally correct until this passes.

## Deprecation Policy For Already-Published Low-Level Packages

We should not try to unpublish `@air-jam/env` or `@air-jam/runtime-topology`.

That is the wrong tool here.

Why:

1. npm unpublish is restrictive
2. unpublish creates avoidable ecosystem churn
3. those package names and versions are already part of the registry history

The correct path is:

1. stop depending on them in the supported public graph
2. stop releasing new versions for them
3. deprecate the already-published versions with a direct message

### Deprecation message shape

Recommended message:

```text
This package is no longer part of the supported public Air Jam surface. Use the supported products instead: @air-jam/sdk, @air-jam/server, @air-jam/mcp-server, and create-airjam.
```

### Deprecation commands

After the public graph no longer depends on them:

```bash
npm deprecate "@air-jam/env@*" "This package is no longer part of the supported public Air Jam surface. Use the supported products instead: @air-jam/sdk, @air-jam/server, @air-jam/mcp-server, and create-airjam."
```

```bash
npm deprecate "@air-jam/runtime-topology@*" "This package is no longer part of the supported public Air Jam surface. Use the supported products instead: @air-jam/sdk, @air-jam/server, @air-jam/mcp-server, and create-airjam."
```

Optional stricter message if we want to name the last supported line:

```text
Deprecated as of the 0.9.0 packaging reset. This package is no longer a supported public Air Jam product. Use @air-jam/sdk, @air-jam/server, @air-jam/mcp-server, or create-airjam instead.
```

## Release Sequencing

This should happen before we finish the supported `0.9.0` public release line.

Recommended sequence:

1. land the package-surface refactor
2. prove tarball installs for the four public packages
3. update the public release manifest
4. deprecate `@air-jam/env` and `@air-jam/runtime-topology`
5. rerun the public publish workflow for the four-package surface only

We should not publish more internal packages just to get this release out the door.

That would solve the immediate release error but harden the wrong public contract.

## Detailed Work Breakdown

### Workstream 1. Release manifest and docs contract

1. shrink `scripts/release/public-packages.mjs` to the four supported packages
2. update release docs to use the final supported public package set
3. remove stale references that imply `env`, `runtime-topology`, `harness`, or `devtools-core` are public install targets

### Workstream 2. `sdk` dependency cleanup

1. audit why `sdk` depends on `runtime-topology`
2. decide whether that seam belongs directly inside `sdk`
3. remove the published dependency edge
4. verify published `sdk` artifacts stay clean

### Workstream 3. `server` dependency cleanup

1. audit exact `harness` and `env` imports used by `server`
2. separate true runtime code from dev/test-only helpers
3. move tiny server-owned pieces local if that is simpler
4. bundle the remaining shared internal code if it is still used
5. verify the published `server` package no longer declares private Air Jam dependencies

### Workstream 4. `mcp-server` and `create-airjam` cleanup

1. audit what `devtools-core` actually provides to each package
2. decide whether any pieces should move directly into `mcp-server` or `create-airjam`
3. keep only the shared remainder in a private workspace package
4. remove `env` and `runtime-topology` from `create-airjam`'s published runtime dependency graph where possible
5. verify scaffold and MCP flows from tarball installs

### Workstream 5. Private package conversion

1. mark internal packages `private: true`
2. strip them out of public release logic
3. update any local smoke scripts or scaffold helpers that still expect registry treatment

### Workstream 6. Deprecation and release recovery

1. deprecate the published `env` and `runtime-topology` packages after the graph no longer depends on them
2. rerun the supported public release lane with only the four intended public packages
3. verify npm package pages, CLI install paths, and docs all tell the same story

## Acceptance Criteria

This plan is complete only when all of these are true:

1. only `@air-jam/sdk`, `@air-jam/server`, `@air-jam/mcp-server`, and `create-airjam` are in the public release manifest
2. `@air-jam/harness`, `@air-jam/devtools-core`, `@air-jam/env`, and `@air-jam/runtime-topology` are private workspace packages
3. no published public package declares a private Air Jam package in `dependencies`
4. tarball installs of all four public packages work outside the monorepo
5. `@air-jam/env` and `@air-jam/runtime-topology` are deprecated on npm with clear messaging
6. docs, release automation, and npm pages all tell one coherent product story

## Explicit Non-Goals

This plan does not require:

1. collapsing every internal workspace package into one giant package
2. introducing changesets or a new versioning system
3. supporting the old low-level packages as stable compatibility contracts
4. hiding internal workspace structure from repo contributors

The point is not to remove internal modularity.
The point is to stop leaking internal modularity into the public npm contract.
