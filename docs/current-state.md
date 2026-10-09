# Current State

Last updated: 2026-10-10
Status: six-package consolidation passes local batch and isolated consumer proof; delivery pending

The public framework is being separated from the private Air Jam product.
The separation branches are pushed and under review, but neither is merged.
Candidate packages are not published and production still serves the previous
public-repository deployment.

## Framework boundary

The six-package foundation owns the SDK, standalone server, CLI, MCP,
shared devtools and scaffolder. Devtools includes the evaluation harness;
environment validation remains an internal helper. Reference games
remain public. The normal `pnpm run dev` command starts a standalone game and
server without product accounts, a database or provider credentials.

The private product consumes exact candidate package archives. Explicit local
attachment permits framework development without changing dependency manifests
or lockfiles; it does not introduce a private SDK fork.

The consolidated family passes `pnpm check:batch` and packed, isolated consumers
for typed imports, real room/controller/state traffic, MCP discovery and shipped
helper execution. All six archives install in the private product with exact
integrity and packaged-content matching. These are local candidate results, not
published-package or new-head CI evidence.

The final canonicality pass cleared the corrected six-package export surface.
The regenerated set `local-scaffold-20261009T233400Z-d2ce0d7e` passes isolated
typed/runtime consumer checks; full typechecking/lint, 134 devtools tests,
33 package/release/bootstrap contracts, 66 CLI tests and 14 MCP tests pass after
the corrections. Published MCP configuration exports remain intact.

Creator documentation has one public source. Its packaged MDX snapshot and AI
pack serve the private website and external agents. Installed-artifact checks
cover all 16 creator pages. Product plans, operational contracts and product
history have a private owner; prior public snapshots remain recoverable in Git.

## Reviewed delivery

[The public separation PR](https://github.com/vucinatim/air-jam/pull/114)
passed CI and the six-cell Node and operating-system installation matrix for
the preceding eight-package candidate.
One independent Opus 5.5 review is recorded on GitHub. Its code corrections
were qualified; the new consolidation requires fresh artifact qualification.

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
publication, production source transfer or Studio database migration has occurred
during this separation. The public MIT license is unchanged.

## Delivery guard

Do not merge removal of the public product paths while Railway's previous
automatic deployment source still points to them. Keep the existing serving
deployment available while the reviewed private replacement is qualified and
the source handover is performed.

The private product separation plan owns that sequence. Public framework gates
alone do not establish product or production readiness.
