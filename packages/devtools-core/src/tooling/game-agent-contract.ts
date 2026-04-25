import type { AirJamGameAgentContract } from "@air-jam/sdk";
import { pathToFileURL } from "node:url";
import {
  loadAirJamAppConfig,
  loadGameAgentContractFromConfig,
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

const resolvedContract =
  configPath && operation === "inspect"
    ? ((await loadAirJamAppConfig(configPath)).game.machine?.agent ?? null)
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
      ? `Air Jam config "${configPath}" does not export a valid game.machine.agent contract.`
      : `Game agent contract module "${contractPath}" does not export gameAgentContract.`,
  );
}

if (operation === "inspect") {
  process.stdout.write(
    `${JSON.stringify(
      {
        hasContract: true,
        gameId: resolvedContract.gameId,
        snapshotStoreDomains: resolvedContract.snapshotStoreDomains ?? [
          "default",
        ],
        snapshotDescription: resolvedContract.snapshotDescription ?? null,
        actions: Object.entries(resolvedContract.actions).map(
          ([actionId, action]) => ({
            actionId,
            target: {
              kind: action.target.kind,
              actionName: action.target.actionName,
              storeDomain: action.target.storeDomain ?? "default",
            },
            description: action.description ?? null,
            availability: action.availability ?? null,
            payload: {
              kind: action.payload.kind,
              description: action.payload.description ?? null,
              ...(action.payload.allowedValues
                ? { allowedValues: [...action.payload.allowedValues] }
                : {}),
            },
            resultDescription: action.resultDescription ?? null,
          }),
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
      {
        actionId,
        target: {
          kind: action.target.kind,
          actionName: action.target.actionName,
          storeDomain: action.target.storeDomain ?? "default",
        },
        description: action.description ?? null,
        availability: action.availability ?? null,
        payload: {
          kind: action.payload.kind,
          description: action.payload.description ?? null,
          ...(action.payload.allowedValues
            ? { allowedValues: [...action.payload.allowedValues] }
            : {}),
        },
        resultDescription: action.resultDescription ?? null,
      },
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
  const resolvedPayload =
    action.payload.kind === "none"
      ? undefined
      : action.resolveInput
        ? action.resolveInput(payload)
        : payload;

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
