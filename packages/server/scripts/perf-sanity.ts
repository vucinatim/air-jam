import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { io, type Socket } from "socket.io-client";
import { createNoopRuntimeUsagePublisher } from "../src/analytics/runtime-usage.ts";
import { createAirJamServer } from "../src/index.ts";

type GenericEventMap = Record<string, (...args: unknown[]) => void>;
type GenericSocket = Socket<GenericEventMap, GenericEventMap>;

interface PerfConfig {
  controllers: number;
  hz: number;
  durationMs: number;
  warmupMs: number;
  strict: boolean;
  reconnectControllers: number;
  reconnectCycles: number;
  reconnectPauseMs: number;
}

interface Stats {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
}

interface BaselineScenarioResult {
  sentCount: number;
  receivedCount: number;
  dropRatePct: number;
  throughputSent: number;
  throughputReceived: number;
  durationSec: number;
  latency: Stats;
  heapDeltaMb: number;
}

interface ReconnectScenarioResult {
  attempts: number;
  failures: number;
  resumedFailures: number;
  failureRatePct: number;
  resumedFailureRatePct: number;
  latency: Stats;
}

const BASELINE_THRESHOLDS = {
  maxDropRatePct: 2,
  maxP95LatencyMs: 50,
};

const RECONNECT_THRESHOLDS = {
  maxFailureRatePct: 0,
  maxResumedFailureRatePct: 0,
  maxP95LatencyMs: 150,
};

const parseNumberArg = (flag: string, fallback: number): number => {
  const entry = process.argv.find((arg) => arg.startsWith(`--${flag}=`));
  if (!entry) {
    return fallback;
  }

  const value = Number(entry.split("=")[1]);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return value;
};

const hasFlag = (flag: string): boolean => process.argv.includes(`--${flag}`);

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil((p / 100) * values.length) - 1),
  );

  return values[index] ?? 0;
};

const summarizeLatency = (latencies: number[]): Stats => {
  if (latencies.length === 0) {
    return { p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const total = sorted.reduce((acc, value) => acc + value, 0);

  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
    avg: total / sorted.length,
  };
};

const connectSocket = async (url: string): Promise<GenericSocket> => {
  return await new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    }) as GenericSocket;

    const onConnect = () => {
      socket.off("connect_error", onError);
      resolve(socket);
    };

    const onError = (error: Error) => {
      socket.off("connect", onConnect);
      reject(error);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
};

const emitWithAck = async <TAck>(
  socket: GenericSocket,
  event: string,
  payload: unknown,
): Promise<TAck> => {
  return await new Promise((resolve) => {
    socket.emit(event, payload, (ack: TAck) => resolve(ack));
  });
};

const disconnectClientSocket = async (socket: GenericSocket): Promise<void> => {
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      socket.removeAllListeners();
      resolve();
    };

    if (!socket.connected) {
      socket.disconnect();
      finish();
      return;
    }

    socket.once("disconnect", finish);
    socket.disconnect();
    setTimeout(finish, 100);
  });
};

const toFixedMs = (value: number): string => `${value.toFixed(2)} ms`;

const buildConfig = (): PerfConfig => {
  const controllers = Math.min(
    Math.floor(parseNumberArg("controllers", 8)),
    16,
  );
  return {
    controllers,
    hz: Math.floor(parseNumberArg("hz", 30)),
    durationMs: Math.floor(parseNumberArg("durationMs", 90_000)),
    warmupMs: Math.floor(parseNumberArg("warmupMs", 3_000)),
    strict: hasFlag("strict"),
    reconnectControllers: Math.min(
      controllers,
      Math.floor(parseNumberArg("reconnectControllers", 4)),
    ),
    reconnectCycles: Math.floor(parseNumberArg("reconnectCycles", 10)),
    reconnectPauseMs: Math.floor(parseNumberArg("reconnectPauseMs", 25)),
  };
};

const createPerfRuntime = () =>
  createAirJamServer({
    authService: {
      verifyHostBootstrap: async ({ appId }: { appId?: string }) => ({
        isVerified: true,
        appId,
        verifiedVia: "appId" as const,
      }),
    },
    runtimeUsagePublisher: createNoopRuntimeUsagePublisher(),
  });

const withPerfServer = async <T>(
  run: (baseUrl: string) => Promise<T>,
): Promise<T> => {
  const runtime = createPerfRuntime();
  try {
    const port = await runtime.start(0);
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await runtime.stop();
  }
};

const bootstrapHostAndCreateRoom = async (
  baseUrl: string,
  maxPlayers: number,
): Promise<{ host: GenericSocket; roomId: string }> => {
  const host = await connectSocket(baseUrl);
  const bootstrapAck = await emitWithAck<{ ok: boolean }>(
    host,
    "host:bootstrap",
    {},
  );
  if (!bootstrapAck.ok) {
    host.disconnect();
    throw new Error("Failed to bootstrap host for perf sanity run");
  }

  const createAck = await emitWithAck<{ ok: boolean; roomId?: string }>(
    host,
    "host:createRoom",
    { maxPlayers },
  );
  if (!createAck.ok || !createAck.roomId) {
    host.disconnect();
    throw new Error("Failed to create room for perf sanity run");
  }

  return { host, roomId: createAck.roomId };
};

const runBaselineScenario = async (
  baseUrl: string,
  config: PerfConfig,
): Promise<BaselineScenarioResult> => {
  const sockets: GenericSocket[] = [];
  const intervals: NodeJS.Timeout[] = [];
  let host: GenericSocket | null = null;

  try {
    const hostContext = await bootstrapHostAndCreateRoom(
      baseUrl,
      Math.max(config.controllers + 2, 4),
    );
    host = hostContext.host;
    sockets.push(host);

    const roomId = hostContext.roomId;
    const controllers = await Promise.all(
      Array.from({ length: config.controllers }).map(async (_, index) => {
        const socket = await connectSocket(baseUrl);
        sockets.push(socket);

        const controllerId = `ctrl_perf_${index}`;
        const joinAck = await emitWithAck<{ ok: boolean }>(
          socket,
          "controller:join",
          { roomId, controllerId, nickname: `Perf ${index}` },
        );

        if (!joinAck.ok) {
          throw new Error(`Controller join failed for ${controllerId}`);
        }

        return { socket, controllerId };
      }),
    );

    const runId = `perf-${Date.now()}`;
    let sentCount = 0;
    let receivedCount = 0;
    const latenciesMs: number[] = [];

    host.on("server:input", (...args: unknown[]) => {
      const payload = args[0] as {
        roomId?: string;
        input?: { runId?: string; sentAt?: number };
      };

      if (payload.roomId !== roomId) {
        return;
      }
      if (payload.input?.runId !== runId) {
        return;
      }
      if (typeof payload.input.sentAt !== "number") {
        return;
      }

      receivedCount += 1;
      latenciesMs.push(performance.now() - payload.input.sentAt);
    });

    const intervalMs = Math.max(1, Math.floor(1_000 / config.hz));

    console.log("[perf] baseline warmup...");
    await sleep(config.warmupMs);

    const heapStart = process.memoryUsage().heapUsed;
    const startedAt = performance.now();

    for (const { socket, controllerId } of controllers) {
      const handle = setInterval(() => {
        sentCount += 1;
        socket.emit("controller:input", {
          roomId,
          controllerId,
          input: {
            runId,
            sentAt: performance.now(),
            vector: { x: 1, y: 0 },
            action: true,
          },
        });
      }, intervalMs);

      intervals.push(handle);
    }

    await sleep(config.durationMs);

    for (const handle of intervals) {
      clearInterval(handle);
    }

    await sleep(500);

    const endedAt = performance.now();
    const heapEnd = process.memoryUsage().heapUsed;
    const durationSec = Math.max((endedAt - startedAt) / 1_000, 0.001);
    const dropCount = Math.max(sentCount - receivedCount, 0);
    const dropRatePct = sentCount === 0 ? 0 : (dropCount / sentCount) * 100;

    return {
      sentCount,
      receivedCount,
      dropRatePct,
      throughputSent: sentCount / durationSec,
      throughputReceived: receivedCount / durationSec,
      durationSec,
      latency: summarizeLatency(latenciesMs),
      heapDeltaMb: (heapEnd - heapStart) / (1024 * 1024),
    };
  } finally {
    for (const handle of intervals) {
      clearInterval(handle);
    }
    if (host) {
      host.off("server:input");
    }
    await Promise.all(sockets.map((socket) => disconnectClientSocket(socket)));
  }
};

const runReconnectScenario = async (
  baseUrl: string,
  config: PerfConfig,
): Promise<ReconnectScenarioResult> => {
  const sockets: GenericSocket[] = [];
  let host: GenericSocket | null = null;

  try {
    const hostContext = await bootstrapHostAndCreateRoom(
      baseUrl,
      Math.max(config.reconnectControllers + 2, 4),
    );
    host = hostContext.host;
    sockets.push(host);

    const roomId = hostContext.roomId;
    let controllers = await Promise.all(
      Array.from({ length: config.reconnectControllers }).map(
        async (_, index) => {
          const socket = await connectSocket(baseUrl);
          sockets.push(socket);

          const controllerId = `ctrl_reconnect_${index}`;
          const deviceId = `device_reconnect_${index}`;
          const joinAck = await emitWithAck<{ ok: boolean; resumed?: boolean }>(
            socket,
            "controller:join",
            {
              roomId,
              controllerId,
              deviceId,
              nickname: `Reconnect ${index}`,
            },
          );

          if (!joinAck.ok) {
            throw new Error(
              `Initial reconnect scenario join failed for ${controllerId}`,
            );
          }

          return { socket, controllerId, deviceId };
        },
      ),
    );

    const reconnectLatenciesMs: number[] = [];
    let attempts = 0;
    let failures = 0;
    let resumedFailures = 0;

    console.log("[perf] reconnect churn...");

    for (let cycle = 0; cycle < config.reconnectCycles; cycle += 1) {
      for (const controller of controllers) {
        controller.socket.disconnect();
      }

      await sleep(config.reconnectPauseMs);

      const nextControllers = await Promise.all(
        controllers.map(async ({ controllerId, deviceId }) => {
          attempts += 1;
          const socket = await connectSocket(baseUrl);
          sockets.push(socket);

          const startedAt = performance.now();
          const joinAck = await emitWithAck<{ ok: boolean; resumed?: boolean }>(
            socket,
            "controller:join",
            {
              roomId,
              controllerId,
              deviceId,
              nickname: controllerId,
            },
          );
          reconnectLatenciesMs.push(performance.now() - startedAt);

          if (!joinAck.ok) {
            failures += 1;
          } else if (!joinAck.resumed) {
            resumedFailures += 1;
          }

          return { socket, controllerId, deviceId };
        }),
      );

      controllers = nextControllers;
    }

    const failureRatePct = attempts === 0 ? 0 : (failures / attempts) * 100;
    const resumedFailureRatePct =
      attempts === 0 ? 0 : (resumedFailures / attempts) * 100;

    return {
      attempts,
      failures,
      resumedFailures,
      failureRatePct,
      resumedFailureRatePct,
      latency: summarizeLatency(reconnectLatenciesMs),
    };
  } finally {
    await Promise.all(sockets.map((socket) => disconnectClientSocket(socket)));
  }
};

const printBaselineResult = (result: BaselineScenarioResult): void => {
  console.log("\n[perf] Air Jam server input baseline");
  console.log(`measurement duration: ${result.durationSec.toFixed(2)} s`);
  console.log(`sent events: ${result.sentCount}`);
  console.log(`received events: ${result.receivedCount}`);
  console.log(`drop rate: ${result.dropRatePct.toFixed(2)}%`);
  console.log(`throughput sent: ${result.throughputSent.toFixed(2)} evt/s`);
  console.log(
    `throughput received: ${result.throughputReceived.toFixed(2)} evt/s`,
  );
  console.log(`latency p50: ${toFixedMs(result.latency.p50)}`);
  console.log(`latency p95: ${toFixedMs(result.latency.p95)}`);
  console.log(`latency p99: ${toFixedMs(result.latency.p99)}`);
  console.log(`latency avg: ${toFixedMs(result.latency.avg)}`);
  console.log(`latency max: ${toFixedMs(result.latency.max)}`);
  console.log(`heap delta: ${result.heapDeltaMb.toFixed(2)} MB`);
};

const printReconnectResult = (result: ReconnectScenarioResult): void => {
  console.log("\n[perf] Air Jam controller reconnect churn");
  console.log(`reconnect attempts: ${result.attempts}`);
  console.log(`failed reconnects: ${result.failures}`);
  console.log(`resume misses: ${result.resumedFailures}`);
  console.log(`failure rate: ${result.failureRatePct.toFixed(2)}%`);
  console.log(
    `resume failure rate: ${result.resumedFailureRatePct.toFixed(2)}%`,
  );
  console.log(`reconnect latency p50: ${toFixedMs(result.latency.p50)}`);
  console.log(`reconnect latency p95: ${toFixedMs(result.latency.p95)}`);
  console.log(`reconnect latency p99: ${toFixedMs(result.latency.p99)}`);
  console.log(`reconnect latency avg: ${toFixedMs(result.latency.avg)}`);
  console.log(`reconnect latency max: ${toFixedMs(result.latency.max)}`);
};

const collectBaselineWarnings = (result: BaselineScenarioResult): string[] => {
  const warnings: string[] = [];
  if (result.dropRatePct > BASELINE_THRESHOLDS.maxDropRatePct) {
    warnings.push(
      `Baseline drop rate exceeded threshold (${result.dropRatePct.toFixed(2)}% > ${BASELINE_THRESHOLDS.maxDropRatePct.toFixed(2)}%)`,
    );
  }
  if (result.latency.p95 > BASELINE_THRESHOLDS.maxP95LatencyMs) {
    warnings.push(
      `Baseline p95 latency exceeded threshold (${result.latency.p95.toFixed(2)} ms > ${BASELINE_THRESHOLDS.maxP95LatencyMs.toFixed(2)} ms)`,
    );
  }
  return warnings;
};

const collectReconnectWarnings = (
  result: ReconnectScenarioResult,
): string[] => {
  const warnings: string[] = [];
  if (result.failureRatePct > RECONNECT_THRESHOLDS.maxFailureRatePct) {
    warnings.push(
      `Reconnect failure rate exceeded threshold (${result.failureRatePct.toFixed(2)}% > ${RECONNECT_THRESHOLDS.maxFailureRatePct.toFixed(2)}%)`,
    );
  }
  if (
    result.resumedFailureRatePct > RECONNECT_THRESHOLDS.maxResumedFailureRatePct
  ) {
    warnings.push(
      `Reconnect resume failure rate exceeded threshold (${result.resumedFailureRatePct.toFixed(2)}% > ${RECONNECT_THRESHOLDS.maxResumedFailureRatePct.toFixed(2)}%)`,
    );
  }
  if (result.latency.p95 > RECONNECT_THRESHOLDS.maxP95LatencyMs) {
    warnings.push(
      `Reconnect p95 latency exceeded threshold (${result.latency.p95.toFixed(2)} ms > ${RECONNECT_THRESHOLDS.maxP95LatencyMs.toFixed(2)} ms)`,
    );
  }
  return warnings;
};

async function main(): Promise<void> {
  const config = buildConfig();
  const previousControllerResumeLeaseMs =
    process.env.AIR_JAM_CONTROLLER_RESUME_LEASE_MS;

  try {
    process.env.AIR_JAM_CONTROLLER_RESUME_LEASE_MS = "50";

    const baseline = await withPerfServer((baseUrl) =>
      runBaselineScenario(baseUrl, config),
    );
    printBaselineResult(baseline);

    const reconnect = await withPerfServer((baseUrl) =>
      runReconnectScenario(baseUrl, config),
    );
    printReconnectResult(reconnect);

    const warnings = [
      ...collectBaselineWarnings(baseline),
      ...collectReconnectWarnings(reconnect),
    ];

    if (warnings.length > 0) {
      console.warn("\n[perf] warnings:");
      for (const warning of warnings) {
        console.warn(`- ${warning}`);
      }
    }

    if (config.strict && warnings.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (previousControllerResumeLeaseMs === undefined) {
      delete process.env.AIR_JAM_CONTROLLER_RESUME_LEASE_MS;
    } else {
      process.env.AIR_JAM_CONTROLLER_RESUME_LEASE_MS =
        previousControllerResumeLeaseMs;
    }
  }
}

main().catch((error) => {
  console.error("[perf] benchmark failed", error);
  process.exitCode = 1;
});
