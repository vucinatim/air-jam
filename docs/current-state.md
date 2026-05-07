# Current State

Last updated: 2026-05-08  
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

The repo is currently focused on three things:

1. working from the cleaned repo operating system baseline instead of from historical drift
2. running the final prerelease manual proof and hosted release proof for the v1 launch set
3. preparing the launch-facing landing, media, and discoverability execution that follows the final proof pass

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
4. the on-demand full-stack preview lane is operational:
   1. preview doctor
   2. preview up
   3. preview down
   4. PR-close destroy
   5. orphan sweep
5. the Railway transport problem is no longer blocking:
   1. the direct Railway API control surface replaced the unreliable CLI auth path for hosted automation
   2. hosted preview create and destroy were validated from `main`
6. the preview semantics are now explicit:
   1. native Vercel branch previews are one thing
   2. managed full-stack previews live at `full-pr-<n>.preview.airjam.io`
   3. inactive full-stack preview hosts now render as inactive instead of pretending to be live
7. the release architecture and public product direction are already substantially defined in:
   1. [vision.md](./vision.md)
   2. [discoverability-vision.md](./discoverability-vision.md)
   3. [framework-paradigm.md](./framework-paradigm.md)
   4. [strategy/public-arcade-release-strategy.md](./strategy/public-arcade-release-strategy.md)
8. the full implemented surface is now easier to recover through:
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

## What Is Still Open

The important remaining work is now late-stage and launch-facing:

1. run the final manual launch proof in [plans/v1-release-plan.md](./plans/v1-release-plan.md)
2. prove the hosted upload, managed media, and official hosting path against the actual launch set
3. finish the late prerelease cleanup only where the final proof finds real blockers
4. execute the release-facing landing, media, article, and discoverability work after the go / no-go pass
5. decide which small user-facing polish items still deserve inclusion before launch, such as creator attribution enhancements

## Active Now

This is the single plan that should govern current work:

1. [plans/v1-release-plan.md](./plans/v1-release-plan.md)

## Recent Closures

The preview system closeout, Railway API control-surface replacement, and repo operating system reset are closed and archived.

They should no longer compete with launch execution.

## Planned Next

These are real next-step tracks, but they should not displace the launch closeout path yet:

1. turn the discoverability and GTM phases in [plans/v1-release-plan.md](./plans/v1-release-plan.md) into a concrete execution checklist
2. add creator-attribution polish where it meaningfully improves Arcade trust and self-promotion without turning into a larger account-linking project
3. revisit longer-horizon architecture work only after release and launch-facing closeout settle

## Immediate Next Steps

1. run the final manual release proof against the five-game launch set
2. run the hosted upload and managed media proof on the real platform lane
3. close any real blockers without reopening broad platform work
4. execute the final landing, media, blog, discoverability, and launch distribution sequence

## Current Caveats

1. the active full-stack preview cost surface is mainly Railway compute/runtime, not old Vercel preview artifacts
2. native Vercel previews and managed full-stack previews should not be discussed as if they are the same thing
3. the repo now has enough finished infrastructure that the main risk is orientation drift, not missing foundation

## Canonical Read Order

For a fast orientation pass:

1. [../README.md](../README.md)
2. [docs-index.md](./docs-index.md)
3. this file
4. [working-agreements.md](./working-agreements.md)
5. [documentation-taxonomy.md](./documentation-taxonomy.md)
6. the currently relevant active plan
7. [work-ledger.md](./work-ledger.md) only if historical context is needed
