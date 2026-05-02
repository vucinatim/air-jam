# Root Workspace CLI Consolidation Plan

Status: completed baseline (archived)  
Last updated: 2026-04-04

## Summary

The root `package.json` script surface has grown into a mix of:

1. canonical repo lifecycle commands
2. workspace orchestration helpers
3. legacy convenience aliases
4. one-off maintenance tasks
5. create-airjam-adjacent local helper flows

That is too much surface area for the repo root.

The clean target is:

1. keep a very small root `package.json` script surface
2. consolidate repo-local orchestration behind one internal workspace CLI
3. keep `create-airjam` focused on public project-generation and project-local runtime workflows
4. remove redundant aliases that only duplicate flags or `pnpm --filter ...` commands

This is a repo-internal cleanup. It must not change the public `create-airjam` publishing contract.

## Problem

The current root script list is mixing several concerns:

### 1. Canonical root lifecycle

- `build`
- `typecheck`
- `test`
- `lint`
- `format`
- `format:check`

These belong at the root.

### 2. Workspace orchestration

- `dev`
- `arcade:test`
- `secure:init`

These also belong at the root, but they should feel like one coherent system, not thin wrappers around scattered files.

### 3. Redundant convenience aliases

- `dev:pong`
- `dev:code-review`
- `dev:last-band-standing`
- `dev:the-office`
- `dev:air-capture`
- `dev:template:pong`
- `arcade:test:pong`
- `arcade:test:code-review`
- `arcade:test:last-band-standing`
- `arcade:test:the-office`
- `arcade:test:air-capture`
- `test:scaffold:workspace`

These are just aliases over the main commands plus flags. They add noise, not capability.

### 4. Specialized maintenance commands

- `dev:server`
- `dev:platform`
- `dev:logs`
- `analytics:rebuild`
- `db:backup:platform`
- `pack:local`
- `scaffold:tarball`
- `scaffold:workspace`
- `test:legacy:tarball`

Some of these are useful, but they should not all be promoted to top-level root lifecycle commands.

### 5. Release / smoke validation

- `check:release`
- `smoke:browser`
- `smoke:happy-path`
- `playwright:install`
- `test:scaffold`
- `test:scaffold:registry`
- `test:scaffold:tarball`
- `guard:canonical`
- `perf:sanity`

These are legitimate, but they need clearer grouping and naming.

## Decision

Do **not** move repo-root workspace orchestration into `create-airjam`.

Reason:

1. `create-airjam` is the public developer CLI distribution package
2. repo-root orchestration is monorepo-specific and not part of the public generated-project contract
3. mixing those responsibilities would make the package name and ownership less honest again

The correct split is:

### `create-airjam`

Owns:

1. public scaffolding
2. generated-project runtime commands
3. project-local release / AI-pack commands

Examples:

- `npx create-airjam my-game`
- `pnpm exec airjam dev`
- `pnpm exec airjam secure:init`
- `pnpm exec airjam ai-pack status --dir .`
- `pnpm exec airjam release bundle --dir .`

### Root workspace CLI

Owns:

1. monorepo-only orchestration
2. local Arcade validation helpers
3. repo-specific maintenance tasks
4. release-check workflow composition

This should stay internal to this repo.

## Target Architecture

Introduce one repo-local workspace CLI, implemented under `scripts/workspace/`.

Recommended entrypoint:

- `scripts/workspace/cli.mjs`

Recommended internal structure:

```text
scripts/
  workspace/
    cli.mjs
    commands/
      dev.mjs
      arcade-test.mjs
      secure-init.mjs
      scaffold-local.mjs
      pack-local.mjs
      platform-db-backup.mjs
      legacy-tarball-validate.mjs
    lib/
      shared-arg-parsing.mjs
      command-helpers.mjs
```

Existing shared workspace helpers should remain shared rather than duplicated:

- `scripts/lib/workspace-stack.mjs`
- `scripts/lib/repo-games.mjs`
- any log/stack helper already used by the orchestration commands

This does **not** require publishing another package. A repo-local CLI script is enough.

## Target Root Script Surface

### Keep as canonical root scripts

These should remain visible in root `package.json`:

```json
{
  "dev": "node scripts/workspace/cli.mjs dev",
  "arcade:test": "node scripts/workspace/cli.mjs arcade:test",
  "secure:init": "node scripts/workspace/cli.mjs secure:init",
  "build": "pnpm -r build",
  "typecheck": "pnpm --filter sdk build && pnpm -r --filter \"!sdk\" typecheck",
  "test": "pnpm --filter sdk build && pnpm --filter server test && pnpm --filter sdk test && pnpm --filter platform test",
  "lint": "pnpm -r lint",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "check:release": "pnpm typecheck && pnpm test && pnpm build && pnpm smoke:happy-path",
  "smoke:browser": "playwright test --config playwright.smoke.config.ts",
  "smoke:happy-path": "pnpm --filter @air-jam/server test -- --run tests/game-lifecycle.integration.test.ts tests/routing-security.integration.test.ts && pnpm smoke:browser && pnpm test:scaffold",
  "playwright:install": "playwright install --with-deps chromium",
  "test:scaffold": "pnpm --filter create-airjam build && pnpm --filter create-airjam smoke",
  "test:scaffold:registry": "pnpm --filter create-airjam build && pnpm --filter create-airjam smoke:registry",
  "test:scaffold:tarball": "pnpm --filter create-airjam build && pnpm --filter create-airjam smoke:tarball",
  "guard:canonical": "bash ./scripts/guard-canonical.sh"
}
```

### Remove from root `package.json`

These should be deleted:

- `dev:pong`
- `dev:code-review`
- `dev:last-band-standing`
- `dev:the-office`
- `dev:air-capture`
- `dev:template:pong`
- `arcade:test:pong`
- `arcade:test:code-review`
- `arcade:test:last-band-standing`
- `arcade:test:the-office`
- `arcade:test:air-capture`
- `test:scaffold:workspace`

Reason:

1. they duplicate the real commands
2. `pnpm dev -- --game=<id>` and `pnpm arcade:test -- --game=<id>` are already the canonical interface

### Move out of top-level script surface

These should become direct repo-local CLI commands or direct `pnpm --filter ...` invocations, not first-class root scripts:

- `dev:server`
- `dev:platform`
- `dev:logs`
- `analytics:rebuild`
- `db:backup:platform`
- `pack:local`
- `scaffold:tarball`
- `scaffold:workspace`
- `perf:sanity`
- `test:legacy:tarball`

Recommended access model:

```bash
node scripts/workspace/cli.mjs service server
node scripts/workspace/cli.mjs service platform
node scripts/workspace/cli.mjs logs
node scripts/workspace/cli.mjs scaffold-local --source=workspace
node scripts/workspace/cli.mjs scaffold-local --source=tarball
node scripts/workspace/cli.mjs pack-local
node scripts/workspace/cli.mjs platform db-backup
node scripts/workspace/cli.mjs legacy validate-tarball
```

These are valid workflows, but they should not crowd the root command surface.

## Naming Guidance

### Root scripts

Use short lifecycle names only:

- `dev`
- `arcade:test`
- `secure:init`
- `build`
- `typecheck`
- `test`

### Internal workspace CLI subcommands

Use namespaced commands where the operation is not part of daily lifecycle:

- `service server`
- `service platform`
- `logs`
- `scaffold-local`
- `pack-local`
- `platform db-backup`
- `legacy validate-tarball`

This keeps root `package.json` clean while preserving discoverability for LLMs and maintainers through `--help`.

## Why not another package?

Do **not** create a new published package for this cleanup.

A separate internal package like `@air-jam/workspace-cli` would add:

1. more workspace surface area
2. more package build/link complexity
3. more naming and ownership overhead

for very little gain.

A repo-local CLI script is the minimal honest boundary.

## Implementation Phases

### Phase 1. Introduce repo-local workspace CLI

Create `scripts/workspace/cli.mjs` using `commander`.

It should wrap the existing orchestration implementations without redesigning behavior:

- `dev`
- `arcade:test`
- `secure:init`
- optional maintenance commands for current root-only helpers

The goal is consolidation first, not behavior change.

### Phase 2. Collapse root scripts

Update root `package.json` to:

1. keep only canonical lifecycle / release validation scripts
2. remove per-game aliases
3. remove redundant `test:scaffold:workspace`
4. move specialized helpers off the top-level script surface

### Phase 3. Reorganize `scripts/`

After the CLI is stable:

1. move workspace-orchestration files under `scripts/workspace/commands/`
2. keep shared utilities under `scripts/lib/` or move them to `scripts/workspace/lib/` if they become workspace-specific
3. leave unrelated content-generation scripts where they are unless a separate cleanup is needed

Do not mix this with content/doc generation refactors.

### Phase 4. Update docs

Update:

- `README.md`
- `docs/monorepo-operating-system.md`
- any root command references in plans or generated docs if they describe the repo workflow

The docs should present only the canonical root commands.

## Tests

Before considering this complete:

1. `pnpm dev -- --help` equivalent through the new workspace CLI
2. `pnpm arcade:test -- --help`
3. `pnpm secure:init -- --help`
4. `pnpm test`
5. `pnpm typecheck`
6. `pnpm test:scaffold`
7. one real workspace boot:
   - `pnpm dev -- --game=pong`
8. one real Arcade test boot:
   - `pnpm arcade:test -- --game=pong`

## Acceptance Criteria

This cleanup is complete when:

1. root `package.json` exposes only the minimal canonical workflow surface
2. repo-specific maintenance helpers are still available, but no longer pollute the main script list
3. there is one discoverable repo-local workspace CLI with `--help`
4. `create-airjam` remains focused on public/project-local workflows
5. no behavior regresses in workspace dev or local Arcade validation

## Recommendation

This is worth doing.

The current root script surface is too noisy, and the right fix is not “delete random aliases.” The right fix is:

1. keep `create-airjam` where it already belongs
2. introduce one internal workspace CLI for monorepo-only orchestration
3. reduce root `package.json` to the smallest honest surface

That is the cleanest professional shape.
