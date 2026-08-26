# Current State

Last updated: 2026-08-26
Status: current snapshot

This is the canonical quick-read status surface for the Air Jam repo.

Use this file for:

1. current focus
2. what is structurally done
3. what is still open
4. the small set of plans that govern current work
5. immediate next steps

Do not use this file as a running work log.

Update it only at:

1. phase closures
2. meaningful reprioritizations
3. repo operating system changes that affect how the repo should be read

For historical progress, use [work-ledger.md](./work-ledger.md).

## Current Focus

Air Jam is no longer blocked on the Android Auto road-trip release or preview
infrastructure.

The repo is currently focused on three things:

1. working from the cleaned repo operating system baseline instead of from
   historical drift
2. running the final prerelease manual proof and hosted release proof for the v1
   launch set
3. keeping the now-simpler Railway-first deployment model boring while
   preparing the launch-facing landing, media, and discoverability execution
   that follows the final proof pass

## What Is Structurally Done

These are now baseline truths, not open architecture debates:

1. the framework, platform, realtime server, and browser-worker split is established
2. the dashboard and hosted release model are real:
   1. game records
   2. release records
   3. release artifacts
   4. managed media
   5. public hosted release serving
3. the hosted release machine lane is real:
   1. CLI auth
   2. CLI release submit / inspect / publish
   3. MCP release submit / inspect / publish
4. the Railway-first deploy model is real:
   1. the platform now deploys on Railway alongside the realtime server and browser worker
   2. Railway native PR environments are the canonical preview model
   3. the repo now owns deploy inspection instead of a second preview control plane
5. the release architecture and public product direction are already substantially defined in:
   1. [vision.md](./vision.md)
   2. [discoverability-vision.md](./discoverability-vision.md)
   3. [framework-paradigm.md](./framework-paradigm.md)
   4. [strategy/public-arcade-release-strategy.md](./strategy/public-arcade-release-strategy.md)
6. the full implemented surface is now easier to recover through:
   1. [capability-inventory.md](./capability-inventory.md) for current capability breadth
   2. [documentation-taxonomy.md](./documentation-taxonomy.md) for the live docs category map
   3. explicit reference docs for:
      1. the platform control plane
      2. the platform docs surface
      3. the hosted release pipeline
      4. platform identity and auth
      5. documentation and AI-pack delivery
      6. runtime topology and inspection
      7. semantic agent sessions
      8. game metadata and media presentation
      9. local, hosted-release, and agent development loops
7. Last Band Standing now has a much stronger quiz-content baseline:
   1. one canonical row per song with inline category ownership
   2. one canonical quiz category and a curated 1-through-5 difficulty for
      every song
   3. same-quiz-category answer pools with four unique visible labels and no
      permissive fallback
   4. Unicode-safe canonical normalization
   5. deterministic catalog validation and randomized option-generation tests
   6. 206 canonical songs across ten independently playable categories
   7. 59 Slovenian songs and 26 Balkan songs
   8. explicit deterministic clip timing on every catalog entry
   9. complete two-, six-, and ten-player ten-round semantic match proofs
   10. a clean host answer reveal, controller-owned all-player between-round
       rankings, and scrollable ten-player final standings
8. the Android Auto road-trip implementation is structurally in place:
   1. Arcade owns an exact typed `?qr=open` launch contract
   2. Arcade and Last Band Standing respond to short-wide dimensions and safe
      areas without Android/user-agent branches
   3. Last Band Standing has a compact ten-player gameplay strip
   4. the private wrapper uses the URL contract instead of DOM button matching
   5. the wrapper is rebuilt on Android for Cars App Library 1.7.0 with focused
      host-navigation tests and zero Android lint errors
9. the road-trip platform-foundation goal is complete locally:
   1. the public preview-controller launcher is contextual and disappears
      during phone-connected gameplay
   2. semantic Arcade sessions resolve epoch-scoped embedded stores through
      authoritative `arcade.surface` state
   3. local bootstrap and 16-player Arcade capacity are re-proven
   4. the top-center controller menu consumes the real phone safe-area inset
   5. the Android wrapper carries the canonical installed Air Jam icon
10. first-party product telemetry is now part of the platform baseline:
    1. one closed, versioned event contract covers canonical page views and
       meaningful public intent
    2. same-origin browser ingestion is bounded, rate-limited, idempotent, and
       non-blocking to product UX
    3. agent-facing resources record server-observed reach without changing
       their public response contracts
    4. append-only raw evidence projects deterministically into daily event and
       ephemeral-session metrics
    5. the ops-only report keeps product telemetry, platform lifecycle facts,
       and authoritative runtime activity visibly separate
    6. anonymous identity is memory-only and the system does not fingerprint or
       persist raw IP addresses, full user agents, full URLs, query strings, or
       raw referrers
    7. the dormant external website-analytics integration and its environment
       and CSP contract are fully removed

## What Is Still Open

The important remaining work is now late-stage and launch-facing:

1. run the final manual launch proof in [plans/v1-release-plan.md](./plans/v1-release-plan.md)
2. prove the hosted upload, managed media, and official hosting path against the actual launch set
3. finish the late prerelease cleanup only where the final proof finds real blockers
4. finish the external Railway domain cutover and final deploy validation
5. execute the release-facing landing, media, article, and discoverability work after the go / no-go pass
6. decide which small user-facing polish items still deserve inclusion before launch, such as creator attribution enhancements
7. keep the public story aligned around the AI-native framework thesis instead of drifting back into generic platform/framework language

## Active Now

The v1 release plan remains the governing product plan:

1. [plans/v1-release-plan.md](./plans/v1-release-plan.md)

## Recent Closures

The first-party telemetry implementation, Android Auto road-trip release,
preview system closeout, Railway API control-surface replacement, and repo
operating system reset are closed.

The telemetry implementation plan is preserved in the
[2026-08-26 telemetry archive](./archive/2026-08-26-first-party-product-telemetry-plan.md).
Other closed plans are archived according to the repository documentation
taxonomy.

They should no longer compete with launch execution.

## Planned Next

These are real next-step tracks, but they should not displace the launch closeout path yet:

1. turn the discoverability and GTM phases in [plans/v1-release-plan.md](./plans/v1-release-plan.md) into a concrete execution checklist
2. add creator-attribution polish where it meaningfully improves Arcade trust and self-promotion without turning into a larger account-linking project
3. use [strategy/post-v1-topology-roadmap.md](./strategy/post-v1-topology-roadmap.md) as the canonical post-v1 architecture sequence:
   1. Arcade isolation next
   2. API and auth extraction after that
4. do not reopen deployment or multi-app architecture churn before the release path settles unless a real release blocker forces it forward

## Immediate Next Steps

1. include the live Last Band Standing `0.2.1` release in the remaining v1
   launch-set proof
2. treat further clip-start listening and tuning as non-blocking content polish
3. run the final manual release proof against the five-game launch set
4. run the hosted upload and managed media proof on the real platform lane
5. complete the Railway domain cutover and re-run the production smoke checks
6. close any real blockers without reopening broad platform work
7. execute the final landing, media, blog, discoverability, and launch
   distribution sequence

## Current Caveats

1. the remaining deployment risk is mostly domain cutover and provider-state verification, not missing app architecture
2. the repo now has enough finished infrastructure that the main risk is orientation drift, not missing foundation
3. product telemetry anonymous-session and actor-class counts are approximate
   discovery measures, not durable people or identity proof

## Canonical Read Order

For a fast orientation pass:

1. [../README.md](../README.md)
2. [docs-index.md](./docs-index.md)
3. this file
4. [working-agreements.md](./working-agreements.md)
5. [documentation-taxonomy.md](./documentation-taxonomy.md)
6. the currently relevant active plan
7. [work-ledger.md](./work-ledger.md) only if historical context is needed
