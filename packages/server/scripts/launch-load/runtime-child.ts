import type { Socket } from "node:net";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { createAirJamServer } from "../../src/index.js";
import { installServerProcessSignalHandlers } from "../../src/process-lifecycle.js";
import {
  LAUNCH_LOAD_TRAFFIC,
  type RuntimeMessage,
  type RuntimeSample,
} from "./contract.js";

const send = (message: RuntimeMessage): void => {
  if (process.connected)
    process.send?.(message, undefined, undefined, () => undefined);
};

const main = async (): Promise<void> => {
  const startedAt = performance.now();
  const runtime = createAirJamServer();
  const sockets = new Set<Socket>();
  let closedBytesRead = 0;
  let closedBytesWritten = 0;
  // Observe public HTTP TCP sockets before listen; closed sockets retain their
  // contribution without retaining the sockets themselves for the whole run.
  runtime.httpServer.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => {
      closedBytesRead += socket.bytesRead;
      closedBytesWritten += socket.bytesWritten;
      sockets.delete(socket);
    });
  });

  const delay = monitorEventLoopDelay({ resolution: 10 });
  delay.enable();
  let previousUtilization = performance.eventLoopUtilization();
  let sampleTimer: ReturnType<typeof setInterval> | undefined;
  let stopping = false;
  const sample = (): void => {
    const cpu = process.cpuUsage();
    const memory = process.memoryUsage();
    const utilization = performance.eventLoopUtilization();
    const intervalUtilization = performance.eventLoopUtilization(
      utilization,
      previousUtilization,
    );
    previousUtilization = utilization;
    let bytesRead = closedBytesRead;
    let bytesWritten = closedBytesWritten;
    for (const socket of sockets) {
      bytesRead += socket.bytesRead;
      bytesWritten += socket.bytesWritten;
    }
    const value: RuntimeSample = {
      elapsedMs: performance.now() - startedAt,
      cpuUserMicros: cpu.user,
      cpuSystemMicros: cpu.system,
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      eventLoopDelayP95Ms: delay.count ? delay.percentile(95) / 1_000_000 : 0,
      eventLoopUtilization: intervalUtilization.utilization,
      bytesRead,
      bytesWritten,
    };
    send({ type: "sample", sample: value });
    delay.reset();
  };
  const stopSampling = (): void => {
    if (stopping) return;
    stopping = true;
    sample();
    clearInterval(sampleTimer);
    delay.disable();
  };
  process.once("SIGTERM", stopSampling);
  process.once("SIGINT", stopSampling);
  const removeLifecycleHandlers = installServerProcessSignalHandlers({
    runtime,
  });
  runtime.onTerminalFailure(() => {
    send({
      type: "failure",
      message: "Realtime admission authority was lost.",
    });
    stopSampling();
  });
  // Parent loss follows the same bounded production drain as SIGTERM. The IPC
  // channel and sampler must not keep an otherwise stopped runtime alive.
  process.once("disconnect", () => process.emit("SIGTERM", "SIGTERM"));
  process.channel?.unref();

  try {
    const port = await runtime.start(0);
    if (stopping) {
      await runtime.stop();
      return;
    }
    send({ type: "ready", url: `http://127.0.0.1:${port}`, pid: process.pid });
    sample();
    sampleTimer = setInterval(sample, LAUNCH_LOAD_TRAFFIC.sampleIntervalMs);
    sampleTimer.unref();
  } catch {
    process.exitCode = 1;
    send({
      type: "failure",
      message: "Realtime load-test runtime failed to start.",
    });
    stopSampling();
    removeLifecycleHandlers();
    await runtime.stop();
  }
};

void main().catch(() => {
  process.exitCode = 1;
  send({
    type: "failure",
    message: "Realtime load-test runtime initialization or cleanup failed.",
  });
});
