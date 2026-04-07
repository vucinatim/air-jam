# Local Runtime Workflow Modes Plan

Last updated: 2026-04-06  
Status: archived completed baseline

Archived on 2026-04-07 after the explicit `standalone:dev`, `arcade:dev`, and `arcade:test` workflow surface landed.
Current release execution now lives in [Work Ledger](../work-ledger.md) and [V1 Release Launch Plan](../plans/v1-release-launch-plan.md).

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Monorepo Operating System](../monorepo-operating-system.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Arcade Surface Contract](../systems/arcade-surface-contract.md)
5. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)

## Purpose

Define the cleanest durable local runtime workflow model for Air Jam so game authors and maintainers can reason about:

1. standalone game development
2. live Arcade development with a repo game
3. built-bundle Arcade validation
4. HTTP versus HTTPS as a separate concern instead of a hidden workflow fork

This plan exists because the current repo can already do most of these things, but the command surface and mental model still blur three different axes together:

1. standalone versus Arcade
2. live dev server versus built local bundle
3. insecure local HTTP versus secure local HTTPS

The goal is not to add more modes. The goal is to name the existing modes honestly, tighten the contracts, and make each one easier to trust.

## Core Position

Air Jam should support three explicit local runtime modes.

Those modes should be:

1. standalone live game dev
2. Arcade integration with a live game
3. Arcade integration with a built game

Transport security should be a separate option, not a separate workflow family.

That means:

1. `http` versus `https` should not redefine what the mode is
2. the command name should tell you whether you are in standalone, live Arcade, or built Arcade
3. docs should describe which runtime surface is authoritative in each mode
4. logs and debugging expectations should stay consistent across all modes

## Non-Goals

This plan is not for:

1. replacing local trusted HTTPS with Cloudflare tunnel as the default path
2. inventing a single magic command that hides every mode behind flags and heuristics
3. rebuilding the platform, SDK, or local game runtime from scratch
4. forcing every current workflow to be production-identical
5. adding backward-compatibility layers for older confusing command names forever

## Desired End State

Air Jam should support this clear local matrix:

### 1. Standalone Game Dev

Purpose:

1. fastest game iteration
2. game-owned host/controller debugging
3. game-specific browser API work

Target contract:

1. run one game directly
2. host and controller both work
3. can run over HTTP or HTTPS
4. does not depend on the platform shell

### 2. Live Arcade Dev

Purpose:

1. test one repo game inside the real platform Arcade shell
2. keep live Vite iteration while validating host/controller/platform behavior
3. debug integration issues without switching to a built artifact

Target contract:

1. platform runs
2. selected game runs as a live dev server
3. Arcade embeds that live game surface
4. can run over HTTP or HTTPS

### 3. Built Arcade Validation

Purpose:

1. validate the publish-like built game inside the real platform Arcade shell
2. catch build-only, embed-only, and base-path issues before release
3. act as the prerelease confidence mode

Target contract:

1. platform runs
2. selected game is built first
3. platform serves the built artifact through the local build route
4. can run over HTTP or HTTPS

## Current Baseline

The repo already has most of the implementation pieces:

1. `pnpm dev -- --game=<id>` is hybrid workspace dev:
   SDK watch, server, platform, and the selected game's direct Vite dev server
2. `pnpm arcade:test -- --game=<id>` is built local Arcade validation:
   it builds the selected game and serves it through `/airjam-local-builds/<id>/`
3. `cd games/<id> && pnpm dev -- --secure` already supports standalone secure game dev
4. secure local Arcade already uses trusted local HTTPS via `mkcert` plus Next's `--experimental-https`
5. Cloudflare tunnel already exists as an explicit fallback mode for standalone secure game dev

What is still missing is a clean explicit live Arcade mode and a cleaner contract around what each existing command means.

## Architecture Direction

### 1. Treat Runtime Mode And Transport Mode Separately

These are different axes and should stay different:

1. runtime mode:
   standalone, live Arcade, built Arcade
2. transport mode:
   HTTP or HTTPS

The repo should not force people to reverse-engineer runtime mode from HTTPS flags.

### 2. Name Modes By What They Actually Do

Commands should describe the runtime surface they create.

The durable shape should be:

1. standalone live game dev
2. live Arcade dev
3. built Arcade validation

Avoid names that imply "just run the game" when the command actually starts the full workspace with the platform alongside it.

### 3. Keep Built Arcade Validation As A First-Class Release Gate

The built Arcade path should remain explicit and protected.

Why:

1. it catches build-only bundle failures
2. it catches embedded-route and base-path problems
3. it is the closest local proof to hosted release behavior

This should not be collapsed into live Vite Arcade dev.

### 4. Secure Local HTTPS Stays The Canonical Local Secure Path

Trusted local HTTPS is still the right default.

Reasons:

1. it keeps everything local
2. it works for LAN devices
3. it keeps controller/browser API testing honest
4. it avoids making public tunnel infrastructure a prerequisite for routine local validation

Important note:

1. the platform already uses Next's `--experimental-https`
2. so the remaining complexity is not "how do we get Next on HTTPS"
3. the remaining complexity is mode clarity, cross-surface wiring, and trustworthy contracts

Cloudflare tunnel should remain a fallback for standalone secure game dev, not the canonical default.

### 5. One Honest Debug Story Per Mode

Each mode should make it obvious where to look when something fails:

1. standalone mode:
   game runtime first
2. live Arcade mode:
   platform shell plus embedded live game runtime
3. built Arcade mode:
   platform shell plus embedded built game runtime

That distinction matters because failures like:

1. controller bridge attach timeouts
2. built-bundle init-order crashes
3. base-path asset issues

only show up in the embedded Arcade modes, not in standalone dev.

## Target Command Surface

The target developer-facing model should become:

```bash
# Standalone live game dev
cd games/code-review
pnpm dev
pnpm dev -- --secure

# Live Arcade dev with a repo game
pnpm arcade:dev -- --game=code-review
pnpm arcade:dev -- --game=code-review --secure

# Built Arcade validation with a repo game
pnpm arcade:test -- --game=code-review
pnpm arcade:test -- --game=code-review --secure
```

Notes:

1. the exact final command names can still be tuned
2. but the conceptual split should stay fixed
3. if the root keeps `pnpm dev`, it should remain clearly documented as hybrid workspace dev until a better explicit live Arcade command exists

## Migration Direction

### Phase 1. Clarify Existing Modes

Done or underway:

1. root docs and workspace CLI help now describe `pnpm dev` as hybrid workspace dev
2. root docs now distinguish built Arcade validation from standalone secure game dev

Still needed:

1. make the built Arcade versus live Arcade distinction visible in more platform/game docs
2. keep bug triage language consistent with those mode names

### Phase 2. Add Explicit Live Arcade Dev

Needed capability:

1. run platform + server + selected live game dev server
2. have Arcade embed the live game directly, not the built local-build route
3. preserve the same host/controller/platform contract as the built Arcade path where practical

Rules:

1. do not replace built Arcade validation with this
2. do not hide whether the embedded surface is live or built
3. keep secure local HTTPS available for this mode too

### Phase 3. Keep Built Arcade Validation Strict

Built Arcade should remain:

1. explicit
2. build-first
3. closer to release behavior than live Arcade dev

The local build route should keep catching:

1. base path mistakes
2. bundle init-order bugs
3. embedded runtime startup failures

## Risks To Avoid

1. one overloaded `dev` command trying to be all modes at once
2. making tunnel/public infrastructure the default local secure story
3. letting live Arcade dev and built Arcade validation silently behave differently without explanation
4. treating secure local HTTPS as the cause of integration bugs that are really built-surface bugs
5. hiding whether a failure occurred in the outer platform shell or the inner embedded game surface

## Test Plan

### Standalone

1. each repo game runs directly in standalone live dev over HTTP
2. secure-context games also run directly in standalone secure dev over HTTPS

### Live Arcade

1. a selected repo game can be launched inside Arcade while still running from the live dev server
2. controller host/controller bridge attach works in both HTTP and HTTPS modes

### Built Arcade

1. a selected repo game can be built and served through `/airjam-local-builds/<id>/`
2. host/controller both attach correctly inside Arcade
3. secure built Arcade works for secure-context games
4. build-only regressions are detectable separately from live Arcade dev

## Success Criteria

This plan is successful when:

1. every repo-owned game has an understandable answer to:
   standalone, live Arcade, and built Arcade
2. developers do not have to reverse-engineer which runtime mode a command actually starts
3. secure local validation feels like a transport option, not a second architecture
4. prerelease debugging can clearly distinguish:
   platform-shell bug, embedded live-game bug, or embedded built-game bug
