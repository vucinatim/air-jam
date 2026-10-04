import type { LatencySummary, RuntimeSample } from "./contract.js";

const MAX_LATENCY_BIN_MS = 10_000;

const requireMeasurement = (value: number, name: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and non-negative.`);
  }
};

/** Fixed-size 1 ms bins; percentile values are conservative upper bounds. */
export class LatencyHistogram {
  private readonly bins = new Float64Array(MAX_LATENCY_BIN_MS + 2);
  private count = 0;
  private totalMs = 0;
  private maxMs = 0;

  record(ms: number): void {
    requireMeasurement(ms, "Latency");
    this.bins[Math.min(Math.ceil(ms), MAX_LATENCY_BIN_MS + 1)]! += 1;
    this.count += 1;
    this.totalMs += ms;
    this.maxMs = Math.max(this.maxMs, ms);
  }

  summarize(): LatencySummary {
    const percentile = (fraction: number): number => {
      if (this.count === 0) return 0;
      const target = Math.ceil(this.count * fraction);
      let seen = 0;
      for (let bin = 0; bin < this.bins.length; bin += 1) {
        seen += this.bins[bin]!;
        if (seen >= target) {
          // The overflow bucket has no finer resolution: report its upper bound.
          return bin > MAX_LATENCY_BIN_MS ? this.maxMs : bin;
        }
      }
      throw new Error("Latency histogram count is inconsistent.");
    };
    return {
      count: this.count,
      averageMs: this.count ? this.totalMs / this.count : 0,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      maxMs: this.maxMs,
      overflowCount: this.bins[MAX_LATENCY_BIN_MS + 1]!,
      resolutionMs: 1,
    };
  }
}

export interface RuntimeSummary {
  durationMs: number | null;
  cpuSeconds: number | null;
  meanCpuCores: number | null;
  peakRssBytes: number | null;
  meanRssBytes: number | null;
  peakHeapUsedBytes: number | null;
  eventLoopDelayP95MaxMs: number | null;
  bytesRead: number | null;
  bytesWritten: number | null;
}

/** Cumulative counter deltas and trapezoidal RSS weighting over observed time. */
export const summarizeRuntimeSamples = (
  samples: RuntimeSample[],
): RuntimeSummary => {
  const result: RuntimeSummary = {
    durationMs: null,
    cpuSeconds: null,
    meanCpuCores: null,
    peakRssBytes: null,
    meanRssBytes: null,
    peakHeapUsedBytes: null,
    eventLoopDelayP95MaxMs: null,
    bytesRead: null,
    bytesWritten: null,
  };
  let rssByteMilliseconds = 0;
  let previous: RuntimeSample | undefined;
  for (const sample of samples) {
    for (const field of [
      "elapsedMs",
      "cpuUserMicros",
      "cpuSystemMicros",
      "rssBytes",
      "heapUsedBytes",
      "eventLoopDelayP95Ms",
      "eventLoopUtilization",
      "bytesRead",
      "bytesWritten",
    ] as const) {
      requireMeasurement(sample[field], field);
    }
    if (sample.eventLoopUtilization > 1) {
      throw new RangeError("eventLoopUtilization must be at most one.");
    }
    if (previous) {
      for (const field of [
        "elapsedMs",
        "cpuUserMicros",
        "cpuSystemMicros",
        "bytesRead",
        "bytesWritten",
      ] as const) {
        if (sample[field] < previous[field]) {
          throw new RangeError(`${field} must not decrease between samples.`);
        }
      }
      rssByteMilliseconds +=
        ((previous.rssBytes + sample.rssBytes) / 2) *
        (sample.elapsedMs - previous.elapsedMs);
    }
    result.peakRssBytes = Math.max(result.peakRssBytes ?? 0, sample.rssBytes);
    result.peakHeapUsedBytes = Math.max(
      result.peakHeapUsedBytes ?? 0,
      sample.heapUsedBytes,
    );
    result.eventLoopDelayP95MaxMs = Math.max(
      result.eventLoopDelayP95MaxMs ?? 0,
      sample.eventLoopDelayP95Ms,
    );
    previous = sample;
  }
  const first = samples[0];
  const last = previous;
  if (!first || !last || last.elapsedMs === first.elapsedMs) return result;
  result.durationMs = last.elapsedMs - first.elapsedMs;
  result.cpuSeconds =
    (last.cpuUserMicros -
      first.cpuUserMicros +
      last.cpuSystemMicros -
      first.cpuSystemMicros) /
    1_000_000;
  result.meanCpuCores = result.cpuSeconds / (result.durationMs / 1000);
  result.meanRssBytes = rssByteMilliseconds / result.durationMs;
  result.bytesRead = last.bytesRead - first.bytesRead;
  result.bytesWritten = last.bytesWritten - first.bytesWritten;
  return result;
};
