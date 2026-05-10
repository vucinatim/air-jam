# Air Jam Final V1 Release Plan

Last updated: 2026-05-08  
Status: active release plan

Related docs:

1. [Work Ledger](../work-ledger.md)
2. [Current State](../current-state.md)
3. [Framework Paradigm](../framework-paradigm.md)
4. [Public Arcade Release Strategy](../strategy/public-arcade-release-strategy.md)
5. [Release Workflow](../strategy/release-workflow.md)
6. [Production Observability Baseline](../strategy/production-observability-baseline.md)
7. [Capability Inventory](../capability-inventory.md)

## Purpose

This is the single live execution plan for the Air Jam v1 release.

It owns:

1. the final proof bar
2. the remaining launch-critical fixes
3. hosted release validation
4. release media and landing closeout
5. deployment and launch distribution

If a remaining task materially affects the v1 release, it belongs here.

## Current Reality

Air Jam is no longer blocked on core platform architecture.

These are already true:

1. the framework, platform, realtime server, browser worker, and hosted release model are real
2. the dashboard, release records, artifacts, managed media, and hosted serving path all exist
3. the Railway-hosted platform, realtime server, and browser worker topology is real
4. Railway native PR environments are the canonical preview model
5. the repo operating system is reset and the live docs surface is now much cleaner

The remaining work is late-stage product proof and release execution, not more broad platform building.

## Launch Set

The intended v1 release set is:

1. `pong`
2. `air-capture`
3. `code-review`
4. `last-band-standing`
5. `the-office`

## Release Bar

V1 is ready only when all of the following are true:

1. the five-game launch set passes the final manual product proof
2. the hosted upload, artifact, managed media, and public hosting path are proven on the real platform lane
3. official deployment and official server validation pass
4. release-facing landing, media, and article surfaces are aligned with shipped reality
5. the npm/package/release story is honest for the v1 public surface
6. the final launch/distribution checklist is executable without guesswork

## Scope

This plan includes:

1. final manual product proof
2. late launch-critical fixes only
3. hosted release and managed media proof
4. official deploy and live validation
5. release media, landing, article, and discoverability closeout
6. public package/release honesty needed for launch

This plan does not include:

1. future architecture work
2. post-v1 remote room work
3. broad SDK cleanup that does not block release
4. speculative feature work
5. aesthetic churn that does not improve launch trust

## Execution Order

### 1. Final Product Proof

Run the final manual proof against the five-game launch set.

This includes:

1. local launch-set product proof
2. hosted release dashboard proof
3. managed media proof
4. official hosting and official server proof
5. live deploy validation
6. final go / no-go recording

Done when:

1. the launch set has a clear go / no-go result
2. every real blocker is recorded here
3. non-blocking polish is explicitly cut or deferred

### 2. Launch-Critical Fix Pass

Only fix what the final proof exposes as a real release blocker or trust-eroding issue.

Allowed work:

1. broken hosted release flows
2. broken official deployment behavior
3. misleading or broken public-facing landing / Arcade / controller behavior
4. release-surface security or abuse holes that are cheap and necessary to close
5. release contract mismatches that would make the public story dishonest

Do not:

1. reopen broad framework work
2. create new subordinate implementation plans
3. do polish-for-polish’s-sake

### 3. Hosted Release And Official Platform Validation

Prove the real hosted path with the actual platform lane.

Required outcomes:

1. upload real release artifacts
2. verify release metadata and managed media
3. verify public hosted serving
4. verify official provider wiring and runtime behavior
5. confirm the final preview/deploy story is not misleading

Done when:

1. the hosted path is proven against real deploy surfaces
2. the official platform and server story is operationally trustworthy

### 4. Release Surface Closeout

Close the remaining launch-facing public surfaces.

This includes:

1. landing-page truth density and trust polish
2. Arcade trust-facing polish that still matters
3. release media assets
4. framework launch article
5. origin-story article
6. final docs alignment for the public product story

The public story should align around one primary claim:

- Air Jam is an open AI-native framework for multiplayer games controlled by phones.

The supporting public explanation should stay consistent:

1. humans and agents use the same runtime, input, state, inspection, and release model
2. self-hosting and hosted Arcade publishing are two clear distribution lanes
3. Arcade is the hosted public product surface, not a separate framework model
4. `Dashboard` should be the normal creator-facing noun; reserve `control plane` for architecture/reference docs

Optional only if cheap and high-signal:

1. creator-attribution polish for Arcade trust and self-promotion

### 5. Public Package And Release Honesty

Make sure the public install and release story is honest for v1.

Required outcomes:

1. the package graph and npm story do not lie
2. release workflow and package surfaces match what we publicly claim
3. unsupported legacy package reality is explicit
4. the landing/docs install story is aligned with the actual release lane

### 6. Launch Distribution Closeout

Turn the discoverability and GTM direction into one concrete execution checklist.

Required outcomes:

1. release timing/order is explicit
2. submission/posting targets are explicit
3. required assets and copy are explicit
4. owned/community/distribution surfaces are sequenced

## Current Open Buckets

The only remaining open buckets that deserve release attention are:

1. final manual proof
2. hosted upload and managed media proof
3. official deploy/server validation
4. launch-facing landing/media/article/discoverability closeout
5. any proof-discovered blockers

Everything else should be treated as:

1. already done
2. explicitly cut from v1
3. post-v1 backlog

## Explicit Cuts

Do not pull these back into v1 unless the final proof proves they are actually required:

1. remote rooms and distributed display work
2. broad SDK ergonomics cleanup
3. game-specific polish beyond clear release blockers
4. broad account-linking or creator-social systems
5. speculative Studio or agent-control expansion

## Done Criteria

This plan is done when:

1. the final product proof passes
2. any discovered release blockers are closed
3. the hosted/official platform path is proven
4. launch-facing public surfaces are aligned
5. the launch/distribution checklist is concrete
6. `docs/current-state.md` and `docs/work-ledger.md` record that the repo has moved from prerelease execution into actual launch execution or post-launch work
