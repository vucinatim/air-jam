# Suggestions

## High-Impact Follow-Ups

1. Add a CI docs-crawl check that fetches built HTML for each docs route and fails if no `<pre><code>` appears on pages containing fenced code.
2. Add per-page MDX metadata exports (`title`, `description`) and build JSON-LD for docs pages to improve search snippet quality.
3. Generate searchable heading anchors from MDX at build-time and merge them into `docs-index` so command search can include section-level results without hardcoding.
4. Replace raw client-sent API keys with short-lived signed host tokens issued by the platform API (claims: gameId, role, exp, allowed origins) and validated in a single Socket.IO auth middleware.
5. Add dedicated room capability tokens for controller actions (`controller:system`, `controller:play_sound`, `controller:action_rpc`) to remove trust from room-code knowledge and prevent cross-room spoofing.
6. Split `packages/server/src/index.ts` Socket.IO handlers into domain modules (`room-lifecycle`, `game-lifecycle`, `signals`, `rpc`) and wire them through a small registration function to reduce core-file complexity and make targeted tests/composition easier.
7. Add a dedicated server performance harness (`autocannon` or custom socket benchmark) with committed baseline metrics and threshold-based CI checks for input latency and reconnect churn regressions.
