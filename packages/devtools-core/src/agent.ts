import path from "node:path";
import { runCommandResult } from "./commands.js";
import {
  inspectControllerSessionContext,
  invokeControllerAction,
  readRuntimeSnapshot,
  resolveControllerSessionGameRuntime,
} from "./controller.js";
import {
  classifyGameActionOutcome,
  computeGameSnapshotObservation,
} from "./game-action-observation.js";
import { inspectGame } from "./games.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import type {
  AirJamAgentContractInspection,
  AirJamGameSnapshotInspection,
  InspectGameAgentContractOptions,
  InvokeGameActionOptions,
  InvokeGameActionResult,
  JsonObject,
  ReadGameSnapshotOptions,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 5_000;

const parseHelperJson = <T>(output: string): T => {
  const startIndex = output.indexOf("{");
  const endIndex = output.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Expected JSON helper output but received:\n${output}`);
  }

  return JSON.parse(output.slice(startIndex, endIndex + 1)) as T;
};

type ResolvedGameAgentSource = {
  configPath: string;
};

const runGameAgentHelper = <T>({
  cwd,
  configPath,
  contractPath,
  operation,
  args = [],
}: {
  cwd: string;
  configPath?: string | null;
  contractPath?: string | null;
  operation: "inspect" | "project" | "read-action" | "resolve-input";
  args?: string[];
}): T => {
  const result = runCommandResult({
    command: process.execPath,
    args: [
      ...resolveDevtoolsHelperArgs(
        resolveDevtoolsHelperScript("agent-contract.ts"),
      ),
      "--operation",
      operation,
      ...(configPath ? ["--config", configPath] : []),
      ...(contractPath ? ["--contract", contractPath] : []),
      ...args,
    ],
    cwd,
  });

  if (!result.ok) {
    throw new Error(
      `Air Jam agent helper failed.\n\n${result.stderr || result.stdout}`,
    );
  }

  return parseHelperJson<T>(result.stdout);
};

const resolveGameAgentSource = async ({
  configPath,
}: {
  configPath: string | null;
}): Promise<ResolvedGameAgentSource | null> => {
  if (configPath) {
    const helperResult = runGameAgentHelper<{ hasContract: boolean }>({
      cwd: path.dirname(configPath),
      configPath,
      operation: "inspect",
    });
    if (helperResult.hasContract) {
      return {
        configPath,
      };
    }
  }

  return null;
};

export const inspectGameAgentContract = async ({
  cwd = process.cwd(),
  gameId,
}: InspectGameAgentContractOptions = {}): Promise<AirJamAgentContractInspection> => {
  const game = await inspectGame({ cwd, gameId });
  const source = await resolveGameAgentSource({ configPath: game.configPath });

  if (!source) {
    return {
      gameId: game.id,
      rootDir: game.rootDir,
      hasContract: false,
      snapshotStoreDomains: [],
      snapshotDescription: null,
      actions: [],
    };
  }

  const helperResult = runGameAgentHelper<{
    snapshotStoreDomains: string[];
    snapshotDescription: string | null;
    actions: AirJamAgentContractInspection["actions"];
  }>({
    cwd: game.rootDir,
    configPath: source.configPath,
    operation: "inspect",
  });

  return {
    gameId: game.id,
    rootDir: game.rootDir,
    hasContract: true,
    snapshotStoreDomains: helperResult.snapshotStoreDomains,
    snapshotDescription: helperResult.snapshotDescription,
    actions: helperResult.actions,
  };
};

export const readGameSnapshot = async ({
  controllerSessionId,
  requestSync = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ReadGameSnapshotOptions): Promise<AirJamGameSnapshotInspection> => {
  const session = inspectControllerSessionContext(controllerSessionId);
  const runtime = await resolveControllerSessionGameRuntime({
    controllerSessionId,
    timeoutMs,
  });
  if (!runtime.gameId) {
    throw new Error(
      `Controller session "${controllerSessionId}" is not associated with an Air Jam game.`,
    );
  }

  const contract = await inspectGameAgentContract({
    cwd: session.cwd,
    gameId: runtime.gameId,
  });
  if (!contract.hasContract) {
    throw new Error(
      `Game "${runtime.gameId}" does not publish an agent contract yet.`,
    );
  }

  const storeDomainBindings = contract.snapshotStoreDomains.map(
    (contractStoreDomain) => ({
      contractStoreDomain,
      runtimeStoreDomain:
        contractStoreDomain === "default"
          ? runtime.defaultStoreDomain
          : contractStoreDomain,
    }),
  );
  const runtimeStoreDomains = storeDomainBindings.map(
    (binding) => binding.runtimeStoreDomain,
  );
  const runtimeSnapshot = await readRuntimeSnapshot({
    controllerSessionId,
    storeDomains: runtimeStoreDomains,
    requestSync,
    timeoutMs,
  });
  const rawStores = runtimeSnapshot.storeSnapshots.filter((snapshot) =>
    runtimeStoreDomains.includes(snapshot.storeDomain),
  );
  const storesPayload = storeDomainBindings.reduce<Record<string, JsonObject>>(
    (nextStores, binding) => {
      const snapshot = rawStores.find(
        (candidate) => candidate.storeDomain === binding.runtimeStoreDomain,
      );
      if (snapshot) {
        nextStores[binding.contractStoreDomain] = snapshot.data;
      }
      return nextStores;
    },
    {},
  );

  const helperResult = runGameAgentHelper<{
    snapshot: JsonObject;
  }>({
    cwd: session.cwd,
    configPath: (
      await inspectGame({ cwd: session.cwd, gameId: runtime.gameId })
    ).configPath,
    operation: "project",
    args: [
      "--controller-id",
      session.controllerId,
      "--stores-base64",
      Buffer.from(JSON.stringify(storesPayload), "utf8").toString("base64url"),
    ],
  });

  return {
    controllerSessionId,
    gameId: runtime.gameId,
    snapshotStoreDomains: [...contract.snapshotStoreDomains],
    runtimeStoreDomains,
    storeDomainBindings,
    snapshotDescription: contract.snapshotDescription,
    actions: contract.actions,
    snapshot: helperResult.snapshot,
    rawStores,
  };
};

export const resolveGameActionPayload = async ({
  cwd = process.cwd(),
  gameId,
  actionId,
  payload,
}: {
  cwd?: string;
  gameId: string;
  actionId: string;
  payload?: unknown;
}): Promise<JsonObject | undefined> => {
  const contract = await inspectGameAgentContract({
    cwd,
    gameId,
  });
  if (!contract.hasContract) {
    throw new Error(`Game "${gameId}" does not publish an agent contract yet.`);
  }

  const action = contract.actions.find(
    (candidate) => candidate.actionId === actionId,
  );
  if (!action) {
    throw new Error(`Unknown game action "${actionId}" for game "${gameId}".`);
  }

  if (action.payload.kind === "none") {
    return undefined;
  }

  const game = await inspectGame({
    cwd,
    gameId,
  });

  return (
    runGameAgentHelper<{
      payload: JsonObject | null;
    }>({
      cwd: game.rootDir,
      configPath: game.configPath,
      operation: "resolve-input",
      args: [
        "--game-id",
        gameId,
        "--action-id",
        actionId,
        "--payload-base64",
        Buffer.from(JSON.stringify(payload ?? null), "utf8").toString(
          "base64url",
        ),
      ],
    }).payload ?? undefined
  );
};

export const invokeGameAction = async ({
  controllerSessionId,
  actionId,
  payload,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: InvokeGameActionOptions): Promise<InvokeGameActionResult> => {
  const session = inspectControllerSessionContext(controllerSessionId);
  const runtime = await resolveControllerSessionGameRuntime({
    controllerSessionId,
    timeoutMs,
  });
  if (!runtime.gameId) {
    throw new Error(
      `Controller session "${controllerSessionId}" is not associated with an Air Jam game.`,
    );
  }

  const contract = await inspectGameAgentContract({
    cwd: session.cwd,
    gameId: runtime.gameId,
  });
  if (!contract.hasContract) {
    throw new Error(
      `Game "${runtime.gameId}" does not publish an agent contract yet.`,
    );
  }

  const action = contract.actions.find(
    (candidate) => candidate.actionId === actionId,
  );
  if (!action) {
    throw new Error(
      `Unknown game action "${actionId}" for game "${runtime.gameId}".`,
    );
  }

  const snapshotBefore = await readGameSnapshot({
    controllerSessionId,
    requestSync: true,
    timeoutMs,
  });

  const resolvedPayload = await resolveGameActionPayload({
    cwd: session.cwd,
    gameId: runtime.gameId,
    actionId,
    payload,
  });

  const result = await invokeControllerAction({
    controllerSessionId,
    actionName: action.target.actionName,
    storeDomain:
      snapshotBefore.storeDomainBindings.find(
        (binding) => binding.contractStoreDomain === action.target.storeDomain,
      )?.runtimeStoreDomain ?? action.target.storeDomain,
    payload: resolvedPayload,
  });
  const snapshotAfter = await readGameSnapshot({
    controllerSessionId,
    requestSync: true,
    timeoutMs,
  });
  const { snapshotAfterStatus, observedStateChange } =
    computeGameSnapshotObservation({
      snapshotBefore,
      snapshotAfter,
    });
  const { acknowledgementObservation, outcome } = classifyGameActionOutcome({
    acknowledgement: result.acknowledgement,
    observedStateChange,
  });

  return {
    ...result,
    actionId,
    lane: "player",
    acknowledgementObservation,
    outcome,
    snapshotBefore,
    snapshotAfter,
    snapshotAfterStatus,
    observedStateChange,
  };
};
