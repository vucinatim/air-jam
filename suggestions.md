# Suggestions

Only keep live follow-ups here. Completed reset work and stale migration notes should not stay in this file.

## High-Impact Follow-Ups

1. Add a CI docs-crawl check that fetches built HTML for each docs route and fails if pages containing fenced code do not render `<pre><code>`.
2. Add per-page MDX metadata exports (`title`, `description`) and JSON-LD so docs/search snippets are richer and less ad hoc.
3. Generate searchable heading anchors from MDX at build time and merge them into `docs-index` so command search can resolve section-level hits without hardcoded entries.
4. Consolidate host bootstrap verification into one dedicated auth middleware or bootstrap service boundary so static app ID mode, signed host-grant mode, and future managed-mode policy do not stay split across handlers.
5. Add dedicated room capability tokens for controller actions (`controller:system`, `controller:play_sound`, `controller:action_rpc`) so room-code knowledge is not enough to issue privileged commands.
6. Add a dedicated server performance harness with committed baseline metrics and threshold-based CI checks for input latency and reconnect churn regressions.
7. Extract the parallel host/controller bridge clients into a small generic bridge transport base so handshake, timeout, port lifecycle, and event fanout do not stay duplicated.

## Framework Boundary Follow-Ups

These are still useful post–Arcade reset, but they should be handled as small hardening passes rather than another migration.

1. **Single bootstrap owner:** Centralize embedded-vs-standalone runtime resolution and URL parsing into one module so room/join/arcade bootstrap does not stay split across runtime params, embedded adapters, realtime clients, and runtime hooks.
2. **Reconnect seam narrowing:** Revisit `hostArcadeRestore` and move it behind a host-only adapter if we can do so cleanly, so `AirJamStore` stays room/session shaped instead of carrying host-shell restore state forever.
3. **Protocol change recipe:** Funnel schema/protocol changes through `packages/sdk/src/protocol` more deliberately and document the change path in `docs/development-loop.md` so transport updates stop fanning out loosely.
