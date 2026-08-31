import {
  assessHostedReleaseOrigin,
  HOSTED_RELEASE_PUBLIC_ORIGIN_ENV,
  type HostedReleaseOriginAssessment,
} from "../src/lib/releases/hosted-release-origin";
import {
  attestRemoteReleaseOrigin,
  inspectRemoteReleaseOrigin,
  ReleaseOriginOperatorError,
  type RemoteReleaseOriginInspectionResult,
} from "./release-origin-attestation";

const CLI_CONTRACT_VERSION = 2 as const;

type ReleaseOriginInspectInput = {
  command: "inspect";
  json: boolean;
  platformUrl: string | null;
};

type ReleaseOriginAttestInput = {
  command: "attest";
  json: boolean;
  platformUrl: string;
  releaseUrl: string;
};

type ReleaseOriginCliInput =
  | ReleaseOriginInspectInput
  | ReleaseOriginAttestInput;

type LocalReleaseOriginInspectionResult = {
  source: { type: "local" };
  assessment: HostedReleaseOriginAssessment;
};

type ReleaseOriginInspectionResult =
  | LocalReleaseOriginInspectionResult
  | RemoteReleaseOriginInspectionResult;

const isLocalInspectionResult = (
  result: ReleaseOriginInspectionResult,
): result is LocalReleaseOriginInspectionResult =>
  result.source.type === "local";

const fail = (message: string): never => {
  throw new Error(message);
};

const parseInput = (raw: string | undefined): ReleaseOriginCliInput => {
  const serializedInput =
    raw ?? fail("Missing release-origin CLI operation payload.");

  let value: unknown;
  try {
    value = JSON.parse(serializedInput);
  } catch {
    return fail("Release-origin CLI operation payload is not valid JSON.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("Release-origin CLI operation payload must be an object.");
  }

  const input = value as Record<string, unknown>;
  if (input.command !== "inspect" && input.command !== "attest") {
    return fail("Unknown release-origin CLI command.");
  }
  if (input.platformUrl !== null && typeof input.platformUrl !== "string") {
    return fail("Release-origin platformUrl must be a string or null.");
  }

  if (input.command === "attest") {
    if (typeof input.platformUrl !== "string") {
      return fail("Release-origin attestation requires platformUrl.");
    }
    if (typeof input.releaseUrl !== "string") {
      return fail("Release-origin attestation requires releaseUrl.");
    }
    return {
      command: "attest",
      json: input.json === true,
      platformUrl: input.platformUrl,
      releaseUrl: input.releaseUrl,
    };
  }

  return {
    command: "inspect",
    json: input.json === true,
    platformUrl: input.platformUrl,
  };
};

const inspectLocalEnvironment = (): LocalReleaseOriginInspectionResult => ({
  source: { type: "local" as const },
  assessment: assessHostedReleaseOrigin(),
});

const main = async (): Promise<void> => {
  const input = parseInput(process.argv[2]);
  if (input.command === "attest") {
    const result = await attestRemoteReleaseOrigin({
      platformUrl: input.platformUrl,
      releaseUrl: input.releaseUrl,
    });
    if (input.json) {
      console.log(
        JSON.stringify(
          {
            contractVersion: CLI_CONTRACT_VERSION,
            command: "release-origin.attest",
            ...result,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(`Hosted release origin attestation: ${result.status}`);
      console.log(`Evidence kind: ${result.evidenceKind}`);
      console.log(`Attested at: ${result.attestedAt}`);
      console.log(`Platform origin: ${result.source.platformOrigin}`);
      console.log(`Release origin: ${result.source.releaseOrigin}`);
      for (const item of result.checks) {
        console.log(
          `${item.status === "passed" ? "✓" : "✗"} ${item.id}: ${item.summary}`,
        );
      }
      console.log(
        `Checks: ${result.summary.passed} passed, ${result.summary.failed} failed`,
      );
      console.log(
        `Production deployment evidence: ${result.productionEvidenceEligible ? "eligible" : "diagnostic only"}`,
      );
    }
    if (result.status === "failed") process.exitCode = 1;
    return;
  }

  const result: ReleaseOriginInspectionResult = input.platformUrl
    ? await inspectRemoteReleaseOrigin(input.platformUrl)
    : inspectLocalEnvironment();

  if (input.json) {
    console.log(
      JSON.stringify(
        {
          contractVersion: CLI_CONTRACT_VERSION,
          command: "release-origin.inspect",
          environmentKey: HOSTED_RELEASE_PUBLIC_ORIGIN_ENV,
          ...result,
        },
        null,
        2,
      ),
    );
    return;
  }

  const sourceLabel =
    result.source.type === "remote"
      ? `remote ${result.source.platformOrigin}`
      : "local environment";
  console.log(
    `Hosted release origin (${sourceLabel}): ${result.assessment.status}`,
  );
  console.log(`Environment key: ${HOSTED_RELEASE_PUBLIC_ORIGIN_ENV}`);

  if (isLocalInspectionResult(result)) {
    console.log(
      `Authenticated platform origin: ${result.assessment.platformOrigin}`,
    );
    if (result.assessment.status === "ready") {
      console.log(
        `Untrusted release origin: ${result.assessment.publicOrigin}`,
      );
      console.log(`Release cookie site: ${result.assessment.cookieSite}`);
      return;
    }
    console.log(`Reason: ${result.assessment.reason}`);
    return;
  }

  console.log(
    `Platform readiness: ${result.readiness.ok ? "ready" : "unready"} (HTTP ${result.readiness.httpStatus})`,
  );
  console.log(
    `Canonical platform origin: ${result.requestPolicy.platformPublicOrigin}`,
  );
  console.log(
    `Railway preview policy: ${result.requestPolicy.isRailwayPreviewEnvironment ? "yes" : "no"}`,
  );
  console.log(
    `Admitted platform hosts: ${result.requestPolicy.platformRequestHosts.join(", ")}`,
  );
  console.log(`Boundary required: ${result.assessment.required}`);
  console.log(
    `Untrusted release origin: ${result.assessment.publicOrigin ?? "unavailable"}`,
  );
  if (result.assessment.reason) {
    console.log(`Reason: ${result.assessment.reason}`);
  }
};

const jsonOutputWasRequested = (): boolean => {
  try {
    const input = JSON.parse(process.argv[2] ?? "null") as unknown;
    return (
      Boolean(input) &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      (input as Record<string, unknown>).json === true
    );
  } catch {
    return false;
  }
};

void main().catch((error: unknown) => {
  const inspectionError =
    error instanceof ReleaseOriginOperatorError ? error : null;
  const message =
    error instanceof Error
      ? error.message
      : "Release-origin inspection failed.";

  if (jsonOutputWasRequested()) {
    let command = "release-origin.inspect";
    try {
      const parsed = JSON.parse(process.argv[2] ?? "null") as Record<
        string,
        unknown
      > | null;
      if (parsed?.command === "attest") command = "release-origin.attest";
    } catch {
      // Keep the inspection command as the stable fallback envelope.
    }
    console.log(
      JSON.stringify(
        {
          contractVersion: CLI_CONTRACT_VERSION,
          command,
          error: {
            code: inspectionError?.code ?? "INSPECTION_FAILED",
            message,
          },
        },
        null,
        2,
      ),
    );
  } else {
    console.error(message);
  }
  process.exitCode = 1;
});
