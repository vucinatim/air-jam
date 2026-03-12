# SDK Composability Refactor Plan

## Goal

Make `@air-jam/sdk` headless-first and composable, while keeping optional UI helpers available without locking users into SDK-owned shells.

## Architecture Direction

- Keep a single npm package: `@air-jam/sdk`.
- Split public API by subpath exports:
  - `@air-jam/sdk` -> headless core only.
  - `@air-jam/sdk/ui` -> optional UI components.
  - `@air-jam/sdk/ui/styles.css` -> optional UI styles.
- Keep `HostShell` and `ControllerShell` temporarily as legacy convenience.

## Phase Plan

### Phase 0: API Contract Definition

1. Define and freeze headless API surface:
   - Provider/context
   - Hooks
   - Protocol types
   - Store and utilities
2. Define UI API surface:
   - avatar, qr, scanner, badges, etc.
3. Mark shell components as legacy/deprecated (no removal yet).

### Phase 1: Export Split (Non-Breaking)

1. Add `./ui` and `./ui/styles.css` exports in `packages/sdk/package.json`.
2. Create `packages/sdk/src/ui/index.ts` as UI barrel.
3. Keep existing root exports for one compatibility cycle (with deprecation notes where relevant).

### Phase 2: Shell Decoupling

1. Refactor `HostShell` / `ControllerShell` to be presentational:
   - Accept props/model data.
   - Avoid owning `useAirJamHost` / store wiring internally.
2. Add optional model hooks in UI namespace if needed:
   - e.g. `useHostShellModel`, `useControllerShellModel`.
3. Keep compatibility wrappers for legacy usage during migration window.

### Phase 3: Primitive UI Components

Introduce small composable components, for example:

1. `JoinQrCode`
2. `JoinUrlField`
3. `RoomScannerDialog`
4. `ConnectionBadge`
5. `PlayerList`
6. `OrientationGuard`

### Phase 4: Template Migration (`create-airjam`)

1. Update template host/controller to use headless hooks + primitives.
2. Remove hard dependency on shell components in template code.
3. Keep starter minimal and easy to modify.

### Phase 5: Documentation Migration

1. Rewrite docs to be headless-first.
2. Move shell docs to compatibility/legacy section.
3. Update all examples/imports to:
   - `import { useAirJamHost } from "@air-jam/sdk"`
   - `import { JoinQrCode } from "@air-jam/sdk/ui"`

### Phase 6: Validation

Run before release:

1. `pnpm --filter sdk build`
2. `pnpm --filter server typecheck`
3. `pnpm --filter platform build`
4. `pnpm --filter create-airjam build`
5. Scaffold smoke test with `create-airjam` and verify host/controller flows.

### Phase 7: Versioning and Publish

1. `@air-jam/sdk`: minor bump (new subpath exports, compatibility preserved).
2. `create-airjam`: minor bump (template/docs migration).
3. `@air-jam/server`: bump only if changed in release.
4. Publish via workflow dispatch after version bump commit.

## Release Messaging

1. Headless-first SDK architecture.
2. Optional UI moved under `@air-jam/sdk/ui`.
3. Shell components remain available but deprecated.
4. No breaking changes in this transition release.

