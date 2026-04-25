import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommandResult } from "./commands.js";
import {
  inspectControllerSessionContext,
  invokeControllerAction,
  readRuntimeSnapshot,
} from "./controller.js";
import { inspectGame } from "./games.js";
import type {
  AirJamGameAgentContractInspection,
  AirJamGameSnapshotInspection,
  InspectGameAgentContractOptions,
  InvokeGameActionOptions,
  InvokeGameActionResult,
  JsonObject,
  ReadGameSnapshotOptions,
} from "./types.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_TIMEOUT_MS = 5_000;

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
      resolveTsxCliPath(),
      resolveHelperScriptPath("game-agent-contract.ts"),
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
      `Air Jam game agent helper failed.\n\n${result.stderr || result.stdout}`,
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
}: InspectGameAgentContractOptions = {}): Promise<AirJamGameAgentContractInspection> => {
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
    gameId: string;
    snapshotStoreDomains: string[];
    snapshotDescription: string | null;
    actions: AirJamGameAgentContractInspection["actions"];
  }>({
    cwd: game.rootDir,
    configPath: source.configPath,
    operation: "inspect",
  });

  return {
    gameId: helperResult.gameId,
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
  if (!session.gameId) {
    throw new Error(
      `Controller session "${controllerSessionId}" is not associated with an Air Jam game.`,
    );
  }

  const contract = await inspectGameAgentContract({
    cwd: session.cwd,
    gameId: session.gameId,
  });
  if (!contract.hasContract) {
    throw new Error(
      `Game "${session.gameId}" does not publish an agent contract yet.`,
    );
  }

  const runtimeSnapshot = await readRuntimeSnapshot({
    controllerSessionId,
    storeDomains: contract.snapshotStoreDomains,
    requestSync,
    timeoutMs,
  });
  const rawStores = runtimeSnapshot.storeSnapshots.filter((snapshot) =>
    contract.snapshotStoreDomains.includes(snapshot.storeDomain),
  );
  const storesPayload = rawStores.reduce<Record<string, JsonObject>>(
    (nextStores, snapshot) => {
      nextStores[snapshot.storeDomain] = snapshot.data;
      return nextStores;
    },
    {},
  );

  const helperResult = runGameAgentHelper<{
    snapshot: JsonObject;
  }>({
    cwd: session.cwd,
    configPath: (
      await inspectGame({ cwd: session.cwd, gameId: session.gameId })
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
    gameId: session.gameId,
    snapshotStoreDomains: [...contract.snapshotStoreDomains],
    snapshotDescription: contract.snapshotDescription,
    actions: contract.actions,
    snapshot: helperResult.snapshot,
    rawStores,
  };
};

export const invokeGameAction = async ({
  controllerSessionId,
  actionId,
  payload,
}: InvokeGameActionOptions): Promise<InvokeGameActionResult> => {
  const session = inspectControllerSessionContext(controllerSessionId);
  if (!session.gameId) {
    throw new Error(
      `Controller session "${controllerSessionId}" is not associated with an Air Jam game.`,
    );
  }

  const contract = await inspectGameAgentContract({
    cwd: session.cwd,
    gameId: session.gameId,
  });
  if (!contract.hasContract) {
    throw new Error(
      `Game "${session.gameId}" does not publish an agent contract yet.`,
    );
  }

  const action = contract.actions.find(
    (candidate) => candidate.actionId === actionId,
  );
  if (!action) {
    throw new Error(
      `Unknown game action "${actionId}" for game "${session.gameId}".`,
    );
  }

  const resolvedPayload =
    action.payload.kind === "none"
      ? undefined
      : (runGameAgentHelper<{
          payload: JsonObject | null;
        }>({
          cwd: session.cwd,
          configPath: (
            await inspectGame({
              cwd: session.cwd,
              gameId: session.gameId,
            })
          ).configPath,
          operation: "resolve-input",
          args: [
            "--action-id",
            actionId,
            "--payload-base64",
            Buffer.from(JSON.stringify(payload ?? null), "utf8").toString(
              "base64url",
            ),
          ],
        }).payload ?? undefined);

  const result = await invokeControllerAction({
    controllerSessionId,
    actionName: action.target.actionName,
    storeDomain: action.target.storeDomain,
    payload: resolvedPayload,
  });

  return {
    ...result,
    actionId,
  };
};
