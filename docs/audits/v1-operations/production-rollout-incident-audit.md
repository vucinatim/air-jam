# Production Rollout Incident Audit

Last updated: 2026-08-31
Status: corrective implementation and independent reviews locally proven; production verification pending

## Outcome

The platform deployment created after PR `#73` did not become healthy on
Railway. Railway retained the preceding successful deployment, so the public
site continued returning `200`; this was a failed rollout, not a confirmed user
outage.

The failure exposed a process problem as well as two runtime-contract defects.
Green pull-request CI and preview deployments were treated as sufficient even
though the production deployment had not reached terminal `SUCCESS`, and PRs
`#72` and `#73` were merged with GitHub still reporting `REVIEW_REQUIRED` and
zero submitted reviews.

This audit is durable incident evidence. The readiness manifest remains the
execution-state authority.

## Timeline And Evidence

1. PR `#72`, hosted-release origin isolation, merged at
   `2026-08-30T07:54:44Z` as commit
   `69b17b5479ab8ac757465e08eaa0528ad87d0a56`.
2. PR `#73`, release-origin attestation, merged at
   `2026-08-30T08:31:25Z` as commit
   `006924de5fbcf22507913501afd30a8e860a5167`.
3. Both PRs had successful CI and ephemeral Railway preview checks, but both
   still reported `REVIEW_REQUIRED` with no submitted GitHub reviews.
4. Production platform deployment
   `2209f79f-c58c-452f-9032-7576fcb25c2f` started Next successfully at
   `2026-08-30T08:33:51Z`, remained unapproved by Railway's healthcheck, and
   was stopped at `2026-08-30T08:40:16Z` with terminal status `FAILED`.
5. On `2026-08-31`, the repo-owned Railway doctor still reported that failed
   deployment as the newest platform deployment while the server and release
   browser worker were `SUCCESS`.
6. The public `https://airjam.io/api/health` endpoint still returned `200` from
   the previous platform revision. Its older payload did not contain the
   deployment identity introduced by PR `#73`, confirming that the failed
   candidate had not replaced the serving revision.

## Root Causes

### Deployment liveness was coupled to product readiness

`/api/health` returned `503` when the hosted-release origin boundary was not
ready. That made an optional-to-configure release-domain dependency part of the
platform process liveness contract. Railway correctly interpreted the response
as a failed deployment even though Next itself was running.

The canonical split is now:

1. `/api/health`: process liveness only; a running platform returns `200`
2. `/api/readiness`: release origin and other product/dependency readiness;
   valid unready state returns `503` with a machine-readable reason

Release-origin inspection and attestation use readiness. Railway deployment
health uses liveness.

### Railway's probe host was rejected by production host policy

Railway calls the configured healthcheck using `Host:
healthcheck.railway.app`. The production proxy rejected unknown hosts before
the request could reach `/api/health`.

The corrected rule makes exactly `/api/health` host-independent. A hostname
allowlist would not add security because clients can choose the HTTP `Host`
header, and it would couple the liveness contract to one provider's current
probe identity. `/api/readiness`, application routes, and release routes remain
under the normal fail-closed host policy. The exception therefore restores
portable process liveness without widening application routing authority.

### Built-origin drift proof tested source behavior, not the artifact

The build/runtime origin guard read an environment variable through a dynamic
object lookup. Next did not reliably inline that expression into the standalone
artifact, so source-level tests could pass while the deployed bundle lost the
build-time value.

The implementation now uses an explicit build-time environment reference and
the deploy check boots the emitted `.next/standalone` server. One boot proves a
matching build/runtime origin is ready; a second boot deliberately changes the
runtime origin and must return `503 invalid`. This is artifact evidence rather
than an inference from unit tests.

## Corrective Proof

The recovery branch currently proves:

1. `44` focused platform liveness, readiness, host-policy, and origin tests
2. `20` repo CLI inspection and attestation contract tests
3. platform TypeScript and focused ESLint checks
4. a clean hermetic install and production Next build
5. the real standalone bundle answering Railway's exact liveness probe with
   `200`
6. the same bundle exposing ready release-origin state at `/api/readiness`
7. the same built bundle rejecting deliberate build/runtime origin drift with
   `503`
8. a final Claude Opus hostile review with no actionable blockers
9. a resumed Canonicalizer review with verdict `ready` after its two structural
   findings were fixed

Production is not considered recovered until the merged corrective commit has
a Railway platform deployment with explicit terminal `SUCCESS` and the live
liveness/readiness responses are inspected against that deployment identity.

## Process Lessons

The canonical current review, merge, and production-delivery rules live in
[Working Agreements](../../working-agreements.md#review-stacks-and-integration).
The incident produced these lessons that shaped that policy:

1. preview success proved the candidate, not that production accepted the
   merged revision
2. the rollout remained incomplete until provider state reached terminal
   `SUCCESS`
3. the newer terminal `FAILED` deployment remained incident evidence even while
   the previous revision kept serving traffic
4. locally completed agent reviews did not replace attached exact-head evidence
   or a formal GitHub approving review
5. source-only tests missed a contract that depended on framework build-time
   transformation; the corrective proof therefore exercised the production
   artifact
6. collapsing deployment liveness, dependency readiness, and product capability
   readiness made an optional capability block a healthy process rollout

This audit records why those rules exist; it is not a parallel operating-policy
owner.

Gate `G5-02` owns mechanical enforcement for review evidence and post-merge
Railway verification through the repo CLI and required automation.

## Incident Closure Steps

1. close Gate `G5-05` by establishing an independent automated reviewer identity
   and non-bypassable branch protection for its exact-head attestation
2. merge recovery PR `#76` only after its exact agent reviews and protected
   automated attestation pass with the incident evidence attached; PR `#77`
   defines the future canonical policy and is not treated as if it were already
   present on `main`
3. observe PR `#76`'s exact production platform deployment through terminal
   `SUCCESS`
4. inspect live `/api/health` and `/api/readiness` with deployment identity
5. re-resolve PR `#77` after its base changes, rerun both exact-base-and-head
   agent reviews, obtain the protected automated attestation, and merge it
   independently
6. repair, rebase, review, and roll out PRs `#74` and `#75` independently

The Claude Opus and Canonicalizer evidence listed above predates the exact-head
attachment standard introduced by PR `#77`; it remains incident evidence but is
not a protected automated review attestation.
