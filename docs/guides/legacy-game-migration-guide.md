# Air Jam Legacy Game Migration Guide

Last updated: 2026-03-29  
Status: current guide

Related docs:

1. [Framework Paradigm](../framework-paradigm.md)
2. [Monorepo Operating System](../monorepo-operating-system.md)

Earlier whole-product closeout plans and migration working notes remain in
the private product archive and this repository's Git history.

## Purpose

This guide captures the real migration recipe from the older Air Jam app shape to the current v1 app shape.

It is based on the three ZeroDays legacy games:

1. `code-review`
2. `last-band-standing`
3. `the-office`

These games now serve as the migration proof set, not just as historical examples.

## Node.js Minimum

Air Jam 1.0 authoring requires Node.js 22.15 or newer for devtools, the CLI and MCP,
create-airjam and generated projects. The declaration loader uses synchronous
module hooks to enforce its framework-free boundary through imports, `require`
and `createRequire`. The SDK and server retain their Node.js 22.0 minimum.

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

1. [Pong template](../../games/pong)
2. [air-capture](../../games/air-capture)

The most important traits are:

1. `defineAirJamGame(...)` from `@air-jam/sdk/core` in `src/airjam.config.ts`
2. `airjam.Host` and `airjam.Controller` route wrappers in `src/app.tsx`
3. host and controller runtime hooks mounted only inside their route entry files
4. game-owned code grouped under `src/game/` or `src/store/` with explicit boundaries
5. actor-aware store actions using the current `(ctx, payload)` action contract
6. app-owned host/controller UI rather than framework-era generic shell composition

## Minimal Migration Recipe

### 1. Declare The Game In `airjam.config.ts`

Old apps often kept runtime wiring inside `App.tsx` or provider setup.

The target shape is:

1. `src/airjam.config.ts`
2. `defineAirJamGame({ metadata, stores, simulation, input, agent, testing })`
3. `createAirJamApp(airjam, { runtime: env.vite(import.meta.env) })` in `app.tsx`
4. declared controls passed there through `input: defineAirJamInput({ ... })`

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

1. `SurfaceViewport`
2. `PlayerAvatar`
3. host/controller consumer hooks

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

1. declare the controls and bind the SDK's `ControlButton`, `AxisButton` and `Stick` to them; the SDK sends them
2. read them only in simulation steps; games run no send loops of their own

The rule is:

1. prefer current framework primitives
2. do not cargo-cult them where a specialized input model is already clean and stable

## Tarball Validation Rule

Migration proof is not complete until the migrated game works against local packaged dependencies.

In this repo the canonical validation command is:

```bash
pnpm run repo -- legacy validate-tarball --root /absolute/path/to/air-jam-games
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

## From 0.9 To 1.0: The game is declared in core

Keep `src/airjam.config.ts` framework-free and export the named `airjam` from
`defineAirJamGame` in `@air-jam/sdk/core`. Move metadata into the declaration;
`metadata.maxPlayers` alone sets room capacity. The loader rejects React,
the SDK root, TSX and CSS in that module graph with
`AJ_DECLARATION_NOT_FRAMEWORK_FREE`, naming the importer.

Bind the declaration in `app.tsx` with `createAirJamApp(airjam, { runtime })`.
The result contains `Host`, `Controller`, `paths` and `session`; game facts and
`createHostRuntime` belong to the declaration. Import agent helpers from core.

The declared relative `testing` path names a development-only module exporting
`testing = defineAirJamTesting({ player, profiles, visual })` from
`@air-jam/devtools/testing`. `visual` is optional and uses the declared agent.
A player offers `model` in every profile automatically; remove manually authored
model policies. Agents inspect the description through `airjam.inspect_game`.
See the creator migration page for the complete before/after mapping.

## From 0.9 To 1.0: Settings are declared

Move tunable speed, force, damage, health, duration and count constants into
`defineAirJamSettings` from `@air-jam/sdk/core`, and pass the result as the
`settings` field of `defineAirJamGame`. Keep a leaf settings module and infer
its values with `AirJamSettingsValues<typeof gameSettings>`. Delete the old
constants. Lobby choices remain store state.

Read `settings` in simulation create, step and observe contexts, and in
`AirJamActionContext<GameSettings>`. Supply the fourth simulation type parameter
for typed values. Host drawing uses `useAirJamSettings(gameSettings)`; copy any
phone display values into the store rather than reading settings on controllers.

Only settings declared `live: true` can change during a host's lifetime.
`airjam.read_game_settings` returns the current values and revision;
`airjam.update_game_settings` takes an atomic patch and `expectedRevision`.
Unknown, invalid, stale and non-live updates fail with `AJ_SETTING_UNKNOWN`,
`AJ_SETTING_INVALID`, `AJ_SETTING_STALE` and `AJ_SETTING_NOT_LIVE` respectively.
Start a new room through `airjam.start_game_run({ settings: { ... }, ... })`
for a non-live value. Input logs now require version 2, resolved initial
settings and the ordered settings events; version 1 logs must be recorded again.

See [Game Settings](../../content/docs/sdk/settings/page.mdx) for declarations, host hooks and CLI
commands.

## From 0.9 To 1.0: Assets and theme are declared

Move sound manifests into `defineAirJamAssets` from `@air-jam/sdk/core` and
pass the result as `assets` in `defineAirJamGame`. Import `SoundConfig` from
`@air-jam/sdk/core`. Declare images and other loaded files there too, using
served paths under `public/`. Read their paths
from the object and remove old manifests and path imports. Use sound `surface`
marks for host-only or controller-only audio. Remove game-owned `<AudioRuntime>`
mounts; the binding supplies it on each surface. Keep playlist and playback
logic inside that binding.

Move colours and font families into `defineAirJamTheme` and pass it as `theme`.
Map existing Tailwind names to `--airjam-color-*` and `--airjam-font-*` with
`@theme inline`. Canvas and 3D drawing read the same theme object. Remove
repeated colour and font literals; shadows and gradients remain CSS.
Inspection now fails `AJ_ASSET_MISSING` for a declared file that is absent.

See [Game Assets and Theme](../../content/docs/sdk/assets-and-theme/page.mdx) for the complete shapes.
