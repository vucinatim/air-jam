# Public Release Security Hardening Plan

Last updated: 2026-04-07  
Status: archived

Archived on: 2026-04-09  
Archive reason: release-blocking hardening landed; remaining follow-ups belong in [Suggestions](../suggestions.md), not the active prerelease plan surface

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
5. [Production Observability Baseline](../strategy/production-observability-baseline.md)
6. [Environment Contracts](../systems/env-contracts.md)
7. [Suggestions](../suggestions.md)

## Purpose

Turn the current repo-wide security review into one concrete prerelease hardening track so public release decisions are based on explicit risks instead of loose discussion.

This plan is intentionally narrow.
It is for:

1. public-release trust boundaries
2. obvious bad practices that create future operational risk
3. deciding what must be fixed now versus what can wait

It is not for:

1. abstract enterprise security theater
2. broad framework rewrites without clear release value
3. adding heavy infrastructure for a tiny initial launch

## Audit Summary

The repo is already stronger than most prerelease multiplayer stacks.

Current strengths:

1. server-side room authority is explicit
2. privileged controller channels already require room-scoped capability grants
3. reconnect/resume and focus routing are covered by real integration tests
4. hosted release zip validation already blocks traversal, symlinks, and oversized payloads

Current concerns are mostly outside the core room/session model:

1. platform web-security headers are too permissive
2. hosted release moderation currently fails open
3. private release inspection needs release-scoped access instead of broad reusable credentials
4. local env and DB posture still allow unsafe prerelease habits
5. abuse controls need one more pass before public exposure

## Core Position

For the expected first public wave, Air Jam does not need a huge security program.
It does need a clean minimum professional baseline:

1. public web surfaces should not be trivially embeddable or abuse-prone
2. hosted public releases should fail closed when trust checks are unavailable
3. local development should not casually point at production state
4. simple abuse controls should be honest about their limits

## Risk Model

This plan assumes:

1. low initial scale, roughly tens of users rather than thousands
2. public internet exposure for the platform and runtime server
3. creators uploading hosted release artifacts and media
4. no dedicated security operations team

That means the right bar is:

1. close obvious holes now
2. remove dangerous operational footguns now
3. defer only the follow-ups that do not weaken the public trust story

## Findings By Priority

### Priority 1. Must Fix Before Public Release

1. restore strict clickjacking protection on the platform and only allow framing where the product truly requires it
2. make hosted release moderation fail closed so unmoderated releases cannot become `ready` or `live`
3. stop trusting raw `x-forwarded-for` for server rate-limit identity unless the deployment path guarantees trusted proxy headers
4. stop treating a production-connected `DATABASE_URL` as an acceptable default local prerelease workflow

### Priority 2. Strongly Recommended Before Or Immediately After Release

1. revisit room-code entropy and the join/bootstrap throttle model together

### Priority 3. Good Post-Release Hardening

1. move moderation off the synchronous creator-facing publish path
2. centralize host bootstrap verification behind one dedicated service boundary
3. continue tightening env validation across repo/workspace scripts

## Workstreams

### Workstream A. Platform Web-Security Policy

Goal:

1. make the platform safe as a public web app without breaking the legitimate embedded surfaces

Required outcomes:

1. remove the global `frame-ancestors 'self' *` posture
2. define route-specific framing policy for public site, dashboard/auth, and any embedded release surfaces
3. confirm login and dashboard routes cannot be embedded cross-origin

Done when:

1. framing rules are explicit and minimal
2. the policy matches the real product surface instead of blanket permissiveness

### Workstream B. Hosted Release Trust Lane

Goal:

1. ensure Air Jam-hosted public releases only move forward when trust checks actually ran

Required outcomes:

1. moderation unavailability blocks public release readiness
2. moderation failures and skipped states are represented clearly in release state/check records
3. only explicit approved paths can inspect non-live releases

Done when:

1. a release cannot become public-ready without completed trust checks
2. private inspection is release-scoped and short-lived instead of relying on one reusable secret

### Workstream C. Server Abuse And Enumeration Baseline

Goal:

1. make the runtime server harder to probe or abuse casually

Required outcomes:

1. rate-limit identity is based on trusted deployment data, not blindly on client-controlled headers
2. room-code and join/bootstrap abuse posture is documented and intentionally chosen
3. the current low-scale defaults are explicit, not accidental

Done when:

1. abuse controls match the real deployment model
2. server throttles are no longer trivially bypassable in misconfigured deployments

### Workstream D. Local Ops And Secret Hygiene

Goal:

1. remove local workflows that can damage production state or leak secrets into the wrong runtime

Required outcomes:

1. local dev should prefer local DB state by default
2. server runtime/tests should not auto-ingest unrelated env files without explicit intent
3. prerelease validation against real hosted state, if still needed, should be opt-in and clearly separated

Done when:

1. local iteration is safe by default
2. production-connected env usage is explicit, rare, and hard to do by accident

### Workstream E. Verification And Release Sign-Off

Goal:

1. make the hardening track provable instead of discussion-only

Required outcomes:

1. add targeted tests for the new fail-closed and policy behavior
2. rerun canonical server/platform suites
3. document the remaining accepted risks after the pass

Done when:

1. the release posture is supported by tests and docs, not just manual confidence

## Execution Order

1. fix platform framing policy
2. fix hosted release moderation to fail closed
3. harden runtime-server rate-limit identity assumptions
4. separate local-default DB/env posture from production-connected validation flows
5. rerun tests, update docs, and record any intentionally accepted residual risks

## Validation Contract

Every hardening change should keep validation proportional and real:

1. `pnpm --filter @air-jam/server test`
2. `pnpm --filter platform test`
3. add targeted regression tests where release behavior changes
4. rerun broader root gates only when the touched surface justifies it

## Exit Criteria

This plan is complete when:

1. all Priority 1 items are resolved
2. any deferred Priority 2 items are explicitly accepted and documented
3. tests cover the new fail-closed and policy behavior
4. the repo docs describe the actual public-release posture honestly

## Current Recommendation

Air Jam is close to a reasonable small-scale public baseline, but not ready to call the security posture done yet.

The practical prerelease bar should be:

1. keep the now-fixed framing-policy, moderation, throttle-identity, and local DB guardrails green under tests
2. keep the new release-scoped inspection access model green under tests
3. keep explicit DB ownership at startup/runtime boundaries so server imports do not reopen hidden env or connection side effects
4. decide whether room-code entropy should be raised before or immediately after release

## Progress Snapshot

Completed in the current pass:

1. platform clickjacking policy now fails closed instead of allowing arbitrary cross-origin framing
2. hosted release moderation now requires an explicit passed outcome before a release can become `ready`
3. runtime-server proxy header trust is now deployment-aware instead of blindly following raw `x-forwarded-for`
4. non-production server runtime now blocks non-local `DATABASE_URL` values unless `AIR_JAM_ALLOW_REMOTE_DATABASE=enabled`
5. hosted release inspection now uses short-lived, release-scoped signed access tokens instead of one reusable global bearer token
6. ambient server runtime/tests now default to repo-root + server-owned env files instead of automatically ingesting `apps/platform/.env.local`
7. server DB creation now happens through explicit startup/runtime ownership instead of module-load `DATABASE_URL` reads and singleton connection setup
8. explicit server startup entrypoints no longer reach into `apps/platform/.env.local` for compatibility fallback

After that, the remaining items become normal bounded follow-up hardening rather than launch blockers.

Accepted follow-up items after this pass:

1. revisit room-code entropy together with the low-scale abuse model before or immediately after wider public rollout
