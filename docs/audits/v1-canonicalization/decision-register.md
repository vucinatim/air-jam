# Air Jam 1.0 Canonicalization Decision Register

Last updated: 2026-09-04
Status: complete for `G1-01`
Readiness owner: `G1-01`

This register resolves the audit without becoming an implementation tracker.
The readiness manifest remains the only execution-state authority. The
[canonicalization execution set](./canonicalization-execution-set.md) turns the
accepted findings into the bounded refactor/removal bundles, `G1-04` approves
public and high-impact cuts, and `G1-05` implements them.

| Finding | Decision                    | Readiness reference        | Rationale                                                                                                                  |
| ------- | --------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CAN-001 | accepted-existing           | G1-02, G1-03, G1-05        | SDK becomes the sole topology authority; delete the private duplicate.                                                     |
| CAN-002 | accepted-existing           | G1-03, G1-05, G5-01, G5-02 | Remove the always-mounted server harness bus; coordinate but do not conflate it with worker auth.                          |
| CAN-003 | accepted-existing           | G1-02, G1-03, G1-05        | Make runtime inspection an intentional leaf rather than an accidental stable-root promise.                                 |
| CAN-004 | accepted-existing           | G1-02, G1-03, G1-05        | Keep `createAirJamApp` as the creator model and move raw runtimes to a platform-owned internal leaf.                       |
| CAN-005 | accepted-existing           | G1-02, G1-03, G1-05        | Delete the unused speculative capabilities schema in favor of executable semantic contracts.                               |
| CAN-006 | accepted-existing           | G1-03, G1-05               | One implementation stream with CAN-200; no new package by default.                                                         |
| CAN-007 | accepted-existing           | G1-03, G1-05, G2-02, G2-03 | First-party and packed clean-room semantic contracts need real conformance proof.                                          |
| CAN-008 | accepted-existing           | G1-02, G1-03, G1-05        | Remove or deliberately type/document the accidental server root; current evidence favors removal.                          |
| CAN-009 | accepted-existing           | G3-01, G3-02, G3-04        | Enforce and prove a safe single-replica envelope; distributed rooms wait for measured need.                                |
| CAN-010 | rejected                    | —                          | Responsibility count and file size alone do not justify the proposed extraction; require concrete coupling evidence first. |
| CAN-011 | accepted-existing           | G1-03, G1-05, G3-04        | Extract proven room-domain transitions without inventing another state model.                                              |
| CAN-012 | accepted-existing           | G1-02, G1-03, G1-05        | Purge deprecated aliases/fallbacks but preserve canonical topology `publicHost`.                                           |
| CAN-013 | deferred                    | decision register          | Valid private dead-code cleanup, but it does not block an honest 1.0 and needs no active tracker.                          |
| CAN-100 | accepted-existing           | G5-01, G5-02, G3-04        | Critical source-level unsafe fallback; Gate 5 must verify production state without assuming current exposure.              |
| CAN-101 | accepted-existing, narrowed | G3-01, G3-02, G3-04        | Immutable release delivery blocks 1.0; mutable media may use a bounded cached alias before direct-CDN work.                |
| CAN-102 | accepted-existing           | G5-01, G5-02, G4-02        | Require worker access authority and Chromium-aware readiness.                                                              |
| CAN-103 | accepted-existing           | G1-03, G1-05, G5-02        | Delete generic lifecycle-bypassing mutations and keep trusted transitions.                                                 |
| CAN-104 | accepted-existing           | G1-03, G1-05, G3-04        | Enforce and serialize the one-live-release invariant in PostgreSQL.                                                        |
| CAN-105 | accepted-existing           | G5-01, G5-02               | Remove reporter contact from creator-facing projections and prove privacy boundaries.                                      |
| CAN-106 | accepted-existing, narrowed | G4-01, G5-02               | Complete abuse triage through one private machine adapter; public MCP expansion is not required.                           |
| CAN-107 | accepted-existing           | G1-03, G1-05, G3-02        | UI and machine adapters must share actor-aware application services and admission policy.                                  |
| CAN-108 | accepted-existing           | G3-01, G3-02, G3-03, G4-02 | Durable platform job authority is the root fix; CAN-206 is one adapter consequence.                                        |
| CAN-109 | accepted-existing           | G3-02                      | Ratified quotas, cleanup, and usage inspection already belong to this item.                                                |
| CAN-110 | accepted-existing           | G3-03, G3-06, G7-01        | Production migration becomes a private inspect/backup/apply/verify/restore operation.                                      |
| CAN-111 | accepted-existing           | G1-02, G1-03, G1-05        | One internal DB contract owns shared tables; platform remains sole migration authority.                                    |
| CAN-112 | accepted-existing           | G1-03, G1-05               | Extract a testable orchestrator while preserving the existing replicated-state model.                                      |
| CAN-113 | accepted-existing, split    | G3-02, G5-02               | Cross-adapter bypass blocks 1.0; distributed/global limiting remains before-scale unless topology evidence changes.        |
| CAN-114 | accepted-existing           | G1-03, G1-05               | Enforce active media assignment integrity and centralize its service mapping.                                              |
| CAN-115 | deferred                    | decision register          | Valid dead duplication; delete opportunistically, but it has no release or scale consequence.                              |
| CAN-200 | accepted-existing           | G1-03, G1-05, G2-02        | Establish the installed project CLI and combine copied-runtime implementation work with CAN-006.                           |
| CAN-201 | accepted-existing, narrowed | G1-03, G1-05, G2-02, G2-03 | Require structured lifecycle parity through shared services, not a new universal command bus.                              |
| CAN-202 | accepted-existing           | G1-02, G1-05, G2-02        | Fix the MCP production dependency and add isolated packed-package proof.                                                   |
| CAN-203 | accepted-existing, split    | G1-03, G1-05, G2-02        | Skill validity/reference checks block 1.0; broader prose consolidation stays evidence-led.                                 |
| CAN-204 | accepted-existing           | G1-03, G1-05, G2-05        | Separate managed references from user-owned project contracts before adoption.                                             |
| CAN-205 | accepted-existing           | G1-03, G1-05, G2-02, G2-04 | Distinguish portable server declaration from Codex/Claude client registration and proof.                                   |
| CAN-206 | merged                      | CAN-108; G2-03, G2-04      | First resolve the supported CLI/MCP contract; MCP tasks adapt platform jobs and do not own persistence.                    |
| CAN-207 | merged                      | CAN-002; G1-03, G1-05      | Remove unreachable MCP residue in the same retirement program as the obsolete harness bus.                                 |
| CAN-300 | accepted-existing           | G1-03, G1-05, G1-06        | Make workspace topology reproducible without deleting the user's local bot-lab files.                                      |
| CAN-301 | accepted-new                | G1-02, G1-05, G1-06        | Make generated freshness transitive from authored docs through the base pack to hosted artifacts.                          |

## Cross-Review Corrections Applied

1. No universal command bus or mega-schema is approved. Shared typed services
   plus thin adapters remain the target.
2. Durable job persistence belongs to the platform release lifecycle, not MCP
   process memory. MCP parity is a product-contract decision and client proof.
3. Source-level unsafe fallbacks are findings; claims about current production
   exposure require Gate 5 environment/topology evidence.
4. Single-replica 1.0 is acceptable when enforced, measured, alerted, drained,
   and documented. Multi-node room authority is not being built speculatively.
5. Specialized conditionally loaded skills may remain. Repeated policy and
   malformed discovery metadata are the actual defects.
6. Private operator automation defaults to the repo CLI; agent-first does not
   mean publishing privileged operations in the creator MCP server.
