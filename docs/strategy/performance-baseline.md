# Air Jam Performance Baseline

Last updated: 2026-03-21
Status: active baseline (non-CI)

This document tracks lightweight local performance sanity runs.

## Default Command

```bash
node scripts/workspace/cli.mjs perf sanity
```

## Latest Result (2026-03-21, default profile)

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
node scripts/workspace/cli.mjs perf sanity --durationMs=12000 --warmupMs=1000 --controllers=6 --hz=25
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

- This is a local sanity benchmark for regression spotting.
- It is intentionally **not CI-gated** yet.
- Use `--strict` for optional non-zero exit on soft threshold warnings.
- Soak and long-duration benchmarks remain deferred until traction justifies nightly perf investment.
