# Air Jam Framework Work Ledger

Last updated: 2026-10-09
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
