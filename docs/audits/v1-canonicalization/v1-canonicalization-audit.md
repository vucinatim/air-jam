# Air Jam 1.0 Canonicalization Audit

Last updated: 2026-08-28
Status: complete
Readiness owner: `G1-01`

## Executive Conclusion

Air Jam has a strong underlying product architecture: host-authoritative game
state, explicit input/state/signal lanes, shared runtime protocol, semantic
game-session control, deterministic scaffold sources, and a repo-native
execution surface. The project is not a rewrite candidate.

It is also not ready for an honest 1.0 contract cut yet.

The audit found 39 evidence-backed issues: 1 critical, 25 high, 12 medium, and
1 low. After cross-review and the public-surface audit, 30 findings contain work
required before 1.0, six are before-scale concerns, two are deliberately
deferred, and one proposed refactor was rejected for insufficient evidence.
These are not 39 independent
projects. They converge into the existing Gate 1, Gate 2, reliability,
operations, and security work already present in the readiness graph.

The dominant pattern is not bad code everywhere. It is strong systems that
grew adjacent copies or incomplete adapters:

1. one semantic concept has multiple source owners
2. an agent-facing capability exists in MCP but not in the documented terminal
   or clean-scaffold path
3. trusted platform transitions can be bypassed by generic adapters
4. long-running work is owned by request/process memory instead of a durable
   product job
5. generated guidance repeats policy and blurs vendor/user ownership
6. production operations remain human-memory or UI-only paths

## What Is Already Canonical

1. Host authority, server hard invariants, and the three runtime lanes are
   coherent and well tested.
2. `createAirJamApp` and game-owned semantic contracts are the right creator
   and agent boundaries.
3. Semantic sessions are the right machine-control surface; browser work is
   appropriately visual proof rather than gameplay truth.
4. Devtools services already provide a useful convergence point for CLI and
   MCP adapters.
5. First-party game workspaces are the real deterministic scaffold sources.
6. Platform telemetry has explicit privacy, ledger, projection, repair, and
   retention ownership; it should not be simplified by discarding those
   invariants.
7. The readiness manifest is a functioning machine execution authority and can
   absorb audit outcomes without a second Markdown tracker.

## Highest-Priority Findings

### 1. Isolate creator code from authenticated platform origin

`CAN-100` is the only critical finding. The source currently permits hosted
creator JavaScript to fall back to the platform origin, and the host iframe is
not sandboxed. Gate 5 must verify actual production configuration, then remove
the unsafe fallback and prove origin isolation.

### 2. Remove fail-open and obsolete control planes

The realtime server always mounts an unauthenticated legacy harness command
bus (`CAN-002`), while the release browser worker can allow access when its
token is absent (`CAN-102`). They are distinct implementations but one security
proof should show that no development or privileged control plane silently
opens in production.

### 3. Make the clean-scaffold agent front door real

Generated projects document `pnpm exec airjam ...` but do not install the
package that provides it (`CAN-200`). The eventual installed project CLI must
cover structured lifecycle operations through the same services as MCP
(`CAN-201`), package all runtime dependencies (`CAN-202`), and prove actual
Codex/Claude client registration rather than equating `.mcp.json` with portable
installation (`CAN-205`).

### 4. Put release work below durable product jobs

Release finalization currently performs extraction, thousands of object writes,
browser capture, screenshot movement, moderation, and DB transitions in one
HTTP request (`CAN-108`). MCP's in-memory task requirement (`CAN-206`) is a
symptom, not the job authority. The platform should own idempotent inspectable
jobs, while UI, CLI, HTTP, and MCP remain adapters.

### 5. Establish one trusted platform lifecycle

Generic status setters can bypass release/media validation (`CAN-103`), the DB
cannot enforce one live release (`CAN-104`), UI and machine transports own
parallel workflows (`CAN-107`), and rate/admission policy differs by adapter
(`CAN-113`). One actor-aware application service and PostgreSQL invariants
should own each transition.

### 6. Cut the public framework contract intentionally

Runtime topology has a private duplicate (`CAN-001`), runtime inspection leaks
from the stable root (`CAN-003`), raw runtimes teach a second creator model
(`CAN-004`), a speculative capabilities schema overlaps executable contracts
(`CAN-005`), and the server exposes an untyped accidental root (`CAN-008`).
These are bounded pre-1.0 removals, not reasons to preserve compatibility
sediment.

### 7. Reduce agent guidance to owned, testable layers

The generated AI pack contains 4,540 lines across contracts, docs, and skills;
rules repeat across several surfaces and one required MCP skill lacks standard
metadata (`CAN-203`). Updates also claim replacement authority over natural
user customization files (`CAN-204`). Keep a short project router, one normal
loop, managed versioned references, user-owned extension points, and only
specialized conditionally loaded skills.

The public-surface follow-up also proved that hosted AI-pack freshness can pass
against a stale base pack (`CAN-301`). Global freshness must validate the full
authored-docs-to-hosted-artifact chain.

## Simplification and Deletion Opportunities

The accepted deletion-first set includes:

1. the private duplicate runtime-topology package
2. the legacy server visual-harness HTTP bus and unreachable public MCP visual
   definitions
3. the speculative capabilities manifest
4. copied project-runtime and environment-validation sources after one owner is
   established
5. accidental stable SDK/server exports and deprecated runtime aliases
6. generic platform status mutation paths that bypass trusted lifecycles
7. malformed/repeated guidance rather than adding another documentation layer
8. the local-only bot-lab workspace importer/Docker exceptions and empty
   `apps/studio` placeholder, while preserving the user's local bot-lab files
9. the dead duplicate platform architecture diagram when convenient

The audit rejected a proposed six-way store extraction (`CAN-010`) because
line count and responsibility enumeration did not prove that another set of
abstractions would improve the system. This is an important guardrail: audit
work must simplify proven seams, not reward architectural motion by itself.

## Canonical End-State Shape

```text
game-owned contract and domain state
            |
            v
shared typed domain/application services
      /          |          |          \
    CLI         MCP        API          UI

platform durable jobs -> bounded workers -> immutable isolated artifacts
repo CLI              -> private production operations and evidence
```

The same domain capability may have several adapters. It should not have
several owners.

## 1.0 Consequences

1. Gate 1 remains necessary and should now use these findings rather than run
   another open-ended code review.
2. `G1-02` verifies package/export/config/generated surfaces in pack/clean-room
   conditions; `G1-03` produces the exact combined removal/refactor set.
3. `G1-04` remains the single human checkpoint for public and high-impact cuts.
4. `G1-05` implements the accepted set, grouped by shared root cause rather
   than by audit ID.
5. Gate 2 proves the installed CLI, semantic session, client registration, and
   clean scaffold without private monorepo knowledge.
6. Gate 3 owns static delivery, durable release work, quotas, cleanup, capacity,
   single-replica safety, and recovery.
7. Gate 4 owns private machine-operable migrations, abuse operations, events,
   runbooks, and repair evidence.
8. Gate 5 owns origin isolation, control-plane auth, privacy projections,
   request identity, and negative-path proof.

No new parallel execution tracker was created. The
[decision register](./decision-register.md) maps every finding into the existing
readiness program, merges shared implementation streams, and records the
rejected/deferred work.

The durable [codebase assessment](./codebase-assessment.md) records the
architectural judgment produced by the audit. The
[canonicalization execution set](./canonicalization-execution-set.md) converts
accepted findings into deletion-first, Git-measured implementation bundles for
`G1-05` without replacing the readiness manifest.

## Evidence Set

1. [audit-contract.md](./audit-contract.md)
2. [system-map.md](./system-map.md)
3. [runtime-framework-audit.md](./runtime-framework-audit.md)
4. [platform-release-audit.md](./platform-release-audit.md)
5. [tooling-contracts-audit.md](./tooling-contracts-audit.md)
6. [decision-register.md](./decision-register.md)
7. [codebase-assessment.md](./codebase-assessment.md)
8. [canonicalization-execution-set.md](./canonicalization-execution-set.md)
9. [public-surface-source-audit.md](./public-surface-source-audit.md)
10. [gate-1-removal-approval-packet.md](./gate-1-removal-approval-packet.md)

The three lane reports were produced independently and then cross-reviewed in
a rotation. Cross-review specifically challenged severity, release timing,
duplicate implementation plans, unsafe production inferences, and proposals
that would create new unnecessary layers.
