import type {
  AirJamStateSyncPayload,
  ClientToServerEvents,
  ControllerJoinAck,
  ControllerJoinedNotice,
  ControllerLeaveAck,
  ControllerStateMessage,
  ControllerWelcomePayload,
  PlayerProfile,
  PlayerUpdatedNotice,
  ServerErrorPayload,
  ServerToClientEvents,
  SignalPayload,
} from "@air-jam/sdk/protocol";
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { io, type Socket } from "socket.io-client";
import { detectProjectContext } from "./context.js";
import { getTopology } from "./dev.js";
import type {
  AirJamProjectMode,
  AirJamRuntimeSnapshotInspection,
  AirJamRuntimeStoreSnapshot,
  AirJamVirtualControllerSession,
  AirJamVirtualControllerSessionSummary,
  ConnectControllerOptions,
  DisconnectControllerOptions,
  DisconnectControllerResult,
  GetTopologyOptions,
  InvokeControllerActionOptions,
  InvokeControllerActionResult,
  JsonObject,
  ReadRuntimeSnapshotOptions,
  SendControllerInputOptions,
  SendControllerInputResult,
} from "./types.js";
import { readHarnessSnapshot } from "./visual.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ControllerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type InternalControllerSession = {
  cwd: string;
  summary: AirJamVirtualControllerSessionSummary;
  socket: ControllerSocket;
  projectMode: AirJamProjectMode;
  harnessSnapshot: JsonObject | null;
  welcome: JsonObject | null;
  controllerState: JsonObject | null;
  players: JsonObject[];
  storeSnapshots: Map<string, AirJamRuntimeStoreSnapshot>;
  pendingSyncWaiters: Map<
    string,
    Set<(snapshot: AirJamRuntimeStoreSnapshot | null) => void>
  >;
  lastSignal: JsonObject | null;
  lastError: JsonObject | null;
  isolatedHarnessOwner: ChildProcess | null;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const WAIT_INTERVAL_MS = 25;
const virtualControllerSessions = new Map<string, InternalControllerSession>();

const resolveHelperScriptPath = (fileName: string): string => {
  const builtHelperPath = path.resolve(__dirname, "tooling", fileName);
  if (existsSync(builtHelperPath)) {
    return builtHelperPath;
  }

  return path.resolve(__dirname, "..", "src", "tooling", fileName);
};

const resolveTsxCliPath = (): string =>
  path.join(
    path.dirname(require.resolve("tsx/package.json")),
    "dist",
    "cli.mjs",
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toJsonObject = (value: unknown): JsonObject | null => {
  if (!isRecord(value)) {
    return null;
  }

  return { ...value };
};

const toJsonObjectArray = (value: unknown): JsonObject[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const objectValue = toJsonObject(entry);
    return objectValue ? [objectValue] : [];
  });
};

const upsertPlayer = (
  players: JsonObject[],
  incoming: PlayerProfile | JsonObject | null,
): JsonObject[] => {
  const nextPlayer = toJsonObject(incoming);
  const playerId =
    typeof nextPlayer?.id === "string" && nextPlayer.id ? nextPlayer.id : null;
  if (!nextPlayer || !playerId) {
    return players;
  }

  const nextPlayers = players.slice();
  const existingIndex = nextPlayers.findIndex((entry) => entry.id === playerId);
  if (existingIndex === -1) {
    nextPlayers.push(nextPlayer);
    return nextPlayers;
  }

  nextPlayers[existingIndex] = {
    ...nextPlayers[existingIndex],
    ...nextPlayer,
  };
  return nextPlayers;
};

const removePlayer = (
  players: JsonObject[],
  controllerId: string,
): JsonObject[] => players.filter((entry) => entry.id !== controllerId);

const nowIso = (): string => new Date().toISOString();

const waitForCondition = async ({
  timeoutMs,
  predicate,
}: {
  timeoutMs: number;
  predicate: () => boolean;
}): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }
};

const waitForSocketConnect = async (
  socket: ControllerSocket,
  timeoutMs: number,
): Promise<void> => {
  if (socket.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for controller socket connect."));
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onConnectError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });
};

const emitJoinWithAck = async ({
  socket,
  payload,
  timeoutMs,
}: {
  socket: ControllerSocket;
  payload: Parameters<ClientToServerEvents["controller:join"]>[0];
  timeoutMs: number;
}): Promise<ControllerJoinAck> =>
  await new Promise<ControllerJoinAck>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timed out waiting for controller join acknowledgement."),
      );
    }, timeoutMs);

    socket.emit("controller:join", payload, (ack) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });

const emitLeaveWithAck = async ({
  socket,
  payload,
  timeoutMs,
}: {
  socket: ControllerSocket;
  payload: Parameters<ClientToServerEvents["controller:leave"]>[0];
  timeoutMs: number;
}): Promise<ControllerLeaveAck> =>
  await new Promise<ControllerLeaveAck>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timed out waiting for controller leave acknowledgement."),
      );
    }, timeoutMs);

    (
      socket as unknown as {
        emit: (event: string, ...args: unknown[]) => void;
      }
    ).emit("controller:leave", payload, (ack: ControllerLeaveAck) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });

const parseJoinRoomId = (joinUrl: URL): string | null => {
  const roomId =
    joinUrl.searchParams.get("room") ?? joinUrl.searchParams.get("aj_room");
  return roomId?.trim().toUpperCase() || null;
};

const parseJoinCapabilityToken = (joinUrl: URL): string | null =>
  joinUrl.searchParams.get("aj_controller_cap")?.trim() ||
  joinUrl.searchParams.get("cap")?.trim() ||
  null;

const parseJoinControllerId = (joinUrl: URL): string | null =>
  joinUrl.searchParams.get("controllerId")?.trim() ||
  joinUrl.searchParams.get("aj_controller_id")?.trim() ||
  null;

const parseHelperJson = <T>(output: string): T => {
  const startIndex = output.indexOf("{");
  const endIndex = output.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Expected JSON helper output but received:\n${output}`);
  }

  return JSON.parse(output.slice(startIndex, endIndex + 1)) as T;
};

const isRoomNotFoundJoinError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return /room not found/i.test(error.message);
};

const terminateIsolatedHarnessOwner = async (
  process: ChildProcess | null,
): Promise<void> => {
  if (!process || process.killed || process.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    const onExit = () => {
      process.off("exit", onExit);
      resolve();
    };

    process.once("exit", onExit);
    process.kill("SIGTERM");

    setTimeout(() => {
      process.off("exit", onExit);
      resolve();
    }, 1_000).unref();
  });
};

const resolveSocketOriginFromTopology = async (
  options: GetTopologyOptions,
): Promise<string | null> => {
  try {
    const topology = await getTopology(options);
    const preferredSurfaces = [
      topology.surfaces.controller,
      topology.surfaces.embeddedController,
      topology.surfaces.platformController,
    ];

    for (const surface of preferredSurfaces) {
      const objectSurface = toJsonObject(surface);
      const socketOrigin =
        (typeof objectSurface?.socketOrigin === "string"
          ? objectSurface.socketOrigin
          : null) ??
        (typeof objectSurface?.backendOrigin === "string"
          ? objectSurface.backendOrigin
          : null) ??
        (typeof objectSurface?.appOrigin === "string"
          ? objectSurface.appOrigin
          : null);
      if (socketOrigin) {
        return socketOrigin;
      }
    }
  } catch {
    // Fall back to the join URL origin below.
  }

  return null;
};

const startIsolatedHarnessOwner = async ({
  cwd,
  gameId,
  mode,
  secure,
  roomId,
  timeoutMs,
}: {
  cwd: string;
  gameId?: string;
  mode: NonNullable<ConnectControllerOptions["mode"]>;
  secure: boolean;
  roomId?: string;
  timeoutMs: number;
}): Promise<{
  process: ChildProcess;
  roomId: string | null;
  controllerJoinUrl: string | null;
  snapshot: JsonObject | null;
}> => {
  const topology = await getTopology({
    cwd,
    gameId,
    mode,
    secure,
  });

  const appOrigin = topology.urls.appOrigin;
  const hostUrl = topology.urls.hostUrl;
  const controllerBaseUrl = topology.urls.controllerBaseUrl;
  const publicHost = topology.urls.publicHost;
  if (!appOrigin || !hostUrl || !controllerBaseUrl || !publicHost) {
    throw new Error(
      "Unable to start an isolated harness owner because the resolved topology is incomplete.",
    );
  }

  const helperFile = resolveHelperScriptPath("hold-harness-host.ts");
  const args = [
    resolveTsxCliPath(),
    helperFile,
    "--app-origin",
    appOrigin,
    "--host-url",
    hostUrl,
    "--controller-base-url",
    controllerBaseUrl,
    "--public-host",
    publicHost,
    "--mode",
    mode,
    "--timeout-ms",
    String(timeoutMs),
  ];
  if (topology.urls.localBuildUrl) {
    args.push("--local-build-url", topology.urls.localBuildUrl);
  }
  if (topology.urls.browserBuildUrl) {
    args.push("--browser-build-url", topology.urls.browserBuildUrl);
  }
  if (roomId) {
    args.push("--room-id", roomId);
  }

  const helperProcess = spawn(process.execPath, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return await new Promise((resolve, reject) => {
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup();
      void terminateIsolatedHarnessOwner(helperProcess).finally(() => {
        reject(new Error("Timed out waiting for isolated harness ownership."));
      });
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      helperProcess.stdout?.off("data", onStdout);
      helperProcess.stderr?.off("data", onStderr);
      helperProcess.off("exit", onExit);
      helperProcess.off("error", onError);
    };

    const maybeResolve = () => {
      try {
        const payload = parseHelperJson<{
          roomId: string | null;
          controllerJoinUrl: string | null;
          snapshot: JsonObject | null;
        }>(stdoutBuffer);
        settled = true;
        cleanup();
        resolve({
          process: helperProcess,
          roomId: payload.roomId,
          controllerJoinUrl: payload.controllerJoinUrl,
          snapshot: payload.snapshot,
        });
      } catch {
        // Wait for the full JSON payload.
      }
    };

    const onStdout = (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();
      maybeResolve();
    };

    const onStderr = (chunk: Buffer | string) => {
      stderrBuffer += chunk.toString();
    };

    const onError = (error: Error) => {
      if (settled) {
        return;
      }
      cleanup();
      reject(error);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) {
        return;
      }
      cleanup();
      reject(
        new Error(
          [
            "Isolated harness owner exited before producing a join URL.",
            stderrBuffer.trim(),
            `exit=${code ?? "null"} signal=${signal ?? "null"}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    };

    helperProcess.stdout?.on("data", onStdout);
    helperProcess.stderr?.on("data", onStderr);
    helperProcess.once("error", onError);
    helperProcess.once("exit", onExit);
  });
};

const buildRuntimeSnapshot = ({
  session,
  requestedStoreDomains = [],
  missingStoreDomains = [],
}: {
  session: InternalControllerSession;
  requestedStoreDomains?: string[];
  missingStoreDomains?: string[];
}): AirJamRuntimeSnapshotInspection => ({
  ...session.summary,
  welcome: session.welcome,
  controllerState: session.controllerState,
  players: session.players.slice(),
  harnessSnapshot: session.harnessSnapshot,
  storeSnapshots: Array.from(session.storeSnapshots.values()).sort(
    (left, right) => left.storeDomain.localeCompare(right.storeDomain),
  ),
  lastSignal: session.lastSignal,
  lastError: session.lastError,
  requestedStoreDomains: [...requestedStoreDomains],
  missingStoreDomains: [...missingStoreDomains],
});

const buildSessionSummary = (
  session: InternalControllerSession,
): AirJamVirtualControllerSessionSummary => ({
  ...session.summary,
});

const getRequiredSession = (
  controllerSessionId: string,
): InternalControllerSession => {
  const session = virtualControllerSessions.get(controllerSessionId);
  if (!session) {
    throw new Error(
      `Unknown Air Jam controller session "${controllerSessionId}". Connect a controller first.`,
    );
  }

  return session;
};

export const inspectControllerSessionContext = (
  controllerSessionId: string,
): {
  cwd: string;
  gameId: string | null;
  controllerId: string;
  session: AirJamVirtualControllerSessionSummary;
} => {
  const session = getRequiredSession(controllerSessionId);
  return {
    cwd: session.cwd,
    gameId: session.summary.gameId,
    controllerId: session.summary.controllerId,
    session: buildSessionSummary(session),
  };
};

const waitForStateSync = async ({
  session,
  storeDomain,
  timeoutMs,
}: {
  session: InternalControllerSession;
  storeDomain: string;
  timeoutMs: number;
}): Promise<AirJamRuntimeStoreSnapshot | null> =>
  await new Promise<AirJamRuntimeStoreSnapshot | null>((resolve) => {
    const waiters = session.pendingSyncWaiters.get(storeDomain) ?? new Set();
    const timeout = setTimeout(() => {
      waiters.delete(onSync);
      if (waiters.size === 0) {
        session.pendingSyncWaiters.delete(storeDomain);
      }
      resolve(null);
    }, timeoutMs);

    const onSync = (snapshot: AirJamRuntimeStoreSnapshot | null) => {
      clearTimeout(timeout);
      waiters.delete(onSync);
      if (waiters.size === 0) {
        session.pendingSyncWaiters.delete(storeDomain);
      }
      resolve(snapshot);
    };

    waiters.add(onSync);
    session.pendingSyncWaiters.set(storeDomain, waiters);
    session.socket.emit("controller:state_sync_request", {
      roomId: session.summary.roomId,
      storeDomain,
    });
  });

const attachSocketListeners = (session: InternalControllerSession): void => {
  session.socket.on("server:welcome", (payload: ControllerWelcomePayload) => {
    session.welcome = {
      ...payload,
    };
    session.players = toJsonObjectArray(payload.players);
  });

  session.socket.on("server:state", (payload: ControllerStateMessage) => {
    session.controllerState = toJsonObject(payload.state);
  });

  session.socket.on(
    "server:controllerJoined",
    (payload: ControllerJoinedNotice) => {
      const fallbackPlayer =
        payload.player ??
        ({
          id: payload.controllerId,
          label: payload.nickname ?? payload.controllerId,
        } satisfies JsonObject);
      session.players = upsertPlayer(session.players, fallbackPlayer);
    },
  );

  session.socket.on("server:controllerLeft", (payload) => {
    session.players = removePlayer(session.players, payload.controllerId);
  });

  session.socket.on("server:playerUpdated", (payload: PlayerUpdatedNotice) => {
    session.players = upsertPlayer(session.players, payload.player);
  });

  session.socket.on("server:signal", (payload: SignalPayload) => {
    session.lastSignal = toJsonObject(payload);
  });

  session.socket.on("server:error", (payload: ServerErrorPayload) => {
    session.lastError = toJsonObject(payload);
  });

  session.socket.on("airjam:state_sync", (payload: AirJamStateSyncPayload) => {
    const snapshot: AirJamRuntimeStoreSnapshot = {
      storeDomain: payload.storeDomain,
      data: { ...payload.data },
      updatedAt: nowIso(),
    };
    session.storeSnapshots.set(payload.storeDomain, snapshot);
    const waiters = session.pendingSyncWaiters.get(payload.storeDomain);
    if (!waiters) {
      return;
    }

    for (const waiter of waiters) {
      waiter(snapshot);
    }
    session.pendingSyncWaiters.delete(payload.storeDomain);
  });

  session.socket.on("disconnect", (reason) => {
    session.summary.connected = false;
    session.summary.disconnectedAt = nowIso();
    session.summary.disconnectReason = reason ?? "unknown";
    void terminateIsolatedHarnessOwner(session.isolatedHarnessOwner).finally(
      () => {
        session.isolatedHarnessOwner = null;
      },
    );
    for (const waiters of session.pendingSyncWaiters.values()) {
      for (const waiter of waiters) {
        waiter(null);
      }
    }
    session.pendingSyncWaiters.clear();
  });
};

export const connectController = async ({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
  roomId,
  harnessSessionId,
  controllerJoinUrl,
  controllerId,
  deviceId,
  nickname,
  avatarId,
  capabilityToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ConnectControllerOptions = {}): Promise<AirJamVirtualControllerSession> => {
  const context = await detectProjectContext({ cwd });
  const normalizedRequestedRoomId = roomId?.trim().toUpperCase() || undefined;
  const harnessSession =
    controllerJoinUrl === undefined
      ? await readHarnessSnapshot({
          cwd,
          gameId,
          mode,
          secure,
          roomId: normalizedRequestedRoomId,
          sessionId: harnessSessionId,
          timeoutMs,
        })
      : null;
  const canUseIsolatedOwner =
    Boolean(harnessSession?.gameId ?? gameId) ||
    context.mode === "standalone-game";

  const connectWithJoinUrl = async ({
    joinUrlString,
    ownedHarnessProcess,
    snapshot,
  }: {
    joinUrlString: string;
    ownedHarnessProcess: ChildProcess | null;
    snapshot: JsonObject | null;
  }): Promise<AirJamVirtualControllerSession> => {
    const joinUrl = new URL(joinUrlString);
    const resolvedRoomId =
      normalizedRequestedRoomId ?? parseJoinRoomId(joinUrl);
    if (!resolvedRoomId) {
      throw new Error(
        `Controller join URL "${joinUrlString}" does not include a room code.`,
      );
    }

    const resolvedControllerId =
      controllerId?.trim() ||
      parseJoinControllerId(joinUrl) ||
      `ctrl_mcp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const resolvedDeviceId =
      deviceId?.trim() || `aj-mcp-device-${randomUUID()}`;
    const resolvedSocketOrigin =
      (await resolveSocketOriginFromTopology({
        cwd,
        gameId: harnessSession?.gameId ?? gameId,
        mode,
        secure,
      })) ?? joinUrl.origin;
    const resolvedCapabilityToken =
      capabilityToken?.trim() || parseJoinCapabilityToken(joinUrl) || undefined;
    const controllerSessionId = randomUUID();

    const socket = io(resolvedSocketOrigin, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    }) as ControllerSocket;

    const internalSession: InternalControllerSession = {
      cwd,
      summary: {
        controllerSessionId,
        gameId: harnessSession?.gameId ?? gameId ?? null,
        projectMode: context.mode,
        mode: harnessSession?.mode ?? mode,
        topologyMode: harnessSession?.topologyMode ?? null,
        secure: harnessSession?.secure ?? secure,
        process: harnessSession?.process ?? null,
        roomId: resolvedRoomId,
        controllerId: resolvedControllerId,
        deviceId: resolvedDeviceId,
        controllerJoinUrl: joinUrlString,
        socketOrigin: resolvedSocketOrigin,
        connected: false,
        connectedAt: nowIso(),
        disconnectedAt: null,
        disconnectReason: null,
      },
      socket,
      projectMode: context.mode,
      harnessSnapshot: snapshot,
      welcome: null,
      controllerState: null,
      players: [],
      storeSnapshots: new Map(),
      pendingSyncWaiters: new Map(),
      lastSignal: null,
      lastError: null,
      isolatedHarnessOwner: ownedHarnessProcess,
    };

    attachSocketListeners(internalSession);

    try {
      await waitForSocketConnect(socket, timeoutMs);
      const ack = await emitJoinWithAck({
        socket,
        payload: {
          roomId: resolvedRoomId,
          controllerId: resolvedControllerId,
          deviceId: resolvedDeviceId,
          nickname: nickname?.trim() || undefined,
          avatarId: avatarId?.trim() || undefined,
          capabilityToken: resolvedCapabilityToken,
        },
        timeoutMs,
      });

      if (!ack.ok) {
        throw new Error(
          ack.message ??
            `Controller join was rejected${ack.code ? ` (${ack.code})` : ""}.`,
        );
      }

      internalSession.summary.connected = true;
      internalSession.summary.roomId = ack.roomId ?? resolvedRoomId;
      internalSession.summary.controllerId =
        ack.controllerId ?? resolvedControllerId;
      await waitForCondition({
        timeoutMs: Math.min(timeoutMs, 500),
        predicate: () =>
          internalSession.welcome !== null ||
          internalSession.controllerState !== null,
      });
      virtualControllerSessions.set(controllerSessionId, internalSession);
      return buildRuntimeSnapshot({ session: internalSession });
    } catch (error) {
      socket.disconnect();
      await terminateIsolatedHarnessOwner(ownedHarnessProcess);
      throw error;
    }
  };

  if (
    controllerJoinUrl === undefined &&
    harnessSession?.controlSurface === "isolated-session"
  ) {
    const owner = await startIsolatedHarnessOwner({
      cwd,
      gameId: harnessSession.gameId ?? gameId,
      mode,
      secure,
      roomId: normalizedRequestedRoomId,
      timeoutMs,
    });
    if (!owner.controllerJoinUrl) {
      await terminateIsolatedHarnessOwner(owner.process);
      throw new Error(
        "Isolated harness owner did not produce a controller join URL.",
      );
    }

    return connectWithJoinUrl({
      joinUrlString: owner.controllerJoinUrl,
      ownedHarnessProcess: owner.process,
      snapshot: owner.snapshot,
    });
  }

  const resolvedJoinUrl =
    controllerJoinUrl ?? harnessSession?.urls.controllerJoinUrl ?? null;
  if (!resolvedJoinUrl) {
    throw new Error(
      "Unable to resolve a controller join URL. Start from a harness session or provide controllerJoinUrl explicitly.",
    );
  }

  try {
    return await connectWithJoinUrl({
      joinUrlString: resolvedJoinUrl,
      ownedHarnessProcess: null,
      snapshot: harnessSession?.snapshot ?? null,
    });
  } catch (error) {
    if (canUseIsolatedOwner && isRoomNotFoundJoinError(error)) {
      const owner = await startIsolatedHarnessOwner({
        cwd,
        gameId: harnessSession?.gameId ?? gameId,
        mode,
        secure,
        roomId: normalizedRequestedRoomId,
        timeoutMs,
      });
      if (!owner.controllerJoinUrl) {
        await terminateIsolatedHarnessOwner(owner.process);
        throw error;
      }

      return await connectWithJoinUrl({
        joinUrlString: owner.controllerJoinUrl,
        ownedHarnessProcess: owner.process,
        snapshot: owner.snapshot,
      });
    }

    throw error;
  }
};

export const sendControllerInput = async ({
  controllerSessionId,
  input,
}: SendControllerInputOptions): Promise<SendControllerInputResult> => {
  const session = getRequiredSession(controllerSessionId);
  if (!session.summary.connected) {
    throw new Error(
      `Air Jam controller session "${controllerSessionId}" is not connected.`,
    );
  }

  const payload = { ...input };
  session.socket.emit("controller:input", {
    roomId: session.summary.roomId,
    controllerId: session.summary.controllerId,
    input: payload,
  });

  return {
    ...buildSessionSummary(session),
    input: payload,
    sentAt: nowIso(),
  };
};

export const invokeControllerAction = async ({
  controllerSessionId,
  actionName,
  storeDomain,
  payload,
}: InvokeControllerActionOptions): Promise<InvokeControllerActionResult> => {
  const session = getRequiredSession(controllerSessionId);
  if (!session.summary.connected) {
    throw new Error(
      `Air Jam controller session "${controllerSessionId}" is not connected.`,
    );
  }

  const normalizedPayload = payload ? { ...payload } : undefined;
  session.socket.emit("controller:action_rpc", {
    roomId: session.summary.roomId,
    actionName,
    payload: normalizedPayload,
    storeDomain,
  });

  return {
    ...buildSessionSummary(session),
    actionName,
    storeDomain,
    ...(normalizedPayload ? { payload: normalizedPayload } : {}),
    sentAt: nowIso(),
  };
};

export const readRuntimeSnapshot = async ({
  controllerSessionId,
  storeDomains = [],
  requestSync = storeDomains.length > 0,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ReadRuntimeSnapshotOptions): Promise<AirJamRuntimeSnapshotInspection> => {
  const session = getRequiredSession(controllerSessionId);
  const normalizedStoreDomains = Array.from(
    new Set(
      storeDomains
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

  const missingStoreDomains: string[] = [];
  if (requestSync && normalizedStoreDomains.length > 0) {
    const syncResults = await Promise.all(
      normalizedStoreDomains.map(async (storeDomain) => {
        const result = await waitForStateSync({
          session,
          storeDomain,
          timeoutMs,
        });
        return {
          storeDomain,
          ok: result !== null,
        };
      }),
    );

    for (const result of syncResults) {
      if (!result.ok) {
        missingStoreDomains.push(result.storeDomain);
      }
    }
  }

  return buildRuntimeSnapshot({
    session,
    requestedStoreDomains: normalizedStoreDomains,
    missingStoreDomains,
  });
};

export const disconnectController = async ({
  controllerSessionId,
}: DisconnectControllerOptions): Promise<DisconnectControllerResult> => {
  const session = getRequiredSession(controllerSessionId);
  if (session.summary.connected) {
    try {
      const ack = await emitLeaveWithAck({
        socket: session.socket,
        payload: {
          roomId: session.summary.roomId,
          controllerId: session.summary.controllerId,
        },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (!ack.ok) {
        throw new Error(
          ack.message ?? "Controller leave request was rejected by the server.",
        );
      }
    } catch {
      // Fall back to socket disconnect. Manual devtools teardown should not hang
      // forever when the room is already gone or the socket is mid-teardown.
    }
  }
  session.socket.disconnect();
  session.summary.connected = false;
  session.summary.disconnectedAt = session.summary.disconnectedAt ?? nowIso();
  session.summary.disconnectReason =
    session.summary.disconnectReason ?? "manual_disconnect";
  await terminateIsolatedHarnessOwner(session.isolatedHarnessOwner);
  session.isolatedHarnessOwner = null;
  virtualControllerSessions.delete(controllerSessionId);

  return {
    disconnected: true,
    session: buildSessionSummary(session),
  };
};
