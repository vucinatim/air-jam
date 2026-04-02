# ZeroDays Game Import And Template Promotion Plan

Last updated: 2026-04-02  
Status: active

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Game Source Scaffolding Plan](./game-source-scaffolding-plan.md)
3. [Legacy Game Migration Guide](../systems/legacy-game-migration-guide.md)
4. [Monorepo Operating System](../monorepo-operating-system.md)
5. [V1 Release Launch Plan](./v1-release-launch-plan.md)

## Purpose

Define the cleanest canonical way to bring the three ZeroDays showcase games into the Air Jam monorepo as first-class `games/` projects, align them with the modern Pong-style architecture, remove external-project baggage, and eventually promote them into scaffoldable `create-airjam` templates.

This plan exists because the current state is only half-native:

1. `code-review`, `last-band-standing`, and `the-office` are already valid Air Jam games
2. they still live outside the repo in `/Users/timvucina/Desktop/zerodays/air-jam-games`
3. they still carry standalone-project clutter and direct local file dependencies back into this repo
4. they are not yet aligned with the reference architecture we want docs, skills, and templates to teach
5. they are not yet part of the canonical scaffold/template catalog

The goal is not just to copy those folders into the repo.

The goal is to make them:

1. real workspace-native games under `games/`
2. structurally aligned with the modern Air Jam architecture
3. runnable through one local Arcade/dev workflow
4. eligible for template promotion only after they are clean enough to teach publicly

## Core Position

The repo should eventually expose five real source-of-truth games:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

But not all five should become public templates merely because they exist in the repo.

The correct order is:

1. import the ZeroDays games into `games/`
2. normalize them into workspace-native source games
3. refactor them toward the Pong-style architecture and documentation contract
4. prove they run locally through the same workspace launcher and local Arcade path
5. promote them into scaffoldable templates only after they meet that standard

That keeps the repo honest and avoids teaching half-migrated patterns.

This track is now active by explicit product decision because:

1. the team wants these games published and maintained from one place
2. importing them into the monorepo is the cleanest maintenance path
3. template promotion is now a useful bonus rather than the only reason to do the work

## Current Status

As of 2026-04-02, the baseline import and native-workspace wiring are in:

1. `code-review`, `last-band-standing`, and `the-office` now live under `games/`
2. obvious standalone clutter and direct repo-backlink `file:` dependencies were removed
3. the root workspace and TS project graph now include the imported games
4. baseline per-game validation is already green:
   1. `code-review` typecheck + build
   2. `last-band-standing` typecheck + tests + build
   3. `the-office` typecheck + build
5. each imported game now has an explicit repo manifest via `airjam-template.json`, and all three imported games are now promoted to `scaffold: true`
6. the shared workspace launcher already supports `pnpm dev -- --game=<id>`
7. `code-review` has already been launched successfully through that shared stack
8. the first architecture-alignment pass is now in across the imported trio:
   1. `code-review` now has explicit `host/`, `controller/`, `game/domain`, and `game/stores` seams
   2. `last-band-standing` now treats round logic and state as explicit `game/domain` and `game/stores` ownership, with root compatibility shims left only to reduce migration noise
   3. `the-office` now exposes the same `host/`, `controller/`, and `game/stores` ownership model as the other repo-owned games

So the remaining work is not "can we import them?"

The remaining work is:

1. keep `code-review`, `last-band-standing`, and `the-office` healthy through the shared scaffold gate now that they are public
2. decide later whether any of the three need deeper architecture polish beyond the current reference-quality export/build contract

## Non-Goals

This plan is not for:

1. importing the games as frozen historical snapshots
2. preserving every standalone-project file and workflow inside the monorepo
3. making the legacy games public templates before they are reference-quality
4. adding game-specific one-off launcher scripts for every imported game
5. expanding the public template catalog by brute force without architectural alignment

## Desired End State

Air Jam should support this canonical truth:

1. all repo-owned games live under `games/`
2. all five first-party or repo-owned showcase games are workspace-native
3. all repo-owned games can be launched locally through one shared workspace launcher contract
4. all repo-owned games can be exercised through the local Arcade proof surface without ad hoc per-game wiring
5. only games that satisfy the modern reference standard are marked scaffoldable
6. `create-airjam` can eventually offer five well-maintained templates without drift

The important distinction is:

1. `games/` membership means "repo-owned and workspace-native"
2. scaffoldability means "clean enough to export and teach publicly"

## Import Source Of Truth

The current external source projects are:

1. `/Users/timvucina/Desktop/zerodays/air-jam-games/code-review`
2. `/Users/timvucina/Desktop/zerodays/air-jam-games/last-band-standing`
3. `/Users/timvucina/Desktop/zerodays/air-jam-games/the-office`

The import targets should become:

1. `games/code-review`
2. `games/last-band-standing`
3. `games/the-office`

Once imported, the repo copies become the source of truth.

The external folders should stop being the place we maintain or validate them against.

## Architecture Direction

### 1. Workspace-Native First

Imported ZeroDays games should become normal monorepo game projects.

That means:

1. no direct `file:` dependencies back into the repo root
2. use workspace-local package boundaries in the monorepo
3. follow the same package/runtime assumptions as `games/pong` and `games/air-capture`
4. run through the same top-level dev and validation flows where practical

The import should remove "external app glued to this repo" behavior.

### 2. Pong-Like Architecture Is The Teaching Standard

The long-term reference shape should still be taught by the two strongest canonical games:

1. `games/pong` as the smallest starter
2. `games/air-capture` as the advanced reference

The imported ZeroDays games should move toward that same architecture language:

1. clear `host/` and `controller/` ownership
2. explicit `game/domain`, `game/stores`, `game/engine`, `game/ui`, and `game/debug` boundaries when appropriate
3. modern `src/airjam.config.ts` bootstrap
4. route boundaries that make runtime ownership obvious
5. minimal shell confusion or old framework-era coupling

This does not mean every game must have identical folders.

It means each game should be legible through the same conceptual model.

### 3. Imported Games Must Lose Standalone Garbage

Imported games should not keep unrelated standalone-project clutter unless it is clearly valuable.

Examples that should usually be removed from imported source games:

1. `dist`
2. `node_modules`
3. local lockfiles that duplicate the monorepo root contract
4. local `plan.md`
5. local `suggestions.md`
6. stale or duplicated local docs that conflict with repo docs
7. local skills that duplicate repo-wide skills without adding unique value
8. external-only packaging or hosting files that are no longer part of the repo contract

Examples that may stay if still valuable:

1. game-specific `README.md`
2. game-specific public assets
3. game-specific test files
4. small game-local docs that explain rules, content, or creative context

The rule is: keep source, not baggage.

### 4. Template Promotion Should Be Deliberate

Imported games should not become scaffoldable on the same day they are imported unless they already meet the standard.

Promotion to `airjam-template.json` should require:

1. workspace-native package/config normalization complete
2. local Arcade launch proven through the shared workspace launcher
3. repo-level typecheck/build green
4. scaffold export/install/typecheck/test/build proof green
5. docs and local guidance consistent with the patterns we actually recommend publicly

That is the gate that protects the template catalog from becoming a dumping ground.

## Local Launcher And Arcade Contract

This plan should produce one canonical local game-launch workflow for repo-owned games.

### Desired developer UX

Examples:

```bash
pnpm dev -- --game=pong
pnpm dev -- --game=air-capture
pnpm dev -- --game=code-review
pnpm dev -- --game=last-band-standing
pnpm dev -- --game=the-office
```

Or an equivalent short alias pattern if we later want one.

The important part is:

1. one launcher
2. one option shape
3. no hardcoded per-game shell scripts beyond shared metadata

### Launcher responsibilities

The shared workspace launcher should:

1. start sdk watch
2. start server
3. start platform
4. start the selected game from `games/<id>`
5. reserve or clear the required local dev ports deterministically
6. expose the selected game through the local Arcade reference path

### Local Arcade responsibilities

The local Arcade/dev proof path should stop being manually hardcoded only for Pong and Air Capture.

The clean direction is:

1. each repo-owned game declares the metadata needed for local Arcade references
2. platform local-reference game resolution can enumerate repo-owned games from that metadata
3. browser smoke or local Arcade tooling can select a target game by id rather than hardcoding paths one by one

This should produce one honest source of truth for:

1. workspace launch
2. local Arcade launch
3. browser-smoke launch where relevant

## Proposed Data Model

### `games/` registry metadata

Imported games should eventually expose a tiny metadata file, for example:

1. game id
2. display name
3. local dev command or Vite entry assumptions when needed
4. whether the game is scaffoldable
5. whether the game is included in browser smoke
6. category such as `starter`, `reference`, or `showcase`

This should remain declarative.

The launcher and local Arcade surfaces should consume metadata, not hardcoded conditionals everywhere.

### Relationship to scaffold manifests

This plan should not create a second incompatible manifest format unless necessary.

The preferred direction is:

1. one tiny game metadata surface
2. scaffold-related fields only where needed
3. local-launch-related fields only where needed

If we must split the files, the responsibilities should stay very clear:

1. game registry metadata for workspace/runtime discovery
2. scaffold manifest for public template promotion

But the ideal is to avoid needless duplication.

## Migration Strategy

This should land in phases.

### Phase 1. Import As Workspace-Native Source Games

Required outcomes:

1. copy `code-review`, `last-band-standing`, and `the-office` into `games/`
2. remove obvious standalone garbage and generated output
3. convert local repo-backlink dependencies to workspace-local repo usage
4. make root workspace and project graph aware of the new games
5. get each imported game to local `typecheck` and `build`

Rules:

1. do not mark them scaffoldable yet
2. do not preserve external-folder assumptions
3. prefer deleting clutter over carrying it into the monorepo

### Phase 2. Normalize To The Modern Air Jam Repo Contract

Required outcomes:

1. each imported game uses the same workspace dependency model as repo-native games
2. each imported game has a sane minimal package surface
3. game-local scripts are reduced to what is still truly needed
4. local docs, README, and AI/agent guidance stop contradicting repo truth

This phase is about making them belong here before making them exemplary.

### Phase 3. Align Architecture Toward The Pong Standard

Required outcomes:

1. host/controller ownership is obvious
2. route boundaries match the modern runtime model
3. game logic folders are grouped into durable ownership seams
4. old mixed buckets are reduced where they meaningfully hurt clarity
5. docs and skills can describe these games using the same mental model as `pong` and `air-capture`

Rules:

1. do not churn healthy gameplay logic for aesthetics alone
2. refactor file structure and ownership where it improves clarity
3. prefer fewer stronger boundaries over many micro-abstractions

### Phase 4. Shared Local Launcher And Arcade Integration

Required outcomes:

1. `pnpm dev -- --game=<id>` can launch any repo-owned game under `games/`
2. local Arcade references can resolve any registered repo-owned game
3. browser smoke and local proof tooling stop hardcoding only the original pair
4. the launcher and local-reference system are metadata-driven rather than ad hoc

This is the phase that makes the imported games feel truly native to the workspace.

### Phase 5. Template Promotion One By One

Required outcomes for each game:

1. add scaffold metadata only when the game is clean enough
2. prove export through `create-airjam`
3. prove install, typecheck, tests where available, and build
4. expose it to the public template picker only after that proof passes

Rule:

1. promotion is per game, not all-or-nothing

That means the likely order is:

1. `code-review` (done)
2. `last-band-standing` (done)
3. `the-office` (done)

unless real proof shows a different order is more honest.

## Cleanup Policy

When importing the ZeroDays games, prefer this cleanup posture:

Delete by default:

1. `dist`
2. `node_modules`
3. local lockfiles that are not part of the monorepo contract
4. ephemeral planning/tracking files duplicated by repo docs
5. local AI/agent guidance that only repeats repo-wide rules

Keep only with reason:

1. game-specific docs that explain gameplay/content
2. game-specific creative assets
3. test files
4. small configuration files that still directly matter to the game

This plan should reduce noise, not import it.

## Testing Strategy

This plan only succeeds if the imported games are proven through the same repo-native surfaces.

### Per-game baseline checks

For each imported game:

1. `pnpm --filter <game> typecheck`
2. `pnpm --filter <game> build`
3. `pnpm --filter <game> test` where tests exist

### Workspace launcher checks

After Phase 4:

1. launch each repo-owned game through the shared launcher
2. verify server, platform, and selected game come up correctly
3. verify the game appears through the local Arcade route

### Browser/Arcade proof

Where appropriate:

1. expand the local Arcade smoke surface to cover additional repo-owned games
2. at minimum, ensure the metadata-driven launcher can select them correctly

### Scaffold proof

For each game promoted to template status:

1. `pnpm test:scaffold`
2. `pnpm test:scaffold:tarball`

The promotion gate should be explicit and automated.

## Risks To Avoid

1. importing the games but leaving them effectively external and half-detached
2. carrying external-project clutter into `games/`
3. marking all three scaffoldable before they are reference-quality
4. hardcoding more game-specific launcher branches as the repo grows
5. trying to force every game into identical folders instead of consistent conceptual ownership
6. letting docs/skills recommend a standard that the imported games do not follow

## Done When

This plan is complete when:

1. `code-review`, `last-band-standing`, and `the-office` live under `games/`
2. they are workspace-native and no longer depend on external-folder file links
3. they no longer carry obvious standalone garbage
4. they are aligned enough with the modern Pong-style architecture to be legible through the same docs/skills model
5. `pnpm dev -- --game=<id>` can launch any repo-owned game cleanly
6. local Arcade can resolve repo-owned games through one metadata-driven path
7. each promoted game is added to the scaffold/template catalog only after passing the template gate
