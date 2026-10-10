# Air Jam Framework Work Ledger

Last updated: 2026-10-10
Status: historical framework memory

This ledger records public framework milestones after ownership separation.
Earlier whole-product history remains preserved in the private product ledger
and this repository's Git history. Its local pre-separation snapshot is also
retained in the ignored migration recovery archive.

## 2026-10-09 Framework documentation ownership separated locally

Creator documentation now has one public authored source and catalog. The CLI
packages verified website MDX alongside agent guidance, and the private website
consumes supported package exports. The 16-page installed-artifact qualification
passed the CLI and private render checks before this internal-document move.

179 internal documents were removed from the public tree only after confirming
their originals were present in private Git history and their current private
owners existed. The existing private documentation architecture changes were
preserved rather than overwritten. Eight mixed root snapshots were retained
before replacing public orientation with framework-scoped guidance.

This ownership cut was committed in the local extraction branch. Publication,
deployment images, reviewed delivery, production source handover and Studio
restoration remain separate unfinished requirements.

## 2026-10-09 Canonicality review follow-ups

The separation review confirmed the package and server-composition boundaries.
Its actionable follow-ups removed private deployment instructions from public
contribution guidance, corrected the architecture source and generated creator
documentation, and consolidated clean package-consumer proofs behind one runner.
The server and library scenarios both passed against the existing candidate
archives; the regenerated documentation still needs a newly packed CI candidate.
Focused contract tests, lint and generated-document freshness passed. No source
handover or production change occurred.

## 2026-10-09 Clean-checkout MCP typecheck dependency corrected

The first Linux PR run exposed MCP consumer tests importing distribution files
before the package's own build was guaranteed to finish. Typechecking now uses
the existing locked build helper for the MCP package itself; its build owns its
devtools prerequisite. The cold package check passed after moving only its
generated distribution into recoverable temporary storage. All 13 public package
boundary tests pass. The failed CI run remains evidence, not a delivery pass.

## 2026-10-09 Release candidate dependency audit correction

The immutable candidate audit rejected pinned MCP SDK 1.30.0 for
[GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h).
The MCP dependency now pins patched 1.32.1 through pnpm's normal update, including
the regenerated lock. All 14 MCP tests and its typecheck pass; release candidate
auditing still needs its corrected CI run. No audit exception was introduced.

## 2026-10-09 Installation evidence corrected for optional libraries

Cross-platform scaffolding passed discovery, development lifecycle and all
quality checks, then failed its version inventory by requiring optional framework
libraries at the project root. The inventory now derives its required set from
the existing package ownership metadata. Required tools still fail when missing;
optional-library candidate integrities remain checked when installed, and clean
library consumers qualify their independent use. All 15 bootstrap/matrix tests
pass. Controller bridge tests also wait for actual asynchronous effects instead
of assuming a zero-delay timer delivers MessageChannel traffic; all six pass.
Neither correction changes player runtime behavior or weakens release gates.

## 2026-10-09 Separation review contracts corrected

The single Opus 5.5 GitHub review of PR #114 identified two workspace seams:
the generic server image's start command and devtools guessing a private CLI
layout. The image configuration now uses its actual Node entrypoint. Owning
workspaces declare one CLI and their supported modes in root package metadata;
real start, inspect and stop tests cover standalone and both Arcade modes with
no framework source copies. Unsupported modes fail before starting a process.

Logging composition now preserves the same disabled-collector sentinel across
its exported helper and server options. Built-in production authentication
disabled explicitly emits a warning; local master-key startup logs no key, and
injected adapters retain their own reporting. Packaged documentation declares
its required renderer components, rejects undeclared tags, and clarifies that
signed host grants need a verifying backend rather than a standalone env secret.
Generated guidance was refreshed from the public source. Stale patch guidance,
state claims and empty Drizzle placeholders were removed or corrected.

The complete test stage passes after updating fixtures to declare their
workspace. Full typechecking, lint and canonical checks pass; the scoped changed
gate completes in 3.339 seconds. Both clean package-consumer proofs pass against
the same packed family: strict library/helper/doc usage and typed server logging
composition, plus real room/controller traffic, child launch, state sync,
readiness and drain. The initial library proof exposed another fixture relying
on implicit workspace detection; its declaration was corrected before the pass.

Registry inspection found the three newly public names absent. The trusted
publisher now rejects missing names before any registry mutation. First-name
setup and trusted publisher configuration remain external release prerequisites;
this work neither publishes packages nor changes production deployment sources.

## 2026-10-10 Six-package structural review and cleanup

The green six-package revision `f429228e` passed CI and the complete public
installation matrix. Tim authorized an updated Opus 5.5 high-effort
[review of PR #114](https://github.com/vucinatim/air-jam/pull/114#pullrequestreview-5478936724).
It found no code merge blocker and confirmed the simpler package graph, with
eight inline cleanup findings. Private integration inspection is not the
private product's final review. Existing tarballs contain the MIT license;
an initial unsupported license-omission claim was removed before submission.

The approved response removes the unused devtools root barrel, adds an explicit
controller entry, and exports public types beside their owning operation.
One package tsup configuration builds modules and all six executable helpers.
Workspace declarations work without root SDK dependencies; real launch, topology
and stop tests cover all three modes and name-ordered default selection.
Historical-path and script-spelling tests, the separate helper builder, dead
visual shims, duplicate standalone start configuration and internal env pack
hooks are gone. Actual ownership, dependency, installed-runtime and containment
checks remain.

Creator MDX copies are now ignored build outputs rather than tracked source;
the authored pages and catalog are unchanged, and packages still include the
complete verified snapshot. The workspace protocol has its own contract,
devtools has a package guide, and stale current-state/release-trust text and
Pong's host-grant caveat are corrected. The Pong scaffold archive was regenerated.

Full typechecking, lint and canonical stages pass. All test-stage components
pass, including 134 devtools, 14 MCP, 66 CLI, 131 server and 313 SDK tests,
scaffold extraction checks and all reference-game suites. The initial batch
caught a test referencing the removed root; focused correction retained its
built game-session smoke. Scaffold freshness then caught the changed Pong
README; regeneration and its affected tests passed. No gate was weakened.

`repo pack verify-local --json` qualifies exact local set
`local-scaffold-20261010T125053Z-1b2f10df`: typed isolated consumers, shipped
helpers, workspace discovery without source copies, all 16 documentation pages,
real room/controller and child-state traffic, readiness and drain. Fresh pushed
CI and matrix proof remain distinct from this local evidence.

The one final Canonicalizer pass returned `ready` in session
`f96c56a3-7484-41d1-817b-24d4628a81ef`, with no required implementation round.
It confirmed module/build/documentation ownership and the retained substantive
test boundaries. Harmless helper declaration outputs and possible future
type-definition relocation are not delivery work.

npm registration and trusted publishers are configured for all six names.
CLI and devtools retain npm-generated first-name placeholders; no 0.9.3
implementation is published. Publication, private qualification, guarded
Railway handover and Studio restoration remain separate delivery requirements.
