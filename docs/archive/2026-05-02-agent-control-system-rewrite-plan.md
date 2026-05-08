# Agent Control System Rewrite Plan

Last updated: 2026-04-27  
Status: planned architecture rewrite

Related docs:

1. [Vision](../vision.md)
2. [Framework Paradigm](../framework-paradigm.md)
3. [Work Ledger](../work-ledger.md)
4. [Air Jam MCP And Agent Devtools Plan](./2026-05-02-air-jam-mcp-and-agent-devtools-plan.md)
5. [Harness Visual Contract](./2026-05-02-harness-visual-contract.md)
6. [AI-Native Development Workflow](./2026-03-28-ai-native-development-system.md)

## Purpose

Rewrite Air Jam's agent-facing game control system into one minimal, obvious, hard-to-misuse architecture.

The goal is not to add more agent tooling. The goal is to remove duplicated concepts, collapse overlapping control lanes, and make the correct workflow the default workflow in both code and docs.

The desired end state is:

1. every Air Jam game exposes one clear agent-facing contract
2. browser preview stays the canonical visual verification path
3. precise host-side staging and real player-like control both work through one coherent session model
4. visual capture and scenario tooling become optional consumers of that same contract instead of a second competing control system
5. generated projects ship the seam by default so agents do not invent architecture mid-task

Latest progress:

1. the first Phase 1 package-boundary repair is now landed: `@air-jam/harness` root no longer exports the Playwright/session runner surface, browser/runtime authoring stays on `@air-jam/harness/runtime`, and the mixed visual-scenario/capture surface now lives behind explicit `@air-jam/harness/visual` imports
2. the second Phase 1 happy-path repair is now landed in `devtools-core` for harness/session tooling: these flows now try to attach to a compatible already-running local dev session before starting a managed one, which removes the default port-collision path for live MCP/browser work
3. the third Phase 1 live-state primitive is now landed in `@air-jam/sdk`: synced stores officially expose `getState()` and `subscribe(...)`, plus a React-safe `useLiveStateRef()` hook so bridge/runtime code can consume the latest replicated store state without hand-rolled mirror refs
4. the first concrete Phase 2 unification slice is now landed: shared agent-action input definitions live in `@air-jam/sdk`, visual harness actions now consume that same core instead of carrying their own parser/metadata system, agent contracts use the `agentAction.participant(...)` builder, and Pong proved the first strict contract path
5. the second concrete Phase 2 unification slice is now landed: `src/airjam.config.ts` now publishes agent-facing seams only through flat `agent` and `visualScenariosModule` fields, the `game.agent` alias is gone, `@air-jam/devtools-core` and MCP now expose one high-level `open_game_session` / `send_game_session_input` / `read_game_session` / `invoke_game_session_action` / `close_game_session` lane, and the older public controller/harness/game-action MCP control tools are no longer registered as first-class agent choices
6. the third concrete Phase 2 strictness slice is now landed: first-party games no longer ship the old raw `payload` / `resolveInput` contract shape, the SDK no longer exports or normalizes that legacy action form, and `invoke_game_session_action` now resolves one unified action namespace with explicit `player:*` and `host:*` ids instead of a public surface discriminator
7. the fourth concrete Phase 2 strictness slice is now landed: `createAirJamApp({ metadata: gameMetadata, ... })` now carries canonical game identity, first-party semantic contracts and visual scenario packs no longer repeat `gameId`, `<VisualHarnessRuntime />` now receives canonical `gameId` explicitly at mount time, and harness command completion now waits for a committed published snapshot instead of sampling React state too early
8. the fifth concrete Phase 2 strictness slice is now landed: semantic game contracts now declare named snapshot stores through explicit typed `stores` bindings instead of raw domain arrays, first-party game contracts no longer need ad hoc generic casts to read the default store, and harness/game-session action results now report whether they observed a new committed snapshot or timed out without one
9. the sixth concrete Phase 2 strictness slice is now landed: controller store dispatch, server action forwarding, and high-level game-session/devtools results now all publish first-class accepted/rejected action acknowledgements so callers can distinguish rejection from “accepted but no visible change yet” without inferring from logs or snapshots
10. the seventh concrete Phase 2 strictness slice is now landed: `createAirJamStore(...)` now exposes `useHostActionListener(...)` and `subscribeHostActions(...)` as the canonical host-only imperative reaction seam, so games can react to accepted semantic actions with local runtime effects without queueing ephemeral commands through replicated state
11. the first concrete Phase 4 template-reset slice is now landed: the `minimal` starter now ships `src/game/contracts/agent.ts` wired through `agent`, and its host proves the new `useHostActionListener(...)` seam with a tiny host-only local effect instead of replicated queue-and-drain state
12. the second concrete Phase 4 docs-reset slice is now landed: generated projects now ship a short `docs/agent-gold-path.md`, the local docs index points at it first, `AGENTS.md` tells agents to read it before the broader pack, and the AI-pack contract now requires that file so the shortest correct workflow cannot silently disappear from future scaffolds
13. the third concrete Phase 4 docs-reset slice is now landed: task-backed MCP tools now advertise the client capability requirement directly in registered tool descriptions, the MCP server instructions call that execution model out explicitly, and the generated visual/MCP docs now frame `src/game/contracts/agent.ts` as primary while treating `visual/*` as optional host staging plus visual proof instead of a competing control surface
14. the local prerelease acceptance lane is now more resilient too: repo-local `scaffold local` and `pack local` preflight missing workspace dependency links before tarball packing, try a frozen install first, and fall back to a normal install when recent workspace package changes left the lockfile and node_modules out of sync
15. the local prerelease tarball lane is now immutable per run too: `pack local` and `scaffold local --source=tarball` now create dedicated tarball-set directories plus manifests under `.airjam/tarballs/sets/<set-id>/`, generated projects keep pointing at their original set after later repacks, `pnpm install --frozen-lockfile` stays clean across those later repacks, and a fresh tarball-backed minimal scaffold was re-proved through `typecheck`, `test`, `build`, in-app browser host render, and installed-tarball `open_game_session`
16. the first actor-semantics hardening slice is now landed: `createAirJamStore(...)` exposes a host-only `asPlayer(controllerId)` impersonation lane for explicit semantic player dispatch, the path rejects non-host usage and disconnected controller ids instead of mutating ambiguous state, and the first-read SDK/scaffold docs now teach that `ctx.actorId` always means the dispatcher identity
17. the second actor-and-agent-DX hardening slice is now landed: `agentActionInput.zod(...)` is now the first-class schema-backed agent-action helper, invalid networked-store payload roots now surface a named `__airJamInvalidActionPayloads__` type marker instead of collapsing to anonymous `never`, and the public/generated docs now state explicitly that payload roots must be omitted or exactly one plain object instead of `T | undefined` unions
18. the third actor-and-outcome hardening slice is now landed: high-level semantic game-action invocation now returns `snapshotBefore`, `snapshotAfter`, `snapshotAfterStatus`, `observedStateChange`, `acknowledgementObservation`, and a normalized `outcome`, so `host_ack_missing` / `host_ack_timeout` no longer read like semantic rejection when the game state visibly changed
19. the first controller-ownership hardening slice is now landed: controller provenance is now explicit at the shared protocol/server boundary, host runtime inspection can carry a controller-session roster separate from plain player profiles, and virtual/MCP controllers no longer inherit the normal human reconnect lease when their owning tooling session disappears
20. the second controller-ownership hardening slice is now landed: hosts now have one explicit `removeController(controllerId)` recovery control, the preview workspace can surface the live room controller roster with source-aware kick actions, and manual local recovery no longer depends on waiting for stale sessions or restarting the whole background stack
21. the third controller-recovery slice is now landed: hosts now have a first-class `resetRoom()` lifecycle operation, server-side room teardown cleanly evicts sockets from the old room before rebinding the host to a fresh empty room, and the preview workspace exposes that path as a local-dev panic button that reloads the host page so gameplay state and controller state reset together instead of trapping developers in a dirty room
22. the latest DX-clarity slice is now landed too: semantic game contracts now use `agentAction.participant(...)` as the canonical builder name, the docs pack now ships a dedicated state-lanes cookbook, `acceptAirJamAction(...)` / `rejectAirJamAction(...)` have first-read worked examples, `resultDescription` is now documented as effect-description metadata rather than implicit runtime result data, and isolated harness/runtime ownership timeouts now tell builders to close the previous game session before treating the issue as gameplay breakage
23. the public API-pruning slice is now landed too: the SDK root now exposes only the neutral agent authoring surface (`defineAirJamAgentContract`, `defineAirJamAgentStores`, `agentStore`, `agentAction`, `agentActionInput`), agent-inspection helpers moved to the dedicated `@air-jam/sdk/agent-tooling` subpath, `createAirJamApp(...)` now publishes `controllerPath`, `agent`, and `visualScenariosModule` as flat top-level fields instead of nested `game.*`, and first-party games/devtools/scaffolds now follow that single strict path
24. the final naming-cleanup slice is now landed too: the public contract story is now consistently `agent`, not `machine`, repo file/module names and helper scripts were renamed to match that vocabulary, and active docs/template guidance now teach only the `agent` surface instead of a mixed `machine`/`agent` story
25. the visual-proof staging collapse is now landed too: semantic agent contracts now support first-class `agentAction.host(...)` actions, `VisualHarnessRuntime` now binds full synced stores through `agent={{ contract, stores }}` and derives the host dispatch lane internally, high-level game sessions expose those actions as canonical `host:*` actions, migrated visual scenarios now stage through `context.agent.invoke(...)`, and runtime-local bridges are reduced toward bootstrap/inspection-only responsibilities

## Why This Rewrite Exists

Recent real agent testing showed that the current system is powerful but too easy to misunderstand.

The agent eventually completed the task, but it took a noisy path:

1. it mixed up harness sessions and controller sessions
2. it misdiagnosed an intentional helper-path fallback as a packaging/path bug
3. it treated the visual harness bridge as if it were the primary way to unlock agent control
4. it fell back to direct harness HTTP endpoints instead of staying on the official MCP path
5. it had to discover important authoring structure while already in the middle of gameplay debugging

That means the current architecture works, but the model we expose is not yet intuitive enough for agent-first development.

## Current Diagnosis

### 1. There Are Too Many Similar Control Concepts

Today an agent can encounter all of these:

1. semantic agent actions
2. visual-harness bridge actions
3. controller sessions
4. harness sessions
5. visual scenarios

These are all valid internals, but they do not read like one coherent product surface.

### 2. The "Visual Harness" Name Owns Too Much

The current harness story mixes two different responsibilities:

1. browser-published runtime control and state publication
2. Playwright-driven visual scenarios and screenshot capture

Those should not be the same conceptual thing.

The first is a core agent-control primitive. The second is optional visual tooling.

### 3. Package Boundaries Do Not Enforce Safe Usage

The current `@air-jam/harness` root exports both browser-runtime and Playwright-side modules. That makes accidental wrong imports possible and teaches the wrong mental model.

The package graph should make the safe import path obvious and the wrong import path impossible.

### 4. The Official Tooling Surface Leaks Internal Transport Concepts

The MCP currently exposes powerful low-level lanes, but the primary UX still makes agents think about:

1. which session type they need
2. whether an action is a harness action or a game action
3. whether they need browser bridge setup before they can act

Agents should think about intent, not transport.

### 5. The Minimal Template Still Depends On Mid-Task Architecture Invention

The current guidance tells agents when to add agent seams, which is better than nothing, but it still leaves too much discretion during the task itself.

For agent-first development, the seam should already exist in the minimal template in the smallest possible form.

## External Agent Findings To Incorporate

The recent external-agent run surfaced concrete friction that should be treated as direct rewrite inputs, not anecdotal complaints.

### Highest-Signal Findings

1. the semantic agent contract and the visual-harness bridge feel like two parallel agent surfaces with no sharp operational line
2. `@air-jam/harness` root is not browser-safe and silently pulls Playwright-side code into browser bundling
3. the synced store authoring path does not expose a clean supported way to produce imperative live snapshots for bridge/runtime control
4. `snapshotBefore` / `snapshotAfter` semantics are not trustworthy enough if "after" can still mean "before the next React commit"
5. the game snapshot context is too stringly and does not connect clearly to the actual typed game store
6. payload-definition systems are fragmented across multiple control lanes instead of using one schema story
7. MCP harness wrappers fight existing live dev servers instead of attaching to them
8. bootstrap/runtime wrapper failures are too easy to misdiagnose, which causes agents to lose trust in the official path
9. task-backed MCP tools do not explain the execution model clearly enough for non-task-aware clients
10. `gameId` and agent-related config are duplicated in too many places
11. agent config nesting and string module paths are more fragile and less obvious than they should be
12. the generated docs do not yet contain enough of the practical operational knowledge needed to stay on the happy path

### Interpretation

These findings reinforce the same core conclusion:

1. the problem is not missing power
2. the problem is duplicated concepts, weak package boundaries, and an overly transport-shaped product story
3. the rewrite must therefore remove ambiguity by structure, not by adding more explanation on top of the current shape

## Consolidated Improvement Ledger

This section is the durable rollup of the agent-control and SDK-DX improvements discovered through the recent external-agent build, the follow-up self-check, and local repo review.

It intentionally mixes:

1. active architectural rewrite items
2. API/DX hardening items
3. source-versus-artifact parity problems
4. template and docs discoverability problems

The goal is to keep one readable problem/solution ledger instead of scattering the same critique across chat history.

### 1. Enforce Source, Tarball, Scaffold, And Docs Parity

Problem:

The external-agent feedback was partly correct against the local installed tarball and partly outdated relative to current source. That means a builder can read current docs or source, install the published artifact, and still hit an older or differently shaped SDK/devtools surface.

Why this matters:

1. it destroys trust in the official path faster than almost any API flaw
2. it makes good feedback look inconsistent or sloppy
3. it forces builders to source-dive just to learn whether a problem is real or already fixed

Suggested solution:

1. add explicit parity checks that validate packed tarballs against current source for the critical agent-control seams
2. make scaffold smoke prove the shipped template, packed SDK, packed harness package, and packed MCP path all agree on the same authoring story
3. fail release preparation if current docs mention APIs or config shapes that the packed artifacts do not yet ship
4. treat source-artifact drift as a release-blocking product bug, not just a packaging detail

### 2. Collapse To One Canonical Machine-Facing Contract

Problem:

The current public story still makes builders think about semantic agent contracts, visual-harness bridge actions, session types, and staging lanes as adjacent concepts instead of one coherent system.

Why this matters:

1. every agent or builder pays a decision tax before they can even start testing
2. overlapping concepts make the system look more configurable than it really is
3. the happy path becomes something you learn socially instead of something the product structure teaches directly

Suggested solution:

1. expose one canonical game-owned agent contract with `snapshot` plus `actions`
2. make action lanes explicit as `player` and `host` instead of forcing users to reason about separate public subsystems
3. keep visual tooling as a consumer of that contract, not a second authoring model
4. continue deleting or de-emphasizing legacy public surfaces that require users to choose transport details themselves

### 3. Keep One High-Level Session Story

Problem:

The public tooling story has historically leaked harness sessions, controller sessions, bridge registration, raw invoke endpoints, and other internal transport concepts.

Why this matters:

1. it makes the official tooling feel less direct than raw browser workarounds
2. it increases the chance that agents bypass the supported path and talk to internal HTTP endpoints directly
3. it teaches implementation detail instead of intent

Suggested solution:

1. keep `open_game_session` / `read_game_session` / `invoke_game_session_action` / `close_game_session` as the only primary external story
2. make internal session ids, broker polling, and registration details implementation-private unless a user explicitly needs low-level debugging
3. keep attaching to an already-running compatible local dev session as the default behavior
4. ensure every agent-visible action is discoverable through one unified session read path

### 4. Add First-Class Action Acknowledgement And Rejection Semantics

Problem:

Networked store actions are still effectively fire-and-forget from the caller's point of view. Controllers can dispatch an action that gets blocked because of cooldown, wrong phase, missing authority, or bad payload shape and receive no structured caller-facing result.

Why this matters:

1. games duplicate host rules on the client just to explain why nothing happened
2. silent no-op behavior erodes trust in the action API
3. agent-driven testing becomes harder because callers cannot distinguish "accepted but no visible change yet" from "rejected"

Suggested solution:

1. add a first-class action acknowledgement channel with explicit accepted/rejected outcomes
2. include a typed rejection reason or action result payload where appropriate
3. make the controller and agent-control lanes consume the same acknowledgement model
4. keep diagnostics for debugging, but do not rely on diagnostics alone as the product-facing result contract

### 5. Add A First-Class Host Imperative Reaction Seam

Problem:

Games regularly need host-only imperative reactions to semantic actions: spawn a projectile into a local simulation ref, play a sound, trigger a one-shot animation, write a log entry, or kick off deterministic staging logic. Today the common workaround is queue-in-store plus host `useEffect` drain plus consume action.

Why this matters:

1. it is the most obvious place where builders feel they are fighting the framework
2. it adds avoidable replicated-state noise for inherently local host-side effects
3. it encourages game-specific ad hoc patterns instead of one supported extension seam

Suggested solution:

1. add a first-class host-side imperative listener primitive, such as a host action listener or equivalent callback contract
2. make that primitive work cleanly with the existing replicated-store authority model
3. keep it explicit and small so it does not collapse replicated state and local effects into one unclear abstraction
4. document it as the canonical answer for host-local side effects instead of forcing queue-and-consume patterns into every non-trivial game

### 6. Make Post-Action Snapshot Semantics Trustworthy

Problem:

If post-action reporting can read "after" state before the next committed published snapshot exists, the result surface is semantically wrong even when the underlying action worked.

Why this matters:

1. agents and builders naturally treat `snapshotAfter` as committed truth
2. ambiguous timing makes the official agent-control path feel unreliable
3. it pushes users toward polling or raw browser inspection just to verify success

Suggested solution:

1. wait for the next committed published snapshot before reporting post-action state
2. when no new commit occurs, report that condition explicitly instead of pretending a stale snapshot is "after"
3. distinguish "action completed with no state change" from "timed out before observing a new commit"
4. keep the semantics identical across semantic actions, host staging actions, and visual-tooling consumers

### 7. Make Actor Identity And Host-Initiated Dispatch Unambiguous

Problem:

Builders can read `ctx.actorId` as "the player this action is about" when the real rule is "the actor that dispatched the action." That is correct transport semantics, but it is easy to misuse from host code, where a host-driven action may accidentally write host identity into player-owned state.

Why this matters:

1. it creates silent, plausible-looking bugs instead of loud failures
2. the broken state often still renders something believable, so builders lose time debugging the wrong layer
3. teams will re-encode ad hoc `controllerId` payload patterns unless the framework teaches the distinction structurally

Suggested solution:

1. keep the existing `ctx.actorId` meaning exactly as the dispatcher identity
2. document that rule sharply in the shortest authoring path, not only in generated API docs
3. add a host-only explicit impersonation lane for the cases where the host truly wants to execute the same semantic action as player `X`
4. keep administrative host actions separate from impersonation so "act as player" and "mutate player state as host" do not blur together again

### 8. Make Action Payload Rules And Errors Self-Explaining

Problem:

The current store-action payload contract is intentionally strict, but when a builder violates it the resulting TypeScript errors can collapse into broad `never`-shaped failures that do not identify the real offending action.

Why this matters:

1. builders waste time source-diving SDK declaration files to learn a simple rule
2. the error teaches the type system, not the product contract
3. friction appears early in the exact part of the SDK that should feel obvious

Suggested solution:

1. keep the root payload contract minimal: omitted or plain object only
2. improve the type-level diagnostics so the failing action name is surfaced directly
3. decide explicitly whether `T | undefined` payload unions are supported; if not, say so in the main authoring docs and error surface
4. use the same plain-language wording across docs, compiler messages, and agent guidance

### 9. Make Zod The Obvious Schema Helper On The Machine-Action Path

Problem:

The SDK already teaches Zod strongly in adjacent surfaces, but the agent-action input builder still makes Zod users drop to the lower-level `custom(...)` API.

Why this matters:

1. it makes the agent-control surface feel less first-class than the rest of the SDK
2. it creates a false "maybe this lane is not meant for schemas" impression
3. it is a tiny missing ergonomic that creates disproportionate hesitation during authoring

Suggested solution:

1. add `agentActionInput.zod(schema, options?)` as the obvious typed helper
2. keep `custom(...)` as the low-level escape hatch, not the default Zod story
3. use the new helper in first-party examples and generated docs immediately so it becomes the learned path

### 10. Distinguish Rejection, Acceptance, And Missing Host Acknowledgement Cleanly

Problem:

The protocol now has accepted/rejected action result types, but some higher-level surfaces can still report `host_ack_missing` in ways that are too easy to read as a gameplay rejection instead of a transport acknowledgement problem.

Why this matters:

1. it makes working behavior look broken
2. agents lose trust in the official agent-control lane and start adding local debug seams
3. users end up reading logs or source to interpret a result that should already be explicit

Suggested solution:

1. preserve the protocol distinction between accepted and rejected actions
2. audit every devtools and MCP result layer so transport acknowledgement gaps never masquerade as semantic rejection
3. surface a third explicit state for "accepted or applied, but host acknowledgement was not observed before timeout" when that is the truth
4. document how callers should reason about acknowledgement, snapshot deltas, and visual confirmation together

### 11. Teach The State Lanes With One Worked Cookbook, Not Inference

Problem:

Builders can infer the right split between replicated gameplay state, host-only simulation refs, and controller-published continuous input, but they still have to infer it by combining several docs and examples.

Why this matters:

1. the lane model is one of Air Jam's biggest strengths
2. if that model is not taught clearly, builders re-invent mixed React state or over-replicated local effects
3. the cost shows up immediately in any non-trivial action game

Suggested solution:

1. add one short worked cookbook that shows the three canonical lanes side by side
2. include one real example of host-only sim data plus replicated HUD data plus controller continuous input
3. cross-link that cookbook from the gold path, networked-state docs, and starter template comments

### 12. Promote The Real Host Loop And Action-Outcome Patterns In The First Read

Problem:

Even after the architecture cleanup, builders can still miss `useHostTick`, `acceptAirJamAction`, and `rejectAirJamAction` because those patterns are currently more discoverable through source or deeper docs than through the first authoring pass.

Why this matters:

1. builders will hand-roll requestAnimationFrame loops if they do not see the canonical host loop first
2. action rejection and result payloads stay underused if the examples never normalize them
3. the framework then looks less expressive than it really is

Suggested solution:

1. move `useHostTick` into the gold path and starter guidance as the default host gameplay loop
2. add one concise accept/reject example to the main SDK docs and generated project docs
3. ensure the minimal starter comments point at the exact moment to use each primitive

## Recommended Follow-On Architecture Shape

The next slice should not be treated as a bag of unrelated fixes.

It should be one clean DX-hardening pass around actor semantics, agent-action ergonomics, and outcome clarity.

### 1. Keep The Dispatcher Model Strict

Recommendation:

1. keep `ctx.actorId` as the actual dispatcher identity
2. do not overload it to mean "the player this action affects"
3. do not add heuristics that silently rewrite host-dispatched actions into controller identities

Reason:

That would make the transport model less honest and would create harder-to-debug authority bugs later.

### 2. Add One Explicit Host-Only Impersonation API

Recommendation:

1. add a host-only dispatch surface for the narrow case "run this semantic player action exactly as controller X"
2. make it read clearly as impersonation, not generic dispatch configuration
3. keep it unavailable on controller clients

Preferred shape:

1. `const playerActions = useGameStore.asPlayer(controllerId);`
2. `await playerActions.joinTeam({ team: "red" });`

or an equivalent explicit host-only helper such as:

1. `const actions = useGameStore.useActionsAs({ role: "controller", actorId: controllerId });`

Constraint:

The API name must make impersonation unmistakable. A vague shape like `useActions({ actorId })` is too easy to misuse.

### 3. Keep Administrative Host Intent Separate

Recommendation:

1. when the host is making an administrative decision, model that as a host action with an explicit target payload
2. use impersonation only when the goal is "do exactly what the player would have done"

Example split:

1. `host_assign_team({ controllerId, team })` is an administrative host action
2. `asPlayer(controllerId).joinTeam({ team })` is impersonation of the player's semantic action

Reason:

This preserves intent clarity and prevents impersonation from turning into a generic mutation escape hatch.

### 4. Treat The Remaining Work As One Focused Hardening Phase

The clean next bundle is:

1. actor semantics and host-only impersonation API
2. payload-error diagnostics
3. `agentActionInput.zod(...)`
4. `host_ack_missing` and action-outcome result clarity

### 5. Fix Local Controller Ownership And Recovery Semantics

The next real local-testing DX gap is controller ownership and room recovery.

Current failure mode:

1. an agent or MCP client can create virtual controllers that look like ordinary players from the host's point of view
2. if the owning tool disappears uncleanly, those controllers can survive long enough to block manual preview or on-screen-controller testing
3. local dev currently lacks one obvious cross-game recovery path beyond restarting background processes or waiting for leases to expire

Required direction:

1. keep real phone reconnect behavior intact
2. treat preview and virtual controllers as explicit first-class controller sources rather than inferring intent from generic player state
3. make virtual/MCP controllers ephemeral tooling resources with stricter cleanup semantics than human phones
4. surface a controller-session roster and one obvious local room reset escape hatch so a builder never gets trapped in a dirty room

Implementation order:

1. add explicit controller provenance at the protocol/server/runtime boundary: `phone`, `preview`, `virtual`
2. expose a host-visible controller-session roster that stays separate from plain `players`
3. make virtual controllers skip the normal reconnect lease on disconnect and disappear immediately when their tooling owner dies
4. add UI and tool affordances to inspect and kill controller sessions manually
5. add one generic local `reset room` or equivalent destructive dev escape hatch that recreates a fresh room without relying on game-owned reset actions

Non-goals:

1. do not weaken the normal reconnect lease for real phone controllers
2. do not overload `PlayerProfile` with transport/session metadata
3. do not make game authors build custom per-game cleanup actions just to recover local dev
4. one state-lanes cookbook plus stronger first-read docs for `useHostTick` and accept/reject

### 7. Tighten Typed Snapshot And Store-Domain Access

Problem:

The game snapshot/store context is still too stringly in places. Builders can still end up inferring store-domain meaning from source code or reaching for casts around named domains.

Why this matters:

1. it weakens the clean contract story that the rest of the system is aiming for
2. it makes agent-control extensions feel more internal than public
3. it prevents games from publishing richer contracts without leaking local implementation knowledge

Suggested solution:

1. let agent contracts declare or bind named store domains more explicitly
2. provide typed helpers for reading the canonical store/domain context inside agent contracts
3. reduce ad hoc `Record<string, ...>` access where the contract can be stronger
4. keep the contract explicit rather than hiding store ownership behind magic discovery

### 8. Use One Schema Story Across Machine-Facing Lanes

Problem:

The input lane, semantic action lane, and visual/host staging lane have historically carried slightly different payload-definition stories.

Why this matters:

1. users should not have to re-learn payload authoring every time they switch lanes
2. duplicated schema systems increase docs and tooling drift
3. agents become more likely to cargo-cult outdated examples

Suggested solution:

1. keep converging on one shared agent-action input definition model
2. prefer the same schema language and metadata shape wherever possible
3. make visual tooling consume the same action-definition core instead of re-describing payloads
4. reserve separate schema systems only where the underlying runtime constraints are genuinely different

### 9. Keep Runtime-Safe And Node-Side Package Boundaries Obvious

Problem:

The harness/runtime split has improved, but the product still carries conceptual residue from the old mixed browser/runtime versus visual/Playwright package story.

Why this matters:

1. builders need the safe import path to be obvious without reading three docs first
2. package boundaries teach the mental model more strongly than prose
3. ambiguity here creates bundler crashes, false bug reports, and distrust in the official examples

Suggested solution:

1. keep browser/runtime authoring and Node/Playwright authoring physically separate in public exports
2. ensure naming makes the safe path obvious and the wrong path feel wrong
3. continue auditing package dependencies and entrypoints so runtime-facing imports stay conceptually pure
4. prefer structural enforcement over "do not import X here" documentation warnings

### 10. Make The Gold Path The Default Scaffold Path

Problem:

Several real capabilities already exist, but the most minimal starter path does not teach them. Builders therefore rediscover or reimplement patterns that the framework already supports.

Why this matters:

1. the starter template is the real documentation most builders copy from
2. hidden good primitives have nearly the same DX cost as missing primitives
3. examples anchor the perceived product model more strongly than long docs pages

Suggested solution:

1. update the default starter to demonstrate the intended runtime/config story, not merely the smallest possible story
2. show the canonical agent seam in the smallest useful form instead of leaving architecture invention for mid-task
3. include a minimal example of live-state access and host-side staging where that materially improves discoverability
4. keep the starter small, but make it representative of the intended product path rather than a bare minimum demo

### 11. Improve Discoverability Of Existing Ergonomic Primitives

Problem:

Capabilities such as `env.auto()`, live-state access helpers, and the runtime-versus-visual harness split can still be easy to miss unless the builder already knows they exist.

Why this matters:

1. missed primitives produce false-negative critiques of the framework
2. builders lose time reinventing patterns the SDK already solved
3. docs become less trustworthy if the best path is not the most visible path

Suggested solution:

1. surface the most important ergonomic primitives in the starter, README, and generated docs, not only in deep system docs
2. add one short "gold path" section for authoring, one for agent control, and one for visual capture
3. make docs prioritize "when do I use this?" rather than listing features without decision guidance
4. keep operational docs honest about what is already solved versus what is still in rewrite

### 12. Reduce Remaining Import-Surface And Bootstrap Boilerplate

Problem:

A new builder can still encounter more import and bootstrap ceremony than necessary, especially around router setup and leaf-package discovery.

Why this matters:

1. every repeated bootstrap snippet feels like framework tax
2. users should not need to grep exports or package metadata to find common primitives
3. small paper cuts compound, especially in a system that already has strong architectural opinions

Suggested solution:

1. consider a small runtime-owned router helper if repeated basename boilerplate remains universal
2. keep reviewing whether some leaf exports should be easier to discover from the main authoring surface
3. prefer reducing repeated app bootstrap code when doing so does not blur runtime ownership
4. treat this as secondary to the larger contract/session work, not as a substitute for it

### 13. Keep Game Identity Canonical And Non-Duplicated

Problem:

Game identity used to drift across metadata, agent contracts, visual scenarios, and runtime mounting sites. That duplication made contracts more fragile and increased the chance of configuration skew.

Why this matters:

1. identity duplication is simple but high-friction configuration debt
2. every repeated `gameId` or agent-side identity field is another place for drift
3. clean agent-control authoring depends on one obvious declaration site

Suggested solution:

1. keep canonical game identity flowing from one source of truth
2. continue removing repeated agent-facing identity declarations where the runtime/config can derive them safely
3. preserve explicitness at mount/runtime boundaries only where it protects bundling or ownership semantics
4. add parity tests so future package or scaffold changes do not reintroduce drift

### 14. Keep Task-Backed MCP Tooling Explicit For Non-Task-Aware Clients

Problem:

Task-backed tools such as visual capture can fail confusingly when the caller does not understand the required execution model.

Why this matters:

1. builders may misread client limitations as Air Jam tool failures
2. long-running tooling is part of the official DX story and should fail legibly
3. agent-control trust depends on clear contracts at the protocol layer too

Suggested solution:

1. keep task-backed requirements visible in MCP metadata
2. improve failure messaging so unsupported clients learn exactly what capability is missing
3. document the task-backed execution model in the same place that recommends those tools
4. make sure the normal happy path uses task-capable clients where long-running tools are part of the expected workflow

### 15. Protect The Good Core And Avoid Regressing It During DX Cleanup

Problem:

The strongest parts of Air Jam are already clear: lane separation, host authority, one-owner-per-fact, host/controller surface boundaries, and pure testable gameplay code. DX fixes should not accidentally weaken those foundations.

Why this matters:

1. the current core architecture is the reason the SDK already feels promising
2. some "ergonomic" shortcuts would blur transport, state, and local effect boundaries again
3. the right fix is usually the smallest explicit new seam, not a broader convenience abstraction

Suggested solution:

1. keep the three-lane model and host authority rules intact
2. add narrow first-class seams where builders currently resort to ugly patterns
3. prefer deletion and consolidation over adding more sidecar subsystems
4. treat every DX improvement as successful only if it makes the correct architecture more obvious, not more hidden

## Rewrite Principles

1. one obvious agent-control contract per game
2. browser preview and agent control are complementary, not fused
3. visual tooling consumes the control contract but does not define a second control language
4. runtime-safe imports and Node/Playwright imports must be enforced by package structure
5. generated templates must teach the ideal path by default
6. names should describe intent, not implementation detail
7. keep the number of public concepts lower even if internals stay rich
8. prefer deleting and collapsing old lanes over carrying broad backwards-compatibility shims

## Core Decision

Air Jam should have one canonical game-owned agent contract.

That contract should be the primary authoring and tooling abstraction.

It should expose:

1. `snapshot`
2. `actions`

Each action should declare its execution lane explicitly:

1. `player`
2. `host`

Meaning:

1. `player` actions behave like semantic controller actions or real player intents
2. `host` actions stage or manipulate authoritative game state in deterministic ways for testing, setup, and evaluation

The agent should not need to think in terms of "harness action" versus "game action". Those are implementation details behind one contract.

## Immediate Hardening Before Full Rewrite

The full architecture reset should remain the main goal, but several high-friction problems should be fixed directly even before the full model lands.

### Immediate Hardening Targets

1. make the browser runtime import path obvious and structurally safe
2. provide one first-class supported live snapshot path for bridge/runtime use so consumers do not need ref-mirroring tricks
3. make action invocation result semantics trustworthy, especially around `snapshotAfter`
4. make MCP harness/game-session tools attach to an already-running compatible local dev server instead of racing to start a duplicate one
5. improve task-backed tool messaging so clients and users understand what is required
6. reduce agent config duplication and string-path fragility where that can be done without waiting for the full rewrite

### Hardening Rule

Short-term fixes should move the current system toward the target model.

Do not add new stopgap abstractions that become another long-lived layer to delete later.

## Target User Model

This should be the entire mental model an agent needs:

1. need to see the game: use the browser or in-app preview
2. need machine-readable state: read the game snapshot
3. need to trigger something precisely: invoke a game action
4. need to behave like a real player: send player input or invoke a `player` action
5. need repeatable screenshots or visual proofs: run visual capture

Anything deeper than that belongs to implementation internals, not the primary product story.

## Target Architecture

### 1. Canonical Contract Lives Under The Main SDK Authoring Story

The primary contract helper should live on the main game-authoring path, not under a side-system that sounds optional.

Target shape:

1. `@air-jam/sdk` continues to own standard game authoring
2. `@air-jam/sdk/agent` owns the agent-contract definition and types
3. `@air-jam/sdk/agent-runtime` owns the browser-safe runtime adapter used by the host
4. optional visual tooling moves behind an explicitly separate package or subpath that is clearly Playwright/Node-side only

The important rule is not the exact package name. The important rule is:

1. the core contract is part of normal Air Jam game authoring
2. browser runtime integration is browser-safe
3. Playwright tooling is physically separate
4. the default browser-safe entry cannot accidentally pull visual-runner or Playwright dependencies

### 2. One Session Story

The primary devtools/MCP surface should revolve around one game session abstraction.

Internally that session may use:

1. controller sockets
2. host runtime bridge registration
3. local broker endpoints
4. visual scenario runners

But the public product story should be:

1. open a game session
2. inspect the contract
3. read snapshots
4. invoke actions
5. optionally send raw player input
6. optionally capture visuals
7. close the session

If a compatible local dev session already exists, the official tooling should attach to it by default instead of competing with it for process ownership.

### 3. Host-Side Staging Is First-Class

Host-targeted deterministic actions are the real high-value testing primitive and should be treated that way.

Examples:

1. `spawnProjectile`
2. `setPhase`
3. `seedMatch`
4. `damageStructure`
5. `startRound`
6. `resetArena`

These should be clearly documented as first-class authoring tools, not as "visual harness extras."

### 4. Visual Capture Becomes A Consumer, Not The Owner

Visual scenarios and screenshot flows should consume the same game contract.

That means:

1. scenario code can call contract actions
2. scenario code can read contract snapshots
3. scenario packs add screenshot orchestration and DOM assertions only
4. the visual system no longer defines a parallel action language

### 5. Template-Owned Seam By Default

The minimal template should ship a tiny default agent seam:

1. `src/game/contracts/agent.ts`
2. `src/host/agent-runtime.tsx` or equivalent tiny host mount
3. one empty or trivial snapshot projection
4. one or two commented example actions

This seam should be small enough not to burden humans, but present enough that agents never have to invent the structure from scratch.

The generated docs for that seam must also answer the practical first questions directly:

1. which import path is browser-safe
2. how to read live game state for agent control
3. when to use a host-targeted action versus player-like input
4. how to run the official MCP/browser workflow without dropping to raw HTTP endpoints

## Public API Direction

### Authoring

Target game-owned files:

1. `src/game/contracts/agent.ts`
2. `src/airjam.config.ts`
3. optional `src/game/contracts/visual-scenarios.ts` only when visual capture matters

The contract file should own:

1. snapshot projection
2. semantic action definitions
3. action descriptions and payload descriptions
4. action execution lane metadata

It should also minimize duplicated identifiers.

`gameId` should come from one canonical source and be derived or shared everywhere else that is technically possible.

### MCP / Devtools

The primary MCP surface should become smaller and more intent-shaped.

Target primary tools:

1. `airjam.inspect_game_agent_contract`
2. `airjam.open_game_session`
3. `airjam.send_game_session_input`
4. `airjam.read_game_session`
5. `airjam.invoke_game_session_action`
6. `airjam.capture_visuals`
7. `airjam.close_game_session`

Lower-level transport tools can remain internally as implementation building blocks, but they should not remain public documented workflow choices for generated projects.

Task-backed tools must also return or document a plain-language explanation of what the client needs in order to execute them.

## Package And Module Rewrite

### 1. Separate Browser Runtime From Visual Tooling

Purge the current mixed-entry pattern.

Required outcome:

1. browser code cannot accidentally import Playwright-side helpers
2. visual tooling cannot appear to be the primary runtime-control owner
3. import paths make runtime intent obvious
4. examples, scaffold comments, and generated docs all use the browser-safe import path explicitly

### 2. Collapse Duplicate Action Systems

The current semantic game-contract lane and visual-bridge lane should converge into one action-definition model.

That means one shared definition shape for:

1. action metadata
2. payload parsing
3. result descriptions
4. snapshot projection
5. action execution lane
6. action result timing semantics

The visual layer should consume that model, not redefine it.

Use one schema language across the agent-facing surfaces wherever possible.

The default choice should be the same schema story the input lane already uses unless a clearly better unified alternative appears.

### 3. Make Session Internals Private By Default

`controllerSessionId`, harness registration, broker polling, and raw invoke endpoints are useful implementation details, but they should not dominate the generated-project mental model.

Keep them available where needed, but move them behind a higher-level session owner.

## Naming Reset

The current "harness" terminology should be narrowed.

Direction:

1. "agent contract" or "game contract" becomes the primary control concept
2. "visual capture" or "visual scenarios" becomes the screenshot/regression concept
3. "harness" survives only if it names a clearly secondary visual/testing subsystem instead of the core control story

If the name continues to blur responsibilities, rename the package and docs rather than explaining the ambiguity forever.

## Phased Execution Order

Implementation should happen in explicit phases, not as an all-at-once refactor.

The order matters because the first goal is to stop new agents from falling into the current footguns before the deeper architecture convergence is complete.

### Phase 1. Safe Runtime And Happy-Path Repair

This is the first execution slice.

It exists to remove the highest-friction failures that currently destroy trust in the official path.

Primary goals:

1. make the browser-safe runtime import path obvious and structurally safe
2. make MCP/devtools attach cleanly to compatible already-running local dev sessions instead of fighting them
3. remove the most painful unsupported live-state/snapshot authoring workarounds

Concrete scope:

1. split or restructure `@air-jam/harness` exports so browser code cannot accidentally pull Playwright-side code
2. update all scaffold examples, docs, and first-party browser runtime imports to the browser-safe entry
3. fix harness/game-session wrapper logic so live compatible local dev is reused before any new process startup is attempted
4. audit and fix the known wrapper/bootstrap failure paths that currently push agents toward raw HTTP fallbacks
5. provide one first-class supported live-state access path for agent control instead of requiring ad hoc ref mirroring
6. tighten `snapshotAfter` behavior or semantics so action results are trustworthy enough for external consumers
7. improve task-backed tool messaging so the failure mode explains what kind of client support is missing

Phase 1 explicit non-goals:

1. do not fully redesign the public contract model yet
2. do not carry broad compatibility layers just to preserve the old happy path
3. do not rename half the system before the unified model is chosen

Phase 1 exit criteria:

1. browser runtime examples no longer crash Vite by importing the wrong entry
2. official MCP/devtools flows can attach to an already-running compatible dev session without port conflicts
3. the standard extension path has a documented and supported live-state access primitive
4. action result snapshots are reliable enough for a basic external-agent control loop
5. the generated docs tell a new agent exactly which runtime import path to use

### Phase 2. Contract Unification

This is the core architecture slice.

Primary goals:

1. collapse semantic agent actions and visual-bridge actions into one canonical contract model
2. choose one schema story for agent-facing payloads
3. define one clear typed snapshot model with explicit action timing semantics

Concrete scope:

1. define the canonical contract helper and its type surface
2. add action execution-lane metadata as part of that contract
3. fold visual bridge actions into the same underlying action-definition model
4. replace stringly snapshot-store stories with a more typed and readable authoring model
5. reduce duplicated `gameId` ownership and other agent-config drift where possible

Phase 2 exit criteria:

1. there is one primary agent-facing contract story in code and docs
2. visual tooling consumes that contract instead of defining a parallel action language
3. payload definitions no longer require agents to learn multiple competing metadata systems

### Phase 3. Session And MCP Simplification

Primary goals:

1. move the public tooling story up to one game-session abstraction
2. make intent the main public API instead of transport details
3. demote low-level session classes and raw invoke lanes off the default path

Concrete scope:

1. build the higher-level session owner in `devtools-core`
2. align MCP and CLI naming around open/read/invoke/input/capture/close
3. keep low-level transport tools only as secondary expert surfaces where still useful
4. improve task-backed tools and long-running operations to be understandable from the first error message

Phase 3 exit criteria:

1. the main generated workflow no longer requires understanding controller sessions versus harness sessions
2. the documented MCP happy path is intent-shaped and short
3. external agents can stay on official tools without dropping to raw HTTP endpoints

### Phase 4. Template And Documentation Reset

Primary goals:

1. make the ideal structure the default in generated projects
2. teach the new mental model directly and briefly
3. remove transport-shaped tribal knowledge from the required onboarding path

Concrete scope:

1. ship the minimal agent seam by default in `minimal`
2. reduce config nesting and string-module references where practical
3. derive repeated identifiers from one source where possible
4. rewrite generated docs around the five-step agent mental model
5. add concise operational answers for runtime imports, host-vs-player actions, live-state access, task-backed tools, and browser/MCP pairing

Phase 4 exit criteria:

1. a new generated project already contains the agent seam
2. the core generated docs fit on one short page
3. an external agent does not need repo archaeology to discover the correct workflow

### Phase 5. First-Party Migration And Purge

Primary goals:

1. prove the new model on real games
2. switch visual tooling consumers onto the new contract
3. delete the obsolete lanes quickly once the new path is proven

Concrete scope:

1. migrate one simple proving game first, preferably `pong`
2. migrate the generated `minimal` template
3. migrate remaining first-party adopters
4. purge obsolete exports, docs, and compatibility layers aggressively

Phase 5 exit criteria:

1. the new model is proven on a first-party game and a generated project
2. old duplicated control lanes are removed or clearly deprecated on a short path to deletion
3. the external-agent acceptance test passes cleanly

## Recommended Immediate Execution Start

The first implementation pass should begin with exactly these three tracks in parallel where safe:

1. package-boundary repair for browser-safe runtime imports
2. live-dev attachment and MCP/devtools happy-path repair
3. supported live-state snapshot primitive for agent control

Those three fixes reduce the most immediate friction while also preparing the codebase for the deeper Phase 2 contract collapse.

## Workstreams

### Workstream 1. Contract Model Reset

1. define the single canonical game contract shape
2. add explicit action execution-lane metadata
3. align snapshot projection and action metadata on one shared type system
4. remove or fold the duplicate visual-bridge action-definition model
5. replace stringly snapshot-store stories with a more typed and author-readable model
6. define explicit and trustworthy semantics for `snapshotBefore`, `snapshotAfter`, and action completion
7. reduce duplicated `gameId` ownership where possible

### Workstream 2. Runtime And Session Reset

1. build the higher-level game-session owner in `devtools-core`
2. make session open/read/invoke/close the primary story
3. move low-level controller/harness details behind that owner
4. keep raw input as an escape hatch, not the center of the UX
5. make official tooling attach cleanly to compatible already-running local dev sessions
6. make runtime snapshot consumption easy enough that games and tools do not need imperative state-mirroring workarounds

### Workstream 3. Package Boundary Reset

1. split browser-safe runtime exports from Playwright/Node exports
2. remove accidental wrong-import paths
3. make the default authoring imports come from the main SDK lane
4. delete or rename misleading mixed-entry exports
5. ensure scaffold examples only demonstrate browser-safe imports inside browser code

### Workstream 4. MCP And CLI Reset

1. shrink the primary tool set around intent
2. align naming across CLI, MCP, docs, and scaffold comments
3. keep advanced transport tools off the happy path
4. make the generated docs teach the primary session flow only
5. fix existing wrapper/bootstrap bugs that currently push agents toward raw HTTP fallbacks
6. improve task-backed execution messaging and client expectations

### Workstream 5. Template Reset

1. ship the minimal contract seam by default
2. wire config to the seam explicitly
3. ship one tiny example snapshot and actions
4. remove instructions that force agents to discover structure mid-task
5. reduce config nesting and string-module references where practical
6. derive repeated identifiers from one source when possible

### Workstream 6. Documentation Reset

1. rewrite generated project docs around the five-step agent mental model
2. update repo system docs to describe intent before transport
3. rewrite or archive the current harness visual contract doc if it no longer reflects the primary story
4. add a short "which tool do I use?" table everywhere agents start
5. document the browser-safe import path explicitly in every relevant example
6. document the supported live-state access story explicitly so agents do not guess
7. add operational answers for task-backed tools, live-dev attachment, and host-vs-player action choice

### Workstream 7. First-Party Migration And Purge

1. migrate first-party games to the new contract shape
2. migrate visual scenario consumers onto the same contract
3. make `context.agent` the canonical semantic setup surface inside visual scenarios so the harness bridge shrinks toward runtime-local bootstrap and visual-only responsibilities
4. make `defineVisualHarness({ agent, scenarios })` the default authoring shape, with `bridge` optional instead of structurally assumed
5. remove obsolete paths and compatibility layers aggressively
6. keep only the minimum temporary adapters needed for a bounded cutover

## Migration Rules

1. do not add another compatibility abstraction to bridge old and new indefinitely
2. migrate one complete vertical slice early and use it as the canonical example
3. once the new path is proven, purge the old lanes quickly
4. generated templates must switch only after the new path is real and documented

Recommended proving slice:

1. one simple game such as `pong`
2. one generated `minimal` project
3. one real external-agent build/test run

## Validation Standard

The rewrite is only complete when all of these are true:

1. a fresh minimal project already contains the agent seam
2. an external agent can discover the correct control path without repo archaeology
3. browser-safe code has no accidental Playwright import trap
4. visual capture still works through the new contract instead of a parallel control layer
5. the primary generated docs fit on one short page and do not require a terminology deep dive
6. the MCP happy path no longer requires an agent to reason about multiple session classes
7. action invocation semantics are trustworthy enough that `snapshotAfter` means what an external consumer expects
8. official tooling can attach to an already-running compatible dev session without fighting for ports
9. the standard extension path does not require unsupported imperative store workarounds
10. preview-managed browser clients can launch a fresh scaffold through one obvious script path without colliding with the client's own local proxy model

## Acceptance Test

The release-grade proof for this rewrite is:

1. generate a fresh minimal project from local prerelease packages
2. hand it to an external coding agent with one high-level game prompt
3. watch whether it naturally uses the browser for visual truth and the contract for precise control
4. require it to reach a playable game and at least one successful iteration loop without human rescue

If the agent still needs to invent structure, fall back to raw transport concepts, or misread the official flow, the rewrite is not finished.

## Immediate Next Step

Before implementation starts:

1. choose the exact package/subpath naming for the unified contract and browser runtime lanes
2. choose whether "harness" survives only as a visual-capture term or is fully retired from the public authoring story
3. select the first proving game and the first generated template for migration
