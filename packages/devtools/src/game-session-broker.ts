import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { z } from "zod";
import { currentRoomObserver } from "./current-room-observation.js";
import { takeDecisionProviderFromEnvironment } from "./decision-provider.js";
import { GameRunOwner } from "./game-run-owner.js";
import {
  GAME_RUN_PROTOCOL_VERSION,
  GAME_SESSION_BROKER_STATE_FILE,
  MAXIMUM_GAME_RUN_MS,
} from "./game-run-protocol.js";
import {
  gameRunWatchRequestSchema,
  GameRunWatchWriter,
  readGameRunWatchStream,
  type GameRunWatchEvent,
} from "./game-run-watch.js";
import {
  gameSessionBrokerRequestSchema,
  type GameSessionBrokerRequest,
} from "./game-session-protocol.js";
import { createGameSessionRuntime } from "./game-session-runtime.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import { assertProcessScopesConfirmed } from "./managed-process-scope.js";

const stateSchema = z
  .object({
    schemaVersion: z.literal(1),
    instanceId: z.uuid(),
    pid: z.number().int().positive(),
    projectDir: z.string().min(1),
    origin: z.string().regex(/^http:\/\/127\.0\.0\.1:\d+$/),
    secret: z.string().min(40),
    startedAt: z.iso.datetime(),
  })
  .strict();
export type AirJamGameSessionBrokerState = z.infer<typeof stateSchema>;
export type AirJamGameSessionBrokerOperation = GameSessionBrokerRequest;
export type AirJamGameSessionBrokerHealth = {
  ok: true;
  instanceId: string;
  pid: number;
  projectDir: string;
  activeSessionCount: number;
  startedAt: string;
  draining: boolean;
  processScopeError: string | null;
  gameRunProtocolVersion: number;
  cleanupFailures: Array<{ gameSessionId: string; message: string }>;
};

const SESSION_IDLE_MS = 15 * 60_000;
const SESSION_MAXIMUM_MS = 60 * 60_000;
const EMPTY_OWNER_IDLE_MS = 5 * 60_000;
if (MAXIMUM_GAME_RUN_MS >= SESSION_IDLE_MS)
  throw new Error(
    "Run lifetime must remain below the session idle lease until activity renewal is introduced.",
  );
export const resolveGameSessionBrokerStatePath = (projectDir: string) =>
  path.join(projectDir, GAME_SESSION_BROKER_STATE_FILE);

export async function readGameSessionBrokerState(projectDir: string) {
  let source: string;
  try {
    source = await readFile(
      resolveGameSessionBrokerStatePath(projectDir),
      "utf8",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    return stateSchema.parse(JSON.parse(source));
  } catch {
    return null;
  }
}

export async function requestGameSessionBroker<TResult>({
  state,
  request,
}: {
  state: AirJamGameSessionBrokerState;
  request: AirJamGameSessionBrokerOperation;
}): Promise<TResult> {
  const operation = gameSessionBrokerRequestSchema.parse(request);
  const timeoutMs =
    operation.operation === "health"
      ? 1500
      : operation.operation === "shutdown" ||
          operation.operation === "run.stop" ||
          operation.operation === "run.stop-all" ||
          operation.operation === "run.cancel"
        ? 150_000
        : "input" in operation && "timeoutMs" in operation.input
          ? Math.max(30_000, (operation.input.timeoutMs ?? 90_000) + 60_000)
          : 30_000;
  const response = await fetch(`${state.origin}/v1/game-session`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${state.secret}`,
      "x-airjam-owner": state.instanceId,
      "content-type": "application/json",
    },
    body: JSON.stringify(operation),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const result = (await response.json()) as {
    ok?: boolean;
    result?: TResult;
    error?: { message?: string };
  };
  if (!response.ok || result.ok !== true)
    throw new Error(
      result.error?.message ??
        `Game session broker request failed with HTTP ${response.status}.`,
    );
  return result.result as TResult;
}

export async function readGameSessionBrokerHealth(
  state: AirJamGameSessionBrokerState,
) {
  try {
    const health =
      await requestGameSessionBroker<AirJamGameSessionBrokerHealth>({
        state,
        request: { operation: "health" },
      });
    if (
      health.instanceId !== state.instanceId ||
      health.projectDir !== state.projectDir ||
      health.pid !== state.pid
    )
      throw new Error(
        "Game session owner identity does not match its discovery record.",
      );
    return health;
  } catch {
    return null;
  }
}

function requireCurrentOwnerProtocol(health: AirJamGameSessionBrokerHealth) {
  if (health.gameRunProtocolVersion !== GAME_RUN_PROTOCOL_VERSION)
    throw new Error(
      "owner_protocol_mismatch: Stop the existing game session owner before using the updated runtime.",
    );
}
export async function ensureGameSessionBroker(projectDir: string) {
  const state = await readGameSessionBrokerState(projectDir);
  if (state) {
    const health = await readGameSessionBrokerHealth(state);
    if (health) {
      requireCurrentOwnerProtocol(health);
      return state;
    }
    throw new Error(
      `broker_unresponsive: Owner ${state.instanceId} (pid ${state.pid}) is unavailable. Run airjam session stop --dir ${projectDir} before restarting it.`,
    );
  }
  const statePath = resolveGameSessionBrokerStatePath(projectDir);
  if (!existsSync(statePath)) {
    const logDirectory = path.join(projectDir, ".airjam", "logs");
    mkdirSync(logDirectory, { recursive: true });
    const descriptor = openSync(
      path.join(logDirectory, "game-session-broker.log"),
      "a",
      0o600,
    );
    try {
      const helper = resolveDevtoolsHelperScript("game-session-broker.ts");
      const child = spawn(
        process.execPath,
        [...resolveDevtoolsHelperArgs(helper), projectDir],
        {
          cwd: projectDir,
          detached: true,
          stdio: ["ignore", descriptor, descriptor],
        },
      );
      child.unref();
    } finally {
      closeSync(descriptor);
    }
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const current = await readGameSessionBrokerState(projectDir);
    if (current) {
      const health = await readGameSessionBrokerHealth(current);
      if (health) {
        requireCurrentOwnerProtocol(health);
        return current;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    `broker_unavailable: Inspect ${path.join(projectDir, ".airjam", "logs", "game-session-broker.log")}; an existing discovery record requires explicit session stop.`,
  );
}

export async function getGameSessionBrokerStatus(projectDir: string) {
  const state = await readGameSessionBrokerState(projectDir);
  const health = state ? await readGameSessionBrokerHealth(state) : null;
  return health
    ? { running: true as const, ...health }
    : {
        running: false as const,
        projectDir,
        ...(state
          ? { staleState: true, pid: state.pid, instanceId: state.instanceId }
          : {}),
      };
}

export async function stopGameSessionBroker(projectDir: string) {
  const statePath = resolveGameSessionBrokerStatePath(projectDir);
  await mkdir(path.dirname(statePath), { recursive: true });
  const repairPath = `${statePath}.repair`;
  const repair = await open(repairPath, "wx", 0o600);
  try {
    const state = await readGameSessionBrokerState(projectDir);
    if (!state) {
      if (existsSync(statePath))
        throw new Error(
          "Invalid owner record; inspect it before repairing it.",
        );
      return { stopped: false, running: false, projectDir };
    }
    if (await readGameSessionBrokerHealth(state))
      return await requestGameSessionBroker<{
        stopped: true;
        instanceId: string;
      }>({
        state,
        request: { operation: "shutdown" },
      });
    try {
      process.kill(state.pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      const current = await readGameSessionBrokerState(projectDir);
      if (current?.instanceId !== state.instanceId)
        throw new Error("Owner changed during repair.");
      await unlink(statePath);
      return {
        stopped: false,
        running: false,
        staleStateRemoved: true,
        instanceId: state.instanceId,
        projectDir,
      };
    }
    throw new Error(
      `broker_unresponsive: Owner pid ${state.pid} is still alive. Stop that owner before removing its discovery record.`,
    );
  } finally {
    await repair.close();
    await unlink(repairPath);
  }
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_048_576)
      throw new Error("Game session broker request exceeds 1 MiB.");
    chunks.push(buffer);
  }
  return gameSessionBrokerRequestSchema.parse(
    JSON.parse(Buffer.concat(chunks).toString("utf8")),
  );
}
function writeJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

export async function runGameSessionBroker({
  projectDir,
}: {
  projectDir: string;
}) {
  const decisions = takeDecisionProviderFromEnvironment();
  const resolvedProjectDir = path.resolve(projectDir);
  const statePath = resolveGameSessionBrokerStatePath(resolvedProjectDir);
  const instanceId = randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const startedAt = new Date().toISOString();
  const runtime = createGameSessionRuntime(instanceId);
  const sessions = new Map<
    string,
    {
      expiresAt: number;
      maximumAt: number;
      runId?: string;
      cleanupFailure?: string;
    }
  >();
  const opening = new Set<Promise<unknown>>();
  let draining = false;
  let lastOperationAt = Date.now();
  let drainPromise: Promise<void> | undefined;
  let owned = false;
  const runs = new GameRunOwner({
    projectDir: resolvedProjectDir,
    ownerInstanceId: instanceId,
    decisions,
    async openSession({ runId, gameId, nickname, attachment, build, onScope }) {
      const pending = (async () => {
        const session = await runtime
          .openRunSession(
            {
              cwd: build?.rootDir ?? resolvedProjectDir,
              gameId,
              nickname,
              ...(attachment
                ? {
                    controllerJoinUrl: attachment.controllerJoinUrl,
                    controllerId: attachment.controllerId,
                  }
                : {}),
            },
            {
              delegatedObservation: attachment
                ? currentRoomObserver(attachment, instanceId)
                : undefined,
              build,
              onScope,
            },
          )
          .catch((error: unknown) => {
            if (!attachment) throw error;
            throw new Error(
              /room[_ ]full/i.test(String(error))
                ? "room_full: There is no free player seat in the current room."
                : "current_room_unavailable: The delegated player could not join the current room.",
            );
          });
        sessions.set(session.summary.gameSessionId, {
          runId,
          expiresAt: Date.now() + SESSION_IDLE_MS,
          maximumAt: Date.now() + SESSION_MAXIMUM_MS,
        });
        return session;
      })();
      opening.add(pending);
      try {
        return await pending;
      } finally {
        opening.delete(pending);
      }
    },
    sessionClosed(gameSessionId) {
      sessions.delete(gameSessionId);
    },
  });

  const closeSession = async (
    gameSessionId: string,
    reason: "stopped" | "session_expired" = "stopped",
  ) => {
    const lease = sessions.get(gameSessionId);
    if (lease?.runId) {
      return runs.closeSession(lease.runId, reason);
    }
    const result = await runtime.closeGameSession({ gameSessionId });
    sessions.delete(gameSessionId);
    return result;
  };
  const drain = () =>
    (drainPromise ??= (async () => {
      draining = true;
      const runCleanup = await Promise.allSettled([runs.drain()]);
      await Promise.allSettled(opening);
      const results = await Promise.allSettled(
        [...sessions.keys()].map((id) => closeSession(id)),
      );
      const failures = [...runCleanup, ...results].filter(
        (result) => result.status === "rejected",
      );
      if (failures.length)
        throw new AggregateError(
          failures.map((result) => result.reason),
          "Game session cleanup failed: " +
            failures.map((result) => String(result.reason)).join("; "),
        );
    })());

  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/game-session")
      return writeJson(response, 404, {
        ok: false,
        error: { message: "Not found." },
      });
    if (request.headers.authorization !== `Bearer ${secret}`)
      return writeJson(response, 401, {
        ok: false,
        error: { message: "Invalid game session broker credentials." },
      });
    if (request.headers["x-airjam-owner"] !== instanceId)
      return writeJson(response, 409, {
        ok: false,
        error: {
          message:
            "owner_replaced: Game session owner does not match this request.",
        },
      });
    try {
      const operation = await readBody(request);
      if (operation.operation === "health") {
        let processScopeError: string | null = null;
        try {
          assertProcessScopesConfirmed();
        } catch (error) {
          processScopeError =
            error instanceof Error ? error.message : String(error);
        }
        return writeJson(response, 200, {
          ok: true,
          result: {
            ok: true,
            instanceId,
            pid: process.pid,
            projectDir: resolvedProjectDir,
            activeSessionCount: sessions.size,
            startedAt,
            draining,
            processScopeError,
            gameRunProtocolVersion: GAME_RUN_PROTOCOL_VERSION,
            cleanupFailures: [...sessions].flatMap(([gameSessionId, lease]) =>
              lease.cleanupFailure
                ? [{ gameSessionId, message: lease.cleanupFailure }]
                : [],
            ),
          } satisfies AirJamGameSessionBrokerHealth,
        });
      }
      if (operation.operation === "shutdown") {
        try {
          await drain();
          writeJson(response, 200, {
            ok: true,
            result: { stopped: true, instanceId },
          });
        } finally {
          server.close();
        }
        return;
      }
      if (draining)
        throw new Error("owner_stopping: No new operations are accepted.");
      lastOperationAt = Date.now();
      switch (operation.operation) {
        case "run.watch": {
          const cancellation = new AbortController();
          const writer = new GameRunWatchWriter(response);
          const disconnected = () => {
            writer.close();
            cancellation.abort();
          };
          response.once("close", disconnected);
          try {
            await runs.watch(
              operation.input,
              (event) => {
                if (!response.headersSent)
                  response.writeHead(200, {
                    "content-type": "application/x-ndjson",
                    "cache-control": "no-store",
                  });
                writer.send(event);
              },
              cancellation.signal,
            );
          } catch (error) {
            if (!response.destroyed) {
              const message =
                error instanceof Error ? error.message : String(error);
              if (!response.headersSent)
                writeJson(response, 409, { ok: false, error: { message } });
              else
                writer.send({ type: "error", message: message.slice(0, 4000) });
            }
          } finally {
            writer.close();
            response.off("close", disconnected);
            if (!response.writableEnded) response.end();
          }
          return;
        }
        case "run.start":
          return writeJson(response, 200, {
            ok: true,
            result: await runs.start(operation.input, operation.attachment),
          });
        case "run.read":
          return writeJson(response, 200, {
            ok: true,
            result: await runs.read(operation.input.runId),
          });
        case "run.wait": {
          const cancellation = new AbortController();
          const disconnected = () => cancellation.abort();
          response.once("close", disconnected);
          try {
            return writeJson(response, 200, {
              ok: true,
              result: await runs.wait(
                operation.input.runId,
                operation.input.timeoutMs,
                cancellation.signal,
              ),
            });
          } finally {
            response.off("close", disconnected);
          }
        }
        case "run.stop":
          return writeJson(response, 200, {
            ok: true,
            result: await runs.stop(operation.input.runId),
          });
        case "run.list":
          return writeJson(response, 200, { ok: true, result: runs.list() });
        case "run.stop-all":
          return writeJson(response, 200, {
            ok: true,
            result: await runs.stopAll(),
          });
        case "run.cancel":
          return writeJson(response, 200, {
            ok: true,
            result: await runs.cancel(operation.input.runId),
          });
        case "run.profiles":
          return writeJson(response, 200, {
            ok: true,
            result: await runs.discover(operation.input.gameId),
          });
      }
      if (operation.operation === "open") {
        const pending = (async () => {
          const opened = await runtime.openGameSession({
            ...operation.input,
            cwd: resolvedProjectDir,
          });
          if (draining) {
            await runtime.closeGameSession({
              gameSessionId: opened.gameSessionId,
            });
            throw new Error("owner_stopping: Session open cancelled.");
          }
          sessions.set(opened.gameSessionId, {
            expiresAt: Date.now() + SESSION_IDLE_MS,
            maximumAt: Date.now() + SESSION_MAXIMUM_MS,
          });
          return opened;
        })();
        opening.add(pending);
        try {
          return writeJson(response, 200, { ok: true, result: await pending });
        } finally {
          opening.delete(pending);
        }
      }
      const lease = sessions.get(operation.input.gameSessionId);
      if (!lease)
        throw new Error(
          `unknown_session: Session does not belong to owner ${instanceId}, project ${resolvedProjectDir}, started ${startedAt}.`,
        );
      if (Date.now() >= lease.expiresAt || Date.now() >= lease.maximumAt) {
        await closeSession(operation.input.gameSessionId, "session_expired");
        throw new Error("session_expired: Its controller was disconnected.");
      }
      lease.expiresAt = Math.min(Date.now() + SESSION_IDLE_MS, lease.maximumAt);
      if (
        lease.runId &&
        ["input", "invoke", "control", "close"].includes(operation.operation)
      )
        throw new Error(
          "session_owned_by_run: Interactive writes are refused; use run.stop to end this activity.",
        );
      let result: unknown;
      switch (operation.operation) {
        case "read":
          result = await runtime.readGameSession(operation.input);
          break;
        case "observe":
          result = await runtime.observeGameSession(operation.input);
          break;
        case "control":
          result = await runtime.controlGameSessionParticipant(operation.input);
          break;
        case "input":
          result = await runtime.sendGameSessionInput(operation.input);
          break;
        case "invoke":
          result = await runtime.invokeGameSessionAction(operation.input);
          break;
        case "capture":
          result = await runtime.captureGameSessionVisuals(operation.input);
          break;
        case "close":
          result = await closeSession(operation.input.gameSessionId);
          break;
      }
      writeJson(response, 200, { ok: true, result });
    } catch (error) {
      writeJson(response, 400, {
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
  let sweeping = false;
  const sweep = setInterval(() => {
    if (!owned || draining || sweeping) return;
    sweeping = true;
    const now = Date.now();
    const expired = [...sessions].filter(
      ([, lease]) =>
        !lease.cleanupFailure &&
        (now >= lease.expiresAt || now >= lease.maximumAt),
    );
    void Promise.allSettled(
      expired.map(([id]) => closeSession(id, "session_expired")),
    )
      .then(async (results) => {
        for (const [index, result] of results.entries()) {
          if (result.status !== "rejected") continue;
          const [id, lease] = expired[index];
          lease.cleanupFailure =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          console.error(
            `Session ${id} cleanup failed: ${lease.cleanupFailure}`,
          );
        }
        if (
          !sessions.size &&
          !opening.size &&
          now - lastOperationAt >= EMPTY_OWNER_IDLE_MS
        ) {
          await drain();
          server.close();
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        sweeping = false;
      });
  }, 1000);
  const stop = () => {
    void drain()
      .catch((error) => console.error(error))
      .finally(() => server.close());
  };
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Game session broker did not bind a TCP port.");
    await mkdir(path.dirname(statePath), { recursive: true });
    const descriptor = await open(statePath, "wx", 0o600);
    owned = true;
    try {
      await descriptor.writeFile(
        JSON.stringify({
          schemaVersion: 1,
          instanceId,
          pid: process.pid,
          projectDir: resolvedProjectDir,
          origin: `http://127.0.0.1:${address.port}`,
          secret,
          startedAt,
        } satisfies AirJamGameSessionBrokerState),
      );
    } finally {
      await descriptor.close();
    }
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    await new Promise<void>((resolve) => server.once("close", resolve));
    if (drainPromise) await drainPromise;
  } finally {
    clearInterval(sweep);
    process.removeListener("SIGTERM", stop);
    process.removeListener("SIGINT", stop);
    if (server.listening) server.close();
    if (
      owned &&
      (await readGameSessionBrokerState(resolvedProjectDir))?.instanceId ===
        instanceId
    )
      await unlink(statePath);
  }
}

export async function watchGameSessionBroker({
  state,
  input,
  onEvent,
  signal,
}: {
  state: AirJamGameSessionBrokerState;
  input: unknown;
  onEvent: (event: GameRunWatchEvent) => void;
  signal: AbortSignal;
}) {
  const request = {
    operation: "run.watch",
    input: gameRunWatchRequestSchema.parse(input),
  };
  const response = await fetch(`${state.origin}/v1/game-session`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${state.secret}`,
      "x-airjam-owner": state.instanceId,
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    const failure = (await response.json()) as { error?: { message?: string } };
    throw new Error(
      failure.error?.message ??
        `Run watch failed with HTTP ${response.status}.`,
    );
  }
  if (!response.body)
    throw new Error("Run watch response has no event stream.");
  await readGameRunWatchStream(response.body, onEvent);
}
