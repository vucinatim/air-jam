# Air Jam Release Prep Plan

Last updated: 2026-03-29
Status: active

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Monorepo Operating System](../monorepo-operating-system.md)
3. [Performance Baseline](../strategy/performance-baseline.md)
4. [Docs Index](../docs-index.md)

## Purpose

This document captures the current release-readiness review for Air Jam and turns it into one explicit execution checklist.

The goal is not to reopen architecture.

The goal is:

1. ship from the current paradigm safely
2. remove avoidable release risk
3. fix the few things that are cheaper now than after public adoption
4. keep the framework extensible without another reset

## Current Assessment

Air Jam is structurally in good shape for release.

The current positives are:

1. the framework paradigm is clear and coherent
2. SDK, server, platform, and scaffold boundaries are real
3. docs are unusually strong and aligned with implementation
4. scaffold verification is real, not theoretical
5. the canonical release gate passed locally with `pnpm check:release`

This means Air Jam does **not** need a paradigm shift before release.

The main risks now are:

1. release workflow correctness
2. publishing security and ergonomics
3. a few concentrated complexity hotspots
4. reference-app weight and devex polish

Recently completed:

1. package publishing now resolves the selected package set explicitly and publishes only those package jobs
2. CI now runs the same canonical `pnpm check:release` contract that release publishing depends on
3. release-visible platform browser console noise was removed from arcade/controller-facing runtime surfaces
4. one true browser-level Arcade happy-path smoke now runs inside `pnpm check:release`

## Must Fix Before Release

### 1. Fix publish workflow targeting

Status:

1. completed

Current risk:

1. package-specific release events can still trigger publishing of all packages
2. this makes package release automation harder to trust

Required outcome:

1. each publish job must publish only the package explicitly selected by tag or manual input
2. `all` should only publish all packages when that was intentionally requested

### 2. Make CI enforce the real release contract

Status:

1. completed

Current risk:

1. CI does not run the same contract as `pnpm check:release`
2. publish automation can succeed without the strongest gate having passed in CI

Required outcome:

1. CI must run the canonical release gate, or an equivalent split that covers the same checks
2. publish workflows must depend on the same release-grade validation path

### 3. Remove runtime debug logging from user-facing paths

Status:

1. completed

Current risk:

1. browser console noise leaks into release UX
2. some logs expose implementation/debug detail that should be dev-only

Required outcome:

1. remove stray `console.log` / `console.warn` from user-facing platform runtime paths
2. if any logging stays, gate it behind explicit dev diagnostics

## Strongly Recommended Now

### 4. Reduce air-capture physics payload cost

Current issue:

1. the reference game still ships a very large Rapier runtime chunk
2. this weakens first-impression performance and muddies what the framework itself costs

Recommended direction:

1. either reduce the runtime cost directly
2. or split the heavyweight demo path from the lean default reference path

This is the clearest feature/optimization worth doing now rather than later.

### 5. Add one browser-level end-to-end smoke path

Status:

1. completed baseline

Current gap:

1. resolved with one deterministic local Arcade happy-path smoke

Implemented scope:

1. host boots
2. controller joins the real room code from the host browser surface
3. team join and bot staging cross the iframe boundary
4. launch moves both host and controller into gameplay through the real Arcade path

Notes:

1. the smoke path uses a local `local-pong` Arcade reference fixture instead of depending on database-seeded public games
2. this is intentionally one happy-path proof, not a broad browser test suite

### 6. Start decomposing the largest files at obvious seams

This is not a rewrite request.

It is a pressure-relief pass on files that are already expensive to reason about:

1. `packages/server/src/gateway/handlers/register-host-lifecycle-handlers.ts`
2. `apps/platform/src/components/arcade/arcade-system.tsx`
3. `apps/platform/src/components/controller-menu-sheet.tsx`
4. `games/air-capture/src/routes/host-view.tsx`
5. `games/air-capture/src/game/bot-system/bot-controller.ts`

The rule should be:

1. extract only around real boundaries
2. avoid generic helper churn
3. prefer command/use-case modules over utility dumping

## Safe After Release

These matter, but they are not release blockers:

1. richer docs metadata and search indexing
2. bridge transport deduplication
3. stronger causal tracing across cross-surface hops
4. broader performance CI thresholds
5. deeper prototype/reference-app cleanup beyond the immediate bundle issue

## Recommended Publishing Model

## Decision

Air Jam should **not** move to fully manual local publishing as the primary model.

The best default is:

1. keep package publishing in GitHub Actions
2. switch npm publishing auth from long-lived npm tokens to **npm trusted publishing (OIDC)**
3. keep publishing **manually triggered**, not fully automatic on every merge

This gives the right balance:

1. no recurring token rotation burden
2. no local-machine-only release dependency
3. auditable releases from one canonical environment
4. less secret management risk
5. automatic provenance on public packages

## Why This Is The Right Model

### Manual local publishing is worse long-term

Problems:

1. release state depends on one maintainer machine
2. provenance and repeatability are weaker
3. it is easier to accidentally publish from a dirty checkout
4. the release process becomes harder to delegate later

Local publishing should remain a fallback, not the standard path.

### Token-based CI publishing is now high-friction

Problems:

1. write-capable npm tokens now expire quickly
2. rotation becomes recurring maintenance
3. storing publish secrets in CI is a worse security model than OIDC

### Trusted publishing is the clean lane

Why it fits Air Jam:

1. the repo already uses GitHub Actions
2. the publish workflow already requests `id-token: write`
3. Air Jam publishes public packages from a public repo
4. trusted publishing removes the exact pain you called out

## Recommended Release Flow

### Normal release flow

1. make version changes intentionally
2. run `pnpm check:release`
3. merge to `main`
4. trigger a manual GitHub Actions publish workflow for the intended package set
5. let GitHub Actions publish to npm using OIDC trusted publishing
6. create the matching Git tag/release as part of the release process

### Trigger policy

Recommended:

1. publishing should be `workflow_dispatch`
2. package target should be explicit: `sdk`, `server`, `create-airjam`, or `all`
3. the workflow should refuse ambiguous package selection

Avoid:

1. auto-publishing on every release object creation
2. auto-publishing on every tag push unless the tagging flow is fully locked down

### Local publishing policy

Keep local publish available only for:

1. emergency fallback
2. one-off recovery if GitHub Actions/OIDC is unavailable

It should not be the canonical day-to-day release path.

## Concrete Repo Follow-Up

### Release System

1. keep one canonical release trigger shape
2. document the release steps in a small maintainer-facing release doc
3. validate npm trusted publishing live and revoke old npm publish tokens after validation

### Product Quality

1. reduce air-capture physics payload or split heavyweight demo concerns away from the default reference path

### Complexity Control

1. split the largest runtime files only along clear ownership seams
2. avoid adding more feature logic into current hotspot files without extracting one boundary first

## Closeout Rule

This document should stay practical and short.

When these items are completed:

1. move remaining architectural follow-ups back to `docs/suggestions.md`
2. archive this plan if release prep is no longer an active concern
