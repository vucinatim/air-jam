import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  inspectOperationsContract,
  validateOperationsContractInput,
} from "../commands/operations-contract.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");

const readHelp = (...args) =>
  execFileSync(process.execPath, [cliPath, ...args, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const validEvent = {
  contractVersion: 1,
  plane: "lifecycle_runtime",
  eventId: "event:cli:1",
  kind: "synthetic.platform.failed",
  severity: "error",
  outcome: "failed",
  authority: "synthetic_observation",
  source: {
    service: "platform",
    component: "platform-health",
    environment: "production",
  },
  subject: { type: "synthetic_check", id: "synthetic:platform-health" },
  correlation: {
    contractVersion: 1,
    correlationId: "correlation:synthetic:1",
    deploymentId: "deployment:1",
  },
  occurredAt: "2026-08-30T03:00:00.000Z",
  observedAt: "2026-08-30T03:00:01.000Z",
  payload: { statusCode: 503 },
  evidence: [],
};

test("operations contract is discoverable through the canonical repo CLI", () => {
  const platformHelp = readHelp("platform");
  const operationsHelp = readHelp("platform", "operations");
  const contractHelp = readHelp("platform", "operations", "contract");
  const inspectHelp = readHelp("platform", "operations", "contract", "inspect");
  const validateHelp = readHelp(
    "platform",
    "operations",
    "contract",
    "validate",
  );
  const schemaHelp = readHelp("platform", "operations", "contract", "schema");

  assert.match(platformHelp, /operations/);
  assert.match(operationsHelp, /contract/);
  assert.match(contractHelp, /inspect/);
  assert.match(contractHelp, /schema/);
  assert.match(contractHelp, /validate/);
  assert.match(inspectHelp, /--section/);
  assert.match(inspectHelp, /--json/);
  assert.match(validateHelp, /--schema/);
  assert.match(validateHelp, /--input/);
  assert.match(validateHelp, /stdin/);
  assert.match(validateHelp, /--json/);
  assert.match(schemaHelp, /--name/);
  assert.match(schemaHelp, /--json/);
});

test("operations contract inspection returns stable authority-separated JSON", () => {
  const output = execFileSync(
    process.execPath,
    [cliPath, "platform", "operations", "contract", "inspect", "--json"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const contract = JSON.parse(output);

  assert.equal(contract.name, "air-jam-operations");
  assert.equal(contract.contractVersion, 1);
  assert.deepEqual(
    contract.planes.map((plane) => plane.id),
    ["product_telemetry", "lifecycle_runtime", "operational_incident"],
  );
  assert.ok(contract.planes[0].forbiddenUses.includes("automatic remediation"));
  assert.ok(contract.schemas.includes("operational_event"));
  assert.ok(contract.schemas.includes("runbook_action"));
});

test("operations contract exports JSON Schema for external agents", () => {
  const output = execFileSync(
    process.execPath,
    [
      cliPath,
      "platform",
      "operations",
      "contract",
      "schema",
      "--name",
      "runbook_preview",
      "--json",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const document = JSON.parse(output);

  assert.equal(document.schema, "runbook_preview");
  assert.equal(document.runtimeValidationRequired, true);
  assert.equal(
    document.jsonSchema.$id,
    "https://airjam.dev/contracts/operations/v1/runbook_preview.schema.json",
  );
  assert.equal(document.jsonSchema.additionalProperties, false);
});

test("section inspection rejects typos instead of returning empty state", () => {
  assert.equal(inspectOperationsContract("incident").section, "incident");
  assert.throws(() => inspectOperationsContract("incdient"), /Unknown/u);
});

test("contract validation reports only paths and messages, never input values", () => {
  const valid = validateOperationsContractInput({
    schema: "operational_event",
    value: validEvent,
  });
  assert.deepEqual(valid.issues, []);
  assert.equal(valid.ok, true);

  const secret = "must-not-appear-in-validation-output";
  const invalid = validateOperationsContractInput({
    schema: "operational_event",
    value: { ...validEvent, authorization: secret },
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.length > 0);
  assert.doesNotMatch(JSON.stringify(invalid), new RegExp(secret, "u"));

  const secretKey = "must-not-appear-as-an-unknown-field";
  const invalidKey = validateOperationsContractInput({
    schema: "operational_event",
    value: { ...validEvent, [secretKey]: true },
  });
  assert.doesNotMatch(JSON.stringify(invalidKey), new RegExp(secretKey, "u"));

  const chronology = validateOperationsContractInput({
    schema: "operational_event",
    value: {
      ...validEvent,
      observedAt: "2026-08-30T02:59:59.000Z",
    },
  });
  assert.deepEqual(chronology.issues[0], {
    path: "observedAt",
    code: "custom",
    message: "observedAt must not precede occurredAt",
  });

  const invalidSchema = validateOperationsContractInput({
    schema: "secret-schema-name",
    value: validEvent,
  });
  assert.equal(invalidSchema.schema, null);
  assert.equal(invalidSchema.issues[0].code, "invalid_schema");
  assert.doesNotMatch(JSON.stringify(invalidSchema), /secret-schema-name/u);
});

test("CLI validation is nonzero for invalid input and does not echo the payload", () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-operations-contract-"),
  );
  try {
    const validPath = path.join(tempRoot, "valid.json");
    const invalidPath = path.join(tempRoot, "invalid.json");
    const malformedPath = path.join(tempRoot, "malformed.json");
    const secret = "cli-secret-value-must-stay-redacted";
    fs.writeFileSync(validPath, JSON.stringify(validEvent), "utf8");
    fs.writeFileSync(
      invalidPath,
      JSON.stringify({ ...validEvent, token: secret }),
      "utf8",
    );
    fs.writeFileSync(
      malformedPath,
      `{"password":"malformed-secret-value"`,
      "utf8",
    );

    const validResult = spawnSync(
      process.execPath,
      [
        cliPath,
        "platform",
        "operations",
        "contract",
        "validate",
        "--schema",
        "operational_event",
        "--input",
        validPath,
        "--json",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(validResult.status, 0, validResult.stderr);
    assert.equal(JSON.parse(validResult.stdout).ok, true);

    const invalidResult = spawnSync(
      process.execPath,
      [
        cliPath,
        "platform",
        "operations",
        "contract",
        "validate",
        "--schema",
        "operational_event",
        "--input",
        invalidPath,
        "--json",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(invalidResult.status, 1);
    assert.equal(JSON.parse(invalidResult.stdout).ok, false);
    assert.doesNotMatch(
      `${invalidResult.stdout}\n${invalidResult.stderr}`,
      new RegExp(secret, "u"),
    );

    const malformedResult = spawnSync(
      process.execPath,
      [
        cliPath,
        "platform",
        "operations",
        "contract",
        "validate",
        "--schema",
        "operational_event",
        "--input",
        malformedPath,
        "--json",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(malformedResult.status, 1);
    assert.equal(
      JSON.parse(malformedResult.stdout).issues[0].code,
      "invalid_json",
    );
    assert.doesNotMatch(
      `${malformedResult.stdout}\n${malformedResult.stderr}`,
      /malformed-secret-value/u,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
