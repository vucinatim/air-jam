# Current State

Last updated: 2026-07-24
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

Air Jam is no longer mainly blocked on platform or preview infrastructure.

The repo is currently focused on four things:

1. completing the short-lived
   [Android Auto road-trip plan](./plans/android-auto-road-trip-plan.md) for
   2026-07-25 without turning the private wrapper into a new framework
   architecture
2. working from the cleaned repo operating system baseline instead of from
   historical drift
3. running the final prerelease manual proof and hosted release proof for the v1
   launch set
4. keeping the now-simpler Railway-first deployment model boring while
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
   6. 144 canonical songs across ten independently playable categories
   7. 27 Slovenian songs and 26 Balkan songs
   8. explicit deterministic clip timing on every catalog entry
   9. complete two-, six-, and ten-player ten-round semantic match proofs
   10. a compact all-player host reveal and scrollable ten-player controller
       standings
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

## What Is Still Open

The important remaining work is now late-stage and launch-facing:

1. run the final manual launch proof in [plans/v1-release-plan.md](./plans/v1-release-plan.md)
2. prove the hosted upload, managed media, and official hosting path against the actual launch set
3. finish the late prerelease cleanup only where the final proof finds real blockers
4. finish the external Railway domain cutover and final deploy validation
5. execute the release-facing landing, media, article, and discoverability work after the go / no-go pass
6. decide which small user-facing polish items still deserve inclusion before launch, such as creator attribution enhancements
7. keep the public story aligned around the AI-native framework thesis instead of drifting back into generic platform/framework language
8. complete Goal 3 song curation and focused visual polish, then publish the
   locally and real-car-proven road-trip changes after explicit approval

## Active Now

The v1 release plan remains the governing product plan:

1. [plans/v1-release-plan.md](./plans/v1-release-plan.md)

One short-lived urgent plan is active for the 2026-07-25 road trip:

1. [plans/android-auto-road-trip-plan.md](./plans/android-auto-road-trip-plan.md)

The road-trip plan may improve Last Band Standing, Arcade presentation, and the
private Android wrapper, but it must not create a competing Air Jam runtime
model.

## Recent Closures

The preview system closeout, Railway API control-surface replacement, and repo operating system reset are closed and archived.

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

1. complete the user-reviewed Last Band Standing medium/hard song curation and
   focused UI polish pass, then publish the validated update
2. run the final manual release proof against the five-game launch set
3. run the hosted upload and managed media proof on the real platform lane
4. complete the Railway domain cutover and re-run the production smoke checks
5. close any real blockers without reopening broad platform work
6. execute the final landing, media, blog, discoverability, and launch
   distribution sequence

## Current Caveats

1. the remaining deployment risk is mostly domain cutover and provider-state verification, not missing app architecture
2. the repo now has enough finished infrastructure that the main risk is orientation drift, not missing foundation

## Canonical Read Order

For a fast orientation pass:

1. [../README.md](../README.md)
2. [docs-index.md](./docs-index.md)
3. this file
4. [working-agreements.md](./working-agreements.md)
5. [documentation-taxonomy.md](./documentation-taxonomy.md)
6. the currently relevant active plan
7. [work-ledger.md](./work-ledger.md) only if historical context is needed
