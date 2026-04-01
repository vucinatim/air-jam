# Suggestions

Only keep live follow-ups here. Completed reset work and stale migration notes should not stay in this file.

## High-Impact Follow-Ups

1. Promote the current docs render validation to a built-route crawl so docs HTML is verified through actual route output instead of only the canonical render path.
2. Add RSS and Atom feeds for the new blog slice once the first real release/article cadence starts, so release posts can be subscribed to without scraping the site or overloading docs endpoints.
3. Consolidate host bootstrap verification into one dedicated auth middleware or bootstrap service boundary so static app ID mode, signed host-grant mode, and future managed-mode policy do not stay split across handlers.
4. Add dedicated room capability tokens for controller actions (`controller:system`, `controller:play_sound`, `controller:action_rpc`) so room-code knowledge is not enough to issue privileged commands.
5. Add a dedicated server performance harness with committed baseline metrics and threshold-based CI checks for input latency and reconnect churn regressions.
6. Extract the parallel host/controller bridge clients into a small generic bridge transport base so handshake, timeout, port lifecycle, and event fanout do not stay duplicated.
7. Replace or reconfigure the prototype game’s physics runtime so the host build no longer ships `@dimforge/rapier3d-compat` as a 2 MB+ JS chunk; the easy route/editor/template splits are already done, so the remaining warning is now a real physics-runtime cost rather than loose app structure.
8. Add optional causal message IDs for key cross-surface hops so some failure stories can be followed by direct cause/effect links instead of correlation by `traceId`, `roomId`, `collectorSeq`, and per-session `sourceSeq` alone.
9. Move destructive runtime analytics DB integration tests onto a dedicated test database URL instead of relying on an opt-in guard against the shared dev/prod-connected database.
10. Productize the unified dev log sink for scaffolded projects by exposing a published `air-jam-server logs` command, adding a template `pnpm logs` script, and teaching the workflow clearly in the AI pack.
11. Finish narrowing the remaining `air-capture` 3D runtime seams after the release push by moving projectile scene traversal, Rapier body lookup, and a few prefab sensor-sync details behind explicit engine/adapters seams so the runtime keeps converging toward pure-step helpers plus thin render adapters.
12. Move release moderation off the synchronous publish request path onto a small background job or workflow once real publish volume exists, so browser startup and third-party moderation latency do not stay coupled to the creator-facing publish click forever.
13. Rename the internal `games.url` column and related server field names to `preview_url` / `previewUrl` once the release push settles, so the persisted data model matches the now-honest dashboard contract instead of carrying the old self-hosted naming forever.
14. Add a follow-on `GameSettingsRuntime` layered on top of the new platform settings model once prerelease stabilizes, so game-specific preferences can be schema-owned and namespaced without polluting the shared platform settings contract.
15. Revisit the platform dashboard auth surface after v1 and remove the email/password fallback entirely if GitHub-first usage proves sufficient, so the public auth posture does not carry a knowingly secondary password UX longer than needed.
16. Add an internal ops review surface for hosted release abuse reports only if report volume or moderation triage actually demands more than the current creator-facing release dashboard.
17. Add stronger managed-service abuse posture after v1 only if real usage demands it, for example quotas, analytics-backed anomaly handling, or service-tier policy controls beyond the current app-scoped bootstrap and lifecycle rate limits.
18. Revisit SDK package ergonomics after v1 only if it still materially helps adoption, but do it under the explicit runtime-ownership model rather than reopening the older headless-first singleton-owner direction.
19. Add optional per-action schema validation for networked store actions only if real game usage proves the new zero-or-one plain-object RPC contract still needs stronger validation; keep it additive and narrow rather than turning the whole store layer into a schema-first framework.

## Framework Boundary Follow-Ups

These are still useful post–Arcade reset, but they should be handled as small hardening passes rather than another migration.

1. **Single bootstrap owner:** Centralize embedded-vs-standalone runtime resolution and URL parsing into one module so room/join/arcade bootstrap does not stay split across runtime params, embedded adapters, realtime clients, and runtime hooks.
2. **Reconnect seam narrowing:** Revisit `hostArcadeRestore` and move it behind a host-only adapter if we can do so cleanly, so `AirJamStore` stays room/session shaped instead of carrying host-shell restore state forever.
3. **Protocol change recipe:** Funnel schema/protocol changes through `packages/sdk/src/protocol` more deliberately and document the change path in `docs/monorepo-operating-system.md` so transport updates stop fanning out loosely.
