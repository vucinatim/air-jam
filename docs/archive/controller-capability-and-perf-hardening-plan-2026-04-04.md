# Controller Capability And Perf Hardening Plan

Last updated: 2026-04-04  
Status: completed prerelease baseline

Related docs:

1. [V1 Release Launch Plan](../plans/v1-release-launch-plan.md)
2. [Work Ledger](../work-ledger.md)
3. [Performance Baseline](../strategy/performance-baseline.md)
4. [Arcade Surface Contract](../systems/arcade-surface-contract.md)

## Purpose

Harden two remaining release-critical framework-level concerns before public launch:

1. privileged controller actions should require an explicit grant instead of only room membership
2. the existing server perf harness should become an explicit release-confidence gate

This plan stays narrow on purpose. It is not a broader security rewrite or observability redesign.

## Core Position

Air Jam should distinguish between:

1. a controller being allowed to join and play
2. a controller being allowed to issue elevated commands

And it should distinguish between:

1. exploratory local perf measurements
2. committed release-threshold checks

Both distinctions are small but important for a trustworthy public release.

## Desired End State

Air Jam should have these two clean release guarantees:

1. official controller flows can use privileged controller channels, but room-code-only joins cannot abuse those channels
2. the server has one explicit strict perf gate with committed thresholds, including reconnect churn

## Implementation Direction

### 1. Controller privileged capability

Keep current controller room/socket authorization as the identity check.
Add one additional gate for privileged controller channels only:

1. `controller:system`
2. `controller:play_sound`
3. `controller:action_rpc`

Use the same capability pattern already present for child-host launch:

1. opaque token
2. room-scoped
3. explicit expiry

Grant model:

1. issue one room-scoped controller capability bundle from the server
2. include explicit grants for `system`, `play_sound`, and `action_rpc`
3. deliver it through official controller bootstrap flows
4. accept an optional capability token on `controller:join`
5. persist the granted privileges on the controller session / socket authority after validation

Behavior rules:

1. official Arcade and official controller links include the capability automatically
2. manual room-code joins still work for normal play/input/profile flows
3. manual room-code joins do not get privileged controller powers
4. privileged rejections emit explicit structured log events

Do not gate normal controller input behind this capability.

### 2. Perf release gate

Build on the existing perf harness instead of replacing it.

Required hardening:

1. keep the current baseline scenario
2. add a reconnect-churn scenario
3. move thresholds into explicit committed code-level rules
4. keep non-strict mode for local exploration
5. make `--strict` the release-facing gate

Wiring:

1. the strict perf gate belongs in release-confidence validation
2. it should not become part of the ordinary everyday `pnpm test` path
3. the performance baseline doc must match the real enforced thresholds

## Done When

1. official controller bootstrap flows still work normally
2. room-code-only joins can no longer use privileged controller channels
3. privileged controller channels are covered by security tests
4. the perf harness includes reconnect churn
5. strict perf mode fails on threshold regressions
6. the strict perf gate is part of release-confidence validation and documented as such

## Completed Outcome

1. official host/controller URLs now carry a room-scoped controller privileged capability automatically
2. `controller:system`, `controller:play_sound`, and `controller:action_rpc` now require that privileged capability after join
3. manual room-code joins still support normal play/input flows but cannot use those elevated controller channels
4. server routing/security coverage now proves both the rejection and official-flow acceptance paths
5. the server perf sanity harness now runs both the baseline input scenario and reconnect churn under committed thresholds
6. `pnpm check:release` now includes `pnpm run repo -- perf sanity --strict`
