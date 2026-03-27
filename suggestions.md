# Suggestions

Only keep live follow-ups here. Completed reset work and stale migration notes should not stay in this file.

## High-Impact Follow-Ups

1. Promote the current docs render validation to a built-route crawl so docs HTML is verified through actual route output instead of only the canonical render path.
2. Fill `sinceVersion` and `lastVerifiedVersion` on public docs pages once the first real release cadence exists, so manifest consumers can match docs claims to shipped versions instead of only `stability`/`audience`.
3. Add RSS and Atom feeds for the new blog slice once the first real release/article cadence starts, so release posts can be subscribed to without scraping the site or overloading docs endpoints.
4. Consolidate host bootstrap verification into one dedicated auth middleware or bootstrap service boundary so static app ID mode, signed host-grant mode, and future managed-mode policy do not stay split across handlers.
5. Add dedicated room capability tokens for controller actions (`controller:system`, `controller:play_sound`, `controller:action_rpc`) so room-code knowledge is not enough to issue privileged commands.
6. Add a dedicated server performance harness with committed baseline metrics and threshold-based CI checks for input latency and reconnect churn regressions.
7. Extract the parallel host/controller bridge clients into a small generic bridge transport base so handshake, timeout, port lifecycle, and event fanout do not stay duplicated.
8. Replace or reconfigure the prototype game’s physics runtime so the host build no longer ships `@dimforge/rapier3d-compat` as a 2 MB+ JS chunk; the easy route/editor/template splits are already done, so the remaining warning is now a real physics-runtime cost rather than loose app structure.
9. Add optional causal message IDs for key cross-surface hops so some failure stories can be followed by direct cause/effect links instead of correlation by `traceId`, `roomId`, `collectorSeq`, and per-session `sourceSeq` alone.
10. Move destructive runtime analytics DB integration tests onto a dedicated test database URL instead of relying on an opt-in guard against the shared dev/prod-connected database.

## Framework Boundary Follow-Ups

These are still useful post–Arcade reset, but they should be handled as small hardening passes rather than another migration.

1. **Single bootstrap owner:** Centralize embedded-vs-standalone runtime resolution and URL parsing into one module so room/join/arcade bootstrap does not stay split across runtime params, embedded adapters, realtime clients, and runtime hooks.
2. **Reconnect seam narrowing:** Revisit `hostArcadeRestore` and move it behind a host-only adapter if we can do so cleanly, so `AirJamStore` stays room/session shaped instead of carrying host-shell restore state forever.
3. **Protocol change recipe:** Funnel schema/protocol changes through `packages/sdk/src/protocol` more deliberately and document the change path in `docs/development-loop.md` so transport updates stop fanning out loosely.
