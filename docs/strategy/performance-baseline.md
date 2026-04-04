# Air Jam Performance Baseline

Last updated: 2026-04-04
Status: active release gate

This document tracks the committed local server perf sanity contract.

## Default Command

```bash
pnpm run repo -- perf sanity
```

Strict release gate:

```bash
pnpm run repo -- perf sanity --strict
```

The canonical perf pass now has two scenarios:

1. input baseline
2. controller reconnect churn

Committed thresholds:

1. baseline drop rate must stay at or below `2.00%`
2. baseline p95 latency must stay at or below `50.00 ms`
3. reconnect failure rate must stay at `0.00%`
4. reconnect resume failure rate must stay at `0.00%`
5. reconnect p95 latency must stay at or below `150.00 ms`

## Latest Snapshot (2026-04-04, short validation profile)

Command:

```bash
pnpm run repo -- perf sanity --durationMs=2000 --warmupMs=200 --controllers=2 --reconnectControllers=2 --reconnectCycles=2 --reconnectPauseMs=20
```

Baseline:

- sent events: `112`
- received events: `112`
- drop rate: `0.00%`
- latency p50: `0.61 ms`
- latency p95: `2.43 ms`
- latency p99: `3.35 ms`
- latency avg: `0.79 ms`
- latency max: `3.73 ms`

Reconnect churn:

- reconnect attempts: `4`
- failed reconnects: `0`
- resume misses: `0`
- failure rate: `0.00%`
- resume failure rate: `0.00%`
- reconnect latency p50: `1.03 ms`
- reconnect latency p95: `1.42 ms`
- reconnect latency p99: `1.42 ms`
- reconnect latency avg: `1.15 ms`
- reconnect latency max: `1.42 ms`

## Earlier Baseline Snapshot (2026-03-21, default profile)

- controllers: `8`
- target hz/controller: `30`
- measurement duration: `90.50 s`
- sent events: `21240`
- received events: `21240`
- drop rate: `0.00%`
- throughput sent: `234.69 evt/s`
- throughput received: `234.69 evt/s`
- latency p50: `0.59 ms`
- latency p95: `1.10 ms`
- latency p99: `2.72 ms`
- latency avg: `0.71 ms`
- latency max: `35.61 ms`
- heap delta: `-1.03 MB`

## Previous Snapshot (2026-03-21, short profile)

Command:

```bash
pnpm run repo -- perf sanity --durationMs=12000 --warmupMs=1000 --controllers=6 --hz=25
```

- controllers: `6`
- target hz/controller: `25`
- measurement duration: `12.50 s`
- sent events: `1740`
- received events: `1740`
- drop rate: `0.00%`
- throughput sent: `139.15 evt/s`
- throughput received: `139.15 evt/s`
- latency p50: `0.85 ms`
- latency p95: `2.69 ms`
- latency p99: `5.56 ms`
- latency avg: `1.10 ms`
- latency max: `8.50 ms`
- heap delta: `-2.56 MB`

## Notes

- This remains a local release-confidence benchmark, not a general observability system.
- `pnpm check:release` now includes the strict mode gate.
- The committed thresholds are intentionally narrow and local-machine oriented.
- Soak and long-duration benchmarks remain deferred until traction justifies nightly perf investment.
