import { REALTIME_ADMISSION_POLICY } from "@air-jam/database-contract";
import { ErrorCode } from "@air-jam/sdk/protocol";
import { Command, Option } from "commander";
import { execFileSync, fork, type ChildProcess } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";
import { finished } from "node:stream/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { io, type Socket } from "socket.io-client";
import {
  createDatabaseFaultProxy,
  validateLocalDatabaseUrl,
} from "../../tests/helpers/postgres-fixture.js";
import {
  LAUNCH_LOAD_PROFILES,
  LAUNCH_LOAD_TRAFFIC as traffic,
  type RuntimeMessage,
  type RuntimeSample,
} from "./contract.js";
import { createLaunchDatabase } from "./fixture.js";
import { LatencyHistogram, summarizeRuntimeSamples } from "./metrics.js";

type Ack = { ok: boolean; roomId?: string; code?: string; message?: string };
type Client = {
  socket: Socket;
  id: string;
  sequence: number;
  receivedSequence: number;
  stateRevision: number;
  ready: boolean;
};
type Room = { host: Socket; id: string; clients: Client[]; sequence: number };
type Flow = {
  sent: number;
  received: number;
  latency: LatencyHistogram;
  peers: Map<string, { sent: number; received: number }>;
};
type Phase = {
  name: string;
  start: number;
  end?: number;
  rooms: number;
  controllers: number;
  input: Flow;
  state: Flow;
  scheduler: LatencyHistogram;
  ticks: number;
};
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const sourceFingerprint = () => {
  const paths = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      "packages/server",
      "packages/sdk",
      "packages/database-contract",
      "packages/operations-contract",
      "packages/env",
      "packages/harness",
      "packages/devtools-core",
      "patches",
      "package.json",
      "pnpm-lock.yaml",
      "tsconfig.base.json",
    ],
    { cwd: root, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  for (const file of paths) {
    hash.update(file + "\0");
    const absolute = path.join(root, file);
    hash.update(existsSync(absolute) ? readFileSync(absolute) : "<deleted>");
    hash.update("\0");
  }
  return hash.digest("hex");
};
const flow = (): Flow => ({
  sent: 0,
  received: 0,
  latency: new LatencyHistogram(),
  peers: new Map(),
});
const safeError = (error: unknown) =>
  (error instanceof Error ? error.message : String(error))
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted database URL]")
    .slice(0, 2000);
const tally = (metric: Flow, id: string, field: "sent" | "received") => {
  metric[field]++;
  const peer = metric.peers.get(id) ?? { sent: 0, received: 0 };
  peer[field]++;
  metric.peers.set(id, peer);
};
const summarizeFlow = (metric: Flow) => ({
  sent: metric.sent,
  received: metric.received,
  lossPercent: metric.sent
    ? (Math.max(0, metric.sent - metric.received) / metric.sent) * 100
    : null,
  worstPeerLossPercent: metric.peers.size
    ? Math.max(
        ...[...metric.peers.values()].map((peer) =>
          peer.sent
            ? (Math.max(0, peer.sent - peer.received) / peer.sent) * 100
            : 100,
        ),
      )
    : null,
  latency: metric.latency.summarize(),
});

async function main() {
  const command = new Command()
    .addOption(
      new Option("--profile <profile>")
        .choices(Object.keys(LAUNCH_LOAD_PROFILES))
        .default("smoke"),
    )
    .option("--output <path>", "New evidence directory; never overwritten")
    .option("--json")
    .parse();
  const options = command.opts<{
    profile: keyof typeof LAUNCH_LOAD_PROFILES;
    output?: string;
    json?: boolean;
  }>();
  const baseUrl = validateLocalDatabaseUrl(
    process.env.AIR_JAM_TEST_DATABASE_URL,
  );
  const config = LAUNCH_LOAD_PROFILES[options.profile];
  const sourceAtStart = sourceFingerprint();
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const dirty = Boolean(
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
  );
  const runId = `launch-load-${new Date().toISOString().replace(/[^0-9]/g, "")}-${randomUUID().slice(0, 8)}`;
  const output = path.resolve(
    options.output ?? path.join(root, ".airjam", "launch-load", runId),
  );
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output);
  const log = createWriteStream(path.join(output, "runtime.ndjson"));
  const observations = createWriteStream(
    path.join(output, "observations.ndjson"),
  );
  const note = (event: string, details: Record<string, unknown> = {}) => {
    const entry = { at: new Date().toISOString(), event, ...details };
    observations.write(`${JSON.stringify(entry)}\n`);
    if (event !== "sample") process.stderr.write(`${JSON.stringify(entry)}\n`);
  };
  const abort = new AbortController();
  const samples: RuntimeSample[] = [];
  const databaseSamples: Array<{
    at: number;
    server: number;
    total: number;
    active: number;
  }> = [];
  const membershipSamples: Array<{
    at: number;
    phase: string;
    rooms: number;
    controllers: number;
  }> = [];
  const phases: Phase[] = [];
  const rooms: Room[] = [];
  const sockets = new Set<Socket>();
  const expectedDisconnects = new WeakSet<Socket>();
  const violations: string[] = [];
  const unexpectedDisconnects: string[] = [];
  const runtimeFailures: Array<{ phase: string; code: string }> = [];
  let fixture: Awaited<ReturnType<typeof createLaunchDatabase>> | undefined;
  let proxy: Awaited<ReturnType<typeof createDatabaseFaultProxy>> | undefined;
  let child: ChildProcess | undefined;
  let runtimeUrl = "";
  let phase: Phase | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sampler: ReturnType<typeof setInterval> | undefined;
  let sampling = false;
  let stopping = false;
  let failure: string | null = null;
  let cleanupError: string | null = null;
  let fixtureDisposed = false;
  let nextClient = 0;
  let protocolViolations = 0;
  let overload: Record<string, unknown> = {};
  let recovery: Record<string, unknown> = {};
  const interrupt = () => abort.abort(new Error("Rehearsal interrupted."));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const pause = (ms: number) => sleep(ms, undefined, { signal: abort.signal });
  const disconnect = (socket: Socket) => {
    expectedDisconnects.add(socket);
    socket.disconnect();
    sockets.delete(socket);
  };
  const connectClient = async () => {
    abort.signal.throwIfAborted();
    const n = nextClient++;
    const socket = io(runtimeUrl, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: traffic.acknowledgementTimeoutMs,
      extraHeaders: {
        Origin: "http://127.0.0.1",
        "X-Forwarded-For": `198.18.${Math.floor(n / 250)}.${(n % 250) + 1}`,
      },
    });
    sockets.add(socket);
    socket.on("disconnect", (reason) => {
      if (!expectedDisconnects.has(socket) && !stopping) {
        if (unexpectedDisconnects.length < 20)
          unexpectedDisconnects.push(reason);
      }
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        disconnect(socket);
        reject(new Error("Socket connection deadline exceeded."));
      }, traffic.acknowledgementTimeoutMs);
      socket.once("connect", () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.once("connect_error", (error) => {
        clearTimeout(timeout);
        disconnect(socket);
        reject(error);
      });
    });
    return socket;
  };
  const ack = async (
    socket: Socket,
    event: string,
    payload: unknown,
  ): Promise<Ack> =>
    socket
      .timeout(traffic.acknowledgementTimeoutMs)
      .emitWithAck(event, payload);
  const bootstrap = async () => {
    const host = await connectClient();
    const result = await ack(host, "host:bootstrap", {
      appId: fixture!.apps[nextClient % fixture!.apps.length],
      hostSessionKind: "game",
    });
    if (!result.ok) {
      disconnect(host);
      throw new Error(`Bootstrap rejected: ${result.code ?? result.message}`);
    }
    return host;
  };
  const admitRoom = async (withControllers: boolean) => {
    const host = await bootstrap();
    const result = await ack(host, "host:createRoom", {
      maxPlayers: traffic.controllersPerRoom,
    });
    if (!result.ok || !result.roomId) {
      disconnect(host);
      return result;
    }
    const room: Room = { host, id: result.roomId, clients: [], sequence: 0 };
    rooms.push(room);
    host.on(
      "server:input",
      (message: {
        roomId: string;
        controllerId: string;
        input?: {
          runId: string;
          phase: string;
          sequence: number;
          sentAt: number;
        };
      }) => {
        const input = message.input;
        if (input?.runId !== runId) return;
        const client = room.clients.find(
          (item) => item.id === message.controllerId,
        );
        if (
          message.roomId !== room.id ||
          !client ||
          input.sequence <= client.receivedSequence
        ) {
          protocolViolations++;
          return;
        }
        client.receivedSequence = input.sequence;
        const owner = phases.find((item) => item.name === input.phase);
        if (owner) {
          tally(owner.input, client.id, "received");
          owner.input.latency.record(performance.now() - input.sentAt);
        }
      },
    );
    if (withControllers)
      for (let i = 0; i < traffic.controllersPerRoom; i++) {
        const socket = await connectClient();
        const id = `load-controller-${nextClient}`;
        const client: Client = {
          socket,
          id,
          sequence: 0,
          receivedSequence: 0,
          stateRevision: -1,
          ready: false,
        };
        room.clients.push(client);
        socket.on(
          "airjam:state_sync",
          (message: {
            roomId: string;
            revision: number;
            data?: { load?: { runId: string; phase: string; sentAt: number } };
          }) => {
            const state = message.data?.load;
            if (state?.runId !== runId) return;
            if (
              message.roomId !== room.id ||
              message.revision <= client.stateRevision
            ) {
              protocolViolations++;
              return;
            }
            client.stateRevision = message.revision;
            const owner = phases.find((item) => item.name === state.phase);
            if (owner) {
              tally(owner.state, id, "received");
              owner.state.latency.record(performance.now() - state.sentAt);
            }
          },
        );
        const joined = await ack(socket, "controller:join", {
          roomId: room.id,
          controllerId: id,
          deviceId: `device-${id}`,
          nickname: id,
        });
        if (!joined.ok)
          throw new Error(
            `Controller admission rejected: ${joined.code ?? joined.message}`,
          );
        client.ready = true;
      }
    return result;
  };
  const health = async () => {
    const response = await fetch(`${runtimeUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return (await response.json()) as {
      rooms: number;
      controllers: number;
      realtimeAdmission?: { acceptingNewWork: boolean };
    };
  };
  const until = async (
    predicate: () => Promise<boolean>,
    timeoutMs: number,
    label: string,
  ) => {
    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      if (await predicate()) return;
      await pause(250);
    }
    throw new Error(`Deadline exceeded: ${label}`);
  };
  const beginPhase = (name: string) => {
    phase = {
      name,
      start: performance.now(),
      rooms: rooms.length,
      controllers: rooms.reduce((sum, room) => sum + room.clients.length, 0),
      input: flow(),
      state: flow(),
      scheduler: new LatencyHistogram(),
      ticks: 0,
    };
    phases.push(phase);
    note("phase_started", {
      name,
      rooms: phase.rooms,
      controllers: phase.controllers,
    });
    return phase;
  };
  const finishPhase = async () => {
    if (phase) phase.end = performance.now();
    phase = undefined;
    await pause(500);
  };
  const closeExtraRooms = async (keep: number) => {
    const removed = rooms.splice(keep);
    for (const room of removed) {
      for (const client of room.clients) disconnect(client.socket);
      disconnect(room.host);
    }
    await until(
      async () => (await health()).rooms === keep,
      15_000,
      "room cleanup",
    );
  };
  const runTimedPhase = async (name: string, durationMs: number) => {
    beginPhase(name);
    const snapshot = await health();
    membershipSamples.push({
      at: performance.now(),
      phase: name,
      rooms: snapshot.rooms,
      controllers: snapshot.controllers,
    });
    if (
      snapshot.rooms !== phase!.rooms ||
      snapshot.controllers !== phase!.controllers
    )
      throw new Error(
        `${name} membership differs from the intended footprint.`,
      );
    await pause(durationMs);
    await finishPhase();
  };
  try {
    note("fixture_start", { runId, profile: options.profile });
    fixture = await createLaunchDatabase(baseUrl, runId);
    proxy = await createDatabaseFaultProxy(fixture.url);
    const runtimeLabel = `${runId}:runtime`;
    child = fork(
      fileURLToPath(new URL("./runtime-child.ts", import.meta.url)),
      [],
      {
        execArgv: ["--import", "tsx"],
        cwd: path.join(root, "packages/server"),
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: {
          PATH: process.env.PATH,
          TMPDIR: process.env.TMPDIR,
          LANG: process.env.LANG,
          NODE_ENV: "test",
          AIRJAM_OPERATIONAL_ENVIRONMENT: "production",
          AIR_JAM_AUTH_MODE: "required",
          DATABASE_URL: proxy.url,
          PGAPPNAME: runtimeLabel,
          AIR_JAM_ALLOWED_ORIGINS: "http://127.0.0.1",
          AIR_JAM_TRUST_PROXY_HEADERS: "enabled",
          AIR_JAM_DEV_LOG_COLLECTOR: "disabled",
          AIR_JAM_LOG_LEVEL: "warn",
        },
      },
    );
    child.stdout!.pipe(log, { end: false });
    child.stderr!.pipe(log, { end: false });
    for (const stream of [child.stdout!, child.stderr!]) {
      createInterface({ input: stream }).on("line", (line) => {
        let entry: {
          failure?: { code?: string };
          level?: string;
          msg?: string;
        };
        try {
          entry = JSON.parse(line);
        } catch {
          return;
        }
        if (
          entry.failure?.code ||
          entry.level === "error" ||
          entry.level === "fatal"
        ) {
          const phaseName = stopping
            ? "cleanup"
            : (phase?.name ?? "transition");
          if (runtimeFailures.length < 20)
            runtimeFailures.push({
              phase: phaseName,
              code: entry.failure?.code ?? entry.level!,
            });
          if (
            !stopping &&
            !["dependency-outage", "dependency-recovery"].includes(phaseName)
          )
            violations.push(
              `Runtime failure outside dependency drill: ${entry.failure?.code ?? entry.level}.`,
            );
        }
      });
    }
    const ready = new Promise<string>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error("Runtime startup deadline exceeded.")),
        30_000,
      );
      child!.on("message", (message: RuntimeMessage) => {
        if (message.type === "ready") {
          clearTimeout(deadline);
          resolve(message.url);
        } else if (message.type === "sample") samples.push(message.sample);
        else if (message.type === "failure") {
          clearTimeout(deadline);
          reject(new Error(message.message));
          abort.abort(new Error(message.message));
        }
      });
      child!.once("error", (error) => {
        clearTimeout(deadline);
        reject(error);
        abort.abort(error);
      });
      child!.once("exit", (code, signal) => {
        clearTimeout(deadline);
        if (!stopping) {
          const error = new Error(
            `Runtime exited unexpectedly (${code ?? signal}).`,
          );
          reject(error);
          abort.abort(error);
        }
      });
    });
    runtimeUrl = await ready;
    await until(
      async () =>
        (
          await fetch(`${runtimeUrl}/ready`, {
            signal: AbortSignal.timeout(3000),
          })
        ).ok,
      15_000,
      "database-backed readiness",
    );
    const sampleDatabase = async () => {
      if (sampling || stopping) return;
      sampling = true;
      try {
        const [counts] = await fixture!
          .observer`select count(*)::integer as total,
          count(*) filter(where application_name=${runtimeLabel})::integer as server,
          count(*) filter(where application_name=${runtimeLabel} and state='active')::integer as active
          from pg_stat_activity where datname=current_database()`;
        const snapshot = {
          at: performance.now(),
          server: Number(counts!.server),
          total: Number(counts!.total),
          active: Number(counts!.active),
        };
        databaseSamples.push(snapshot);
        const sampledPhase = phase;
        const membership = await health();
        membershipSamples.push({
          at: performance.now(),
          phase: sampledPhase?.name ?? "transition",
          rooms: membership.rooms,
          controllers: membership.controllers,
        });
        if (
          sampledPhase &&
          ["baseline", "burst"].includes(sampledPhase.name) &&
          (membership.rooms !== sampledPhase.rooms ||
            membership.controllers !== sampledPhase.controllers)
        )
          violations.push(
            `${sampledPhase.name} membership changed under load.`,
          );
        note("sample", {
          phase: phase?.name ?? "transition",
          database: snapshot,
          runtime: samples.at(-1) ?? null,
        });
      } catch (error) {
        violations.push(
          `Database observation unavailable: ${safeError(error)}`,
        );
      } finally {
        sampling = false;
      }
    };
    sampler = setInterval(
      () => void sampleDatabase(),
      traffic.sampleIntervalMs,
    );
    await sampleDatabase();
    for (let i = 0; i < config.rooms; i++) {
      const result = await admitRoom(true);
      if (!result.ok) throw new Error(`Baseline room rejected: ${result.code}`);
    }
    let lastTick = performance.now();
    let nextState = lastTick;
    let nextTick = lastTick + 1000 / traffic.inputHz;
    const tick = () => {
      const now = performance.now();
      phase?.scheduler.record(
        Math.max(0, now - lastTick - 1000 / traffic.inputHz),
      );
      if (phase) phase.ticks++;
      lastTick = now;
      for (const room of rooms) {
        for (const client of room.clients) {
          if (!client.ready) continue;
          if (phase) tally(phase.input, client.id, "sent");
          client.socket.emit("controller:input", {
            roomId: room.id,
            controllerId: client.id,
            input: {
              runId,
              phase: phase?.name ?? "",
              sequence: ++client.sequence,
              sentAt: performance.now(),
              vector: { x: 1, y: 0 },
              action: true,
            },
          });
        }
        if (now >= nextState) {
          for (const client of room.clients)
            if (phase && client.ready) tally(phase.state, client.id, "sent");
          room.host.emit("host:state_sync", {
            roomId: room.id,
            storeDomain: "default",
            revision: ++room.sequence,
            data: {
              load: {
                runId,
                phase: phase?.name ?? "",
                sentAt: performance.now(),
              },
              players: room.clients.map((client, index) => ({
                id: client.id,
                x: index * 10,
                y: room.sequence % 100,
                score: index,
              })),
            },
          });
        }
      }
      if (now >= nextState)
        nextState +=
          (Math.floor((now - nextState) / (1000 / traffic.stateHz)) + 1) *
          (1000 / traffic.stateHz);
      nextTick += 1000 / traffic.inputHz;
      const completedAt = performance.now();
      // Keep cadence without accumulating timer drift or fabricating a catch-up
      // burst when the load generator itself cannot sustain the requested rate.
      if (completedAt > nextTick)
        nextTick +=
          Math.ceil((completedAt - nextTick) / (1000 / traffic.inputHz)) *
          (1000 / traffic.inputHz);
      timer = setTimeout(tick, Math.max(1, nextTick - completedAt));
    };
    timer = setTimeout(tick, 1000 / traffic.inputHz);
    await runTimedPhase("baseline", config.baselineMs);
    for (let i = 0; i < config.rooms; i++) {
      const result = await admitRoom(true);
      if (!result.ok)
        throw new Error(`Twice-load room rejected: ${result.code}`);
    }
    await runTimedPhase("burst", config.burstMs);
    beginPhase("overload");
    while (rooms.length < REALTIME_ADMISSION_POLICY.burstRooms) {
      const result = await admitRoom(false);
      if (!result.ok)
        throw new Error(`Below-cap room rejected: ${result.code}`);
    }
    const rejected = await admitRoom(false);
    overload = {
      peakRooms: rooms.length,
      attemptedRooms: rooms.length + 1,
      rejection: rejected,
    };
    if (
      rejected.ok ||
      rejected.code !== ErrorCode.SERVICE_UNAVAILABLE ||
      rejected.message !==
        "Air Jam is at room capacity. Please try again shortly."
    )
      violations.push(
        `Expected global capacity rejection; received ${rejected.code ?? rejected.ok}.`,
      );
    await pause(2000);
    await finishPhase();
    await closeExtraRooms(config.rooms);
    const probe = await bootstrap();
    beginPhase("dependency-outage");
    const outageStarted = performance.now();
    proxy.interrupt();
    const intake = ack(probe, "host:createRoom", { maxPlayers: 4 }).then(
      (result) => ({ kind: "ack", result }),
      (error) => ({ kind: "timeout", message: safeError(error) }),
    );
    let observedUnready = false;
    while (performance.now() - outageStarted < traffic.databaseOutageMs) {
      const response = await fetch(`${runtimeUrl}/ready`, {
        signal: AbortSignal.timeout(3000),
      });
      if (response.status === 503) observedUnready = true;
      await pause(250);
    }
    const duringOutage = await intake;
    disconnect(probe);
    proxy.restore();
    const restoredAt = performance.now();
    await finishPhase();
    beginPhase("dependency-recovery");
    await until(
      async () =>
        (
          await fetch(`${runtimeUrl}/ready`, {
            signal: AbortSignal.timeout(3000),
          })
        ).ok,
      20_000,
      "database authority recovery",
    );
    const admitted = await admitRoom(true);
    recovery = {
      outageMs: restoredAt - outageStarted,
      recoveryMs: performance.now() - restoredAt,
      observedUnready,
      duringOutage,
      freshAdmission: admitted.ok,
    };
    if (!observedUnready || !admitted.ok)
      violations.push("Dependency failure or recovery was not proven.");
    if ("result" in duringOutage && duringOutage.result.ok)
      violations.push("New room was admitted during the database outage.");
    await finishPhase();
    await runTimedPhase("recovered", 5000);
    await sampleDatabase();
  } catch (error) {
    failure = safeError(abort.signal.aborted ? abort.signal.reason : error);
    note("failed", { message: failure });
  } finally {
    stopping = true;
    if (phase && !phase.end) phase.end = performance.now();
    if (timer) clearTimeout(timer);
    if (sampler) clearInterval(sampler);
    proxy?.restore();
    for (const socket of sockets) disconnect(socket);
    const cleanupFailures: string[] = [];
    try {
      if (child && child.exitCode === null && child.signalCode === null) {
        await new Promise<void>((resolve, reject) => {
          const deadline = setTimeout(() => {
            child!.kill("SIGKILL");
          }, 35_000);
          child!.once("exit", (code, signal) => {
            clearTimeout(deadline);
            if (signal === "SIGKILL" || code !== 0)
              reject(new Error(`Runtime cleanup failed (${code ?? signal}).`));
            else resolve();
          });
          child!.kill("SIGTERM");
        });
      }
    } catch (error) {
      cleanupFailures.push(safeError(error));
    }
    try {
      await proxy?.close();
    } catch (error) {
      cleanupFailures.push(safeError(error));
    }
    while (sampling) await sleep(25);
    try {
      await fixture?.cleanup();
      fixtureDisposed = Boolean(fixture);
    } catch (error) {
      cleanupFailures.push(safeError(error));
    }
    cleanupError = cleanupFailures.length ? cleanupFailures.join("; ") : null;
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
  }
  for (const item of phases) {
    const duration = (item.end! - item.start) / 1000;
    for (const [name, stream] of [
      ["input", item.input],
      ["state", item.state],
    ] as const) {
      const stats = summarizeFlow(stream);
      if (
        !stats.latency.count ||
        (stats.lossPercent ?? 100) > 2 ||
        (stats.worstPeerLossPercent ?? 100) > 2 ||
        stats.latency.p95Ms > 50
      )
        violations.push(`${item.name} ${name} exceeded loss/latency floor.`);
    }
    if (
      ["baseline", "burst"].includes(item.name) &&
      item.input.sent / duration / item.controllers < traffic.inputHz * 0.97
    )
      violations.push(
        `${item.name} load generator did not sustain requested input rate.`,
      );
    if (
      ["baseline", "burst"].includes(item.name) &&
      item.state.sent / duration / item.controllers < traffic.stateHz * 0.97
    )
      violations.push(
        `${item.name} load generator did not sustain requested state rate.`,
      );
  }
  if (!databaseSamples.some((item) => item.server > 0))
    violations.push("Runtime database connection attribution was not proven.");
  if (unexpectedDisconnects.length || protocolViolations)
    violations.push(
      "Unexpected disconnects or cross-room/duplicate input detected.",
    );
  const sourceAtEnd = sourceFingerprint();
  if (sourceAtEnd !== sourceAtStart)
    violations.push("Runtime or rehearsal source changed during measurement.");
  const report = {
    contractVersion: 1,
    runId,
    profile: options.profile,
    passed: !failure && !cleanupError && violations.length === 0,
    releaseQualified:
      options.profile === "release" &&
      !failure &&
      !cleanupError &&
      violations.length === 0,
    revision,
    dirty,
    source: { algorithm: "sha256", atStart: sourceAtStart, atEnd: sourceAtEnd },
    machine: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      cpuModel: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
      memoryBytes: os.totalmem(),
    },
    scope:
      "Isolated local realtime/database rehearsal; not provider capacity, browser rendering, or billing evidence.",
    config: {
      ...config,
      ...traffic,
      admissionPolicy: REALTIME_ADMISSION_POLICY,
    },
    phases: phases.map((item) => ({
      name: item.name,
      durationMs: item.end! - item.start,
      rooms: item.rooms,
      controllers: item.controllers,
      input: summarizeFlow(item.input),
      state: summarizeFlow(item.state),
      schedulerDelay: item.scheduler.summarize(),
      ticks: item.ticks,
    })),
    runtime: summarizeRuntimeSamples(samples),
    runtimeSamples: samples,
    database: {
      name: fixture?.name ?? null,
      samples: databaseSamples,
      peakServerConnections: databaseSamples.length
        ? Math.max(...databaseSamples.map((item) => item.server))
        : null,
    },
    membershipSamples,
    overload,
    recovery,
    protocolViolations,
    unexpectedDisconnects,
    runtimeFailures,
    violations,
    failure,
    cleanup: {
      runtimeStopped:
        !child || child.exitCode !== null || child.signalCode !== null,
      fixtureDisposed,
      error: cleanupError,
    },
  };
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  log.end();
  observations.end();
  await Promise.all([finished(log), finished(observations)]);
  process.stdout.write(
    options.json
      ? JSON.stringify(report) + "\n"
      : `Launch-load ${report.passed ? "passed" : "failed"}: ${path.join(output, "report.json")}\n`,
  );
  process.exitCode = report.passed ? 0 : 1;
}

void main().catch((error) => {
  process.stderr.write(`Launch-load failed: ${safeError(error)}\n`);
  process.exitCode = 1;
});
