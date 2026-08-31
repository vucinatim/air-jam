# Production Rollout Incident Audit

Last updated: 2026-08-31
Status: deployment recovery verified; remaining release-capability and automation work tracked in Gate 5

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

PR `#76` merged the corrective implementation as
`e122a52c1da49ef409364c93fb675df56a4e639d` after exact-head Canonicalizer and
Claude Opus review, GitHub CI, standalone-artifact proof, and Railway preview
checks all passed. Railway production platform deployment
`8dbde4b3-3059-4bfd-8ba6-93deccbde995` then reached terminal `SUCCESS`.

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
7. PR `#76` merged at `2026-08-31` as
   `e122a52c1da49ef409364c93fb675df56a4e639d` after both exact-head agent
   reviews and every required candidate check passed.
8. Production platform deployment
   `8dbde4b3-3059-4bfd-8ba6-93deccbde995` reached terminal `SUCCESS`, and live
   `/api/health` returned `200` with that deployment ID and the exact merged
   revision.
9. Live `/api/readiness` returned the valid machine-readable `503` capability
   state because `AIRJAM_RELEASES_PUBLIC_ORIGIN` is not configured. That
   remaining hosted-release boundary is a product-readiness task, not a failed
   process deployment.

## Review-Authority Decision

On 2026-08-31 the maintainer explicitly chose agent-owned implementation
review for 1.0 rather than routine human code approval. The GitHub requirement
for one approving human review was therefore removed before PR `#76` merged.
Strict required CI for administrators, conversation resolution, and the
force-push and branch-deletion protections remained enabled. The current
working agreement keeps review agent-owned without duplicating Opus locally:
substantial batches receive one pre-push Canonicalizer session, and a green
merge candidate receives one GitHub-native Opus review.

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

The reviewed and merged corrective change proves:

1. `58` focused platform deployment-config, liveness, readiness, host-policy,
   and origin tests
2. `21` repo CLI inspection and attestation contract tests
3. platform TypeScript and focused ESLint checks
4. a clean hermetic install and production Next build
5. the real standalone bundle answering Railway's exact liveness probe with
   `200`
6. the same bundle exposing ready release-origin state at `/api/readiness`
7. the same built bundle rejecting deliberate build/runtime origin drift with
   `503`
8. the same built bundle preserving the declared `www.airjam.io` canonical-host
   redirect instead of blocking it in proxy host policy

The exact-head review evidence is attached to PR `#76`; it is not
self-certified by this audit. The production platform deployment reached
terminal `SUCCESS`, live liveness identified the exact deployment and merged
revision, `www.airjam.io` redirected to the canonical apex, and the public
readiness inspector preserved the explicit disabled hosted-release reason.

## Process Lessons

The canonical current review, merge, and production-delivery rules live in
[Working Agreements](../../working-agreements.md#review-stacks-and-integration).
The incident produced these lessons that shaped that policy:

1. preview success is evidence for the candidate, not evidence that production
   accepted the merged revision
2. a rollout is incomplete until provider state reaches terminal `SUCCESS`
3. a newer terminal `FAILED` deployment must remain visible as an incident even
   when the previous revision keeps serving traffic
4. final review belongs on the green GitHub pull request beside the code;
   pre-push canonicality review and merge review must not become duplicate local
   Opus loops
5. production-mode artifact proof must cover any contract that depends on
   framework build-time transformation
6. deployment liveness, dependency readiness, and product capability
   readiness are different contracts and must not be collapsed

This audit records why those rules exist; it is not a parallel operating-policy
owner. Final review remains visible in the GitHub pull-request record through
the canonical agent instructions.

Mechanical post-merge Railway verification is a separate operating-system
correction owned by `G5-02`. Its evidence requirement blocks that work item from
closing until the repo CLI itself can prove the exact merged production
deployment, terminal provider state, and public liveness/readiness identity.

All remaining execution work is tracked by the canonical readiness manifest;
this incident audit intentionally owns no parallel follow-up backlog.
