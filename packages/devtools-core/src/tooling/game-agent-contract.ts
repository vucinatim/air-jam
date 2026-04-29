import {
  getAirJamGameAgentStoreDomains,
  getAirJamGameAgentActionMetadata,
  resolveAirJamGameAgentActionPayload,
  type AirJamGameAgentContract,
} from "@air-jam/sdk";
import { pathToFileURL } from "node:url";
import {
  loadAirJamAppConfig,
  loadGameAgentContractFromConfig,
  resolveAirJamConfigGameId,
} from "./airjam-machine.js";

const getFlagValue = (flag: string): string | null => {
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const operation = getFlagValue("--operation");
const contractPath = getFlagValue("--contract");
const configPath = getFlagValue("--config");
const gameId = getFlagValue("--game-id");

if (!operation || (!contractPath && !configPath)) {
  throw new Error(
    "Missing required --operation and (--config or --contract) input for game agent contract helper.",
  );
}

const resolveContractFromModule = async (
  nextContractPath: string,
): Promise<AirJamGameAgentContract | null> => {
  const contractModule = (await import(
    pathToFileURL(nextContractPath).toString()
  )) as {
    default?: AirJamGameAgentContract;
    gameAgentContract?: AirJamGameAgentContract;
  };

  return contractModule.gameAgentContract ?? contractModule.default ?? null;
};

const inspectedConfig =
  configPath && operation === "inspect"
    ? await loadAirJamAppConfig(configPath)
    : null;

const resolvedContract: AirJamGameAgentContract | null = inspectedConfig
  ? inspectedConfig.game.agent ?? null
  : configPath
    ? await loadGameAgentContractFromConfig(configPath)
    : await resolveContractFromModule(contractPath!);

if (!resolvedContract) {
  if (configPath && operation === "inspect") {
    process.stdout.write(
      `${JSON.stringify(
        {
          hasContract: false,
        },
        null,
        2,
      )}\n`,
    );
    process.exit(0);
  }

  throw new Error(
    configPath
      ? `Air Jam config "${configPath}" does not export a valid game.agent contract.`
      : `Game agent contract module "${contractPath}" does not export gameAgentContract.`,
  );
}

if (operation === "inspect") {
  const snapshotStoreDomains = getAirJamGameAgentStoreDomains(resolvedContract);
  process.stdout.write(
    `${JSON.stringify(
      {
        hasContract: true,
        snapshotStoreDomains,
        snapshotDescription: resolvedContract.snapshotDescription ?? null,
        actions: Object.entries(resolvedContract.actions).map(
          ([actionId, action]) => {
            const metadata = getAirJamGameAgentActionMetadata(action);
            return {
              actionId,
              target: {
                kind: action.target.kind,
                actionName: action.target.actionName,
                storeDomain: action.target.storeDomain ?? "default",
              },
              description: metadata.description ?? null,
              availability: action.availability ?? null,
              payload: {
                kind: metadata.payload.kind,
                description: metadata.payload.description ?? null,
                ...(metadata.payload.allowedValues
                  ? { allowedValues: [...metadata.payload.allowedValues] }
                  : {}),
              },
              resultDescription: metadata.resultDescription ?? null,
            };
          },
        ),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

if (operation === "project") {
  const controllerId = getFlagValue("--controller-id");
  const storesPayload = getFlagValue("--stores-base64");
  if (!storesPayload) {
    throw new Error("Missing required --stores-base64 input.");
  }

  const stores = JSON.parse(
    Buffer.from(storesPayload, "base64url").toString("utf8"),
  ) as Record<string, Record<string, unknown>>;
  const snapshot = await resolvedContract.projectSnapshot({
    controllerId: controllerId?.trim() || null,
    stores,
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        snapshot,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

if (operation === "read-action") {
  const actionId = getFlagValue("--action-id");
  if (!actionId) {
    throw new Error("Missing required --action-id input.");
  }

  const action = resolvedContract.actions[actionId];
  if (!action) {
    throw new Error(`Unknown game agent action "${actionId}".`);
  }

  process.stdout.write(
    `${JSON.stringify(
      (() => {
        const metadata = getAirJamGameAgentActionMetadata(action);
        return {
          actionId,
          target: {
            kind: action.target.kind,
            actionName: action.target.actionName,
            storeDomain: action.target.storeDomain ?? "default",
          },
          description: metadata.description ?? null,
          availability: action.availability ?? null,
          payload: {
            kind: metadata.payload.kind,
            description: metadata.payload.description ?? null,
            ...(metadata.payload.allowedValues
              ? { allowedValues: [...metadata.payload.allowedValues] }
              : {}),
          },
          resultDescription: metadata.resultDescription ?? null,
        };
      })(),
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

if (operation === "resolve-input") {
  const actionId = getFlagValue("--action-id");
  const payloadBase64 = getFlagValue("--payload-base64");
  if (!actionId || !payloadBase64) {
    throw new Error("Missing required --action-id or --payload-base64 input.");
  }

  const action = resolvedContract.actions[actionId];
  if (!action) {
    throw new Error(`Unknown game agent action "${actionId}".`);
  }

  const payload = JSON.parse(
    Buffer.from(payloadBase64, "base64url").toString("utf8"),
  ) as unknown;
  const resolvedPayload = resolveAirJamGameAgentActionPayload(action, payload, {
    gameId:
      gameId ??
      (configPath
        ? (resolveAirJamConfigGameId(await loadAirJamAppConfig(configPath)) ??
          "unknown-game")
        : "unknown-game"),
    actionName: actionId,
    contractKind: "agent",
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        actionId,
        target: {
          kind: action.target.kind,
          actionName: action.target.actionName,
          storeDomain: action.target.storeDomain ?? "default",
        },
        payload: resolvedPayload ?? null,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

throw new Error(`Unknown game agent contract helper operation "${operation}".`);
