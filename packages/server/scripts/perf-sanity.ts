import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { io, type Socket } from "socket.io-client";
import { createAirJamServer } from "../src/index.ts";

type GenericEventMap = Record<string, (...args: unknown[]) => void>;
type GenericSocket = Socket<GenericEventMap, GenericEventMap>;

interface PerfConfig {
  controllers: number;
  hz: number;
  durationMs: number;
  warmupMs: number;
  strict: boolean;
}

interface Stats {
  p50: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
}

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

const hasFlag = (flag: string): boolean => {
  return process.argv.includes(`--${flag}`);
};

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

const toFixedMs = (value: number): string => `${value.toFixed(2)} ms`;

const buildConfig = (): PerfConfig => {
  return {
    controllers: Math.min(Math.floor(parseNumberArg("controllers", 8)), 16),
    hz: Math.floor(parseNumberArg("hz", 30)),
    durationMs: Math.floor(parseNumberArg("durationMs", 90_000)),
    warmupMs: Math.floor(parseNumberArg("warmupMs", 3_000)),
    strict: hasFlag("strict"),
  };
};

async function main(): Promise<void> {
  const config = buildConfig();
  const runId = `perf-${Date.now()}`;

  const runtime = createAirJamServer({
    authService: {
      verifyApiKey: async () => ({ isVerified: true }),
    },
  });

  const sockets: GenericSocket[] = [];
  const intervals: NodeJS.Timeout[] = [];
  let host: GenericSocket | null = null;

  try {
    const port = await runtime.start(0);
    const baseUrl = `http://127.0.0.1:${port}`;

    host = await connectSocket(baseUrl);
    sockets.push(host);

    const createAck = await emitWithAck<{ ok: boolean; roomId?: string }>(
      host,
      "host:createRoom",
      { maxPlayers: Math.max(config.controllers + 2, 4) },
    );

    if (!createAck.ok || !createAck.roomId) {
      throw new Error("Failed to create room for perf sanity run");
    }

    const roomId = createAck.roomId;
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

    console.log("[perf] warmup...");
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
    const throughputSent = sentCount / durationSec;
    const throughputReceived = receivedCount / durationSec;
    const latency = summarizeLatency(latenciesMs);
    const heapDeltaMb = (heapEnd - heapStart) / (1024 * 1024);

    console.log("\n[perf] Air Jam server input sanity benchmark");
    console.log(`controllers: ${config.controllers}`);
    console.log(`target hz/controller: ${config.hz}`);
    console.log(`measurement duration: ${(durationSec).toFixed(2)} s`);
    console.log(`sent events: ${sentCount}`);
    console.log(`received events: ${receivedCount}`);
    console.log(`drop rate: ${dropRatePct.toFixed(2)}%`);
    console.log(`throughput sent: ${throughputSent.toFixed(2)} evt/s`);
    console.log(`throughput received: ${throughputReceived.toFixed(2)} evt/s`);
    console.log(`latency p50: ${toFixedMs(latency.p50)}`);
    console.log(`latency p95: ${toFixedMs(latency.p95)}`);
    console.log(`latency p99: ${toFixedMs(latency.p99)}`);
    console.log(`latency avg: ${toFixedMs(latency.avg)}`);
    console.log(`latency max: ${toFixedMs(latency.max)}`);
    console.log(`heap delta: ${heapDeltaMb.toFixed(2)} MB`);

    const warnings: string[] = [];
    if (dropRatePct > 2) {
      warnings.push(`High drop rate (${dropRatePct.toFixed(2)}%)`);
    }
    if (latency.p95 > 50) {
      warnings.push(`High p95 latency (${latency.p95.toFixed(2)} ms)`);
    }

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
    for (const handle of intervals) {
      clearInterval(handle);
    }

    for (const socket of sockets) {
      socket.disconnect();
    }

    if (host) {
      host.off("server:input");
    }

    await runtime.stop();
  }
}

main().catch((error) => {
  console.error("[perf] benchmark failed", error);
  process.exitCode = 1;
});
