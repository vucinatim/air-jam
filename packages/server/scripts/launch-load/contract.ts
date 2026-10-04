export interface RuntimeSample {
  elapsedMs: number;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  rssBytes: number;
  heapUsedBytes: number;
  eventLoopDelayP95Ms: number;
  eventLoopUtilization: number;
  bytesRead: number;
  bytesWritten: number;
}

export type RuntimeMessage =
  | { type: "ready"; url: string; pid: number }
  | { type: "sample"; sample: RuntimeSample }
  | { type: "failure"; message: string };

export interface LatencySummary {
  count: number;
  averageMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  overflowCount: number;
  resolutionMs: number;
}

export const LAUNCH_LOAD_PROFILES = {
  smoke: { rooms: 2, baselineMs: 2_000, burstMs: 2_000 },
  release: { rooms: 100, baselineMs: 30 * 60_000, burstMs: 5 * 60_000 },
} as const;

export const LAUNCH_LOAD_TRAFFIC = {
  controllersPerRoom: 4,
  inputHz: 30,
  stateHz: 10,
  sampleIntervalMs: 5_000,
  databaseOutageMs: 12_000,
  acknowledgementTimeoutMs: 8_000,
} as const;
