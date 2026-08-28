# Air Jam 1.0 Canonicalization Audit Contract

Last updated: 2026-08-28
Status: completed audit reference
Readiness owner: `G1-01`

## Purpose

This audit determines whether Air Jam's implemented architecture is canonical,
understandable, minimal, agent-operable, and appropriate for a 1.0 release.
It examines more than correctness. It asks whether each important system has one
obvious owner and path, whether its complexity is justified, and whether we
would design it this way today given current agent and tooling capabilities.

The audit itself does not implement production refactors. Accepted findings
become dependency-aware readiness work; rejected or deliberately deferred
findings remain in the decision register with their rationale.

## Required Outcomes

The completed audit must provide:

1. a map of composition roots, package responsibilities, authority boundaries,
   public contracts, and operational surfaces
2. evidence-backed findings covering duplication, unclear ownership, accidental
   complexity, awkward workflows, obsolete paths, and contract drift
3. a clear canonical end state for every accepted finding
4. a decision register that deduplicates and resolves cross-lane findings
5. readiness work items for accepted release-relevant changes, without creating
   a parallel Markdown tracker

## Audit Lanes

### Runtime and framework

Owns finding IDs `CAN-001` through `CAN-099`.

Scope:

- `packages/sdk/`
- `packages/server/`
- `packages/harness/`
- `packages/runtime-topology/`
- game workspaces and scaffold runtime parity
- multiplayer authority, state, transport, input, lifecycle, and semantic agent
  game-session contracts

### Platform and release

Owns finding IDs `CAN-100` through `CAN-199`.

Scope:

- `apps/platform/`
- `packages/release-browser-worker/`
- platform database and release orchestration
- Arcade, publishing, artifacts, media, analytics, and production composition
  roots
- provider boundaries and expensive/background work

### Tooling and public contracts

Owns finding IDs `CAN-200` through `CAN-299`.

Scope:

- `packages/create-airjam/`
- `packages/devtools-core/`
- `packages/mcp-server/`
- repo and workspace CLIs under `scripts/`
- package exports, configuration, templates, docs, skills, install paths, and
  CLI/MCP/API parity
- public developer experience and external-agent operability

### Cross-cutting synthesis

Owns finding IDs `CAN-300` through `CAN-399`.

Scope:

- repository topology and dependency direction
- concepts or implementations duplicated across lanes
- documentation and implemented-contract drift
- global naming, composition, configuration, testing, and ownership issues
- challenges to lane conclusions and final canonical decisions

## Required Review Dimensions

Every lane must evaluate all applicable dimensions:

1. **Canonicality:** Is there exactly one intended path and source of truth?
2. **Ownership:** Is one package or service clearly authoritative?
3. **Boundaries:** Do domain, orchestration, IO, and presentation remain clean?
4. **Composition:** Are entrypoints and dependency direction obvious and
   intentional?
5. **Public surface:** Are exports and supported contracts explicit, minimal,
   aligned with docs, and ready for the intended 1.0 stability promise?
6. **Agent operability:** Can the complete supported lifecycle be discovered,
   invoked, inspected, and safely maintained through CLI, MCP, or another stable
   machine contract using the same domain services as human surfaces?
7. **Simplicity:** Is the complexity necessary, or can concepts, layers,
   packages, commands, or documents be removed or consolidated?
8. **Ergonomics:** Are common human and agent workflows clear and direct rather
   than ceremonial or implementation-leaking?
9. **Testability:** Can behavior be verified at the right boundary without
   unrealistic mocks or fragile integration setup?
10. **Polish:** Do naming, layout, errors, help, generated artifacts, and docs
    communicate one coherent product?
11. **Modern relevance:** Would we design this system this way today, or does it
    encode constraints from older agent/tool generations that no longer apply?
12. **Deletion opportunity:** What can be deleted completely with zero
    backward-compatibility obligation?

Agent-first does not mean adding a bespoke agent layer to every feature. The
preferred shape is one domain capability and service with thin CLI, MCP, API,
and UI adapters. Skills and documentation should route agents to canonical
capabilities rather than duplicate architecture or business logic.

## Complexity Classification

Each finding that concerns structure or ergonomics must select one primary
classification:

- `necessary-complexity`: complexity protects a real invariant and should be
  clarified rather than removed
- `accidental-complexity`: structure or ceremony does not protect a real
  invariant
- `obsolete-complexity`: a former constraint or compatibility path is no longer
  relevant
- `duplicated-capability`: multiple paths own the same behavior or truth
- `unclear-ownership`: authority is split, implicit, or surprising
- `excessive-indirection`: understanding or invoking a capability crosses
  unjustified layers
- `poor-ergonomics`: the supported workflow is awkward for humans or agents
- `contract-drift`: code, docs, tests, generated assets, or public contracts
  disagree

## Finding Schema

Every reported finding must use this exact shape:

```markdown
### CAN-NNN — Concise title

- Category: canonicality | ownership | boundary | composition | public-contract |
  agent-operability | simplicity | ergonomics | testability | polish | debt
- Complexity: necessary-complexity | accidental-complexity |
  obsolete-complexity | duplicated-capability | unclear-ownership |
  excessive-indirection | poor-ergonomics | contract-drift | not-applicable
- Severity: critical | high | medium | low
- Release classification: blocks-1.0 | before-scale | post-1.0 | reject
- Confidence: high | medium | low
- Evidence: exact repo-relative files, symbols, commands, or observed behavior
- Current behavior: what the repository does now
- Architectural harm: why this matters rather than merely differing from taste
- Canonical end state: the smallest coherent final architecture
- Change: what should be refactored, consolidated, or deleted
- Dependencies and blast radius: affected packages, contracts, data, and tests
- Validation: objective evidence that would close the eventual work
```

Do not create findings for unsupported aesthetic preferences. A finding requires
concrete evidence and a stated architectural or product consequence.

## Severity and Release Classification

Severity describes impact:

- `critical`: unsafe authority, data loss, fundamental release invalidity, or an
  architecture that cannot support the promised product
- `high`: duplicate authority, major contract inconsistency, unmaintainable
  composition, or a likely launch/reliability failure
- `medium`: meaningful structural, operability, testability, or polish debt
- `low`: localized clarity or cleanup with limited blast radius

Release classification describes scheduling:

- `blocks-1.0`: required for an honest and operable 1.0
- `before-scale`: may ship in 1.0 only if risk is explicitly bounded, but must be
  resolved before meaningful adoption
- `post-1.0`: valuable end-state improvement that does not weaken the 1.0
  contract
- `reject`: evidence does not justify a change or the proposed change would make
  the architecture worse

## Evidence Rules

1. Prefer source, tests, package manifests, generated contracts, and executable
   CLI inspection over commentary.
2. Cite exact repo-relative paths and symbols. Include commands when output is
   part of the evidence.
3. Distinguish verified behavior from inference.
4. Search for all consumers before declaring a path unused or duplicated.
5. Consider deletion and consolidation before inventing a new abstraction.
6. Do not edit production code during the audit.
7. Do not overwrite unrelated or pre-existing worktree changes.

## Decision and Execution Rules

The root synthesis owns deduplication and decisions:

1. `accepted`: material 1.0 or before-scale work becomes a readiness item with
   dependencies, estimate, and evidence requirements
2. `accepted-existing`: already represented by an existing readiness item; link
   it rather than duplicating it
3. `deferred`: valid post-1.0 improvement recorded in `docs/suggestions.md` only
   when it is durable and non-critical
4. `rejected`: retained in the decision register with concise reasoning
5. `merged`: duplicate finding points to the surviving finding ID

Audit documents preserve evidence and decisions. The readiness manifest remains
the only execution-state authority.

## Completion Criteria

`G1-01` is complete only when:

1. all three lane reports follow this contract
2. cross-review has challenged unsupported or duplicate conclusions
3. the system map and final synthesis identify canonical paths and authority
   boundaries
4. every finding appears in the decision register
5. accepted work is represented exactly once in the readiness graph
6. documentation and readiness validation pass
