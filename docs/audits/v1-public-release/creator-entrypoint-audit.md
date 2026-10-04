# Creator entrypoint audit

Date: 2026-09-11
Last updated: 2026-10-04
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
427 with 60 database tests skipped. The separately run four game suites passed 111. Database skips are not live-database proof, and this local batch is not a
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

## Release upload recovery follow up

On 2026-10-04, source inspection found that the selected build and version label
remained editable throughout an upload. A successful upload cleared the controls,
including any replacement file or label selected while it was running. This
could make a creator lose the selection intended for their next release.

The complete draft, upload-target, file-transfer and finalization operation now
has one TanStack mutation owner. Its submitted inputs and Upload button stay
disabled until the operation settles. Failures retain the file and label for an
explicit retry; success clears them only after finalization accepts the uploaded
generation. Automatic workflow retries are disabled because draft creation is
not idempotent. The layout, upload limits, API and CLI publishing path are unchanged.

Six new React tests use real TanStack mutation state with mocked service and
storage responses. They cover each of the four pending stages, retained inputs
and visible feedback after failure, rejection of duplicate pending clicks, a
failed HTTP transfer followed by an explicit retry, and successful submission of
the exact file and generation. Before the fix, three initial regression cases
failed because the inputs were not disabled. After the fix, all six upload tests
and seven existing creator entrypoint tests passed in a 1.41-second Vitest run.

The scoped changed gate passed implementation typechecking and lint in 6.07
seconds, exceeding its five-second target while separate test typechecking and
lint ran concurrently. Both test files were explicitly typechecked with zero
diagnostics, because the ordinary platform configuration excludes tests. Direct
ESLint also passed for all three implementation/test files. No full batch,
independent merge review, browser rendering or real hosted upload was claimed
for this focused local change. The hosted creator lifecycle and final desktop/
mobile release proof remain open.

## Managed media recovery follow up

The 2026-10-04 pass also found that a failed media read appeared to be an empty
asset history, and that one page-wide pending marker could not correctly track
overlapping thumbnail and cover uploads. Editable file inputs had the same
selection-loss risk as release uploads. Upload, assignment and archive failures
used blocking browser alerts rather than persistent recovery feedback.

The page now uses the existing retry notice, keeps cached assets visible during
a failed refresh, and shows empty history only after a successful read. Each of
the three existing media cards owns its selected file and upload lifecycle.
Thumbnail, cover and video uploads remain independent; completing one cannot
clear another card's pending state or file. Successful finalization clears only
the submitted card. Failed uploads retain their file, and errors stay inline.
Assignment and archive use their existing tRPC mutation state directly rather
than an additional workflow wrapper. Upload limits, domain services, the CLI
media lifecycle and visual layout are unchanged.

Nine React regressions cover loading/error/empty distinctions, cached media and
retry state, failures at each upload stage followed by an explicit retry,
overlapping uploads with independent completion, existing size-limit rejection,
and assignment/archive failures. They use real TanStack mutation state with
mocked API/storage IO. All nine initially failed against the old page. The final
combined run passed these nine cases, six release-upload cases and seven creator
entrypoint cases in 1.58 seconds. Two intermediate action assertions required a
test-adapter correction for TanStack's mutation context; this was not a provider
or domain-service failure.

The implementation changed gate passed typechecking and lint in 5.95 seconds,
above its five-second target. All three creator test files also passed explicit
TypeScript checking with zero diagnostics; direct lint passed for the media
implementation and test. This is local source/React proof, not a browser visual
check, live media upload, final merge review or production rollout. The full
hosted creator lifecycle and physical/mobile release proof remain open.

## Security settings recovery follow up

The 2026-10-04 settings pass found that a failed initial read appeared as a
missing App ID. Saving settings used a discarded rejecting promise and browser
alerts; regeneration automatically closed its confirmation before the server
responded, hiding failures. Clipboard denial also had no recovery feedback.

The existing page now distinguishes loading, failed reads and an absent identity,
offers retry, and keeps cached settings visible during a failed refresh. Saving
origins retains the draft on failure and shows inline results. Save and
regeneration share a pending lock because they update the same identity record;
neither can overwrite the other through overlapping requests. The confirmation
retains the existing invalidation warning, stays open during regeneration, and
shows failures beside an explicit retry. Successful mutations cancel stale reads
and update the canonical query cache from the server response before refreshing.
A failed refresh therefore cannot leave the replaced App ID displayed as current.
Clipboard errors are visible, and the origin input and key visibility controls
are named. No permission rules, origin normalization, API, CLI or database
contract changed; no real key was regenerated.

Seven new React regressions exercise actual TanStack query/mutation state and
the installed Radix confirmation, with mocked server and clipboard IO. They
cover initial read failure/retry, cached refresh failure, pending and failed
regeneration with explicit retry, cancellation without a request, normalized
save acknowledgement despite refresh failure, retained drafts after save
failure, and clipboard denial/retry. Five of the original six cases failed
against the old implementation. The combined creator run passed all 29 tests
in 1.75 seconds, including the release and media regressions.

Source typechecking and lint passed through the scoped gate in 6.95 seconds,
above the five-second target while explicit test typechecking and direct lint
ran concurrently. The new test file also passed explicit TypeScript checking
with zero diagnostics. These are local source and React checks, not visual,
live-account, hosted-candidate, independent review or production evidence.
The creator lifecycle and final desktop/mobile release validation remain open.

## Game overview draft and recovery follow up

The 2026-10-04 overview pass reproduced a profile draft being erased by unrelated
game-query updates, including optimistic Arcade listing and its rollback. The
form reset whenever the game object changed. Initial query failures appeared as
a missing game, and failed secondary reads appeared as missing identity, no
releases or no activity. Profile saves used browser alerts and swallowed promise
rejections; clipboard denial escaped as an unhandled rejection.

The game loader now narrows successful data before mounting an editor keyed by
game identity. That editor owns the profile draft independently of background
reads and visibility changes. Its values reset only when a save is accepted or
another game is opened. Accepted profile fields update the canonical game cache
without replacing managed media URLs; failed saves retain the draft. Pending
profile and listing writes cannot overlap, and inputs are locked while a write
is pending. A failed optimistic listing change rolls back only visibility, not
the entire game record, and shows inline feedback. Read, save, listing and copy
failures use existing recovery components. Slug-check failure is unknown, not
proof that a slug is taken; its retry remains explicit and the server retains
final validation authority. The slug label now names its actual input, and save
confirmation disappears when a new unsaved edit is made. The API, CLI,
publishing eligibility, permission rules and successful-page layout are unchanged.

Eight React regressions use real TanStack query/mutation state and the installed
form and switch components, with mocked service/clipboard IO. They cover initial
game read failure/retry, drafts surviving refresh and listing rollback, failed
save recovery with pending locks, accepted cache updates despite refresh failure,
fresh state for a different game, truthful failed secondary reads, clipboard
denial/retry, and slug-check failure versus confirmed unavailability. Six of the
original seven cases failed against the old page, and clipboard denial produced
an unhandled rejection. The fake-clock slug test was corrected to flush the query
notifications after the debounce-driven render. The final combined run passed
all 37 creator cases in 2.41 seconds with no unhandled errors.

Source lint/typechecking and explicit test-file typechecking pass. The first
scoped gate took 8.62 seconds under concurrent checks; after the final corrections
it took 6.13 seconds, still above the five-second target. Test lint also passes.
No full-batch review, browser rendering, hosted write, live key, provider change,
commit, push, merge or deployment occurred. Final hosted creator and desktop/
mobile release validation remain open.

## Integrated creator recovery validation

On 2026-10-04, `pnpm check:batch` completed with exit code zero for the current
integrated worktree. It checked generated platform sources, full workspace
typechecking, lint, canonical guards and the repo test sequence. The platform
suite reported 660 passing tests and 117 skipped tests across 106 passing and
21 skipped files. Those skips include PostgreSQL integration suites and the
opt-in Cloudflare game-capture test; this run does not replace their separately
required runtime evidence. All 37 creator recovery cases ran and passed.

The recovery changes are not a standalone production patch: they use shared
components from the pending intermediate-delivery integration, including
`RetryNotice`, which is absent from the current local `main` baseline. A partial
cherry-pick without its dependencies is not a valid delivery path. The separately
authorized GPT-6.1 Sol canonicality review found no actionable source blockers
in the new delta since `c8b3b676`. Green GitHub review, hosted creator validation
and coordinated production delivery remain separate requirements. The Cloudflare isolation
decision is still pending and the production capture transport is unchanged.
