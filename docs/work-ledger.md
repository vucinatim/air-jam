# Air Jam Work Ledger

Last updated: 2026-05-03
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
2. the broad implementation surface was intentionally emptied after that audit; the one late structure-alignment pass that was reopened before prerelease QA is now complete
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
4. [Last Band Standing Polish Plan](./plans/last-band-standing-polish-plan.md)
5. [Prerelease Agent Dev Loop Hardening Plan](./plans/prerelease-agent-dev-loop-hardening-plan.md)
6. [Landing, Arcade, and Controller Polish Plan](./plans/landing-arcade-controller-polish-plan-2026-05-03.md)
7. [Controller And Platform Settings Ownership Plan](./plans/controller-platform-settings-ownership-plan-2026-05-03.md)
8. [NPM Public Release And Automation Plan](./plans/npm-public-release-and-automation-plan-2026-05-03.md)

Immediate next work:

1. run the final prerelease manual overpass for the launch set and hosted lanes
2. upload/prove the hosted game path through the dashboard
3. finish release media/blogs and the final landing-page overlook
4. merge into `master`, deploy, and run live validation in the canonical release order
5. harden the local agent/dev loop enough that the next external one-shot game test starts from one command, one visible preview surface, and one reset path
6. turn the now-live deployment split into an explicit production topology and env contract, including the dedicated release moderation/browser-runtime lane
7. remove the dashboard-only hosted game creation gap so platform game records can be created and maintained cleanly from the `airjam` CLI before release submission
8. complete the bounded landing/Arcade/controller polish pass, including the Arcade settings interactivity fix, explicit landing featured games, controller chrome tightening, and removal of dead settings controls
9. refactor controller settings ownership so host-owned room settings and controller-local settings become explicit contracts instead of one ambiguous shared surface
10. turn the current partial npm publish workflow into the first supported public package lane so `npx create-airjam` works from `latest` while legacy npm versions remain installable-but-unsupported

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
11. the Arcade navbar was rolled back from the shared rounded shell-card treatment to the cleaner flat Arcade header; this is a visual correction, not a runtime contract change
12. the platform CSP now keeps production frame ancestors same-origin while allowing non-production localhost/LAN Arcade embeds, and explicitly allows the mounted Umami and Vercel Speed Insights script hosts
13. the Arcade controller sheet, fullscreen prompt, and controller page background were rolled back from the shared rounded shell-card treatment to the earlier flatter controller presentation
14. preview controllers now mount the same controller menu chrome as real controllers, the controller sheet content uses the same horizontal rhythm as the navbar, and the default idle controller surface uses bounded fluid sizing instead of the scaled controller preset that could overflow previews or shrink/rotate when the mobile keyboard changed `visualViewport`
15. the attempted Arcade preview-controller bootstrap was backed out after live logs showed it did not fix the black preview-controller report and created too much release risk; canonical logs showed the failing slice had controller bridges attaching and `joinTeam` RPCs reaching the embedded game store without immediate embedded game `host:state_sync`, while the post-rollback/reconnect slice emitted `aj.embedded.game:*` state sync again, so the next blocker check is a fresh manual retest of real phone + preview controller after dev refresh/restart
16. Arcade controller-sheet exit now routes through the host-owned Arcade platform action instead of direct controller system exit, and the host blocks browser card relaunch until all controller action inputs are released after exit; this removes the observed close/reopen loop where controller exit closed the game and stale browser-launch input immediately reopened the selected card
17. server controller admission now treats accepted room-code joins as fully functional controller joins with the standard controller grants, while still rejecting bad explicit capability links; this fixes the half-connected manual-code state where raw input moved Arcade selection but networked-store actions, pings, and in-game controls were rejected as missing privileged capability
18. Arcade host history now has an explicit browser-surface entry and game-surface entry: launching a game pushes `/arcade/[slug]`, direct game URLs are canonicalized behind an `/arcade` back target, duplicate game-path pushes are suppressed, and browser Back from an active game closes the game through the normal host-owned close path instead of reloading the game
19. preview controllers now emulate a compact iPhone-16-like browser viewport by default, the preview controller route owns the full iframe viewport height, and drag-resize is treated as display scale from the active drag handle, so the iframe keeps a stable phone-sized layout while the floating desktop window can still be resized like DevTools device mode without aspect-ratio snapping
20. `air-capture` now keeps its Rapier gameplay scene mounted and paused behind the lobby/end backdrop after the first active match phase, avoiding the observed return-to-lobby collider teardown race that surfaced as `expected instance of lA` inside Rapier `removeCollider`
21. the Arcade controller route now has one platform-owned forced-orientation surface: idle Arcade controls stay portrait no matter how the device is held, idle remote sizing uses the oriented surface reference dimensions instead of physical `dvw`/`dvh`, active games put the platform chrome, sheet, scanner, and controller dialogs into the game-requested controller orientation with the sheet contents still kept as a single scrollable column, server game launch/close now immediately publish neutral `paused`/`portrait` controller state so stale landscape state cannot flash before the embedded game sends its real initial orientation, and the platform controller now passes `aj_controller_cap` explicitly from current route params so manual room-code apply clears stale privileged tokens while room-code controllers hide room-control actions and show a minimal QR-scan note
22. SDK-owned music is now the canonical first-party path: `MusicPlaylist` and external music-volume helpers live in the SDK, `air-capture` and `code-review` no longer own raw game audio elements, Last Band Standing scales YouTube iframe volume through SDK music volume, and the completed plan is archived at [SDK Audio And Music Standardization Plan](./archive/sdk-audio-and-music-standardization-plan-2026-04-19.md)
23. embedded controller orientation is now SDK-owned: controller-side `SurfaceViewport orientation` publishes presentation sync to the active Arcade controller shell with surface identity validation, first-party games no longer send host-owned orientation solely for Arcade chrome, and Last Band Standing now uses `SurfaceViewport` on its controller like the rest of the launch set
24. `create-airjam` scaffold templates are now packaged generated artifacts instead of live editor-visible TypeScript projects: the old `scaffold-sources` tree is removed during generation, generated templates live under `scaffold-templates` as zip archives plus a manifest, and the CLI extracts the selected archive before standalone project normalization
25. the SDK authoring ergonomics review is captured in [SDK Game Authoring Ergonomics Plan](./plans/sdk-game-authoring-ergonomics-plan.md), including agreed audio, `SurfaceViewport`, join-controls, Pong helper, and sound-type cleanups plus the open runtime-state decision
26. Last Band Standing's next bounded polish pass is captured in [Last Band Standing Polish Plan](./plans/last-band-standing-polish-plan.md), covering controller lobby/start/home fixes, host gameplay layout polish, controller game-over scrolling, song buckets, and randomized clip starts
27. the MCP/devtools closeout no longer relies on `mcp-server` tests rebuilding `@air-jam/devtools-core`; `mcp-server` tests resolve workspace siblings from source, while `devtools-core` tests explicitly prebuild `@air-jam/sdk` because repo game configs import real SDK subpaths during dynamic config loading, which removes the concurrent validation race without inventing new build machinery
28. hosted release serving now injects one explicit `hosted-release` runtime topology into the served HTML bootstrap, and runtime consumers use that same published topology before falling back to looser inference; this removes leaked dev-control traffic from published builds and routes hosted sockets to the configured backend origin instead of accidentally defaulting to the local platform origin
29. the next publishing step is now explicitly planned as MCP Phase 4 on top of the landed release core and CLI: release doctor/validate/bundle/list/inspect/submit/publish plus `auth_status`, with only bundle and submit task-backed and no separate MCP-native login flow
30. MCP release Phase 4 is now landed: standalone generated projects expose task-backed `release_bundle` and `release_submit` plus the blocking release/auth tools over `pnpm mcp`, monorepo MCP stays on the remote release surface instead of pretending the repo root is a publishable app, and real stdio QA against a generated Pong project now completes with structured release metadata even when platform finalize ends in `failed`
31. the late game-structure alignment pass is complete: `the-office` now follows the canonical ownership model, `code-review` now publishes a semantic agent contract from config, Last Band Standing no longer ships the YouTube test route, and Air Capture's leftover debug/input seams are narrowed into the intended game-owned locations
32. the first prerelease agent/dev-loop hardening slice is landed and validation-clean for the touched packages: generated projects and the repo root now point agents at one normal `pnpm run dev` path, generated/root agent and Claude guidance tells agents to use visible preview controllers only through real click/drag/release gestures and semantic agent actions for reliable gameplay proof, local status/reset now exposes and cleans stale known-port listeners, session/log errors are more actionable, the preview controller dock now shows phone, preview, and virtual/agent controllers in one source-badged roster, the packaged minimal scaffold already ships a wired semantic agent contract, create-airjam CLI tests cover the new recovery command help surfaces, devtools-core directly tests unmanaged-listener status/reset behavior on an isolated test port, and the SDK test nullability blocker that was preventing package typecheck is fixed
33. the visual-harness isolation pass is complete and archived: generated projects no longer ship visual harness files/config/docs, first-party games no longer publish visual harness contracts by default, the public SDK/devtools story no longer advertises visual harness as a normal path, and the remaining harness code is now intentionally internal experimental infrastructure instead of a public authoring lane
34. production hosted release publishing now has a dedicated browser-worker lane: Vercel owns the platform app, Railway owns the realtime server and the release browser worker, and release screenshot capture plus OpenAI image moderation both pass on live production publish
35. the hosted platform game record is now a first-class machine contract: `/api/cli/games` supports list/create, `/api/cli/games/[slugOrId]` supports inspect/update, `@air-jam/devtools-core` exposes typed hosted-game helpers plus local metadata defaults, and `create-airjam` now ships `airjam game list|inspect|create|update` so release publishing no longer depends on the dashboard just to register a target game
36. the public hosted catalog is now fully live on production: all six first-party games have hosted records, live releases, Arcade visibility, source links, and template copy commands, and the legacy app host is now being collapsed onto `airjam.io` as the canonical public domain
37. hosted release bundling now vendors remote font CSS/assets into the artifact at bundle time, so published Arcade releases can keep the strict platform CSP while still supporting Google Fonts-style authoring inputs
38. hosted game media is now a first-class machine/CLI lane: the platform exposes owned-game media inspect/upload/finalize/assign/archive endpoints under `/api/cli/games/[slugOrId]/media`, `@air-jam/devtools-core` exposes typed helpers including one-shot file upload, and `create-airjam` now ships `airjam game media inspect|upload|clear` so thumbnails, covers, and preview videos no longer require dashboard-only setup
39. the bounded landing/Arcade/controller polish pass is now landed locally: landing featured games are explicit and the agent demo now cycles real Air Jam workflow prompts, Arcade hides its visible scrollbar and exposes exact template commands on hover while renaming `Minimal` to `Minimal Template` publicly, preview-controller roster rows are compressed to one line, and controller settings interactivity is no longer blocked by page-wide touch suppression leaking into the shared sheet surface
40. controller settings debugging exposed a deeper ownership gap: the intended product model needs both host-owned room settings and controller-local device settings, but the current controller sheet still mixes those domains without an explicit mirrored host-settings contract; the bounded refactor is now tracked in [Controller And Platform Settings Ownership Plan](./plans/controller-platform-settings-ownership-plan-2026-05-03.md)
41. the npm/package release story is now explicitly split from general prerelease execution: old published npm versions should remain installable but unsupported, the first real public package lane should make plain `npx create-airjam` work from `latest`, and the required package graph / GitHub workflow / deprecation steps are tracked in [NPM Public Release And Automation Plan](./plans/npm-public-release-and-automation-plan-2026-05-03.md)

### Current Active Systems Track. Final Prerelease Hardening And Cleanup

Status: active  
Plan: [Final Prerelease Hardening And Cleanup Plan](./plans/final-prerelease-hardening-and-cleanup-plan.md)

Current truth:

1. the last intended fix/improve/polish implementation pass before the final manual prerelease overpass is complete for release purposes
2. the pass is intentionally bounded to release leverage, not broad architecture cleanup
3. the code-side hardening surfaced by the 2026-04-15 review is landed or intentionally deferred
4. the remaining non-manual items are explicit defer/cut decisions rather than hidden blockers: broader server/runtime release error tracking and optional full extraction of `air-capture`'s dev-only prefab-preview surface
5. execution should now move directly into the final manual prerelease proof

### Recently Completed Implementation Track. Game Structure Alignment

Status: completed  
Plan: [Game Structure Alignment Plan](./plans/game-structure-alignment-plan.md)

Current truth:

1. `pong` remains the practical canonical baseline for first-party Air Jam game structure
2. `the-office` now follows that ownership model cleanly, with gameplay-owned files under `src/game/*`, host-owned files under `src/host/*`, a semantic agent contract, and tests no longer mixed into `src/`
3. `code-review` now publishes a semantic agent contract from config like the newer agent-contract adopters
4. Last Band Standing no longer carries the YouTube test route in the shipped app tree
5. Air Capture's root-level debug/input leftovers are narrowed into explicit game-owned locations instead of teaching accidental repo drift
6. the late follow-up composition pass is also complete: `the-office` host orchestration is split back into real host components/hooks and its `src/host/index.tsx` is back down to a thin 70-line shell, while `air-capture` now keeps its heavier lifecycle/sync logic in one dedicated host runtime hook and its `src/host/index.tsx` is reduced to a clearer 259-line composition shell
7. prerelease QA can now run against a more coherent first-party authoring model instead of mixed structural generations

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
5. the agent-facing `runtime-control`, `runtime-inspection`, `runtime-observability`, and `contracts/v2` seams remain in-source but were intentionally removed from public exports on 2026-04-15 because they had no first-party consumer
6. typed metadata helpers now have first-party repo/scaffold adoption through `gameMetadata` exports in each `airjam.config.ts`; platform submission remains authoritative, while code metadata is the typed default for tooling and catalog prefill
7. the prerelease alignment spine is now in place: stable root lanes are explicit, exported experimental leaves are explicit, and private future seams are no longer accidentally implied as public package contracts

### Recently Completed Implementation Track. Prerelease Systems Closeout

Status: completed  
Plan: [Prerelease Systems Closeout Plan](./archive/prerelease-systems-closeout-plan-2026-04-09.md)

Current truth:

1. the SDK-owned platform-settings boundary cleanup and host join-url cleanup are done
2. docs and scaffold guidance are aligned with that post-audit SDK truth
3. browser proof and local runtime cleanup now belong to the final prerelease overpass instead of a separate systems track
4. the first follow-on fix is done: Arcade now carries explicit `controllerUrl` ownership

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

### Planned Future Systems Track. Agent Devtools

Status: prerelease baseline landed

Current intent:

1. keep MCP as a thin adapter over shared `devtools-core` services
2. make the high-level game-session lane the normal machine-control surface
3. keep browser or in-app preview as the canonical visual truth
4. ship a tiny semantic agent seam by default in generated games so external agents do not need to invent authoring structure mid-task

Latest progress inside this track:

1. the high-level game-session lane is the normal machine-control surface: agents open a session, read projected game state, invoke semantic player/host actions, and close the session through one handle
2. generated projects now ship a small semantic `src/game/contracts/agent.ts` seam by default where appropriate, so external agents start from a real contract instead of inventing one mid-task
3. controller ownership and recovery are explicit enough for prerelease: hosts can inspect controller provenance, remove stale controllers, and reset a local room without restarting the whole dev stack
4. semantic action results now include acknowledgement and snapshot-observation fields, so agents can distinguish rejected actions from accepted actions whose gameplay effects resolve later
5. workspace build-race hardening is landed: shared dependency builds for `@air-jam/sdk` and `@air-jam/devtools-core` go through `scripts/ensure-workspace-package-build.mjs`, so parallel package checks no longer race `tsup` clean operations against the same `dist/` folder
6. the visual harness is now ghosted from the normal framework story: browser preview is the visual truth, semantic game sessions are the normal machine-control surface, and the remaining harness subsystem is internal experimental infrastructure rather than a recommended public workflow

### Planned Future Systems Track. Hosted Release CLI And MCP

Status: end-to-end baseline proven  
Plan: [Hosted Release CLI And MCP Plan](./plans/hosted-release-cli-and-mcp-plan.md)

Current intent:

1. preserve the existing hosted release artifact model and platform release domain
2. move local hosted release bundle/validation logic into shared release-core ownership
3. add a first-party browser-assisted CLI auth flow before generic OAuth work
4. expose the same release submission/publish flow through CLI first, then MCP
5. keep pushing the agent-control surface upward from transport primitives toward game-owned semantic contracts that real games can publish and agents can discover
6. use those contracts to prove full host-visible gameplay loops through MCP before broadening the next layer of framework ergonomics

Latest progress inside this track:

1. the hosted release artifact contract now lives in one shared SDK leaf, `@air-jam/sdk/release`
2. platform hosted-release code now reuses that SDK leaf instead of carrying its own duplicate hosted artifact constants/schema
3. local hosted release operations now live in `@air-jam/devtools-core`, including structured `inspectLocalRelease`, `bundleLocalRelease`, and `validateLocalRelease`
4. `create-airjam` now exposes `airjam release doctor`, `airjam release bundle`, `airjam release validate`, `airjam auth *`, `airjam release submit`, `airjam release list`, `airjam release inspect`, and `airjam release publish` as thin adapters over shared release/auth core
5. the platform now exposes the agent-facing auth and release API surface needed by CLI and MCP, including device approval, owned-game release targets, draft creation, upload-target issuance, finalize, inspect, list, and publish
6. hosted release runtime gating is now explicit at the SDK topology boundary, so hosted builds no longer auto-boot dev-only control, browser-log, or preview-controller lanes
7. hosted release HTML bootstrap now publishes one explicit `hosted-release` runtime topology, and a fresh local published Pong release no longer emits dev-control or browser-log traffic
8. local release moderation now has one explicit policy switch: screenshot capture remains required, while `AIRJAM_RELEASES_IMAGE_MODERATION_MODE=disabled` allows deterministic local capture-only releases to become `ready` without OpenAI dependency
9. the local hosted release path is now proven end to end through the real CLI: authenticate, submit, finalize `ready`, publish `live`, and open the hosted Pong release successfully
10. the MCP release path is now proven end to end too from a real generated standalone project: `airjam.auth_status`, task-backed `airjam.release_submit`, `airjam.release_publish`, and `airjam.release_inspect` all complete successfully against the local platform
11. the release/MCP lane is no longer an active implementation blocker for v1; its next owner is prerelease proof, deployment validation, and later production hardening rather than more baseline architecture work
12. hosted-release moderation now has an explicit local capture-only policy mode: screenshot capture still runs and stays required, but `AIRJAM_RELEASES_IMAGE_MODERATION_MODE=disabled` allows deterministic local submit/publish proof without coupling readiness to OpenAI moderation availability; the default `openai` mode still preserves the real automated image-policy path, and a fresh local Pong release was verified end to end as `ready` then `live` with `screenshot_capture: passed` plus `image_moderation: warning`
13. the first agent input/runtime-inspection slice is now landed: `@air-jam/devtools-core` owns virtual controller sessions over the real controller Socket.IO protocol, including controller connect/disconnect, raw input sends, controller action RPC sends, and runtime snapshot reads that can request authoritative `airjam:state_sync` store payloads before returning
14. `@air-jam/mcp-server` now exposes that controller/runtime lane through `airjam.connect_controller`, `airjam.send_controller_input`, `airjam.invoke_controller_action`, `airjam.read_runtime_snapshot`, and `airjam.disconnect_controller`, and focused socket-backed `devtools-core` tests now prove join/input/action/state-sync/disconnect behavior without mocking the transport
15. explicit controller leave is now a first-class acknowledged protocol path instead of a fire-and-forget best-effort emit: server/controller/devtools all speak a `controller:leave` ack, devtools waits for that ack before tearing sockets down, and preview-controller close now uses a parent/iframe handshake so local preview sessions leave immediately without weakening the normal 30-second reconnect lease for real controllers
16. the hosted release publishing lane now extends past local bundle prep: platform exposes bearer-authenticated agent release endpoints for owned games, release listing/detail, draft creation, upload-target issuance, finalize, and publish under `/api/cli/games/*` and `/api/cli/releases/*`
17. `@air-jam/devtools-core` now owns the remote hosted-release client flow too, including list targets, list releases, inspect release, submit local bundle, and publish ready release over the agent API
18. `create-airjam` now exposes `airjam release list`, `airjam release inspect`, `airjam release submit`, and `airjam release publish` as thin adapters over that shared release client, and focused tests now cover the draft/upload/finalize/publish sequence end to end
19. `create-airjam` template ownership is now explicit for semantic agent contracts too: scaffold template verification checks packaged archives for `src/game/contracts/agent.ts` parity with their source games, scaffold smoke now proves both a template that owns an agent contract (`pong`) and one that intentionally omits it (`minimal`), and generated AI-pack guidance now tells agents to treat a template-owned `src/game/contracts/agent.ts` as the canonical semantic game surface
20. Pong's semantic `award_point` QA lane now drives the same host countdown/reset behavior as natural scoring: the host runtime derives score-side effects from replicated score changes instead of only the simulation callback, so live MCP score awards no longer race the ball loop and the browser-visible Pong demo now ends deterministically with the intended winner and score
21. agent-facing contract ownership is now explicit in `src/airjam.config.ts`: flat `createAirJamApp({ agent })` authoring is the supported path, first-party template games wire their semantic agent surfaces there, and the high-level devtools/MCP path no longer falls back to convention-scanned agent files
22. hosted release auth now has a real agent lane: the platform exposes browser-assisted device login under `/api/cli/auth/*`, backed by a dedicated `machine_auth_device_grants` table plus the existing Better Auth `sessions` table for issued agent tokens, and `create-airjam` now ships `airjam auth login`, `airjam auth whoami`, and `airjam auth logout` over shared `@air-jam/devtools-core` auth helpers
23. real hosted-release QA is now proven against the local platform lane too: device login works end to end, standalone generated Pong can be submitted and published through `airjam release submit` / `airjam release publish`, and the shipped devtools release inspection path now resolves generated `src/airjam.config.ts` through a `tsx` helper instead of falsely reporting `missing-config` when the built CLI inspects standalone TypeScript game configs
24. hosted release runtime gating is now explicit at the topology boundary: SDK-owned browser log sink and host preview workspace only auto-enable on local dev runtime modes, so hosted and self-hosted production builds no longer inherit local dev control surfaces through provider-mount side effects
25. hosted release moderation policy is now documented as fail-closed to match the existing platform release service, instead of implying that skipped moderation can still publish with warning checks

Execution note:

1. this is still not part of the current v1 release-critical path
2. the meaningful remaining work is now follow-on runtime ergonomics and richer game-owned runtime contracts, not baseline MCP enablement

### Planned Future Product/Runtime Track. Remote Rooms And Display Surfaces

Status: planned architecture  
Plan: [Remote Rooms And Display Surfaces Plan](./plans/remote-rooms-and-display-surfaces-plan.md)

Current intent:

1. keep browser host authority as the simple default
2. grow Air Jam from phone-first couch rooms into shareable player-owned rooms
3. allow controllers to become broader player input surfaces, including phones, desktop browsers, gamepads, and future agents
4. add optional display/spectator surfaces through typed display snapshots rather than automatic pixel mirroring
5. defer server-authoritative runtime modes and SpacetimeDB-like adapters until after the remote-room and display-snapshot model proves it needs them

Execution note:

1. this is not part of the current v1 release-critical path
2. prerelease preparation should stay limited to docs, naming, and avoiding new phone-only assumptions
3. implementation should wait until after v1 release proof unless it becomes explicitly prioritized

## Completed / Archived Baselines

These plans were removed from the active surface in the 2026-04-09 cleanup:

1. [Standard Lifecycle Contract Plan](./archive/standard-lifecycle-contract-plan-2026-04-09.md)
2. [Composition Shell Contract Plan](./archive/composition-shell-contract-plan-2026-04-09.md)
3. [Showcase Games Release Readiness Plan](./archive/showcase-games-release-readiness-plan-2026-04-09.md)
4. [Showcase Games Release Readiness Checklist](./archive/showcase-games-release-readiness-checklist-2026-04-09.md)
5. [Public Release Security Hardening Plan](./archive/public-release-security-hardening-plan-2026-04-09.md)
6. [SDK Extraction Clean-Swap Plan](./archive/sdk-extraction-clean-swap-plan-2026-04-09.md)
7. [Controller Preview Dock Plan](./archive/controller-preview-dock-plan-2026-04-09.md)
8. [Agent Runtime Contract Plan](./archive/agent-runtime-contract-plan-2026-04-09.md)
9. [Prerelease Systems Closeout Plan](./archive/prerelease-systems-closeout-plan-2026-04-09.md)

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
13. `useHostTick` now has one canonical named-object API with `onTick` and optional `onFrame`; first-party hosts, SDK tests, generated docs, scaffold docs, and hosted AI-pack docs use that shape
14. the repo-local prerelease scaffold lane is now first-class: `pnpm run repo -- scaffold local <target> --source=tarball|workspace --template <id>` carries the full unpublished Air Jam package graph, and `pnpm run repo -- pack local` now prepares the full matching tarball set instead of only `sdk`, `server`, and `create-airjam`
15. scaffolded projects now ship Claude launch settings that run `pnpm run dev -- --preview-managed` for browser-preview tools while keeping `pnpm run dev` as the single documented human command
16. semantic game-session action inspection is now clearer in practice: high-level `invoke_game_session_action` results distinguish acknowledgement observation from gameplay outcome, and surface whether a committed post-action snapshot was observed, so `host_ack_missing` no longer looks indistinguishable from a rejected action when state actually changed
17. local controller ownership is now being hardened deliberately instead of left implicit: controller provenance is becoming explicit, virtual/MCP controllers are being split from human reconnect semantics, and the next local-dev recovery work is a visible controller-session roster plus a generic room-reset escape hatch
18. local host recovery now has a real first-class kill path: hosts can remove controllers explicitly, preview workspace can surface the room controller roster with source-aware kick controls, and stale virtual-tooling sessions no longer require mystery background restarts just to unblock manual testing
19. fresh tarball-scaffold manual QA on 2026-04-30 found and fixed two real generated-consumer regressions before the browser proof was truly clean: `create-airjam dev --preview-managed` now passes the loaded project env into the background server process, and `@air-jam/server` now resolves `.env.local` from the actual app `cwd` instead of the installed package path; a second consumer-path fix also landed in `create-airjam`/server env schemas so omitted optional env keys stay optional under the scaffolded project's installed `zod@4.4.x` rather than failing with `expected nonoptional`
20. semantic `host:*` actions are now first-class on the normal game-session lane even for fresh minimal projects: `openGameSession(...).actions` exposes the host semantic lane, invocation routes through the dedicated `controller:host_action_rpc` server path with host actor semantics, and a fresh 2026-04-30 tarball-scaffolded `minimal` project proved the full path end to end by updating a replicated host announcement banner through the session handle and showing the new banner text in the live browser host surface
21. live browser-host acknowledgements are now fixed at the transport layer too: the root cause was a server-side Socket.IO ack parsing bug where per-socket `socket.timeout(...).emit(...)` acknowledgements were incorrectly read as broadcast response arrays, which turned real accepted host acknowledgements into `host_ack_missing`; after the 2026-04-30 fix in `register-realtime-handlers.ts`, the same fresh tarball-scaffolded minimal project returned `host-acknowledged` / `accepted` for `host:set_announcement` and updated the visible host UI banner to `ACK FIXED`
22. immediate post-invocation `readGameSession({ requestSync: true })` reads are now actually strong instead of accidentally eventual: the root cause was twofold in the state-sync lane itself, where store snapshots were unversioned/un-correlated (so a late older `airjam:state_sync` could overwrite a newer cached snapshot) and devtools commit observation was fingerprinting local receive `updatedAt` timestamps instead of real store versions; the 2026-04-30 fix added monotonic per-store `revision` numbers plus optional `requestId` correlation to sync request/response payloads, controller/runtime now ignore older revisions and wait for the matching sync response, and focused SDK/server/devtools regression coverage now proves a stale late sync can no longer make the next session read jump backward
23. host reconnect now restores replicated store state instead of silently booting from initializer state after refresh/disconnect: room sessions cache the latest replicated `airjam:state_sync` payload per store domain, reconnecting hosts are rehydrated from that room-owned cache through the normal sync channel, host store bindings now adopt higher-revision sync payloads so their next local emit continues from the restored revision, and a fresh 2026-04-30 tarball-scaffolded `minimal` project proved the full browser-use path end to end by showing `Shared Taps 1` + `SESSION QA OK` in the visible host UI, then preserving both across a full page reload/reconnect
24. embedded preview controllers now treat the canonical join URL and the local iframe origin as separate concerns: the share/join URL remains authoritative for room/capability validation, but preview-controller iframes are rebased onto the current host-page origin so browser tooling can interact with them without cross-origin iframe input failures; focused preview URL + manager coverage now proves the local embed origin can differ cleanly from the external phone join origin without weakening allowed-origin validation

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

# 2026-05-03 - Auth origin hardening

- tightened Better Auth base URL and trusted-origin resolution so auth no longer depends on a single implicit prod origin
- switched GitHub social sign-in to use the normalized internal post-auth path rather than an absolute callback URL
- follows from the production callback-origin failure during the public-domain cutover
