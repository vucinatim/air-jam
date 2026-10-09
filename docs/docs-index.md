# Air Jam Framework Docs Index

Last updated: 2026-10-09
Status: public framework navigation

This repository owns the open SDK, runtime, standalone server, creator tools,
reference games and creator documentation. Product plans, Studio, Arcade,
accounts, deployment operations and historical whole-product audits belong to
the private product repository.

## Read first

1. [Repository overview](../README.md)
2. [Current state](./current-state.md)
3. [Working agreements](./working-agreements.md)
4. [Documentation taxonomy](./documentation-taxonomy.md)
5. The contract or guide for the subsystem being changed

The [work ledger](./work-ledger.md) records framework milestones rather than
acting as another task tracker.

## Direction and implemented capabilities

- [Framework vision](./vision.md)
- [Framework paradigm](./framework-paradigm.md)
- [Capability inventory](./capability-inventory.md)
- [Discoverability vision](./discoverability-vision.md)
- [Agent tooling architecture](./architecture/agent-tooling-architecture.md)
- [Repository memory model](./monorepo-operating-system.md)
- [Durable framework follow-ups](./suggestions.md)

## Runtime and authoring contracts

- [Runtime topology](./contracts/runtime-topology-contract.md)
- [Environment contracts](./contracts/environment-contracts.md)
- [Semantic agent sessions](./contracts/agent-session-contract.md)
- [Runtime inspection](./contracts/runtime-inspection-contract.md)
- [Embedded surface protocol](./contracts/arcade-surface-contract.md)
- [Game shell composition](./contracts/composition-shell-contract.md)
- [Game metadata](./contracts/game-metadata-contract.md)
- [AI pack manifest](./contracts/ai-pack-manifest-contract.md)

The embedded protocol retains its existing Arcade names. That protocol is
public; the first-party Arcade implementation is not required to run a game.

## Creator and contributor guides

- [Local development](./guides/local-development-guide.md)
- [Standalone server composition](./guides/server-composition-guide.md)
- [Agent development](./guides/agent-development-guide.md)
- [AI pack workflow](./guides/ai-pack-workflow-guide.md)
- [Hosted publishing client](./guides/hosted-release-guide.md)
- [Legacy game migration](./guides/legacy-game-migration-guide.md)

Creator pages have one authored source in `content/docs/`, ordered by
`content/docs/catalog.json`. The CLI packages that source for agent guidance and
website consumption. Discover it with `airjam docs list --json`; the managed
website renders the package snapshot without owning a second documentation tree.

## Package delivery

- [Public package support](./contracts/public-package-support-contract.md)
- [Release trust](./contracts/public-package-release-trust-contract.md)
- `pnpm --silent run repo -- pack verify-local --json` for exact local archives
- `pnpm --silent run repo -- release install-matrix spec --json` for the
  supported clean-install matrix

The local separation candidate is not published or production-qualified.
Production source handover is governed by the private product's separation
plan; public ownership removal must not trigger an old product deployment.
