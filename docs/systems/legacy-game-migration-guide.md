# Air Jam Legacy Game Migration Guide

Last updated: 2026-03-29  
Status: active

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [V1 Closeout Plan (Archived)](../archive/v1-closeout-plan-2026-03-31.md)
3. [Monorepo Operating System](../monorepo-operating-system.md)
4. [Legacy Game Migration Working Notes](../archive/legacy-game-migration-working-notes-2026-03-29.md)

## Purpose

This guide captures the real migration recipe from the older Air Jam app shape to the current v1 app shape.

It is based on the three ZeroDays legacy games:

1. `code-review`
2. `last-band-standing`
3. `the-office`

These games now serve as the migration proof set, not just as historical examples.

## What Counts As A Successful Migration

A migrated game is not “something that still runs in the repo after patching imports.”

A migrated game should have:

1. current Air Jam app bootstrap
2. clear host/controller route boundaries
3. current action/store contract
4. app-owned UI structure instead of old generic shell assumptions
5. successful validation against local packaged Air Jam dependencies

That last point matters.

Air Jam v1 should be trusted because older real games work against packaged dependencies, not only because the monorepo source graph happens to line up.

## Canonical Target Shape

The canonical target is the current Air Jam app pattern used by:

1. [Pong template](/Users/timvucina/Desktop/MyProjects/air-jam/games/pong)
2. [air-capture](/Users/timvucina/Desktop/MyProjects/air-jam/games/air-capture)

The most important traits are:

1. `createAirJamApp(...)` in `src/airjam.config.ts`
2. `airjam.Host` and `airjam.Controller` route wrappers in `src/app.tsx`
3. host and controller runtime hooks mounted only inside their route entry files
4. game-owned code grouped under `src/game/` or `src/store/` with explicit boundaries
5. actor-aware store actions using the current `(ctx, payload)` action contract
6. app-owned host/controller UI rather than framework-era generic shell composition

## Minimal Migration Recipe

### 1. Move Runtime Bootstrap Into `airjam.config.ts`

Old apps often kept runtime wiring inside `App.tsx` or provider setup.

The target shape is:

1. `src/airjam.config.ts`
2. `createAirJamApp({ runtime: env.vite(import.meta.env), ... })`
3. input schema defined there through `input.schema`
4. input behavior defined there through `input.behavior`

This removes ad hoc route/runtime duplication from the main app entry.

### 2. Make `src/app.tsx` A Pure Route Boundary

The current `app.tsx` should do almost nothing except:

1. mount `Routes`
2. wrap host routes in `<airjam.Host>`
3. wrap controller routes in `<airjam.Controller>`
4. lazily load route modules when useful

Do not let `app.tsx` become a second place where gameplay logic, env wiring, or shell state accumulates.

### 3. Move Host And Controller Entry Points Into Route Files

The clean target is:

1. `src/routes/host-view.tsx`
2. `src/routes/controller-view.tsx`

Those files should own:

1. host runtime hooks
2. controller runtime hooks
3. top-level host/controller composition

They should not also become giant mixed dumping grounds for every game-domain concern.

### 4. Move Input Schema Into `src/game/input.ts`

Input should be defined close to the game, not buried in bootstrap code.

That file should usually own:

1. input schema
2. input-derived constants when they are truly coupled to the schema
3. nothing about host/controller layout or route wiring

### 5. Migrate Store Actions To The Current Contract

This is one of the most important changes.

The old shape relied more on positional args and weaker implicit ownership.

The v1 target shape is:

1. `(ctx, payload) => nextState`
2. use `ctx.actorId` for acting controller identity
3. use `ctx.connectedPlayerIds` when membership pruning matters
4. make host-only or role-aware actions explicit

That keeps the authoritative ownership model legible.

### 6. Keep UI App-Owned

Do not preserve old generic shell helpers just because they existed.

The app should own:

1. host chrome
2. controller chrome
3. lobby presentation
4. match-end presentation

Shared framework helpers are still fine when they are narrow and honest, like:

1. `ForcedOrientationShell`
2. `PlayerAvatar`
3. controller/session hooks

But they should not define the app’s structure for it.

## File Layout Guidance

Do not force every game into the same folder tree.

What matters is boundary clarity, not cargo-cult exact paths.

Good common targets are:

1. `src/airjam.config.ts`
2. `src/app.tsx`
3. `src/routes/`
4. `src/game/`
5. `src/store/` if the domain naturally already lives there
6. `src/components/` for app-owned UI

Use the smallest structure that keeps:

1. runtime wiring clear
2. domain logic isolated
3. host/controller entry points obvious

## Controller Input Migration Rule

Do not blindly rewrite every legacy input loop the same way.

The right choices are:

1. use `useInputWriter()` and `useControllerTick(...)` when fixed-cadence controller publishing is the cleanest fit
2. keep an app-owned loop only when the game genuinely needs a custom continuous control model and the boundary remains clear

The rule is:

1. prefer current framework primitives
2. do not cargo-cult them where a specialized input model is already clean and stable

## Tarball Validation Rule

Migration proof is not complete until the migrated game works against local packaged dependencies.

In this repo the canonical validation command is:

```bash
pnpm run repo -- legacy validate-tarball
```

What it does:

1. builds local `@air-jam/sdk` and `@air-jam/server`
2. packs them to local tarballs
3. copies each legacy game to a temp workspace
4. rewrites that temp copy to consume the local tarballs
5. validates `air-jam-server` CLI resolution
6. runs typecheck, tests when present, and build

This is the release-proof path for migrated legacy apps.

### Important prerelease note

For local tarball proof, the temp consumer currently pins `@air-jam/sdk` through a `pnpm.overrides` entry so the `@air-jam/server` tarball resolves the same local SDK tarball instead of reaching for npm.

That is acceptable for prerelease local validation and keeps the proof deterministic.

## The Three Reference Migration Cases

### 1. `code-review`

This is the smallest and clearest reference case.

It proves:

1. current bootstrap shape
2. current route wrappers
3. current action context usage for team joining
4. current package-consumer validation path

Use this when you want the minimal example.

### 2. `last-band-standing`

This is the structured multi-feature reference case.

It proves:

1. the current bootstrap works with a more complex round engine
2. store/domain helpers can remain modular without flattening everything into one file
3. migrated games with tests can still validate cleanly against tarballs

Use this when you want the “larger but still disciplined” example.

### 3. `the-office`

This is the host-heavy continuous-update reference case.

It proves:

1. the current route/bootstrap shape still works for a game with a stronger host simulation feel
2. canvas-heavy host presentation can stay app-owned
3. not every migrated game needs the exact same controller-input implementation as the others

Use this when you want the “custom host runtime” example.

## What The Migration Guide Does Not Require

Do not over-migrate.

This guide does not require:

1. forcing every app into the Pong folder tree
2. rewriting healthy domain modules just for aesthetic consistency
3. replacing every custom controller loop if it is already a clear fit
4. changing game design or visual identity

The point is to migrate architecture, not to erase app individuality.

## Migration Success Summary

Air Jam v1 migration proof should be judged by these outcomes:

1. runtime bootstrap is current
2. host/controller boundaries are explicit
3. authoritative state ownership is current
4. app structure is clearer than before
5. packaged dependency validation passes

If those are true, the migration is real.
