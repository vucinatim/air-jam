# Operational Contract Proof

Last updated: 2026-08-30
Status: Gate `G4-01` implemented and locally proven

## Outcome

Air Jam now has one versioned, agent-operable authority boundary for moving
from lifecycle/runtime facts to correlated incidents and safely governed
recovery actions.

The runtime implementation lives in the private
`@air-jam/operations-contract` workspace package. The canonical explanatory
contract is
[Operational Events And Incidents Contract](../../contracts/operational-events-and-incidents-contract.md).

## Proven Boundaries

The contract proves:

1. approximate product telemetry cannot validate as an authoritative
   operational event
2. unknown contract versions, fields, enum values, and transitions fail closed
3. event and action chronology is coherent and payloads remain bounded
4. incident identity is a deterministic digest of normalized failure scope and
   inconsistent records are rejected
5. runbook parameters are declared, typed, bounded, and exact
6. mutating apply binds to an immutable preview through descriptor, parameter,
   and preview SHA-256 digests
7. preview expiry, incident context, ordered actions, resource count, service,
   environment, and cost blast radius are revalidated at authorization time
8. destructive work requires operator approval and bounded automatic work is
   reversible, verified, rollback-backed, and agent/system-owned
9. successful and rolled-back actions retain completion and verification
   evidence
10. validation failures expose only paths, codes, and bounded messages rather
    than submitted values

## Agent Surface

Agents discover, inspect, export, and validate the contract through one
repo-owned surface:

```bash
pnpm run repo -- platform operations contract --help
pnpm --silent run repo -- platform operations contract inspect --json
pnpm --silent run repo -- platform operations contract schema \
  --name runbook_preview --json
pnpm --silent run repo -- platform operations contract validate \
  --schema operational_event --input ./event.json --json
```

All seven schema families export Draft 7 JSON Schema for structural discovery.
Runtime validation remains authoritative for cross-field and cross-document
safety invariants.

## Validation

Focused package and CLI contract suites cover schema safety, deterministic
helpers, preview/apply authorization, JSON Schema export, discovery, stable
JSON output, nonzero invalid-input behavior, and submitted-value redaction.

The package declaration test is part of recursive repository typechecking. The
root test suite includes both the package tests and repo CLI contract tests.

The complete `pnpm check:ci` gate passed on 2026-08-30 with:

1. generated-source, recursive typecheck, lint, and canonical-contract checks
2. `69` repository contract tests
3. `12` operations-contract package tests
4. `6` operations-contract repo CLI tests within the repository suite
5. `9` MCP tests
6. `134` passing server tests with `2` skipped
7. `260` SDK tests
8. `211` passing platform tests with `3` skipped
9. successful recursive production builds
10. performance sanity delivering all `20,760` messages with `0%` loss,
    `4.74 ms` p95 and `6.36 ms` p99 latency, plus `40` reconnect attempts with
    no failures or resume misses

The same command is retained as typed readiness evidence for `G4-01`.

## Implementation Boundary

This slice defines and proves the shared contract. It does not fabricate
production behavior that does not exist yet. Durable event producers, outbox
persistence, SLO and synthetic emitters, incident storage and correlation,
notification and GitHub adapters, runbook execution, and failure drills remain
separate Gate 4 work items that must implement this boundary rather than create
parallel models.
