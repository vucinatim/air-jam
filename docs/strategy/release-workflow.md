# Air Jam Release Workflow

Last updated: 2026-03-27
Status: active

Related docs:

1. [Release Prep Plan (Archived)](../archive/release-prep-plan-2026-03-31.md)
2. [Monorepo Operating System](../monorepo-operating-system.md)
3. [Docs Index](../docs-index.md)

## Canonical Release Model

Air Jam publishes packages from GitHub Actions using npm trusted publishing.

This is the canonical path.

It is:

1. GitHub-native to trigger
2. token-free for npm publishing
3. validated by the publish gate before publish
4. followed by package-specific git tags and GitHub releases

Local manual publishing is fallback-only.

## Packages

Trusted publishing must be configured separately on npm for:

1. `@air-jam/sdk`
2. `@air-jam/mcp-server`
3. `@air-jam/server`
4. `create-airjam`

## One-Time Manual Setup On npm

You must do this once per package on npmjs.com.

For each package:

1. open the package settings page on npm
2. find the `Trusted Publisher` section
3. choose `GitHub Actions`
4. configure:
   1. Organization or user: `vucinatim`
   2. Repository: `air-jam`
   3. Workflow filename: `publish-packages.yml`
   4. Environment name: leave blank

Repeat that for all four published packages.

Important:

1. the workflow filename must match exactly
2. npm checks this only when a publish happens, not when you save the config
3. each package can have only one trusted publisher

## One-Time Cleanup After Trusted Publishing Works

After the first successful trusted publish:

1. delete the `NPM_TOKEN` repository secret from GitHub if it still exists
2. revoke old npm publish tokens from your npm account

This reduces future secret drift and removes the token rotation problem.

## Release Steps

### 1. Prepare versions

Update package versions intentionally in the repo before publishing.

This workflow publishes the versions that already exist in:

1. `packages/sdk/package.json`
2. `packages/server/package.json`
3. `packages/create-airjam/package.json`

### 2. Run local validation before release

Recommended final local gate:

```bash
pnpm check:release:doctor
```

This command first enforces `pnpm install --frozen-lockfile`, then runs the real local prerelease gate. That keeps simple dependency drift from first surfacing on GitHub Actions.

It also runs two fast structural contracts before the heavy gate:

1. `pnpm test:repo-contracts`
2. `pnpm check:platform:deploy`

Those exist specifically to catch mistakes that were previously hidden by local workspace state:

1. workflow toolchain drift versus `packageManager`
2. missing workspace bin entrypoints before build
3. hosted platform deploy coupling that only appears in a clean copy

The underlying heavy local gate is:

```bash
pnpm check:release
```

It includes strict perf, browser Playwright smoke, and scaffold tarball smoke.

GitHub publish uses a lighter remote sanity gate:

```bash
pnpm check:release:publish
```

This is intentionally not the full prerelease sweep. It keeps only:

1. repo contract tests
2. clean platform build
3. typecheck
4. server lifecycle/routing smoke

For normal pull-request validation, use the lighter CI contract:

```bash
pnpm check:ci
```

### 3. Merge the release commit

Publish from the exact commit you want tagged and released.

### 4. Trigger GitHub Actions

There are two canonical entrypaths.

#### Manual workflow dispatch

Use the `Publish Packages` workflow directly, or trigger it through `gh`.

Examples:

```bash
pnpm release:public
```

```bash
gh workflow run publish-packages.yml -f package=all-public -f channel=latest
```

#### Automated tag-triggered release

Create and push a canonical public release tag.

Examples:

```bash
pnpm release:public:tag
```

```bash
pnpm run repo -- release tag --channel next
```

Tag mapping:

1. `release/public-v<version>` -> full public graph to `latest`
2. `release/public-next-v<version>` -> full public graph to `next`

### 5. What the workflow does

The workflow:

1. installs dependencies
2. runs `pnpm check:release:publish`
3. resolves the selected package set explicitly
4. publishes the selected package set in dependency order to npm via trusted publishing
5. creates matching package-specific git tag(s)
6. creates matching package-specific GitHub release(s)

The heavy prerelease checks stay local:

1. strict perf sanity
2. scaffold tarball smoke
3. browser Playwright smoke
4. hermetic platform deploy check

That is deliberate. GitHub publish should confirm the repo still builds and the server release path is sane, not rerun every expensive local sign-off gate.

## Tag Format

Package tags are:

1. `sdk-v<version>`
2. `mcp-server-v<version>`
3. `server-v<version>`
4. `create-airjam-v<version>`

Examples:

1. `sdk-v0.9.0`
2. `server-v0.9.0`
3. `create-airjam-v0.9.0`

## Failure Notes

If publishing fails with an npm authentication error:

1. verify the trusted publisher config on npm matches exactly
2. verify the workflow file is named `publish-packages.yml`
3. verify the job ran on a GitHub-hosted runner
4. verify the workflow still has `id-token: write`

If release creation fails because a tag already exists:

1. the version was already tagged before
2. choose a new version or clean up the mistaken tag before retrying

## Maintainer Rule

Do not use ad hoc local publishes as the normal process.

If a local emergency publish is ever necessary:

1. record why it happened
2. bring the repo back to the canonical GitHub Actions flow immediately after
