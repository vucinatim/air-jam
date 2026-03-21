# Air Jam Performance Baseline

Last updated: 2026-03-21
Status: active baseline (non-CI)

This document tracks lightweight local performance sanity runs.

## Command

```bash
pnpm perf:sanity -- --durationMs=12000 --warmupMs=1000 --controllers=6 --hz=25
```

## Latest Result (2026-03-21)

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
