import {
  operationalLaneModeValues,
  operationalLaneValues,
  type OperationalLane,
  type OperationalLaneMode,
} from "@air-jam/database-contract";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import {
  getOperationalLaneControl,
  listOperationalLaneControls,
  PRODUCTION_CONTROL_CONTRACT_VERSION,
  setOperationalLaneControl,
} from "../src/server/operations/production-control-service";

type ProductionControlCliInput =
  | { command: "status"; json: boolean }
  | {
      command: "lane-set";
      lane: OperationalLane;
      mode: OperationalLaneMode;
      reason: string;
      retryAfterSeconds: number | null;
      expectedRevision: number;
      actor: string;
      idempotencyKey: string;
      apply: boolean;
      json: boolean;
    };

const fail = (message: string): never => {
  throw new Error(message);
};

const readRequiredText = (
  input: Record<string, unknown>,
  key: string,
): string => {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  return value || fail(`${key} is required.`);
};

const readInteger = (
  input: Record<string, unknown>,
  key: string,
  minimum: number,
): number => {
  const value = Number(input[key]);
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${key} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
};

const parseInput = (raw: string | undefined): ProductionControlCliInput => {
  const serializedInput = raw ?? fail("Missing production-control operation.");
  let value: unknown;
  try {
    value = JSON.parse(serializedInput);
  } catch {
    fail("Production-control operation is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("Production-control operation must be an object.");
  }

  const input = value as Record<string, unknown>;
  const json = input.json === true;
  if (input.command === "status") return { command: "status", json };
  if (input.command !== "lane-set") {
    return fail("Unknown production-control command.");
  }

  const lane = readRequiredText(input, "lane");
  if (!operationalLaneValues.includes(lane as OperationalLane)) {
    fail(`lane must be one of: ${operationalLaneValues.join(", ")}.`);
  }
  const mode = readRequiredText(input, "mode");
  if (!operationalLaneModeValues.includes(mode as OperationalLaneMode)) {
    fail(`mode must be one of: ${operationalLaneModeValues.join(", ")}.`);
  }

  const retryAfterSeconds =
    input.retryAfterSeconds === null || input.retryAfterSeconds === undefined
      ? null
      : readInteger(input, "retryAfterSeconds", 1);

  return {
    command: "lane-set",
    lane: lane as OperationalLane,
    mode: mode as OperationalLaneMode,
    reason: readRequiredText(input, "reason"),
    retryAfterSeconds,
    expectedRevision: readInteger(input, "expectedRevision", 0),
    actor: readRequiredText(input, "actor"),
    idempotencyKey: readRequiredText(input, "idempotencyKey"),
    apply: input.apply === true,
    json,
  };
};

const printJson = (
  command: string,
  applied: boolean,
  result: unknown,
): void => {
  console.log(
    JSON.stringify(
      {
        contractVersion: PRODUCTION_CONTROL_CONTRACT_VERSION,
        command,
        applied,
        result,
      },
      null,
      2,
    ),
  );
};

const main = async (): Promise<void> => {
  const input = parseInput(process.argv[2]);
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    fail(
      "DATABASE_URL is required. Set it directly or select a Railway environment through the repo CLI.",
    );
  const client = postgres(databaseUrl, { max: 1 });
  const database = drizzle(client, { schema });

  try {
    if (input.command === "status") {
      const result = {
        lanes: await listOperationalLaneControls({ database }),
      };
      if (input.json) printJson(input.command, false, result);
      else {
        for (const lane of result.lanes) {
          console.log(
            `${lane.lane}: ${lane.mode} (revision ${lane.revision})${lane.reason ? ` — ${lane.reason}` : ""}`,
          );
        }
      }
      return;
    }

    const current = await getOperationalLaneControl({
      database,
      lane: input.lane,
    });
    if (!input.apply) {
      const result = {
        current,
        requested: {
          lane: input.lane,
          mode: input.mode,
          reason: input.reason,
          retryAfterSeconds: input.retryAfterSeconds,
          expectedRevision: input.expectedRevision,
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
        },
        revisionMatches: current.revision === input.expectedRevision,
      };
      if (input.json) printJson(input.command, false, result);
      else {
        console.log(
          `Would set ${input.lane} from ${current.mode}@${current.revision} to ${input.mode}.`,
        );
        console.log(
          result.revisionMatches
            ? "Expected revision matches. Pass --apply to persist the change."
            : `Expected revision does not match current revision ${current.revision}; apply would fail.`,
        );
      }
      return;
    }

    const control = await setOperationalLaneControl({
      database,
      input: {
        lane: input.lane,
        mode: input.mode,
        reason: input.reason,
        retryAfterSeconds: input.retryAfterSeconds,
        expectedRevision: input.expectedRevision,
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (input.json) printJson(input.command, true, { control });
    else {
      console.log(
        `Set ${control.lane} to ${control.mode} at revision ${control.revision}.`,
      );
    }
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Production-control operation failed.",
  );
  process.exitCode = 1;
});
