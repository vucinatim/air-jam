import { pathToFileURL } from "node:url";
import { z } from "zod";
import { db, platformDatabaseClient } from "../src/db";
import { RELEASE_REPORT_INTAKE_POLICY } from "../src/lib/releases/release-report-policy";
import { PlatformApplicationError } from "../src/server/application-error";
import { getReleaseReportIntakeStatus } from "../src/server/releases/release-report-intake";
import {
  decideReleaseReportForOperator,
  inspectReleaseReportForOperator,
  listReleaseReportsForOperator,
  reportDecisionInputSchema,
  reportListInputSchema,
} from "../src/server/releases/release-report-operations";

const inputSchema = z.discriminatedUnion("command", [
  z
    .object({ command: z.literal("policy"), json: z.boolean().default(false) })
    .strict(),
  z
    .object({ command: z.literal("status"), json: z.boolean().default(false) })
    .strict(),
  reportListInputSchema.extend({
    command: z.literal("list"),
    json: z.boolean().default(false),
  }),
  z
    .object({
      command: z.literal("inspect"),
      reportId: reportDecisionInputSchema.shape.reportId,
      beforeRevision: z.number().int().positive().optional(),
      json: z.boolean().default(false),
    })
    .strict(),
  reportDecisionInputSchema.extend({
    command: z.literal("decide"),
    apply: z.boolean().default(false),
    json: z.boolean().default(false),
  }),
]);

export const parseReleaseReportCliInput = (input: unknown) =>
  inputSchema.parse(input);

const main = async () => {
  const input = parseReleaseReportCliInput(JSON.parse(process.argv[2] ?? "{}"));
  if (input.command !== "policy" && !process.env.DATABASE_URL?.trim()) {
    throw new Error("database_unavailable");
  }
  // Database credentials select trusted operator authority. Actor is an audit
  // identity, never an authorization claim supplied to a public endpoint.
  try {
    let result: unknown;
    switch (input.command) {
      case "policy":
        result = RELEASE_REPORT_INTAKE_POLICY;
        break;
      case "status":
        result = await getReleaseReportIntakeStatus({ database: db });
        break;
      case "list": {
        const { command: _command, json: _json, ...query } = input;
        result = await listReleaseReportsForOperator({
          database: db,
          input: query,
        });
        break;
      }
      case "inspect":
        result = await inspectReleaseReportForOperator({
          database: db,
          reportId: input.reportId,
          beforeRevision: input.beforeRevision,
        });
        break;
      case "decide": {
        const { command: _command, json: _json, apply, ...decision } = input;
        result = await decideReleaseReportForOperator({
          database: db,
          input: decision,
          apply,
        });
        break;
      }
    }
    console.log(
      JSON.stringify(
        {
          contractVersion: 1,
          command: input.command,
          privacy:
            input.command === "list" ||
            input.command === "policy" ||
            input.command === "status"
              ? "metadata_only"
              : "operator_private_do_not_publish",
          result,
        },
        null,
        2,
      ),
    );
  } finally {
    await platformDatabaseClient.end();
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main().catch((error: unknown) => {
    // Neither parser diagnostics nor database errors may echo report contents,
    // decision reasons, credentials, or connection strings to operator logs.
    const code =
      error instanceof z.ZodError || error instanceof SyntaxError
        ? "invalid_input"
        : error instanceof PlatformApplicationError
          ? error.code
          : "command_failed";
    console.error(JSON.stringify({ contractVersion: 1, error: code }));
    process.exitCode = 1;
  });
}
