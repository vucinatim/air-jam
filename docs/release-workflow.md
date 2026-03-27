# Air Jam Release Workflow

Last updated: 2026-03-27
Status: active

Related docs:

1. [Release Prep Plan](./plans/release-prep-plan.md)
2. [Development Loop](./development-loop.md)
3. [Docs Index](./docs-index.md)

## Canonical Release Model

Air Jam publishes packages from GitHub Actions using npm trusted publishing.

This is the canonical path.

It is:

1. manual to trigger
2. token-free for npm publishing
3. validated by the full release gate before publish
4. followed by package-specific git tags and GitHub releases

Local manual publishing is fallback-only.

## Packages

Trusted publishing must be configured separately on npm for:

1. `@air-jam/sdk`
2. `@air-jam/server`
3. `create-airjam`

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

Repeat that for all three published packages.

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

### 2. Run local validation if desired

Recommended:

```bash
pnpm check:release
```

### 3. Merge the release commit

Publish from the exact commit you want tagged and released.

### 4. Trigger GitHub Actions manually

Use the `Publish Packages` workflow and choose one of:

1. `sdk`
2. `server`
3. `create-airjam`
4. `all`

### 5. What the workflow does

The workflow:

1. installs dependencies
2. runs `pnpm check:release`
3. publishes the selected package(s) to npm via trusted publishing
4. creates package-specific git tag(s)
5. creates package-specific GitHub release(s)

## Tag Format

Package tags are:

1. `sdk-v<version>`
2. `server-v<version>`
3. `create-airjam-v<version>`

Examples:

1. `sdk-v1.2.0`
2. `server-v1.2.0`
3. `create-airjam-v1.2.0`

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
