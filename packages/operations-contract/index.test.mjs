import assert from "node:assert/strict";
import test from "node:test";

import {
  OPERATIONS_CONTRACT_VERSION,
  OPERATIONS_EVENT_MAX_PAYLOAD_BYTES,
  assertIncidentStatusTransition,
  assertRunbookActionStatusTransition,
  assertRunbookInvocationAuthorized,
  createIncidentFingerprint,
  createRunbookDescriptorDigest,
  createRunbookParametersDigest,
  createRunbookPreviewDigest,
  getOperationsContractCatalog,
  getOperationsContractJsonSchema,
  operationalEventEnvelopeSchemaV1,
  operationalIncidentSchemaV1,
  operationalRunbookActionSchemaV1,
  operationalRunbookSchemaV1,
  operationsContractSchemaNames,
  parseOperationsContractValue,
} from "./index.mjs";

const timestamp = "2026-08-30T03:00:00.000Z";
const laterTimestamp = "2026-08-30T03:01:00.000Z";
const expiryTimestamp = "2026-08-30T03:10:00.000Z";

const correlation = {
  contractVersion: 1,
  correlationId: "correlation:release:1",
  releaseId: "release:1",
  generationId: "generation:1",
  jobId: "job:1",
};

const evidence = {
  kind: "event",
  reference: "event:event:1",
  collectedAt: laterTimestamp,
};

const fingerprintInput = {
  contractVersion: 1,
  environment: "production",
  service: "operational_worker",
  symptomKind: "release.job.failed",
  failureClass: "object_store.timeout",
  scope: "release",
  scopeKey: "release:1",
};

const runbook = {
  contractVersion: 1,
  runbookId: "release-processing.pause",
  runbookVersion: "1.0.0",
  title: "Pause release processing",
  description: "Pause one bounded expensive lane and verify admission closes.",
  authority: "bounded_auto",
  mutationClass: "reversible",
  blastRadius: {
    environments: ["production"],
    services: ["platform", "operational_worker"],
    maxResources: 1,
    maxEstimatedCostUsd: 0,
  },
  policy: {
    maxAttempts: 1,
    cooldownSeconds: 300,
    timeoutSeconds: 30,
    requiresApproval: false,
  },
  parameters: [],
  actions: [
    {
      id: "pause",
      action: "production.control.pause",
      description: "Pause the release-processing lane.",
    },
  ],
  verificationAction: "production.control.verify_paused",
  rollbackRunbookId: "release-processing.resume",
};

const previewInvocation = {
  contractVersion: 1,
  mode: "preview",
  runbookId: runbook.runbookId,
  runbookVersion: runbook.runbookVersion,
  idempotencyKey: "incident:1:pause:preview",
  reason: "Preview mitigation for incident 1.",
  incidentId: "incident:1",
  actor: { type: "agent", id: "agent:triage" },
  correlation,
  parameters: {},
  requestedAt: timestamp,
};

const preview = {
  contractVersion: 1,
  previewId: "preview:1",
  runbookId: runbook.runbookId,
  runbookVersion: runbook.runbookVersion,
  runbookDigestSha256: createRunbookDescriptorDigest(runbook),
  parametersDigestSha256: createRunbookParametersDigest({}),
  incidentId: "incident:1",
  correlation,
  createdAt: timestamp,
  expiresAt: expiryTimestamp,
  blastRadius: {
    environments: ["production"],
    services: ["platform", "operational_worker"],
    resourceReferences: ["release:1"],
    estimatedCostUsd: 0,
  },
  actionIds: ["pause"],
  beforeEvidence: [evidence],
  warnings: [],
};

test("operational events accept only the authoritative lifecycle/runtime plane", () => {
  const event = {
    contractVersion: OPERATIONS_CONTRACT_VERSION,
    plane: "lifecycle_runtime",
    eventId: "event:1",
    kind: "release.job.failed",
    severity: "error",
    outcome: "failed",
    authority: "airjam_authoritative",
    source: {
      service: "operational_worker",
      component: "release-job-executor",
      environment: "production",
      version: "commit:abc123",
    },
    subject: { type: "operational_job", id: "job:1" },
    actor: { type: "system", id: "worker:release" },
    correlation,
    occurredAt: timestamp,
    observedAt: laterTimestamp,
    payload: { errorCode: "object_store.timeout", retryable: true },
    evidence: [evidence],
  };

  assert.equal(
    operationalEventEnvelopeSchemaV1.parse(event).eventId,
    "event:1",
  );
  assert.throws(() =>
    operationalEventEnvelopeSchemaV1.parse({
      ...event,
      plane: "product_telemetry",
    }),
  );
  assert.throws(() =>
    operationalEventEnvelopeSchemaV1.parse({ ...event, token: "secret" }),
  );
});

test("operational events reject impossible chronology and unbounded payloads", () => {
  const base = {
    contractVersion: 1,
    plane: "lifecycle_runtime",
    eventId: "event:2",
    kind: "runtime.room.degraded",
    severity: "warning",
    outcome: "degraded",
    authority: "synthetic_observation",
    source: {
      service: "realtime_server",
      component: "room-synthetic",
      environment: "production",
    },
    subject: { type: "room", id: "room:safe-opaque-id" },
    correlation: { contractVersion: 1, correlationId: "correlation:room:1" },
    occurredAt: laterTimestamp,
    observedAt: timestamp,
    payload: {},
    evidence: [],
  };

  assert.throws(() => operationalEventEnvelopeSchemaV1.parse(base));
  assert.throws(() =>
    operationalEventEnvelopeSchemaV1.parse({
      ...base,
      occurredAt: timestamp,
      observedAt: laterTimestamp,
      payload: { body: "x".repeat(OPERATIONS_EVENT_MAX_PAYLOAD_BYTES) },
    }),
  );
});

test("incident fingerprints are stable and separate different scopes", () => {
  const first = createIncidentFingerprint(fingerprintInput);
  const second = createIncidentFingerprint({ ...fingerprintInput });
  const other = createIncidentFingerprint({
    ...fingerprintInput,
    scopeKey: "release:2",
  });

  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.throws(() =>
    createIncidentFingerprint({
      ...fingerprintInput,
      scope: "global",
      scopeKey: "must-not-exist",
    }),
  );
});

test("incidents require coherent terminal resolution state", () => {
  const incident = {
    contractVersion: 1,
    incidentId: "incident:1",
    fingerprint: createIncidentFingerprint(fingerprintInput),
    fingerprintInput,
    severity: "sev2",
    status: "investigating",
    title: "Release processing failures",
    summary: "Multiple jobs share one confirmed production failure class.",
    owner: { type: "agent", id: "agent:triage" },
    firstSeenAt: timestamp,
    lastSeenAt: laterTimestamp,
    occurrenceCount: 2,
    latestEventId: "event:2",
    correlationIds: [correlation.correlationId],
    evidence: [evidence],
    revision: 1,
  };

  assert.equal(
    operationalIncidentSchemaV1.parse(incident).status,
    "investigating",
  );
  assert.throws(() =>
    operationalIncidentSchemaV1.parse({ ...incident, status: "resolved" }),
  );
  assert.throws(() =>
    operationalIncidentSchemaV1.parse({
      ...incident,
      fingerprint: "0".repeat(64),
    }),
  );
  assert.throws(() =>
    operationalIncidentSchemaV1.parse({
      ...incident,
      resolution: {
        code: "dependency.recovered",
        summary: "The dependency recovered.",
        resolvedAt: laterTimestamp,
        resolvedBy: { type: "operator", id: "operator:tim" },
      },
    }),
  );
});

test("incident and action transitions fail closed", () => {
  assert.deepEqual(assertIncidentStatusTransition("open", "investigating"), {
    from: "open",
    to: "investigating",
  });
  assert.throws(() => assertIncidentStatusTransition("resolved", "mitigating"));
  assert.deepEqual(assertRunbookActionStatusTransition("running", "failed"), {
    from: "running",
    to: "failed",
  });
  assert.throws(() =>
    assertRunbookActionStatusTransition("succeeded", "running"),
  );
});

test("bounded automatic runbooks must remain reversible and verifiable", () => {
  assert.equal(
    operationalRunbookSchemaV1.parse(runbook).authority,
    "bounded_auto",
  );
  assert.throws(() =>
    operationalRunbookSchemaV1.parse({
      ...runbook,
      mutationClass: "destructive",
    }),
  );
  assert.throws(() =>
    operationalRunbookSchemaV1.parse({
      ...runbook,
      rollbackRunbookId: undefined,
    }),
  );
  assert.throws(() =>
    operationalRunbookSchemaV1.parse({
      ...runbook,
      policy: { ...runbook.policy, requiresApproval: true },
    }),
  );
});

test("runbook apply binds to the exact descriptor and preview", () => {
  assert.equal(
    assertRunbookInvocationAuthorized(runbook, previewInvocation).invocation
      .mode,
    "preview",
  );
  const apply = {
    ...previewInvocation,
    mode: "apply",
    previewId: "preview:1",
    previewDigestSha256: createRunbookPreviewDigest(preview),
    idempotencyKey: "incident:1:pause:apply",
    requestedAt: laterTimestamp,
  };
  assert.equal(
    assertRunbookInvocationAuthorized(runbook, apply, preview).invocation.mode,
    "apply",
  );
  assert.throws(() =>
    assertRunbookInvocationAuthorized(
      runbook,
      { ...apply, runbookVersion: "2.0.0" },
      preview,
    ),
  );
  assert.throws(() => assertRunbookInvocationAuthorized(runbook, apply));
  const expiredPreview = {
    ...preview,
    expiresAt: laterTimestamp,
  };
  assert.throws(
    () =>
      assertRunbookInvocationAuthorized(
        runbook,
        {
          ...apply,
          previewDigestSha256: createRunbookPreviewDigest(expiredPreview),
          requestedAt: expiryTimestamp,
        },
        expiredPreview,
      ),
    /not valid at apply time/u,
  );
  const oversizedPreview = {
    ...preview,
    blastRadius: { ...preview.blastRadius, estimatedCostUsd: 1 },
  };
  assert.throws(
    () =>
      assertRunbookInvocationAuthorized(
        runbook,
        {
          ...apply,
          previewDigestSha256: createRunbookPreviewDigest(oversizedPreview),
        },
        oversizedPreview,
      ),
    /exceeds the descriptor blast radius/u,
  );

  const approvalRunbook = {
    ...runbook,
    authority: "approval_required",
    mutationClass: "destructive",
    policy: { ...runbook.policy, requiresApproval: true },
    rollbackRunbookId: undefined,
  };
  const approvalPreview = {
    ...preview,
    runbookDigestSha256: createRunbookDescriptorDigest(approvalRunbook),
  };
  const approvalApply = {
    ...apply,
    previewDigestSha256: createRunbookPreviewDigest(approvalPreview),
  };
  assert.throws(() =>
    assertRunbookInvocationAuthorized(
      approvalRunbook,
      approvalApply,
      approvalPreview,
    ),
  );
  assert.equal(
    assertRunbookInvocationAuthorized(
      approvalRunbook,
      {
        ...approvalApply,
        approval: {
          approvedBy: { type: "operator", id: "operator:tim" },
          approvedAt: laterTimestamp,
          decisionReference: "github:approval:1",
        },
      },
      approvalPreview,
    ).invocation.mode,
    "apply",
  );
  assert.throws(
    () =>
      assertRunbookInvocationAuthorized(
        approvalRunbook,
        {
          ...approvalApply,
          approval: {
            approvedBy: { type: "agent", id: "agent:self-approver" },
            approvedAt: laterTimestamp,
            decisionReference: "github:approval:2",
          },
        },
        approvalPreview,
      ),
    /must be issued by an operator/u,
  );
});

test("runbook parameters and previews are bound to declared bounded input", () => {
  assert.equal(
    createRunbookParametersDigest({ alpha: 1, nested: { beta: 2, gamma: 3 } }),
    createRunbookParametersDigest({ nested: { gamma: 3, beta: 2 }, alpha: 1 }),
  );

  const parameterizedRunbook = {
    ...runbook,
    parameters: [
      {
        name: "lane",
        type: "enum",
        required: true,
        description: "Bounded lane to pause.",
        allowedValues: ["release_processing"],
      },
    ],
  };
  const parameters = { lane: "release_processing" };
  const parameterizedPreview = {
    ...preview,
    runbookDigestSha256: createRunbookDescriptorDigest(parameterizedRunbook),
    parametersDigestSha256: createRunbookParametersDigest(parameters),
  };
  const apply = {
    ...previewInvocation,
    mode: "apply",
    previewId: parameterizedPreview.previewId,
    previewDigestSha256: createRunbookPreviewDigest(parameterizedPreview),
    parameters,
    requestedAt: laterTimestamp,
  };

  assert.equal(
    assertRunbookInvocationAuthorized(
      parameterizedRunbook,
      apply,
      parameterizedPreview,
    ).preview.previewId,
    "preview:1",
  );
  assert.throws(() =>
    assertRunbookInvocationAuthorized(
      parameterizedRunbook,
      { ...apply, parameters: { lane: "unknown" } },
      parameterizedPreview,
    ),
  );
  assert.throws(() =>
    assertRunbookInvocationAuthorized(
      parameterizedRunbook,
      { ...apply, parameters: { lane: "release_processing", extra: true } },
      parameterizedPreview,
    ),
  );
});

test("terminal runbook actions require completion evidence", () => {
  const action = {
    contractVersion: 1,
    actionId: "action:1",
    runbookId: runbook.runbookId,
    runbookVersion: runbook.runbookVersion,
    incidentId: "incident:1",
    previewId: "preview:1",
    previewDigestSha256: createRunbookPreviewDigest(preview),
    idempotencyKey: "incident:1:pause:apply",
    actor: { type: "agent", id: "agent:triage" },
    correlation,
    status: "succeeded",
    attempt: 1,
    requestedAt: timestamp,
    startedAt: timestamp,
    completedAt: laterTimestamp,
    beforeEvidence: [evidence],
    afterEvidence: [{ ...evidence, reference: "event:event:verified" }],
    result: {
      code: "production.control.paused",
      summary: "The lane is paused and rejecting new work.",
      details: {},
    },
  };

  assert.equal(
    operationalRunbookActionSchemaV1.parse(action).status,
    "succeeded",
  );
  assert.throws(() =>
    operationalRunbookActionSchemaV1.parse({
      ...action,
      completedAt: undefined,
      result: undefined,
    }),
  );
  assert.throws(() =>
    operationalRunbookActionSchemaV1.parse({
      ...action,
      status: "running",
    }),
  );
  assert.throws(() =>
    operationalRunbookActionSchemaV1.parse({
      ...action,
      status: "rolled_back",
      rollbackActionId: undefined,
    }),
  );
});

test("contract catalog is authority-separated and returned as a detached value", () => {
  const first = getOperationsContractCatalog();
  assert.equal(first.contractVersion, OPERATIONS_CONTRACT_VERSION);
  assert.deepEqual(first.schemas, operationsContractSchemaNames);
  assert.equal(first.planes[0].id, "product_telemetry");
  assert.ok(first.planes[0].forbiddenUses.includes("automatic remediation"));
  first.planes[0].id = "mutated";
  assert.equal(
    getOperationsContractCatalog().planes[0].id,
    "product_telemetry",
  );
});

test("every named contract exports structural JSON Schema", () => {
  for (const schemaName of operationsContractSchemaNames) {
    const document = getOperationsContractJsonSchema(schemaName);
    assert.equal(document.schema, schemaName);
    assert.equal(document.runtimeValidationRequired, true);
    assert.equal(
      document.jsonSchema.$id,
      `https://airjam.dev/contracts/operations/v1/${schemaName}.schema.json`,
    );
    assert.equal(
      document.jsonSchema.$schema,
      "http://json-schema.org/draft-07/schema#",
    );
  }
});

test("named schema parsing rejects unknown schemas and unknown versions", () => {
  assert.equal(
    parseOperationsContractValue("runbook", runbook).contractVersion,
    OPERATIONS_CONTRACT_VERSION,
  );
  assert.throws(() => parseOperationsContractValue("unknown", {}));
  assert.throws(() =>
    parseOperationsContractValue("runbook", {
      ...runbook,
      contractVersion: 2,
    }),
  );
});
