# Air Jam Work Ledger

Last updated: 2026-05-02
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

Immediate next work:

1. run the final prerelease manual overpass for the launch set and hosted lanes
2. upload/prove the hosted game path through the dashboard
3. finish release media/blogs and the final landing-page overlook
4. merge into `master`, deploy, and run live validation in the canonical release order
5. harden the local agent/dev loop enough that the next external one-shot game test starts from one command, one visible preview surface, and one reset path

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
12. the visual harness now has an explicit production-build opt-in query contract, local Arcade build caching invalidates when game `visual/` contracts or harness runtime code changes, and workspace process cleanup now terminates spawned process groups cleanly
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
28. Last Band Standing's next bounded polish pass is captured in [Last Band Standing Polish Plan](./plans/last-band-standing-polish-plan.md), covering controller lobby/start/home fixes, host gameplay layout polish, controller game-over scrolling, song buckets, and randomized clip starts
29. the MCP/devtools closeout no longer relies on `mcp-server` tests rebuilding `@air-jam/devtools-core`; `mcp-server` tests resolve workspace siblings from source, while `devtools-core` tests explicitly prebuild `@air-jam/sdk` because repo game configs import real SDK subpaths during dynamic config loading, which removes the concurrent validation race without inventing new build machinery
30. hosted release serving now injects one explicit `hosted-release` runtime topology into the served HTML bootstrap, and both the SDK runtime resolver and harness runtime consume that same published topology before falling back to looser inference; this removes the leaked `__airjam/dev/*` control-surface traffic from published builds and routes hosted sockets to the configured backend origin instead of accidentally defaulting to the local platform origin
31. the next publishing step is now explicitly planned as MCP Phase 4 on top of the landed release core and CLI: release doctor/validate/bundle/list/inspect/submit/publish plus `auth_status`, with only bundle and submit task-backed and no separate MCP-native login flow
32. MCP release Phase 4 is now landed: standalone generated projects expose task-backed `release_bundle` and `release_submit` plus the blocking release/auth tools over `pnpm mcp`, monorepo MCP stays on the remote release surface instead of pretending the repo root is a publishable app, and real stdio QA against a generated Pong project now completes with structured release metadata even when platform finalize ends in `failed`
33. the late game-structure alignment pass is complete: `the-office` now follows the canonical ownership model, `code-review` now publishes a semantic agent contract from config, Last Band Standing no longer ships the YouTube test route, and Air Capture's leftover debug/input seams are narrowed into the intended game-owned locations
34. visual-proof authoring now lives under the same contract namespace as semantic agent control: first-party visual scenarios moved from top-level `visual/scenarios.ts` to `src/game/contracts/visual-scenarios.ts`, optional runtime-local bridge files now live at `src/game/contracts/visual-bridge.ts`, scaffold/docs/tooling point at that contract-adjacent layout, and the old separate `visual/` authoring center is gone from the live path
35. the first prerelease agent/dev-loop hardening slice is landed and validation-clean for the touched packages: generated projects and the repo root now point agents at one normal `pnpm run dev` path, generated/root agent and Claude guidance tells agents to use visible preview controllers only through real click/drag/release gestures and semantic agent actions for reliable gameplay proof, local status/reset now exposes and cleans stale known-port listeners, session/log errors are more actionable, the preview controller dock now shows phone, preview, and virtual/agent controllers in one source-badged roster, the packaged minimal scaffold already ships a wired semantic agent contract, create-airjam CLI tests cover the new recovery command help surfaces, devtools-core directly tests unmanaged-listener status/reset behavior on an isolated test port, and the SDK test nullability blocker that was preventing package typecheck is fixed

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

### Planned Future Systems Track. Air Jam MCP And Agent Devtools

Status: usable V2 landed  
Plan: [Air Jam MCP And Agent Devtools Plan](./plans/air-jam-mcp-and-agent-devtools-plan.md)

Current intent:

1. build shared `devtools-core` services first and keep MCP as a thin adapter
2. make the same MCP work in this monorepo and in generated `create-airjam` games
3. ship project-local MCP setup and agent guidance by default in generated games, with opt-out

### Planned Future Systems Track. Agent Control System Rewrite

Status: planned architecture rewrite  
Plan: [Agent Control System Rewrite Plan](./plans/agent-control-system-rewrite-plan.md)

Current intent:

1. collapse the current overlapping semantic-game, harness-bridge, controller-session, and visual-scenario concepts into one primary game-owned agent contract
2. keep browser or in-app preview as the canonical visual truth while making precise host-side staged actions a first-class contract feature instead of a visual-harness side path
3. split browser-safe runtime exports from Playwright/Node visual tooling so the package graph makes the safe path obvious and the wrong path impossible
4. move the primary MCP/devtools story up to one game-session abstraction so agents act on intent rather than transport internals
5. ship a tiny agent seam by default in the `minimal` template so external agents do not need to invent authoring structure mid-task

Recommended first execution slice:

1. package-boundary repair for browser-safe runtime imports
2. live-dev attachment and MCP/devtools happy-path repair
3. a supported live-state snapshot primitive for agent control

Latest progress inside this track:

1. the first Phase 1 package-boundary repair is landed: `@air-jam/harness` root is now the safe runtime-facing entry, Playwright/session runner APIs moved behind explicit `@air-jam/harness/visual` imports, first-party scenario/devtools consumers were migrated, and generated harness docs now spell out the `runtime` versus `visual` split directly
2. the second Phase 1 happy-path repair is landed for harness/session tooling: `devtools-core` now tries to attach to a compatible already-running local dev session before starting a managed one, so the default live MCP/browser path no longer immediately collides with an already-open manual dev stack
3. the third Phase 1 live-state primitive is landed in the SDK: `createAirJamStore(...)` now officially exposes `getState()`, `subscribe(...)`, and `useLiveStateRef()` for agent-control/runtime extensions, and the generated docs now point bridge authors at that supported path instead of ad hoc state-mirroring workarounds
4. the first Phase 2 contract-unification slice is landed: shared agent-action input definitions now live in `@air-jam/sdk`, visual harness bridge actions consume that shared core instead of carrying a separate parser/metadata system, agent contracts now use the `agentAction.participant(...)` builder, and `games/pong` is the first proving contract on that strict path
5. the second Phase 2 contract-unification slice is landed: first-party configs and generated docs now use only flat `agent` / `visualScenariosModule` authoring, the `game.agent` alias is removed, `@air-jam/devtools-core` exposes a single high-level game-session API for player input plus semantic and host-side actions, MCP mirrors that lane through `airjam.open_game_session`, `airjam.send_game_session_input`, `airjam.read_game_session`, `airjam.invoke_game_session_action`, and `airjam.close_game_session`, and the older public controller/harness/game-action MCP control tools are no longer registered
6. the third Phase 2 strictness slice is landed: first-party game contracts no longer use the raw `payload` / `resolveInput` form, the SDK no longer exports or normalizes that legacy action contract shape, and session actions now resolve through one unified `player:*` / `host:*` namespace instead of a public surface discriminator
7. the fourth Phase 2 strictness slice is landed: `createAirJamApp({ metadata: gameMetadata, ... })` now carries canonical game identity, first-party semantic contracts and visual scenario packs no longer repeat `gameId`, visual harness runtime registration takes canonical `gameMetadata.slug` at mount time, and harness action completion now waits for committed published snapshots instead of immediate post-action sampling
8. the fifth Phase 2 strictness slice is landed: semantic game contracts now declare typed named `stores` instead of raw domain arrays, first-party game contracts no longer need ad hoc generic casts for default-store reads, and harness/game-session action results now explicitly distinguish `committed-update-observed` from `no-new-commit-before-timeout`
9. the sixth Phase 2 strictness slice is landed: controller store dispatch, server forwarding, and high-level game-session/devtools results now publish first-class accepted/rejected action acknowledgements, so agents can tell “rejected” apart from “accepted but no visible state change yet” without guessing from logs or snapshot timing
10. the seventh Phase 2 strictness slice is landed: `createAirJamStore(...)` now exposes `useHostActionListener(...)` and `subscribeHostActions(...)` as the supported host-only imperative reaction seam, and the generated docs now point builders there instead of queue-and-drain replicated-state patterns for local sim/audio/effect work
11. the first Phase 4 template reset slice is landed: `games/minimal` now ships `src/game/contracts/agent.ts` wired through `agent`, and that starter host demonstrates the new host-action listener seam with a small host-only local notice instead of replicated ephemeral state
12. the second Phase 4 docs reset slice is landed: generated projects now ship `docs/agent-gold-path.md`, the template docs index and `AGENTS.md` push agents there first, and the AI-pack/scaffold contract now requires that file so the shortest correct workflow stays present in future scaffolds
13. the third Phase 4 docs reset slice is landed: task-backed MCP tools now advertise the required client capability directly in registered tool descriptions, the MCP server instructions call that execution model out explicitly, and the generated visual/MCP docs now treat `src/game/contracts/agent.ts` as primary while framing `visual/*` as optional host staging plus visual proof instead of a competing agent-control lane
14. the repo-local prerelease acceptance lane is more resilient now too: `pnpm run repo -- scaffold local ... --source=tarball` and `pnpm run repo -- pack local` preflight missing workspace dependency links before tarball packing, try a frozen install first, and automatically fall back to a normal install when recent workspace package changes left the lockfile and node_modules out of sync
15. the remaining local-prerelease tarball integrity problem is now fixed at the packaging layer: `scaffold local --source=tarball` and `pack local` create immutable tarball-set directories under `.airjam/tarballs/sets/<set-id>/`, generated projects keep pointing at their original set after later repacks, `pnpm install --frozen-lockfile` now stays clean after a new local pack, and a fresh tarball-backed `minimal` scaffold was re-proved end to end through `typecheck`, `test`, `build`, in-app browser host render, and installed-tarball `open_game_session`
16. the latest external-agent build feedback is now folded back into the rewrite plan as one explicit DX-hardening follow-on phase: keep dispatcher semantics strict, add a host-only explicit player-impersonation API instead of muddy `actorId` behavior, tighten action payload diagnostics and acknowledgement/result semantics, add `agentActionInput.zod(...)`, and teach the lane model plus `useHostTick`/accept-reject patterns earlier in the first-read docs
17. the first actor-semantics hardening slice is now landed: `createAirJamStore(...)` exposes a host-only `asPlayer(controllerId)` impersonation lane for explicit semantic player dispatch, the API rejects non-host usage and disconnected controller ids, first-party SDK/scaffold docs now teach that `ctx.actorId` always means the dispatcher, and the new path is covered by focused SDK behavior tests
18. the second actor-and-agent-DX hardening slice is now landed: `agentActionInput.zod(...)` is now the first-class schema-backed agent-action helper, store-action payload type failures now surface a named `__airJamInvalidActionPayloads__` diagnostic marker instead of collapsing to anonymous `never`, the strict payload-root rule now explicitly documents that `T | undefined` unions are invalid, and the SDK/type tests plus generated docs/scaffold archives were refreshed together
19. the third actor-and-outcome hardening slice is now landed: semantic game-action invocation now returns explicit snapshot/acknowledgement observation fields plus a normalized `outcome`, so `host_ack_missing` / `host_ack_timeout` no longer read like semantic rejection when state visibly changed
20. the controller-ownership recovery slice is now landed: controller provenance is explicit, hosts have a richer `host.controllers` roster plus explicit `removeController(controllerId)` recovery controls, and virtual/MCP controllers no longer inherit the normal human reconnect lease
21. the local room-recovery slice is now landed: hosts now expose `resetRoom()`, server room teardown now clears socket membership before rebinding the host to a fresh empty room, and the preview workspace exposes a `Reset room` panic button that reloads the local host page so gameplay state and controller state reset together instead of trapping developers in a dirty room
22. the next DX-clarity slice is landed too: semantic game contracts now use `agentAction.participant(...)` as the canonical builder name, the scaffold/docs pack now includes a dedicated state-lanes cookbook, first-read docs now show canonical `acceptAirJamAction(...)` / `rejectAirJamAction(...)` usage, `resultDescription` is explicitly documented as effect-description metadata rather than implicit runtime result data, and isolated harness/runtime ownership timeouts now tell developers to close the previous game session before treating the failure as a gameplay bug
23. the public API-pruning slice is landed too: the SDK root now keeps only the neutral agent authoring API, agent-inspection helpers moved to `@air-jam/sdk/agent-tooling`, `createAirJamApp(...)` now publishes `controllerPath`, `agent`, and `visualScenariosModule` as flat top-level fields instead of nested `game.*`, and first-party configs/scaffolds/devtools all now read that one strict shape
24. the final naming-cleanup slice is now landed too: the public authoring story is now consistently `agent`, not `machine`, file/module names and helper scripts were renamed repo-wide to that vocabulary, active docs/template guidance now teach only the `agent` surface, and the only remaining `machine` references in live code are intentional unrelated leaves such as `platform-machine` or historical notes about removed aliases
25. the visual-proof staging collapse is now landed too: semantic agent contracts now support first-class `agentAction.host(...)` actions, `VisualHarnessRuntime` now binds full synced stores through `agent={{ contract, stores }}` and derives the host dispatch lane internally, high-level game sessions expose those actions as canonical `host:*` actions, migrated visual scenarios now stage through `context.agent.invoke(...)`, and runtime-local bridges are reduced toward bootstrap/inspection-only responsibilities
26. the workspace build-race hardening slice is now landed too: shared dependency builds for `@air-jam/sdk` and `@air-jam/devtools-core` now go through a tiny locked `scripts/ensure-workspace-package-build.mjs` helper with per-package freshness stamps, so parallel package `typecheck`/`build` runs no longer race `tsup` clean operations against the same `dist/` folder

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
6. hosted release runtime gating is now explicit at the SDK topology boundary, so hosted builds no longer auto-boot dev-only harness, browser-log, or preview-controller lanes
7. hosted release HTML bootstrap now publishes one explicit `hosted-release` runtime topology, and a fresh local published Pong release no longer emits `__airjam/dev/harness/*` or `__airjam/dev/browser-logs` traffic
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
21. agent-facing contract ownership is now explicit in `src/airjam.config.ts`: flat `createAirJamApp({ agent, visualScenariosModule })` authoring is the only supported path, first-party template games wire their published harness/agent surfaces there, and the high-level devtools/MCP/repo-visual path no longer falls back to convention-scanned agent or visual contract files
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
14. `useHostTick` now has one canonical named-object API with `onTick` and optional `onFrame`; first-party hosts, SDK tests, generated docs, scaffold docs, and hosted AI-pack docs use that shape
15. the repo-local prerelease scaffold lane is now first-class: `pnpm run repo -- scaffold local <target> --source=tarball|workspace --template <id>` carries the full unpublished Air Jam package graph, and `pnpm run repo -- pack local` now prepares the full matching tarball set instead of only `sdk`, `server`, and `create-airjam`
16. standalone semantic game-session bootstrap is now materially repaired on the local tarball/generated-project path: `@air-jam/devtools-core` no longer loses helper scripts in packed installs, no longer depends on a visual harness just to own a controller session, bypasses standalone `topology` wrapper scripts that drop `--mode`, and now infers the standalone `gameId` so scaffolded `agent` actions appear through `open_game_session` without explicitly passing `gameId`
17. scaffolded projects now ship a first-class `pnpm run dev:preview` lane for preview-managed browser tools; that mode is intentionally local HTTP only, starts or reuses the Air Jam backend separately, and now detects the Codex-style `preview-proxy` case so the public browser URL can stay on `:5173` while Vite binds behind it on the proxy target port
18. semantic game-session action inspection is now clearer in practice: high-level `invoke_game_session_action` results distinguish acknowledgement observation from gameplay outcome, and surface whether a committed post-action snapshot was observed, so `host_ack_missing` no longer looks indistinguishable from a rejected action when state actually changed
19. local controller ownership is now being hardened deliberately instead of left implicit: controller provenance is becoming explicit, virtual/MCP controllers are being split from human reconnect semantics, and the next local-dev recovery work is a visible controller-session roster plus a generic room-reset escape hatch
20. local host recovery now has a real first-class kill path: hosts can remove controllers explicitly, preview workspace can surface the room controller roster with source-aware kick controls, and stale virtual-tooling sessions no longer require mystery background restarts just to unblock manual testing
21. visual scenarios are now being collapsed onto the canonical agent/session lane instead of treating the harness bridge as a second semantic control system: the harness runner exposes `context.agent`, Pong's deterministic visual staging now uses canonical session actions, and the bridge is being reduced toward runtime-local bootstrap/visual-only responsibilities
22. the visual authoring story is now cleaner and more minimal in practice: `defineVisualHarness({ agent, scenarios })` is the default shape, `bridge` is optional, `context.agent.read()` / `waitFor()` expose the projected agent snapshot directly, and first-party games like `pong`, `air-capture`, and `code-review` no longer carry empty or unnecessary visual bridge surfaces just to stage deterministic captures
23. `@air-jam/harness` is now a real built package instead of a source-export package in live Node paths: its public exports resolve to `dist/*`, its build now emits every exported subpath (`index`, `visual`, `runtime`, `dev-control`), and workspace scripts ensure `@air-jam/sdk` is built first so standalone local dev no longer crashes on `ERR_UNKNOWN_FILE_EXTENSION` when a game imports harness surfaces through the normal package boundary
24. the post-refactor QA proof is now real instead of inferred: fresh `last-band-standing` standalone visual capture was rerun on 2026-04-30, wrote a new `ended` artifact set under `.airjam/artifacts/visual/last-band-standing/`, and full repo `lint` plus `typecheck` passed afterward on the prerelease tree
25. fresh tarball-scaffold manual QA on 2026-04-30 found and fixed two real generated-consumer regressions before the browser proof was truly clean: `create-airjam dev --preview-managed` now passes the loaded project env into the background server process, and `@air-jam/server` now resolves `.env.local` from the actual app `cwd` instead of the installed package path; a second consumer-path fix also landed in `create-airjam`/server env schemas so omitted optional env keys stay optional under the scaffolded project's installed `zod@4.4.x` rather than failing with `expected nonoptional`
26. semantic `host:*` actions are now first-class on the normal game-session lane even for fresh minimal/no-harness projects: `openGameSession(...).actions` exposes the host semantic lane without requiring a harness session, invocation routes through the dedicated `controller:host_action_rpc` server path with host actor semantics, and a fresh 2026-04-30 tarball-scaffolded `minimal` project proved the full path end to end by updating a replicated host announcement banner through the session handle and showing the new banner text in the live browser host surface
27. live browser-host acknowledgements are now fixed at the transport layer too: the root cause was a server-side Socket.IO ack parsing bug where per-socket `socket.timeout(...).emit(...)` acknowledgements were incorrectly read as broadcast response arrays, which turned real accepted host acknowledgements into `host_ack_missing`; after the 2026-04-30 fix in `register-realtime-handlers.ts`, the same fresh tarball-scaffolded minimal project returned `host-acknowledged` / `accepted` for `host:set_announcement` and updated the visible host UI banner to `ACK FIXED`
28. immediate post-invocation `readGameSession({ requestSync: true })` reads are now actually strong instead of accidentally eventual: the root cause was twofold in the state-sync lane itself, where store snapshots were unversioned/un-correlated (so a late older `airjam:state_sync` could overwrite a newer cached snapshot) and devtools commit observation was fingerprinting local receive `updatedAt` timestamps instead of real store versions; the 2026-04-30 fix added monotonic per-store `revision` numbers plus optional `requestId` correlation to sync request/response payloads, controller/runtime now ignore older revisions and wait for the matching sync response, and focused SDK/server/devtools regression coverage now proves a stale late sync can no longer make the next session read jump backward
29. host reconnect now restores replicated store state instead of silently booting from initializer state after refresh/disconnect: room sessions cache the latest replicated `airjam:state_sync` payload per store domain, reconnecting hosts are rehydrated from that room-owned cache through the normal sync channel, host store bindings now adopt higher-revision sync payloads so their next local emit continues from the restored revision, and a fresh 2026-04-30 tarball-scaffolded `minimal` project proved the full browser-use path end to end by showing `Shared Taps 1` + `SESSION QA OK` in the visible host UI, then preserving both across a full page reload/reconnect
30. embedded preview controllers now treat the canonical join URL and the local iframe origin as separate concerns: the share/join URL remains authoritative for room/capability validation, but preview-controller iframes are rebased onto the current host-page origin so browser tooling can interact with them without cross-origin iframe input failures; focused preview URL + manager coverage now proves the local embed origin can differ cleanly from the external phone join origin without weakening allowed-origin validation

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
