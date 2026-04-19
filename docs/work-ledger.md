# Air Jam Work Ledger

Last updated: 2026-04-19
Status: active

This is the single active repo-wide ledger.

Use it to answer:

1. what matters now
2. what is already done
3. which active plans still matter
4. which tracks were archived or collapsed

## Current Execution Order

Air Jam should now move through prerelease work in this order:

1. finish all remaining implementation work up front
2. run the immediate post-implementation fix pass
3. do UI and gameplay polish
4. do prerelease cleanup
5. run prerelease devex and SDK checks
6. run prerelease security checks
7. run the final prerelease overpass in [Final Release Checks Plan](./plans/final-release-checks-plan.md)
8. finish final docs alignment and polish
9. upload the games
10. finish media, blogs, and final landing-page overlook
11. merge into `master`, deploy, and test live
12. lock the release plan and do launch distribution / manual marketing

Canonical prerelease plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

## Audit Summary

After the 2026-04-09 planning audit:

1. several plans were archived because their implementation was already complete or only manual verification remained
2. the broad implementation surface was intentionally emptied after that audit; the only new active implementation work now is the bounded final prerelease hardening pass
3. all scattered manual verification now belongs in one final prerelease plan instead of staying spread across subsystem docs

## Active Plans

### Priority 1. Canonical Release Execution

Status: active  
Plan: [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Still open here:

1. sequence and coordinate the full release path after prerelease implementation is done
2. cover hosted uploads, media/blogs, live deploy, and launch execution

### Current Focus. Final Prerelease Readiness

Status: active execution focus
Plans:

1. [Final Prerelease Hardening And Cleanup Plan](./plans/final-prerelease-hardening-and-cleanup-plan.md)
2. [Final Release Checks Plan](./plans/final-release-checks-plan.md)
3. [V1 Release Launch Plan](./plans/v1-release-launch-plan.md)

Immediate next work:

1. run the final prerelease manual overpass for the launch set and hosted lanes
2. upload/prove the hosted game path through the dashboard
3. finish release media/blogs and the final landing-page overlook
4. merge into `master`, deploy, and run live validation in the canonical release order

Latest progress inside this focus:

1. the hidden prerelease blockers are fixed at the shared boundary: server runtime/test isolation, embedded controller bridge attach parsing, preview session/window identity, platform settings contract alignment, and the Pong controller smoke selector contract
2. full `pnpm run check:release` is green again as of 2026-04-19 on the prerelease state before the late Arcade navbar, controller UI, preview-controller, local CSP, and controller idle-layout fixes, including typecheck, tests, builds, strict perf sanity, browser smoke, and scaffold smoke; focused platform security tests, SDK viewport tests/build, platform typecheck, and platform production build passed after those fixes
3. `code-review`, `the-office`, and `last-band-standing` already received the bounded Stage 3 pass that was called out earlier
4. the preview workspace rollout is complete enough to archive as a finished implementation track rather than leaving it in `docs/plans`
5. the 2026-04-15 project review has now been converted into one explicit final hardening-and-cleanup plan instead of being left as a loose snapshot with implied follow-up
6. the late 2026-04-15 doc cleanup pass collapsed all prerelease and release checks into one consolidated [Final Release Checks Plan](./plans/final-release-checks-plan.md) and archived the Game UI Scaling Plan and Stage 3 Polish Plan now that their implementation tracks are complete
7. the dead `apps/platform/src/app/__airjam/` and `apps/platform/src/app/__airjam-local-builds/` route trees are deleted; only the live `airjam-local-builds/` route remains
8. Workstream 1 of the hardening-and-cleanup plan (review doc alignment and execution-bucket rewrite) is complete
9. the late 2026-04-18 audit closed two hidden release blockers: repo/scaffold template manifests now include required `category` values, and the platform CSP now allows local loopback `http:`/`ws:` frame and connect traffic in non-production so browser smoke matches the real local Arcade stack
10. Arcade cards now expose optional developer actions: source links and generated `create-airjam` template commands are carried through the typed catalog shape, first-party local reference games set both fields automatically, and dashboard-hosted games can set them through schema-owned `games.config`
11. automated arcade-built visual captures are green for the five launch games (`air-capture`, `code-review`, `last-band-standing`, `pong`, and `the-office`), and the secure arcade-built `air-capture` visual capture is also green
12. the visual harness now has an explicit production-build opt-in query contract, local Arcade build caching invalidates when game `visual/` contracts or visual-harness runtime code changes, and workspace process cleanup now terminates spawned process groups cleanly
13. the Arcade navbar was rolled back from the shared rounded shell-card treatment to the cleaner flat Arcade header; this is a visual correction, not a runtime contract change
14. the platform CSP now keeps production frame ancestors same-origin while allowing non-production localhost/LAN Arcade embeds, and explicitly allows the mounted Umami and Vercel Speed Insights script hosts
15. the Arcade controller sheet, fullscreen prompt, and controller page background were rolled back from the shared rounded shell-card treatment to the earlier flatter controller presentation
16. preview controllers now mount the same controller menu chrome as real controllers, the controller sheet content uses the same horizontal rhythm as the navbar, and the default idle controller surface uses bounded fluid sizing instead of the scaled controller preset that could overflow previews or shrink/rotate when the mobile keyboard changed `visualViewport`
17. the attempted Arcade preview-controller bootstrap was backed out after live logs showed it did not fix the black preview-controller report and created too much release risk; canonical logs showed the failing slice had controller bridges attaching and `joinTeam` RPCs reaching the embedded game store without immediate embedded game `host:state_sync`, while the post-rollback/reconnect slice emitted `aj.embedded.game:*` state sync again, so the next blocker check is a fresh manual retest of real phone + preview controller after dev refresh/restart
18. Arcade controller-sheet exit now routes through the host-owned Arcade platform action instead of direct controller system exit, and the host blocks browser card relaunch until all controller action inputs are released after exit; this removes the observed close/reopen loop where controller exit closed the game and stale browser-launch input immediately reopened the selected card
19. server controller admission now treats accepted room-code joins as fully functional controller joins with the standard controller grants, while still rejecting bad explicit capability links; this fixes the half-connected manual-code state where raw input moved Arcade selection but networked-store actions, pings, and in-game controls were rejected as missing privileged capability
20. Arcade host history now has an explicit browser-surface entry and game-surface entry: launching a game pushes `/arcade/[slug]`, direct game URLs are canonicalized behind an `/arcade` back target, duplicate game-path pushes are suppressed, and browser Back from an active game closes the game through the normal host-owned close path instead of reloading the game
21. preview controllers now emulate a compact iPhone-16-like browser viewport by default, the preview controller route owns the full iframe viewport height, and drag-resize is treated as display scale from the active drag handle, so the iframe keeps a stable phone-sized layout while the floating desktop window can still be resized like DevTools device mode without aspect-ratio snapping
22. `air-capture` now keeps its Rapier gameplay scene mounted and paused behind the lobby/end backdrop after the first active match phase, avoiding the observed return-to-lobby collider teardown race that surfaced as `expected instance of lA` inside Rapier `removeCollider`
23. the Arcade controller route now has one platform-owned forced-orientation surface: idle Arcade controls stay portrait no matter how the device is held, idle remote sizing uses the oriented surface reference dimensions instead of physical `dvw`/`dvh`, active games put the platform chrome, sheet, scanner, and controller dialogs into the game-requested controller orientation with the sheet contents still kept as a single scrollable column, server game launch/close now immediately publish neutral `paused`/`portrait` controller state so stale landscape state cannot flash before the embedded game sends its real initial orientation, and the platform controller now passes `aj_controller_cap` explicitly from current route params so manual room-code apply clears stale privileged tokens while room-code controllers hide room-control actions and show a minimal QR-scan note
24. SDK-owned music is now the canonical first-party path: `MusicPlaylist` and external music-volume helpers live in the SDK, `air-capture` and `code-review` no longer own raw game audio elements, Last Band Standing scales YouTube iframe volume through SDK music volume, and the completed plan is archived at [SDK Audio And Music Standardization Plan](./archive/sdk-audio-and-music-standardization-plan-2026-04-19.md)
25. embedded controller orientation is now SDK-owned: controller-side `SurfaceViewport orientation` publishes presentation sync to the active Arcade controller shell with surface identity validation, first-party games no longer send host-owned orientation solely for Arcade chrome, and Last Band Standing now uses `SurfaceViewport` on its controller like the rest of the launch set
26. `create-airjam` scaffold templates are now packaged generated artifacts instead of live editor-visible TypeScript projects: the old `scaffold-sources` tree is removed during generation, generated templates live under `scaffold-templates` as zip archives plus a manifest, and the CLI extracts the selected archive before standalone project normalization
27. the SDK authoring ergonomics review is captured in [SDK Game Authoring Ergonomics Plan](./plans/sdk-game-authoring-ergonomics-plan.md), including agreed audio, `SurfaceViewport`, join-controls, Pong helper, and sound-type cleanups plus the open runtime-state decision

### Current Active Systems Track. Final Prerelease Hardening And Cleanup

Status: active  
Plan: [Final Prerelease Hardening And Cleanup Plan](./plans/final-prerelease-hardening-and-cleanup-plan.md)

Current truth:

1. the last intended fix/improve/polish implementation pass before the final manual prerelease overpass is complete for release purposes
2. the pass is intentionally bounded to release leverage, not broad architecture cleanup
3. the code-side hardening surfaced by the 2026-04-15 review is landed or intentionally deferred
4. the remaining non-manual items are explicit defer/cut decisions rather than hidden blockers: broader server/runtime release error tracking and optional full extraction of `air-capture`'s dev-only prefab-preview surface
5. execution should now move directly into the final manual prerelease proof

### Recently Archived Implementation Track. Game UI Scaling

Status: archived 2026-04-15  
Plan: [Game UI Scaling Plan (Archived)](./archive/game-ui-scaling-plan-2026-04-15.md)

Current truth:

1. `SurfaceViewport` ships full-bleed surface semantics and publishes `--airjam-ui-scale` into Tailwind's sizing/theme variables
2. the launch set and scaffold sources consume that shared scale model
3. any residual styling fallout now lives inside the hardening-and-cleanup plan, not a separate active plan

### Recently Archived Implementation Track. Stage 3 Polish

Status: archived 2026-04-15  
Plan: [Stage 3 Polish Plan (Archived)](./archive/stage-3-polish-plan-2026-04-15.md)

Current truth:

1. the shared-shell pass and the per-game polish sweep landed for the full launch set
2. Arcade-built lobby captures are green for all five launch games after the pass
3. the plan's own rule was to stop Stage 3 and hand off to the final manual proof once no new high-signal issue appeared
4. any surviving polish items now surface as findings inside the final checks plan and loop back into the hardening-and-cleanup plan only if they turn out to matter for launch

### Recently Completed Implementation Track. Preview Controller Workspace Rework

Status: completed  
Plan: [Controller Preview Workspace Plan](./archive/controller-preview-workspace-plan-2026-04-14.md)

Current truth:

1. the old dock metaphor is now replaced on the active SDK surface by a portal-based preview workspace
2. the launcher hit-testing failure is fixed by moving the workspace above host layout ownership instead of depending on per-host z-index luck
3. preview controllers now open as draggable floating windows with close/minimize controls and low-opacity inactive behavior
4. the shared workspace now powers the platform Arcade surface plus all five launch games and their scaffold sources in local dev

### Recently Completed Implementation Track. Agent Runtime Contract Alignment

Status: completed  
Plan: [Agent Runtime Contract Plan](./archive/agent-runtime-contract-plan-2026-04-09.md)

Current truth:

1. the long-term vision now explicitly includes a future where agents can build, run, inspect, control, and iteratively polish games through Air Jam-native contracts
2. the SDK surface audit now explicitly classifies the current public lanes
3. `@air-jam/sdk`, `@air-jam/sdk/ui`, and `@air-jam/sdk/styles.css` are the intended durable prerelease authoring/UI lanes
4. `@air-jam/sdk/preview`, `@air-jam/sdk/arcade*`, `@air-jam/sdk/protocol`, `@air-jam/sdk/capabilities`, `@air-jam/sdk/metadata`, and `@air-jam/sdk/prefabs` are the only public experimental leaves today
5. the machine-facing `runtime-control`, `runtime-inspection`, `runtime-observability`, and `contracts/v2` seams remain in-source but were intentionally removed from public exports on 2026-04-15 because they had no first-party consumer
6. typed metadata helpers now have first-party repo/scaffold adoption through `gameMetadata` exports in each `airjam.config.ts`; platform submission remains authoritative, while code metadata is the typed default for tooling and catalog prefill
7. the prerelease alignment spine is now in place: stable root lanes are explicit, exported experimental leaves are explicit, and private future seams are no longer accidentally implied as public package contracts

### Recently Completed Implementation Track. Prerelease Systems Closeout

Status: completed  
Plan: [Prerelease Systems Closeout Plan](./archive/prerelease-systems-closeout-plan-2026-04-09.md)

Current truth:

1. the SDK-owned platform-settings boundary cleanup and host join-url cleanup are done
2. docs and scaffold guidance are aligned with that post-audit SDK truth
3. built-mode repo visual capture now reuses unchanged game dist artifacts instead of always rebuilding
4. the deferred harness-driven UI cleanup now belongs to the later polish stage, not an active implementation plan
5. the first follow-on fix is done: Arcade now carries explicit `controllerUrl` ownership and the Pong Arcade-built lobby capture passes again

### Recently Completed Implementation Track. Preview Controllers

Status: completed  
Plan: [Controller Preview Dock Plan](./archive/controller-preview-dock-plan-2026-04-09.md)

Current truth:

1. the platform controller route split is complete, including a thin preview-surface mode that reuses the real controller path
2. the SDK now exposes a real `@air-jam/sdk/preview` leaf with shared launch, identity, manager, surface, dock, and host-wrapper ownership
3. platform `/arcade` and `/play`, plus all five launch-set repo and scaffold host flows, now consume that same shared preview path in local dev
4. automated preview-identity uniqueness coverage exists at the launch/manager layer
5. live mixed-session proof passes on both a standalone Pong host and the platform Arcade path
6. preview close/reopen behavior passes with a fresh preview identity on reopen while the phone controller remains connected
7. docs and scaffold guidance are aligned enough for prerelease use
8. the first-use desktop-width pass holds at 1440, 1100, and 960 wide without losing the QR/controller-link or `Add controller` affordance

### Priority 2. Final Manual Release Proof

Status: planned  
Plan: [Final Release Checks Plan](./plans/final-release-checks-plan.md)

This plan now owns:

1. local Arcade and phone/controller proof for the five launch games
2. dashboard hosted-release and managed-media proof
3. official hosted-platform and official-server proof
4. final launch-set go / no-go recording

Execution note:

1. this plan is intentionally late in the sequence
2. it should begin only after implementation, fixes, polish, cleanup, devex checks, and security checks are complete enough that the overpass is meaningful

## Completed / Archived Baselines

These plans were removed from the active surface in the 2026-04-09 cleanup:

1. [Standard Lifecycle Contract Plan](./archive/standard-lifecycle-contract-plan-2026-04-09.md)
2. [Composition Shell Contract Plan](./archive/composition-shell-contract-plan-2026-04-09.md)
3. [Showcase Games Release Readiness Plan](./archive/showcase-games-release-readiness-plan-2026-04-09.md)
4. [Showcase Games Release Readiness Checklist](./archive/showcase-games-release-readiness-checklist-2026-04-09.md)
5. [Public Release Security Hardening Plan](./archive/public-release-security-hardening-plan-2026-04-09.md)
6. [SDK Extraction Clean-Swap Plan](./archive/sdk-extraction-clean-swap-plan-2026-04-09.md)
7. [Visual Review Harness Plan](./archive/visual-review-harness-plan-2026-04-09.md)
8. [Controller Preview Dock Plan](./archive/controller-preview-dock-plan-2026-04-09.md)
9. [Agent Runtime Contract Plan](./archive/agent-runtime-contract-plan-2026-04-09.md)
10. [Prerelease Systems Closeout Plan](./archive/prerelease-systems-closeout-plan-2026-04-09.md)

Why they were archived:

1. implementation was already complete enough to stop driving day-to-day work
2. or the only remaining steps were manual verification, which now belongs in the final manual prerelease plan
3. or the old broader plan was superseded by a smaller truthful closeout plan

## Latest Repo Truth

The audit confirmed:

1. the standard lifecycle, composition shell, hosted release/media lanes, preview workspace rollout, and launch-set polish baselines are done enough that they no longer need separate implementation plans
2. late prerelease hardening is landed across the shared server/platform boundary: real `/health`, maintenance mode, request payload limits, auth + tRPC write-path rate limiting, security headers, dead local-build route cleanup, `games.user_id` indexing, typed `games.config`, and SDK compatibility docs
3. repo and scaffold manifests now carry required template `category` values, which fixed a hidden create-airjam/generated-prep contract failure in the release gate
4. the platform non-production CSP now allows the local loopback `http:`/`ws:` frame and connect traffic used by browser smoke and local Arcade flows, while production keeps the stricter hosted posture
5. full `pnpm run check:release` is green as of 2026-04-19 on the prerelease tree before the late Arcade navbar, controller UI, preview-controller, local CSP, and controller idle-layout fixes; focused platform security tests, SDK viewport tests/build, platform typecheck, and platform production build are green after those fixes
6. exported experimental SDK leaves are limited to `preview`, `arcade*`, `protocol`, `capabilities`, `metadata`, and `prefabs`
7. `runtime-control`, `runtime-inspection`, `runtime-observability`, and `contracts/v2` remain in-source but private pending a real first-party consumer
8. first-party metadata is now canonicalized in source: repo games and scaffold sources export `gameMetadata` beside runtime `airjam` config, and the metadata player-count contract now matches the server's 16-player upper bound
9. `air-capture`'s prefab-preview surface remains a dev-only lazy import that is tree-shaken from production bundles; this is acceptable for v1 but should not be described as fully extracted
10. platform production error tracking exists through Sentry; equivalent server/runtime-wide release tracking is still a follow-up decision, not a hidden implementation miss
11. Arcade developer actions are implemented as structured catalog metadata (`sourceUrl`, `templateId`), with the copyable `npx create-airjam@latest my-game --template <id>` command generated by platform code rather than stored as arbitrary dashboard text
12. the repo is ready to move into the final manual release proof, hosted-lane checks, deploy, and live validation, assuming no new prerelease implementation is intentionally added
13. the visual harness host integration now uses the mounted `<VisualHarnessRuntime />` runtime component as the public authoring surface; the previous hook shape is private implementation detail only

## Documentation Hygiene Tasks

Status: ongoing repo rule

Remaining:

1. keep this ledger as the single active execution surface
2. keep the active plan set minimal and truthful
3. archive plans as soon as implementation is complete or only manual proof remains
4. keep active docs aligned with the real repo state instead of stale plan intent

## Rules

1. If a repo-level track matters now, it must appear here.
2. If a plan is active, it must be linked here.
3. If a plan is completed, superseded, or only blocked on manual proof, archive it.
4. Keep this file ordered by real execution priority, not by category alone.
5. Keep `docs/suggestions.md` limited to durable non-critical follow-ups.
