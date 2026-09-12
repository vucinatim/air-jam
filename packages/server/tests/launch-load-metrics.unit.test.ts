import { describe, expect, it } from "vitest";
import type { RuntimeSample } from "../scripts/launch-load/contract.js";
import {
  LatencyHistogram,
  summarizeRuntimeSamples,
} from "../scripts/launch-load/metrics.js";

const sample = (values: Partial<RuntimeSample> = {}): RuntimeSample => ({
  elapsedMs: 0,
  cpuUserMicros: 0,
  cpuSystemMicros: 0,
  rssBytes: 100,
  heapUsedBytes: 50,
  eventLoopDelayP95Ms: 1,
  eventLoopUtilization: 0.1,
  bytesRead: 0,
  bytesWritten: 0,
  ...values,
});

describe("launch load latency histogram", () => {
  it("reports an explicit empty count without inventing observations", () => {
    expect(new LatencyHistogram().summarize()).toEqual({
      count: 0,
      averageMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      maxMs: 0,
      overflowCount: 0,
      resolutionMs: 1,
    });
  });

  it("uses nearest-rank percentiles with 1 ms upward rounding and exact average/max", () => {
    const histogram = new LatencyHistogram();
    for (let index = 1; index <= 100; index += 1)
      histogram.record(index - 0.25);
    expect(histogram.summarize()).toEqual({
      count: 100,
      averageMs: 50.25,
      p50Ms: 50,
      p95Ms: 95,
      p99Ms: 99,
      maxMs: 99.75,
      overflowCount: 0,
      resolutionMs: 1,
    });
    expect(histogram.summarize()).toEqual(histogram.summarize());
  });

  it("keeps zero and 10000 ms in range and reports overflow quantiles as upper bounds", () => {
    const histogram = new LatencyHistogram();
    for (const value of [0, 10_000, 10_000.1, 20_000]) histogram.record(value);
    expect(histogram.summarize()).toMatchObject({
      count: 4,
      p50Ms: 10_000,
      p95Ms: 20_000,
      p99Ms: 20_000,
      maxMs: 20_000,
      overflowCount: 2,
    });
  });

  it.each([-1, NaN, Infinity, -Infinity])(
    "rejects invalid latency %s without adding it",
    (value) => {
      const histogram = new LatencyHistogram();
      expect(() => histogram.record(value)).toThrow(RangeError);
      expect(histogram.summarize().count).toBe(0);
    },
  );
});

describe("launch load runtime summary", () => {
  it("distinguishes missing intervals from measured zero usage", () => {
    expect(Object.values(summarizeRuntimeSamples([]))).toEqual(
      Array(9).fill(null),
    );
    expect(summarizeRuntimeSamples([sample()])).toEqual({
      durationMs: null,
      cpuSeconds: null,
      meanCpuCores: null,
      meanRssBytes: null,
      peakRssBytes: 100,
      peakHeapUsedBytes: 50,
      eventLoopDelayP95MaxMs: 1,
      bytesRead: null,
      bytesWritten: null,
    });
    expect(summarizeRuntimeSamples([sample(), sample()]).durationMs).toBeNull();
    expect(
      summarizeRuntimeSamples([sample(), sample({ elapsedMs: 1000 })]),
    ).toMatchObject({
      durationMs: 1000,
      cpuSeconds: 0,
      meanCpuCores: 0,
      bytesRead: 0,
      bytesWritten: 0,
    });
  });

  it("subtracts cumulative counters and integrates RSS over uneven sample intervals", () => {
    const samples = [
      sample({
        elapsedMs: 500,
        cpuUserMicros: 100_000,
        cpuSystemMicros: 50_000,
        bytesRead: 100,
        bytesWritten: 200,
      }),
      sample({
        elapsedMs: 1500,
        cpuUserMicros: 300_000,
        cpuSystemMicros: 150_000,
        rssBytes: 300,
        heapUsedBytes: 90,
        eventLoopDelayP95Ms: 7,
        bytesRead: 300,
        bytesWritten: 400,
      }),
      sample({
        elapsedMs: 4500,
        cpuUserMicros: 1_100_000,
        cpuSystemMicros: 1_050_000,
        rssBytes: 500,
        heapUsedBytes: 70,
        eventLoopDelayP95Ms: 3,
        bytesRead: 800,
        bytesWritten: 1100,
      }),
    ];
    expect(summarizeRuntimeSamples(samples)).toEqual({
      durationMs: 4000,
      cpuSeconds: 2,
      meanCpuCores: 0.5,
      peakRssBytes: 500,
      meanRssBytes: 350,
      peakHeapUsedBytes: 90,
      eventLoopDelayP95MaxMs: 7,
      bytesRead: 700,
      bytesWritten: 900,
    });
  });

  it.each([
    "elapsedMs",
    "cpuUserMicros",
    "cpuSystemMicros",
    "bytesRead",
    "bytesWritten",
  ] as const)(
    "rejects decreasing %s instead of combining incompatible samples",
    (field) => {
      expect(() =>
        summarizeRuntimeSamples([
          sample({ [field]: 2 }),
          sample({ [field]: 1 }),
        ]),
      ).toThrow(RangeError);
    },
  );

  it.each([NaN, Infinity, -1])(
    "rejects invalid sample measurements %s",
    (rssBytes) => {
      expect(() => summarizeRuntimeSamples([sample({ rssBytes })])).toThrow(
        RangeError,
      );
    },
  );
});
