# Current State

Last updated: 2026-10-09
Status: reviewed framework separation candidate

The public framework is being separated from the private Air Jam product.
The separation branches are pushed and under review, but neither is merged.
Candidate packages are not published and production still serves the previous
public-repository deployment.

## Framework boundary

The eight-package foundation owns the SDK, standalone server, CLI, MCP,
environment contracts, harness, creator tooling and scaffolder. Reference games
remain public. The normal `pnpm run dev` command starts a standalone game and
server without product accounts, a database or provider credentials.

The private product consumes exact candidate package archives. Explicit local
attachment permits framework development without changing dependency manifests
or lockfiles; it does not introduce a private SDK fork.

Creator documentation has one public source. Its packaged MDX snapshot and AI
pack serve the private website and external agents. Installed-artifact checks
cover all 16 creator pages. Product plans, operational contracts and product
history have a private owner; prior public snapshots remain recoverable in Git.

## Reviewed delivery

[The public separation PR](https://github.com/vucinatim/air-jam/pull/114)
passed CI and the six-cell Node and operating-system installation matrix.
One independent Opus 5.5 review is recorded on GitHub. Its findings are being
addressed before requalifying the updated artifacts.

The paired private candidate passed its full CI, including isolated deployment
image startup, schema readiness and platform, realtime and worker health.
This proves the candidate services start together, not that production has been
transferred. The private separation plan owns that delivery evidence.

## Still required

1. Finish review corrections and qualify the updated public package family.
2. Validate the private product against those exact artifacts and then the
   published packages, including its final independent review.
3. Complete the guarded production source handover with live creator and
   player validation and a retained rollback path.
4. Restore the preserved Studio work by ownership and qualify its complete
   journey before resuming feature development.

The unfinished Studio branch is preserved on the private remote. No package
publication, production source transfer, license change or Studio database
migration has occurred during this separation.

## Delivery guard

Do not merge removal of the public product paths while Railway's previous
automatic deployment source still points to them. Keep the existing serving
deployment available while the reviewed private replacement is qualified and
the source handover is performed.

The private product separation plan owns that sequence. Public framework gates
alone do not establish product or production readiness.
