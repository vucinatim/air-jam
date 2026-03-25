# Suggestions

## High-Impact Follow-Ups

1. Add a CI docs-crawl check that fetches built HTML for each docs route and fails if no `<pre><code>` appears on pages containing fenced code.
2. Add per-page MDX metadata exports (`title`, `description`) and build JSON-LD for docs pages to improve search snippet quality.
3. Generate searchable heading anchors from MDX at build-time and merge them into `docs-index` so command search can include section-level results without hardcoding.
4. Replace raw client-sent API keys with short-lived signed host tokens issued by the platform API (claims: gameId, role, exp, allowed origins) and validated in a single Socket.IO auth middleware.
5. Add dedicated room capability tokens for controller actions (`controller:system`, `controller:play_sound`, `controller:action_rpc`) to remove trust from room-code knowledge and prevent cross-room spoofing.
6. Split `packages/server/src/index.ts` Socket.IO handlers into domain modules (`room-lifecycle`, `game-lifecycle`, `signals`, `rpc`) and wire them through a small registration function to reduce core-file complexity and make targeted tests/composition easier.
7. Add a dedicated server performance harness (`autocannon` or custom socket benchmark) with committed baseline metrics and threshold-based CI checks for input latency and reconnect churn regressions.
8. Extract the now-parallel host/controller bridge clients into a small generic bridge transport base so handshake, port lifecycle, timeout handling, and event fanout live in one place instead of being duplicated across runtime roles.

## Framework boundary (post–Arcade architecture reset)

These consolidate Phase 11 of `docs/implementation-plan.md` without starting a second migration.

1. **Single bootstrap owner:** Route embedded-vs-standalone and URL parsing through one module (today split across `embedded-runtime-adapters.ts`, `runtime-session-params.ts`, `use-host-runtime-api` / `use-controller-runtime-api`, and realtime clients). Goal: one import graph for “how this runtime gets room/join/arcade params.”
2. **Reconnect state:** If `hostArcadeRestore` can move behind a host-only adapter (narrower than `AirJamStore`), do it after Phase 10 cleanup so generic store stays room/session shaped.
3. **Protocol touchpoints:** Prefer funneling schema changes through `packages/sdk/src/protocol` (and server mirrors) with a short “change recipe” in `development-loop.md` so fewer files drift.
4. **Public SDK surface:** Audit `packages/sdk/src/index.ts` exports added during the reset; drop aliases and `export *` re-exports that only existed for migration.
5. **Platform seam:** Keep outer-shell policy (bridge drift, iframe URLs) in `apps/platform` and resist moving Arcade-only branches into `createAirJamStore` or generic hooks. Drift + handshake rejection for embedded bridges is centralized in `apps/platform/src/components/arcade/embedded-bridge-surface-guard.ts` (extend there when adding new shell→iframe paths).
6. **Single runtime owner hook:** `useAirJamController` / `useAirJamHost` currently own live connection side effects, so they are not safe to scatter through one provider tree like passive selector hooks. Add an explicit session-state reader or make duplicate runtime ownership fail loudly in dev so platform UIs cannot accidentally create competing joins/reconnects again.
