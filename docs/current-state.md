# Current State

Last updated: 2026-10-09
Status: local framework separation candidate

The public framework is being separated from the private Air Jam product.
This checkout is not yet merged, published or handed over to production.

## Established local boundary

The eight-package foundation owns the SDK, standalone server, CLI, MCP,
environment contracts, harness, creator tooling and scaffolder. Reference
games remain public. The normal `pnpm run dev` command starts a standalone game
and server without product accounts, a database or provider credentials.

The private production-baseline checkout consumes exact candidate package
archives. Explicit local attachment permits framework development without
changing dependency manifests or lockfiles. It does not introduce a private
SDK fork.

Creator documentation has one public source. Its packaged MDX snapshot and AI
pack serve the private website and external agents. Installed-artifact checks
cover all 16 creator pages, and the private render checks preserve headings,
code examples, diagrams and search metadata.

Internal product plans, operational contracts, audits and whole-product history
now have a private owner. Their removed public copies and the prior root
snapshots are recoverable from Git and the ignored local migration archive.

## Still required

Reference-game ownership, private documentation and Studio/separation memory are
reconciled locally. Private startup and the baseline creator/player journey pass
against installed candidate packages. The final public batch stages pass after
updating a stale CLI export assertion to include the shared documentation API.
The initial batch and repaired test-stage logs remain in
`.airjam/separation-final-batch-20261009.log` and
`.airjam/separation-final-tests-20261009.log`.

1. Build and exercise independent private deployment images against installed
   packages; the local Docker disk currently fails the capacity preflight.
2. Complete substantial-batch canonicality review, green paired delivery and
   guarded production source handover.
3. Restore the preserved Studio work on a private feature branch and qualify its
   complete journey before resuming feature development.

The approved private product repository `vucinatim/air-jam-platform` now exists
and is connected locally. Its `main` contains the reviewed production baseline
`263f0edf`; neither separation branch has been pushed. No package publication,
production source transfer, license change or Studio database
migration has occurred in this separation.

## Delivery guard

Do not merge removal of the public product paths while Railway's previous
automatic deployment source still points to them. The existing serving
deployment must remain available while the reviewed private replacement is
qualified and the source handover is performed.

The private product separation plan owns that sequence. Public framework gates
alone do not establish product or production readiness.
