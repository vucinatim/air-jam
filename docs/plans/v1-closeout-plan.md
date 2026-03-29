# Air Jam V1 Closeout Plan

Last updated: 2026-03-29
Status: active

Related docs:

1. [Release Prep Plan](./release-prep-plan.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Legacy Game Migration Guide](../systems/legacy-game-migration-guide.md)
4. [Monorepo Operating System](../monorepo-operating-system.md)
5. [Release Article Outline](../content/v1-release-article-outline.md)
6. [Docs Index](../docs-index.md)

## Purpose

This document captures the full closeout path from the current prerelease state to a public Air Jam v1 release.

The goal is not to reopen architecture.

The goal is:

1. finish the last product-proof work
2. tighten the release experience for developers
3. validate the framework on real migrated games
4. publish a credible first public version
5. support the release with clear docs, content, and launch distribution

## Current Position

Air Jam is close to release.

The architecture baseline is in place, analytics now has a proper hosted foundation, and the remaining work is mostly closeout, proof, presentation, and launch execution.

That said, the release should still be driven by the technical proof path first.

The highest-value release proof is:

1. easy local dev commands
2. one or two representative games working cleanly
3. a clear migration path from old architecture to new architecture
4. local tarball validation
5. a release PR and package publish that reflect a stable system

Current proof update:

1. the three legacy ZeroDays games are already on the current Air Jam bootstrap shape
2. the migration proof is now captured by the guide plus tarball validation, not by a future in-place rewrite

This proof matters more than polish alone.

## Closeout Principles

### 1. Keep The Critical Path Real

Do not let landing-page polish, blog writing, or launch distribution delay the technical release proof.

### 2. Prove The Framework On Real Games

The release should be justified by migrated games running on the new architecture, not only by the scaffold and prototype apps.

### 3. Optimize Developer Experience Before Marketing

Before asking new developers to try Air Jam, make the local workflow and package experience simple and reliable.

### 4. Treat Content As Launch Support, Not Product Proof

Docs, articles, thumbnails, and visibility work are important, but they should amplify a release that already works cleanly.

## Execution Order

Air Jam should close out v1 in this order:

1. finish local dev ergonomics and final runtime validation
2. tighten core docs and landing-page presentation
3. validate migration path on real legacy games
4. run tarball-based package validation
5. publish the v1 release PR and packages
6. publish the games and release content
7. execute the visibility and launch-distribution plan

## Phase 1. Dev Experience And Runtime Readiness

### Goal

Make local development and day-to-day validation frictionless before the final release push.

### Required outcomes

1. add easy top-level dev commands for the common local flows
2. support a simple switch between the prototype game and `pong`
3. make sure `pong` feels good and behaves as a credible example game
4. keep the command surface simple rather than endlessly configurable

### Recommended direction

The default `pnpm dev` flow should run the platform, server, and one reference game together.

The first useful variant is a simple game selector such as a `--pong` or equivalent explicit command, not a large matrix of flags.

### Success criteria

This phase is complete when:

1. a maintainer can boot the standard local stack with one obvious command
2. switching the reference game is simple and documented
3. `pong` is stable enough to serve as a release-era reference app

## Phase 2. Docs Content And Landing Page Tightening

### Goal

Improve first-contact clarity without blocking the technical release path.

### Required outcomes

1. improve the docs content where the product story is still too thin or too rough
2. improve the landing page so the project looks intentional and ready
3. keep the changes focused on clarity, not on expanding product scope

### Rule

This phase should run in parallel with later technical work when practical.

It should not delay migration validation or release packaging.

## Phase 3. Migration Guide And Legacy Game Validation

### Goal

Prove that Air Jam v1 is a real upgrade path, not just a new clean architecture for new projects only.

### Required outcomes

1. write a migration document by comparing three legacy games against the new `air-capture` and `pong`
2. identify the minimal migration recipe that converts an old game to the current architecture
3. validate the three migrated games against local packaged dependencies

### Current status

Status:

1. completed baseline

Completed:

1. [Legacy Game Migration Guide](../systems/legacy-game-migration-guide.md) now captures the reusable migration recipe
2. `code-review`, `last-band-standing`, and `the-office` already match the current bootstrap and route shape
3. `pnpm test:legacy:tarball` validates all three games against local SDK/server tarballs

### Why this phase matters

This is one of the strongest release proofs available.

If older real games can be moved cleanly, Air Jam v1 becomes much easier to trust.

### Success criteria

This phase is complete when:

1. the migration guide is concrete and reusable
2. the three target games are on the current architecture
3. the migrated games run successfully against local packaged dependencies

## Phase 4. Tarball Validation

### Goal

Validate the actual package-consumer experience before the public publish.

### Required outcomes

1. test the scaffold and migrated games against local tarballs
2. confirm that the package surface works outside the monorepo source graph
3. catch packaging, missing-file, or export mistakes before npm publish

### Rule

This is a hard release gate.

The v1 release should not ship before local tarball validation passes on the migrated games and reference apps.

## Phase 5. Release PR And Package Publish

### Goal

Turn the validated codebase into a deliberate v1 release.

### Required outcomes

1. prepare the v1 release PR
2. finalize package versions and release notes
3. publish the packages
4. verify that the published package set matches the intended release surface

### Rule

This phase should happen only after the migration and tarball proof is complete.

## Phase 6. Platform Publishing And Release Assets

### Goal

Make the platform and release presentation feel complete and real.

### Required outcomes

1. publish the three migrated games on the platform
2. publish `air-capture` and `pong` properly on the platform
3. record gameplay where needed
4. set thumbnails, preview videos, and related assets

### Why this matters

This makes the release visible as a living platform, not only as packages and docs.

## Phase 7. Release Content

### Goal

Support the v1 launch with clear written context.

### Required outcomes

1. write the proper v1 release article in `docs/content`
2. rewrite the older ZeroDays article about building three games with alpha Air Jam
3. make the story legible both for new users and for people who followed the early work

## Phase 8. Visibility And Distribution

### Goal

Give the release a real chance to be discovered.

### Required outcomes

1. create a simple marketing and visibility plan for the open-source free project
2. improve how the project is discoverable by search engines
3. improve how the project is legible and useful to LLM-based discovery and recommendation
4. post the launch material to Hacker News, dev.to, relevant subreddits, Discord communities, and LinkedIn through ZeroDays
5. ask close supporters and friends for early GitHub stars and signal

### Rule

This phase should amplify a release that is already technically solid.

It should not be used to compensate for unclear docs, weak onboarding, or unproven package flows.

## Critical Path

The release-critical path is:

1. top-level dev commands
2. `pong` quality pass
3. migration guide
4. local tarball validation for the three old games
6. release PR
7. package publish

If this path is solid, the release is real.

The landing page, blog content, assets, and launch distribution are important, but they are not the core release proof.

## Parallel Work

Good parallel work during this closeout:

1. docs content tightening
2. landing-page improvement
3. release article drafting
4. gameplay capture planning
5. launch-channel planning

These should help the release, not become blockers for the technical proof path.

## Release Gate

Air Jam should consider v1 ready to publish when all of the following are true:

1. the local dev workflow is simple and documented
2. `air-capture` and `pong` both work cleanly
3. the three old games are migrated and validated
4. local tarball testing passes
5. package publish targets are verified
6. release notes and release article are prepared
7. the launch asset set is good enough to show the platform credibly

## Closeout Rule

This plan should remain the active v1 tracker until the public release is out.

After the release:

1. archive this document
2. move leftover non-release-critical follow-ups into `docs/suggestions.md`
3. start a fresh post-v1 roadmap instead of stretching this plan forward indefinitely
