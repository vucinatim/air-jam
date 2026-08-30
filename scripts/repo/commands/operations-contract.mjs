import {
  OPERATIONS_CONTRACT_NAME,
  OPERATIONS_CONTRACT_VERSION,
  getOperationsContractCatalog,
  getOperationsContractJsonSchema,
  operationsContractSchemaNames,
  parseOperationsContractValue,
} from "@air-jam/operations-contract";
import fs from "node:fs";
import path from "node:path";

const contractSections = Object.freeze([
  "planes",
  "correlation",
  "event",
  "incident",
  "runbook",
  "safety",
  "schemas",
]);

const contractPathSegments = new Set([
  "contractVersion",
  "plane",
  "eventId",
  "kind",
  "severity",
  "outcome",
  "authority",
  "source",
  "service",
  "component",
  "environment",
  "instanceId",
  "version",
  "subject",
  "type",
  "id",
  "actor",
  "correlation",
  "correlationId",
  "causationEventId",
  "requestId",
  "userSessionId",
  "roomId",
  "runtimeSessionId",
  "controllerId",
  "gameId",
  "releaseId",
  "generationId",
  "jobId",
  "deploymentId",
  "providerOperationId",
  "occurredAt",
  "observedAt",
  "payload",
  "evidence",
  "reference",
  "digestSha256",
  "collectedAt",
  "fingerprint",
  "fingerprintInput",
  "symptomKind",
  "failureClass",
  "scope",
  "scopeKey",
  "incidentId",
  "status",
  "title",
  "summary",
  "owner",
  "firstSeenAt",
  "lastSeenAt",
  "occurrenceCount",
  "latestEventId",
  "correlationIds",
  "activeRunbookActionId",
  "externalIssue",
  "provider",
  "repository",
  "number",
  "url",
  "resolution",
  "code",
  "resolvedAt",
  "resolvedBy",
  "revision",
  "runbookId",
  "runbookVersion",
  "description",
  "mutationClass",
  "blastRadius",
  "environments",
  "services",
  "maxResources",
  "maxEstimatedCostUsd",
  "policy",
  "maxAttempts",
  "cooldownSeconds",
  "timeoutSeconds",
  "requiresApproval",
  "parameters",
  "name",
  "required",
  "allowedValues",
  "actions",
  "action",
  "verificationAction",
  "rollbackRunbookId",
  "previewId",
  "runbookDigestSha256",
  "parametersDigestSha256",
  "createdAt",
  "expiresAt",
  "resourceReferences",
  "estimatedCostUsd",
  "actionIds",
  "beforeEvidence",
  "warnings",
  "mode",
  "idempotencyKey",
  "reason",
  "requestedAt",
  "previewDigestSha256",
  "approval",
  "approvedBy",
  "approvedAt",
  "decisionReference",
  "actionId",
  "attempt",
  "startedAt",
  "completedAt",
  "afterEvidence",
  "result",
  "details",
  "rollbackActionId",
]);

const validationMessages = Object.freeze({
  invalid_type: "Value has an invalid type",
  invalid_value: "Value is not an allowed value",
  unrecognized_keys: "Object contains unsupported fields",
  too_big: "Value exceeds the allowed bound",
  too_small: "Value does not meet the required bound",
  invalid_format: "Value has an invalid format",
  not_multiple_of: "Value does not satisfy the required multiple",
  invalid_union: "Value does not match any supported variant",
  invalid_key: "Object contains an invalid key",
  invalid_element: "Collection contains an invalid element",
});

const findChildCommand = (command, name) =>
  command.commands.find((candidate) => candidate.name() === name) ?? null;

const readJsonInput = (inputPath) => {
  const source =
    inputPath === "-"
      ? fs.readFileSync(0, "utf8")
      : fs.readFileSync(path.resolve(process.cwd(), inputPath), "utf8");
  return JSON.parse(source);
};

const normalizeValidationIssues = (error) => {
  if (error && typeof error === "object" && Array.isArray(error.issues)) {
    return error.issues.map((issue) => ({
      path: Array.isArray(issue.path)
        ? issue.path
            .map((segment) =>
              typeof segment === "number"
                ? String(segment)
                : contractPathSegments.has(segment)
                  ? segment
                  : "<key>",
            )
            .join(".")
        : "",
      code: typeof issue.code === "string" ? issue.code : "invalid_input",
      message:
        issue.code === "custom" && typeof issue.message === "string"
          ? issue.message.slice(0, 500)
          : (validationMessages[issue.code] ?? "Input violates the contract"),
    }));
  }
  return [
    {
      path: "",
      code: "invalid_input",
      message: "Input could not be validated",
    },
  ];
};

export const inspectOperationsContract = (section) => {
  const catalog = getOperationsContractCatalog();
  if (!section) return catalog;
  if (!contractSections.includes(section)) {
    throw new Error(
      `Unknown operations contract section ${section}. Expected one of: ${contractSections.join(", ")}.`,
    );
  }
  return {
    name: catalog.name,
    contractVersion: catalog.contractVersion,
    section,
    value: catalog[section],
  };
};

export const validateOperationsContractInput = ({ schema, value }) => {
  if (!operationsContractSchemaNames.includes(schema)) {
    return {
      ok: false,
      contract: OPERATIONS_CONTRACT_NAME,
      contractVersion: OPERATIONS_CONTRACT_VERSION,
      schema: null,
      issues: [
        {
          path: "",
          code: "invalid_schema",
          message: "A supported schema name is required",
        },
      ],
    };
  }
  try {
    parseOperationsContractValue(schema, value);
    return {
      ok: true,
      contract: OPERATIONS_CONTRACT_NAME,
      contractVersion: OPERATIONS_CONTRACT_VERSION,
      schema,
      issues: [],
    };
  } catch (error) {
    return {
      ok: false,
      contract: OPERATIONS_CONTRACT_NAME,
      contractVersion: OPERATIONS_CONTRACT_VERSION,
      schema,
      issues: normalizeValidationIssues(error),
    };
  }
};

export const registerOperationsContractCommands = (platformCommand) => {
  const operationsCommand =
    findChildCommand(platformCommand, "operations") ??
    platformCommand
      .command("operations")
      .description(
        "Inspect and operate authoritative production lifecycle surfaces",
      );

  const contractCommand = operationsCommand
    .command("contract")
    .description(
      "Inspect and validate the versioned operational event, incident, and runbook contract",
    );

  contractCommand
    .command("inspect")
    .description(
      "Read the stable authority-separated operational contract catalog",
    )
    .option(
      "--section <section>",
      `Limit output to one section: ${contractSections.join(", ")}`,
    )
    .option("--json", "Print stable machine-readable JSON")
    .action((options) => {
      const result = inspectOperationsContract(options.section);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(
        `Air Jam operations contract v${result.contractVersion} (${result.name})`,
      );
      if (options.section) {
        console.log(`Section: ${options.section}`);
      } else {
        console.log(
          `Planes: ${result.planes.map((plane) => plane.id).join(", ")}`,
        );
        console.log(`Schemas: ${result.schemas.join(", ")}`);
      }
      console.log(
        "Use --json for the stable machine document or contract validate to check an envelope.",
      );
    });

  contractCommand
    .command("schema")
    .description(
      "Export one structural JSON Schema; runtime validation remains authoritative for cross-field invariants",
    )
    .requiredOption(
      "--name <schema>",
      `Schema name: ${operationsContractSchemaNames.join(", ")}`,
    )
    .option("--json", "Print stable machine-readable JSON")
    .action((options) => {
      const result = getOperationsContractJsonSchema(options.name);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      console.log(
        `Air Jam operations contract v${result.contractVersion}: ${result.schema}`,
      );
      console.log(`JSON Schema ID: ${result.jsonSchema.$id}`);
      console.log(
        "Runtime validation remains required for cross-field safety invariants.",
      );
    });

  contractCommand
    .command("validate")
    .description(
      "Validate one JSON document without echoing its potentially sensitive payload",
    )
    .requiredOption(
      "--schema <schema>",
      `Schema name: ${operationsContractSchemaNames.join(", ")}`,
    )
    .requiredOption("--input <path>", "JSON file path or - for stdin")
    .option("--json", "Print stable machine-readable JSON")
    .action((options) => {
      let value;
      try {
        value = readJsonInput(options.input);
      } catch (error) {
        const result = {
          ok: false,
          contract: OPERATIONS_CONTRACT_NAME,
          contractVersion: OPERATIONS_CONTRACT_VERSION,
          schema: options.schema,
          issues: [
            {
              path: "",
              code:
                error instanceof SyntaxError
                  ? "invalid_json"
                  : "input_read_failed",
              message:
                error instanceof SyntaxError
                  ? "Input is not valid JSON"
                  : "Input could not be read",
            },
          ],
        };
        if (options.json) console.log(JSON.stringify(result, null, 2));
        else console.error(`Invalid JSON input: ${result.issues[0].message}`);
        process.exitCode = 1;
        return;
      }

      const result = validateOperationsContractInput({
        schema: options.schema,
        value,
      });
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.ok) {
        console.log(
          `✓ ${options.schema} satisfies Air Jam operations contract v${result.contractVersion}`,
        );
      } else {
        console.error(
          `✖ ${options.schema} violates Air Jam operations contract v${result.contractVersion}`,
        );
        for (const issue of result.issues) {
          console.error(
            `  ${issue.path || "<root>"}: ${issue.code} — ${issue.message}`,
          );
        }
      }
      if (!result.ok) process.exitCode = 1;
    });
};
