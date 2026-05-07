# NPM Public Release And Automation Plan

Last updated: 2026-05-03  
Status: planned release automation  
Owner: packaging / release automation / npm distribution

## Purpose

This plan defines the first real public npm release lane for Air Jam.

It exists to make these things true at the same time:

1. the landing-page install claim is honest
2. `npx create-airjam` actually works from npm
3. old published packages remain available for legacy users
4. old published packages are explicitly unsupported
5. the release process can be triggered cleanly from GitHub
6. the release process supports both a manual lane and a clean automated lane
7. the package graph stays coherent instead of publishing only part of the system

This is not a generic “versioning thoughts” note. It is a concrete execution plan for the first supported npm lane.

## Why This Plan Exists

The repo already has a publish workflow, but it does not yet represent the real package graph needed for public installs.

Before this release-lane implementation started:

1. the root repo and public packages were versioned at `1.0.0`
2. the current GitHub workflow only publishes:
   - `@air-jam/sdk`
   - `@air-jam/server`
   - `create-airjam`
3. `create-airjam` depends on workspace packages that are not published at all
4. old npm versions exist, but they are pre-reset legacy artifacts rather than a supported line
5. the landing page implies the plain install path should work

That means the current state has a product mismatch:

1. the install command is publicly implied
2. the current workflow does not actually produce a complete npm install graph

We should fix that directly rather than hiding behind prerelease language.

## Product Position

This plan adopts the following support stance.

### Supported line

The new public release line published from this repo is the only officially supported npm lane.

That means:

1. current scaffold
2. current SDK/runtime contracts
3. current CLI flow
4. current hosted release flow

### Legacy line

Older published npm versions remain installable, but are not supported by us.

That means:

1. we do not promise compatibility with the current platform/runtime model
2. we do not promise compatibility with current Arcade behavior
3. we do not promise ongoing fixes

### Arcade is separate

Hosted/public Arcade compatibility is its own product surface.

This plan only defines the public npm package lane. Legacy npm installs and current hosted Arcade should not be treated as the same compatibility promise.

## Non-Goals

This plan does not:

1. retroactively support old npm package lines
2. preserve old runtime contracts as first-class supported architecture
3. require the first public npm lane to be labeled `1.0.0`
4. force a full switch to Changesets immediately
5. publish internal deployment infrastructure like the release browser worker

## Recommended Versioning Strategy

### Decision

Use a stable pre-1.0 release line, not a prerelease tag and not `1.0.0`.

Recommended version:

1. `0.9.0`

### Why

This gives us:

1. a real `latest` install path
2. honest avoidance of a “true v1” claim
3. no `@next` friction on the landing page
4. clear room for a later `1.0.0`

### Explicit rejection

Do not use:

1. `1.0.0` for the first supported npm lane if we do not want to call that the real v1
2. `0.9.0-beta.0` if the landing page should continue to say plain `npx create-airjam`

If the public install command is plain `npx create-airjam`, then the lane should publish to `latest`, and a stable non-prerelease version is the right shape.

## Dist-Tag Strategy

### Required outcome

The public install command should work as:

```bash
npx create-airjam
```

### Decision

Publish the new release line to:

1. npm dist-tag `latest`

### Why

Because npm resolves:

1. `npx create-airjam` -> `latest`
2. `npx create-airjam@next` -> `next`

If the landing page continues to advertise the plain command, `latest` is the only coherent target.

## Release Entry Paths

This plan intentionally supports two release entrypoints.

### Path 1. Manual GitHub-triggered publish

Use `workflow_dispatch` when we want an explicit release button.

This is the correct first-release lane because it:

1. keeps intent explicit
2. lets us choose `latest` or `next`
3. allows partial package publishes if ever needed for recovery

### Path 2. Automated GitHub tag-triggered publish

Use a dedicated release tag to trigger a full publish without opening the workflow UI.

Recommended tags:

1. `release/public-v<version>`
2. `release/public-next-v<version>`

Examples:

```bash
git tag release/public-v0.9.0
git push origin release/public-v0.9.0
```

```bash
git tag release/public-next-v0.9.1
git push origin release/public-next-v0.9.1
```

Tag meaning:

1. `release/public-v*` -> publish full supported public graph to npm `latest`
2. `release/public-next-v*` -> publish full supported public graph to npm `next`

### Why both paths matter

This keeps the release lane flexible without adding architectural clutter.

The manual path is good for:

1. the first supported public release
2. one-off recoveries
3. explicit operator control

The tag path is good for:

1. repeatable GitHub-native automation
2. auditable release intent in git history
3. future release tooling integration without changing the publish engine

### CLI front door

The repo should expose a maintainer front door for both paths so agents do not
need to remember raw `gh` arguments.

Recommended commands:

```bash
pnpm release:public
pnpm release:public:next
pnpm release:public:tag
pnpm release:public:tag:next
```

Equivalent repo CLI forms:

```bash
pnpm run repo -- release trigger --channel latest --package all-public
pnpm run repo -- release tag --channel latest
```

## Legacy Package Policy

### Decision

Keep old packages published, but deprecate them.

### Why

This preserves:

1. old project installs
2. user ability to recover or inspect old setups
3. ecosystem stability

While still making our support stance explicit.

### npm policy constraint

Unpublishing is restrictive and should not be the default strategy.

Important npm rules:

1. broad unpublish is normally only available within 72 hours for new packages without dependents
2. even if a version is unpublished, that exact `name@version` can never be reused
3. full-package unpublish can also block republishing the same package name for 24 hours

So the default migration tool here is:

1. `npm deprecate`

not:

1. `npm unpublish`

### Required deprecation stance

Deprecate currently published legacy versions with clear messaging.

Examples:

1. `create-airjam@"<=0.2.1"`
2. `@air-jam/sdk@"<=0.1.4"`
3. `@air-jam/server@"<=0.1.4"`

Message shape:

1. “Legacy pre-reset Air Jam package. No longer officially supported. Use the current release line.”

## Public Package Graph

### Current problem

The existing workflow publishes only three packages, but `create-airjam` depends on unpublished workspace packages.

That means the current workflow cannot produce a trustworthy public CLI install lane.

### Required package set

The first supported public npm lane should publish this graph:

1. `@air-jam/runtime-topology`
2. `@air-jam/env`
3. `@air-jam/sdk`
4. `@air-jam/harness`
5. `@air-jam/devtools-core`
6. `@air-jam/mcp-server`
7. `@air-jam/server`
8. `create-airjam`

### Explicit exclusion

Do not publish:

1. `@air-jam/release-browser-worker`

Reason:

1. it is deployment/runtime infrastructure, not a normal npm consumer package

## Required Workflow Changes

## Workstream 1. Fix package version scope

### Goal

Move all public packages in the supported graph to `0.9.0`.

### Required changes

Update:

1. `packages/runtime-topology/package.json`
2. `packages/env/package.json`
3. `packages/sdk/package.json`
4. `packages/harness/package.json`
5. `packages/devtools-core/package.json`
6. `packages/mcp-server/package.json`
7. `packages/server/package.json`
8. `packages/create-airjam/package.json`

### Acceptance criteria

1. all public packages share the same release version
2. dependency references between them remain coherent after publish

## Workstream 2. Expand publish workflow

### Goal

Make GitHub publish the full public package graph, not only part of it.

### Current workflow

Current file:

1. `.github/workflows/publish-packages.yml`

Current publish coverage is insufficient for `create-airjam`.

### Required changes

Expand the workflow to cover the full supported graph in deterministic dependency order.

The workflow should support:

1. `workflow_dispatch` manual release selection
2. tag-triggered automated full releases
3. `latest` and `next` channel selection
4. ordered publish execution using `pnpm publish`

The matrix should be package-data-driven and explicit. Avoid hidden inference.

### Acceptance criteria

1. every package required by `create-airjam` on npm is published by the workflow
2. workflow still supports publishing one package or the full set intentionally
3. tags and GitHub releases remain package-specific and clear

## Workstream 3. Define package ordering

### Goal

Ensure publish order respects the package dependency graph.

### Required order

Publish in dependency-safe order:

1. `@air-jam/runtime-topology`
2. `@air-jam/env`
3. `@air-jam/sdk`
4. `@air-jam/harness`
5. `@air-jam/devtools-core`
6. `@air-jam/mcp-server`
7. `@air-jam/server`
8. `create-airjam`

### Why

Package publication should not rely on npm eventually seeing dependencies later in the same matrix in a nondeterministic way.

### Preferred implementation

Use ordered jobs or small grouped stages rather than one fully parallel matrix for the first release lane.

Parallelism is not worth ambiguity here.

### Acceptance criteria

1. installability is deterministic during release
2. `create-airjam` publish never races against missing dependencies

## Workstream 4. Publish to `latest`

### Goal

Make the public install path work as implied by the landing page.

### Required change

Publish with:

```bash
npm publish --access public --tag latest
```

or simply `npm publish --access public` if `latest` is intentionally the default path used by the workflow.

### Acceptance criteria

1. `npm view create-airjam dist-tags`
2. `npx create-airjam`

both reflect the supported line correctly

## Workstream 5. Deprecate old published versions

### Goal

Preserve legacy installs while making support stance explicit.

### Required change

Add a one-time deprecation step for old versions.

This should not be a permanent automatic step on every publish forever. It is a transition task.

### Acceptance criteria

1. legacy package installs print clear deprecation warnings
2. old versions remain available
3. users are pointed toward the supported line

## Workstream 6. Prove the public install lane

### Goal

Do not declare success until the actual install path works.

### Required smoke checks

At minimum:

```bash
npm view create-airjam version dist-tags
npx create-airjam --help
npx create-airjam <tmp-project>
```

Then in the scaffolded project:

```bash
pnpm install
pnpm run dev
```

Also run the repo-side scaffold verification against the real registry lane:

```bash
pnpm test:scaffold:registry
```

### Acceptance criteria

1. `npx create-airjam` resolves the intended public package
2. scaffold creation works
3. generated project installs and boots
4. registry smoke passes

## GitHub Automation Strategy

## Short-term strategy

Keep a manual GitHub-triggered workflow for the first supported release lane.

Use:

1. `workflow_dispatch`

Why:

1. first supported release should be explicit and supervised
2. there are still packaging and dependency-chain changes to settle

## Long-term strategy

Move to a versioned monorepo release system after the first working lane is proven.

Recommended long-term tool:

1. Changesets

### Why Changesets is the right long-term answer

This repo is now a real multi-package monorepo with:

1. shared public package graph
2. cross-package dependency updates
3. future stable/prerelease lanes
4. a need for auditable version bumps and release PRs

Changesets gives:

1. package-by-package bump intent
2. coherent monorepo version propagation
3. release PRs
4. publish automation after merge
5. prerelease support if needed later

### Decision

Do not require Changesets to ship the first supported public lane.

But do treat it as the intended next step after the first successful public npm release.

## Documentation And Product Copy Requirements

## Landing page

If this plan is completed as intended, the landing page may honestly continue to say:

```bash
npx create-airjam
```

If this plan is not completed, the landing page must not imply that the plain install path works.

## Docs

Update release/install docs to reflect:

1. supported public package line
2. legacy unsupported versions
3. npm/GitHub release flow

## Risks

### Risk 1. Partial package publish

If only `create-airjam`, `sdk`, and `server` are published again, the public CLI lane remains incomplete.

### Risk 2. Premature `1.0.0`

If we publish `1.0.0` now only because the workflow exists, we create a version promise we do not want yet.

### Risk 3. Overuse of prerelease tags

If we publish only `next`, the landing-page install story is false unless we change public copy.

### Risk 4. Accidental internal-package publication drift

If more internal packages start appearing, the release graph can become muddy again unless the public package set is named explicitly.

## Open Decisions

These should be resolved during implementation:

1. whether all public packages should be kept at one shared version or whether leaf infra packages can diverge later
2. whether the first release workflow should expose package groups such as `core`, `cli`, `all-public` instead of individual package ids only
3. whether the deprecation step should live in GitHub automation or be a one-time manual release action
4. whether the first supported release should be `0.9.0` exactly or another stable pre-1.0 value

## Recommended Execution Order

1. finalize support policy and version choice
2. update all public package versions
3. expand the GitHub publish workflow to the full public graph
4. encode deterministic publish ordering
5. run repo release validation
6. publish the first supported npm line to `latest`
7. run real registry install smoke checks
8. deprecate old published versions
9. update docs and install copy if needed
10. plan the Changesets migration after the first successful lane is proven

## Completion Criteria

This plan is complete only when all of the following are true:

1. `npx create-airjam` works from npm without extra tags
2. the published package graph is complete and installable
3. old published versions remain available but clearly deprecated
4. the supported package line is not mislabeled as `1.0.0` unless we intentionally decide that
5. GitHub can trigger the release flow cleanly
6. release docs and public product copy are aligned with reality
