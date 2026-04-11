# Final Prerelease Manual Check Plan

Last updated: 2026-04-09  
Status: planned

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [V1 Release Launch Plan](./v1-release-launch-plan.md)
3. [Prerelease Systems Closeout Plan (Archived)](../archive/prerelease-systems-closeout-plan-2026-04-09.md)
4. [Controller Preview Dock Plan (Archived)](../archive/controller-preview-dock-plan-2026-04-09.md)
5. [Showcase Games Release Readiness Plan (Archived)](../archive/showcase-games-release-readiness-plan-2026-04-09.md)
6. [Showcase Games Release Readiness Checklist (Archived)](../archive/showcase-games-release-readiness-checklist-2026-04-09.md)
7. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)

## Purpose

Provide one final manual go/no-go runbook before release.

This plan centralizes all prerelease manual proof that used to be scattered across other plans. If another plan only has manual verification left, that plan should be considered done and archived.

## Execution Rule

This plan starts only after:

1. the remaining prerelease implementation tracks are done or explicitly cut from v1
2. release media and official hosting setup are ready enough for end-to-end product proof
3. no other active plan is waiting on manual verification as its main remaining step

## Scope

This manual plan owns:

1. local Arcade and phone/controller proof for all five launch games
2. dashboard hosted-release and managed-media proof
3. official hosted-platform and official-server proof
4. final launch-set go / no-go recording

It does not own:

1. unfinished prerelease implementation
2. broad new refactors
3. “maybe later” architecture ideas

## Manual Workstreams

### Workstream A. Local Launch-Set Product Proof

Run the final local Arcade and real-controller pass for:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

For each game, verify:

1. host route opens from local Arcade
2. QR/join flow works
3. controller reaches the intended controller UI
4. lobby and ready flow are explicit
5. host-owned start flow works
6. one short gameplay session works
7. ended/reset flow works
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

Verify the real public path:

1. all five launch games are connected to the intended official hosting setup
2. room creation works against the official backend path
3. controller join works against the official backend path
4. gameplay start and return flows work against the official backend path
5. no production-only auth, env, or integration issue blocks the release

### Workstream D. Final Launch Decision Record

For each launch game, record one final outcome:

1. `pass`
2. `pass with note`
3. `blocker`

Also record:

1. any explicit launch-set cuts
2. any accepted v1 limitations
3. the final release go / no-go decision

## Suggested Execution Order

1. finish local launch-set proof
2. run dashboard hosted-release and managed-media proof
3. run official hosting and official-server proof
4. record final launch outcomes and cut decisions

## Done Criteria

This plan is complete when:

1. every launch game has an explicit final manual outcome
2. the dashboard hosted-release and managed-media lanes are proven end to end
3. the official hosted runtime path is proven end to end
4. the release proceeds from one explicit recorded go / no-go decision instead of implied confidence
