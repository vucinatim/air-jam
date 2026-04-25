# Air Jam Final Release Checks Plan

Last updated: 2026-04-19
Status: active manual proof

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md)
4. [Project Review (2026-04-15)](../strategy/project-review-2026-04-15.md)
5. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)

## Purpose

Single consolidated runbook for every prerelease and release-time check.

This plan is the only place release-proof checks live. Every other plan should point here instead of duplicating check content.

## Ownership Rule

1. [Work Ledger](../work-ledger.md) remains the execution source of truth for what is active and what is done.
2. This plan owns the check surface only — verification passes, proof runs, audit steps, and go/no-go recording.
3. Implementation work that falls out of a check (for example, fixing a regression found during the manual proof) belongs back in the relevant implementation plan, not here.

## Execution Rule

This plan starts only after:

1. remaining prerelease implementation is done or explicitly cut from v1
2. release media and official hosting setup are ready enough for end-to-end product proof
3. no other active plan is waiting on manual verification as its main remaining step

Current automated prerequisite status:

1. full `pnpm run check:release` passed on 2026-04-19 against the prerelease state before the late Arcade navbar, controller UI, preview-controller, local CSP, and controller idle-layout fixes; focused platform security tests, SDK viewport tests/build, platform typecheck, and platform production build passed after those fixes
2. all five launch games have green automated `arcade-built` visual captures
3. `air-capture` has a green automated secure `arcade-built` visual capture
4. the remaining work in this plan is intentionally manual product proof, hosted upload proof, live deploy validation, and final go / no-go recording

## Scope

This plan owns:

1. local Arcade and phone/controller product proof for the five launch games
2. dashboard hosted-release and managed-media proof
3. official hosted-platform and official-server proof
4. post-hardening playtest reruns for `air-capture` and `last-band-standing`
5. public experimental SDK export audit
6. canonical release gate confirmation
7. live deploy validation after merge to `master`
8. optional one-time spot-checks that are cheap and worth running once
9. final launch-set go / no-go recording

This plan does not own:

1. unfinished prerelease implementation
2. broad new refactors
3. "maybe later" architecture ideas
4. release execution work after the go / no-go decision (uploads, media posting, GTM)

## Check Workstreams

### Workstream A. Local Launch-Set Product Proof

Run the final local Arcade and real-controller pass for:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

Automated precheck already green on 2026-04-19:

1. `air-capture` `arcade-built`
2. `code-review` `arcade-built`
3. `last-band-standing` `arcade-built`
4. `pong` `arcade-built`
5. `the-office` `arcade-built`
6. `air-capture` secure `arcade-built`

For each game, verify:

1. host route opens from local Arcade
2. QR / join flow works
3. controller reaches the intended controller UI
4. lobby and ready flow are explicit
5. host-owned start flow works
6. one short gameplay session works
7. ended / reset flow works
8. no launch-blocking browser or log-stream errors appear
9. host and controller UIs remain usable on target sizes
10. the game is publicly presentable for v1
11. the host lobby shell shows QR, join URL, copy/open, and start
12. the controller shell shows status, avatar, and lifecycle actions

### Workstream B. Dashboard Hosted Release And Managed Media Proof

Run one end-to-end dashboard proof for the real platform lane:

1. upload a hosted release artifact
2. finalize upload and confirm checks settle correctly
3. make the release live
4. confirm the game can be listed in Arcade
5. upload and assign thumbnail, cover, and preview media where applicable
6. confirm the public catalog renders the assigned media correctly

### Workstream C. Official Hosting And Official Server Proof

Verify the real public path for each of the five launch games:

1. connected to the intended official hosting setup
2. room creation works against the official backend path
3. controller join works against the official backend path
4. gameplay start and return flows work against the official backend path
5. no production-only auth, env, or integration issue blocks the release

### Workstream D. Playtest Rerun

Rerun real Arcade playtests after the prerelease fixes landed:

1. `air-capture` — confirm the controller playing UI, flag pickup rules, rocket AOE, lobby name visibility, and 3-second countdown actually improve trust and readability in live play
2. `last-band-standing` — record whether it remains in the launch set without qualification

### Workstream E. Public Experimental SDK Export Audit

For each public experimental SDK subpath export, record:

1. clear owner
2. explicit experimental status
3. real near-term purpose beyond speculative surface area

Targets:

1. `@air-jam/sdk/preview`
2. `@air-jam/sdk/arcade*`
3. `@air-jam/sdk/capabilities`
4. `@air-jam/sdk/prefabs`
5. `@air-jam/sdk/metadata`
6. `@air-jam/sdk/protocol`

Also confirm that these machine-facing seams remain intentionally in-source but private until a real first-party consumer lands:

1. `@air-jam/sdk/runtime-control`
2. `@air-jam/sdk/runtime-inspection`
3. `@air-jam/sdk/runtime-observability`
4. `@air-jam/sdk/contracts/v2`

Any export that fails the third part is dropped or deferred. Drop or defer decisions are implementation follow-ups that belong in [Final Prerelease Hardening And Cleanup Plan](./final-prerelease-hardening-and-cleanup-plan.md) Workstream 5, not here.

### Workstream F. Canonical Release Gate Confirmation

Current truth:

1. `pnpm run check:release` passed end to end on 2026-04-19, including:
   1. typecheck
   2. tests
   3. builds
   4. strict perf sanity (baseline plus reconnect churn)
   5. browser smoke
   6. scaffold smoke
2. rerun the full gate only if additional prerelease code or config changes land before release

### Workstream G. Live Deploy Validation

After merging to `master` and deploying the platform:

1. the deployed platform reflects the intended public release surface
2. the official hosted runtime responds correctly on the real domain
3. live host and controller flows work from a real client against the real deployment
4. no production-only configuration break surfaces

### Workstream H. Optional One-Time Spot-Checks

Low-cost, high-signal checks worth running once before launch:

1. measure the `air-capture` host bundle impact of `@dimforge/rapier3d-compat` on real mobile; accept or act
2. confirm whether the `games.url` → `preview_url` rename already happened during the dashboard IA reset; if not, bundle into the data / metadata implementation pass

### Workstream I. Final Launch Decision Record

For each launch game, record one final outcome:

1. `pass`
2. `pass with note`
3. `blocker`

Also record:

1. any explicit launch-set cuts
2. any accepted v1 limitations
3. the final release go / no-go decision

## Suggested Execution Order

1. treat the canonical release gate (F) as satisfied unless new prerelease code or config changes land
2. run the public experimental SDK export audit (E) and hand drop or defer items back to implementation only if the audit finds a real blocker
3. run one deep local launch-set product proof pass (A), with emphasis on `air-capture` because it exercises the most runtime surface
4. run playtest reruns (D) for `air-capture` and `last-band-standing` inside the local proof pass if practical
5. run dashboard hosted-release and managed-media proof (B)
6. run official hosting and official-server proof (C)
7. run optional spot-checks (H) alongside any of the above where convenient
8. record final launch outcomes (I)
9. hand off to merge, deploy, and live-deploy validation (G) as part of release execution

## Done Criteria

This plan is complete when:

1. every launch game has an explicit final manual outcome
2. the dashboard hosted-release and managed-media lanes are proven end to end
3. the official hosted runtime path is proven end to end
4. playtest reruns are recorded for `air-capture` and `last-band-standing`
5. the public experimental SDK export audit is complete and any drop or defer actions are handed back to implementation
6. the canonical release gate is green on the final prerelease state
7. live deploy validation is green on the real production surface
8. the release proceeds from one explicit recorded go / no-go decision instead of implied confidence
