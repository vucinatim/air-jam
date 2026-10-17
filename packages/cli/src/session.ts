import { inspectProject } from "@air-jam/devtools/context";
import {
  captureGameSessionVisuals,
  closeGameSession,
  controlGameSessionParticipant,
  gameSessionOperationSchemas,
  invokeGameSessionAction,
  observeGameSession,
  openGameSession,
  readGameSession,
  sendGameSessionInput,
} from "@air-jam/devtools/game-session";
import {
  getGameSessionBrokerStatus,
  stopGameSessionBroker,
  type AirJamGameSessionBrokerOperation,
} from "@air-jam/devtools/game-session-broker";

const resolveProjectDir = async (dir?: string) =>
  (await inspectProject({ cwd: dir })).context.rootDir;
const request = async ({
  dir,
  operation,
}: {
  dir?: string;
  operation: AirJamGameSessionBrokerOperation;
}): Promise<unknown> => {
  switch (operation.operation) {
    case "open":
      return openGameSession({ ...operation.input, cwd: dir });
    case "read":
      return readGameSession({ ...operation.input, cwd: dir });
    case "observe":
      return observeGameSession({ ...operation.input, cwd: dir });
    case "control":
      return controlGameSessionParticipant({ ...operation.input, cwd: dir });
    case "input":
      return sendGameSessionInput({ ...operation.input, cwd: dir });
    case "invoke":
      return invokeGameSessionAction({ ...operation.input, cwd: dir });
    case "capture":
      return captureGameSessionVisuals({ ...operation.input, cwd: dir });
    case "close":
      return closeGameSession({ ...operation.input, cwd: dir });
    default:
      throw new Error("Unsupported session operation.");
  }
};

export const parseJsonValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object.");
  }
  return parsed as Record<string, unknown>;
};

export const runSessionBrokerStatus = async ({
  dir,
}: {
  dir?: string;
}): Promise<unknown> => {
  return getGameSessionBrokerStatus(await resolveProjectDir(dir));
};

export const runSessionBrokerStop = async ({
  dir,
}: {
  dir?: string;
}): Promise<unknown> => stopGameSessionBroker(await resolveProjectDir(dir));

export const openSession = async ({
  dir,
  ...input
}: {
  dir?: string;
  gameId?: string;
  mode?: "standalone-dev" | "arcade-dev" | "arcade-test";
  secure?: boolean;
  roomId?: string;
  controllerJoinUrl?: string;
  timeoutMs?: number;
}): Promise<unknown> =>
  request({ dir, operation: { operation: "open", input } });

export const readSession = async ({
  dir,
  gameSessionId,
  timeoutMs,
}: {
  dir?: string;
  gameSessionId: string;
  timeoutMs?: number;
}): Promise<unknown> =>
  request({
    dir,
    operation: {
      operation: "read",
      input: { gameSessionId, timeoutMs },
    },
  });

export const sendSessionInput = async ({
  dir,
  gameSessionId,
  input,
}: {
  dir?: string;
  gameSessionId: string;
  input: Record<string, unknown>;
}): Promise<unknown> =>
  request({
    dir,
    operation: {
      operation: "input",
      input: gameSessionOperationSchemas.input.parse({ gameSessionId, input }),
    },
  });

export const invokeSessionAction = async ({
  dir,
  gameSessionId,
  actionId,
  payload,
  timeoutMs,
}: {
  dir?: string;
  gameSessionId: string;
  actionId: string;
  payload?: unknown;
  timeoutMs?: number;
}): Promise<unknown> =>
  request({
    dir,
    operation: {
      operation: "invoke",
      input: gameSessionOperationSchemas.invoke.parse({
        gameSessionId,
        actionId,
        payload,
        timeoutMs,
      }),
    },
  });

export const captureSessionVisuals = async ({
  dir,
  gameSessionId,
  timeoutMs,
}: {
  dir?: string;
  gameSessionId: string;
  timeoutMs?: number;
}): Promise<unknown> =>
  request({
    dir,
    operation: {
      operation: "capture",
      input: { gameSessionId, timeoutMs },
    },
  });

export const closeSession = async ({
  dir,
  gameSessionId,
}: {
  dir?: string;
  gameSessionId: string;
}): Promise<unknown> =>
  request({
    dir,
    operation: { operation: "close", input: { gameSessionId } },
  });

export const controlSessionParticipant = async ({
  dir,
  gameSessionId,
  command,
}: {
  dir?: string;
  gameSessionId: string;
  command: Record<string, unknown>;
}): Promise<unknown> =>
  request({
    dir,
    operation: {
      operation: "control",
      input: gameSessionOperationSchemas.control.parse({
        ...command,
        gameSessionId,
      }),
    },
  });
