# Creator entrypoint audit

Date: 2026-09-11
Readiness item: G6-07 — launch-critical creator/player experience
Scope: public quick start and agent discovery; dashboard game registration,
game discovery, and release upload entrypoints. Local/source proof only.

## What this pass establishes

The first creator steps now match the agent-first product direction: an existing
coding agent can discover the CLI/MCP path, work locally, and explicitly publish
through the same release services used by the optional dashboard. Nothing here
introduces a hosted editor, a new publishing workflow, or new access restrictions.

The dashboard no longer hides read failures behind a blank screen or an empty
release history. The changes retain typed query/mutation ownership and reuse the
existing shared retry presentation.

## Findings and corrections

| Finding                                                                                                            | Correction                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public For Agents linked reference pages but omitted connection and operation instructions.                        | Added project-local MCP doctor/config/init discovery, explicit distinction between configuration and actual client registration, semantic session actions, CLI equivalents, and evaluation/publishing links.                                                 |
| Quick Start assumed pnpm was installed and described publishing only through dashboard steps.                      | Added Node 22+/pnpm prerequisites, documented generator installation behavior, and the existing CLI game/auth/submit/inspect/publish path alongside the dashboard path. Publication remains explicit; a processing timeout is not described as cancellation. |
| Dashboard game search was a nonfunctional input.                                                                   | Added case-insensitive name filtering and a distinct no-matches state.                                                                                                                                                                                       |
| Failed game-list reads rendered no useful explanation.                                                             | Added retry feedback, retaining cached game links when available. Successful empty accounts remain distinct.                                                                                                                                                 |
| Dashboard cards manually simulated buttons for navigation; create links nested buttons.                            | Replaced these with native links; retained visible keyboard focus.                                                                                                                                                                                           |
| A date labeled “Updated” displayed `createdAt`.                                                                    | Labeled the displayed field “Created”; no fabricated update timestamp.                                                                                                                                                                                       |
| Create Game used a blocking browser alert, disconnected labels, and click-only submission.                         | Added a native form, associated labels, URL validation, trimmed names, pending-state duplicate protection, and inline error feedback that retains the draft.                                                                                                 |
| Release history failures said “No releases yet”; the header could claim no live release before data was available. | Added explicit loading/error/retry states while preserving cached results; associated upload/version labels and named the details control.                                                                                                                   |

No stale hosted-studio promise was found in the inspected public docs/dashboard
sources. The obsolete navbar “Studio Soon” promise was removed in the preceding
launch-experience pass, not this audit.

Integration also corrected game registration in
`apps/platform/src/server/api/routers/game.ts`: the game and its app identity now
use the same database transaction, so an identity-insert failure cannot commit a
partial registration. Three focused router tests verify shared transaction use,
error propagation, and authentication. These use a mocked transaction, not a live
PostgreSQL rollback test. Both new platform test files were explicitly included
in a TypeScript program with zero diagnostics.

Restarting the normal development stack after the documentation edit exposed a
generated-artifact sequencing bug: platform preparation regenerated managed docs
but verified them against the previous AI-pack manifest. Platform preparation now
uses the same manifest generator as the CLI build, after docs generation and
before verified export. Digest validation remains intact. Three isolated tests
cover changed bytes, invalid metadata, and unsupported managed paths; canonical
`platform generated prepare` and `platform generated check` both passed.

## Evidence

- Inspected source CLI help through `node packages/cli/bin/airjam.mjs` for `mcp`,
  `mcp config`, `mcp init`, `session open`, `auth login`, `game create`,
  `game inspect`, `game update`, `game media`, `release submit`, `release inspect`,
  and `release publish`. Public examples use the generated project's installed
  `pnpm exec airjam` entrypoint; the monorepo root does not expose that binary.
- Confirmed generator source performs `pnpm install` unless skipped, and public
  CLI/SDK packages require Node 22 or later. No new registry installation was
  performed in this pass.
- `pnpm --filter platform exec vitest run --config vitest.config.ts
src/app/dashboard/games/creator-entrypoints.test.ts`: **7 tests passed**.
  Tests exercise real React forms/links and shared retry UI with mocked queries
  and mutations: search, loading/error/cached/empty results, form trimming,
  inline failure/draft retention, pending protection, and release-history retry.
- Scoped `pnpm check:changed -- --files ...` for the three dashboard pages passed
  in **9.5 seconds**. This exceeded the 5-second warm target; it is not reported
  as meeting that latency target.
- `pnpm run repo -- content docs generate` regenerated the canonical docs source;
  `pnpm run repo -- content docs check` then passed.
- Formatting checks passed for both changed MDX pages. A source-path check found
  **13 unique internal documentation destinations and no missing pages**. This
  checks local page existence, not external-link uptime or browser anchor behavior.

## Still required for release confidence

The integrating `pnpm check:batch` completed successfully after this batch:
generated-source validation, full typechecking, lint, canonical guards, repository
contracts, operations/MCP/CLI tests, and server/SDK/platform suites. The server
passed 162 tests with 20 database tests skipped; SDK passed 272; platform passed
427 with 60 database tests skipped. The separately run four game suites passed
111. Database skips are not live-database proof, and this local batch is not a
production build, deployment, or hosted-candidate certification.

Canonicalizer session `d1d6306e-3472-46bd-b422-c078a52f6fa1` returned `ready`
after one correction round: shared Last Band Standing readiness, unused manifest
export removal, and publishing-list clarification. Only affected tests/checks
were rerun for those corrections. No GitHub merge review was requested because
this batch has not been pushed to a green, merge-ready pull request.

This is not an authenticated hosted creator-lifecycle sign-off. It did not create
an account/game on a live service, upload/publish a release, alter media/listing
visibility, or verify independent Claude Desktop installation. Those claims require
the canonical release-program work and its hosted/candidate evidence. In particular,
real authentication, an upload failure and retry, background processing status,
publication/listing, and a resulting playable release still need end-to-end proof
on the intended release candidate.

No production data, provider configuration, deployment, or public package was
changed by this pass. No commit, push, merge, or deployment was performed here.
