import {
  assessHostedReleaseOrigin,
  HOSTED_RELEASE_PUBLIC_ORIGIN_ENV,
  type HostedReleaseOriginAssessment,
} from "../src/lib/releases/hosted-release-origin";

const CLI_CONTRACT_VERSION = 1 as const;
const REMOTE_REQUEST_TIMEOUT_MS = 5_000;
const MAX_REMOTE_RESPONSE_BYTES = 64 * 1024;

type ReleaseOriginCliInput = {
  command: "inspect";
  json: boolean;
  platformUrl: string | null;
};

type RemoteHostedReleaseOriginAssessment = {
  required: boolean;
  status: "ready" | "disabled" | "invalid";
  publicOrigin: string | null;
  reason: string | null;
};

type LocalReleaseOriginInspectionResult = {
  source: { type: "local" };
  assessment: HostedReleaseOriginAssessment;
};

type RemoteReleaseOriginInspectionResult = {
  source: { type: "remote"; platformOrigin: string };
  health: { httpStatus: 200 | 503; ok: boolean };
  assessment: RemoteHostedReleaseOriginAssessment;
};

type ReleaseOriginInspectionResult =
  | LocalReleaseOriginInspectionResult
  | RemoteReleaseOriginInspectionResult;

const isLocalInspectionResult = (
  result: ReleaseOriginInspectionResult,
): result is LocalReleaseOriginInspectionResult =>
  result.source.type === "local";

class ReleaseOriginInspectionError extends Error {
  constructor(
    readonly code:
      | "INVALID_PLATFORM_URL"
      | "REMOTE_REQUEST_FAILED"
      | "REMOTE_HTTP_ERROR"
      | "REMOTE_CONTRACT_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "ReleaseOriginInspectionError";
  }
}

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
  if (input.command !== "inspect") {
    return fail("Unknown release-origin CLI command.");
  }
  if (input.platformUrl !== null && typeof input.platformUrl !== "string") {
    return fail("Release-origin platformUrl must be a string or null.");
  }

  return {
    command: input.command,
    json: input.json === true,
    platformUrl: input.platformUrl,
  };
};

const parsePlatformOrigin = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid origin");
    }
    return url.origin;
  } catch {
    throw new ReleaseOriginInspectionError(
      "INVALID_PLATFORM_URL",
      "--platform-url must be an absolute http(s) origin without credentials, a path, query, or fragment.",
    );
  }
};

const readBoundedResponseText = async (response: Response): Promise<string> => {
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_REMOTE_RESPONSE_BYTES
  ) {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote platform health response exceeded the inspection size limit.",
    );
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_REMOTE_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ReleaseOriginInspectionError(
          "REMOTE_CONTRACT_INVALID",
          "Remote platform health response exceeded the inspection size limit.",
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
};

const parseRemoteHealth = (
  value: unknown,
  httpStatus: 200 | 503,
): Pick<RemoteReleaseOriginInspectionResult, "health" | "assessment"> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote platform health response is not the expected object contract.",
    );
  }

  const health = value as Record<string, unknown>;
  const boundaries = health.boundaries;
  const boundary =
    boundaries && typeof boundaries === "object" && !Array.isArray(boundaries)
      ? (boundaries as Record<string, unknown>).hostedReleaseOrigin
      : null;
  if (
    typeof health.ok !== "boolean" ||
    health.service !== "platform" ||
    !boundary ||
    typeof boundary !== "object" ||
    Array.isArray(boundary)
  ) {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote platform health response does not contain the hosted-release origin boundary.",
    );
  }

  if ((httpStatus === 200 && !health.ok) || (httpStatus === 503 && health.ok)) {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote platform health status does not match its HTTP status.",
    );
  }

  const assessment = boundary as Record<string, unknown>;
  const status = assessment.status;
  if (
    typeof assessment.required !== "boolean" ||
    (status !== "ready" && status !== "disabled" && status !== "invalid")
  ) {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote hosted-release origin assessment has invalid required or status fields.",
    );
  }

  if (status === "ready") {
    if (
      typeof assessment.publicOrigin !== "string" ||
      assessment.reason !== null
    ) {
      throw new ReleaseOriginInspectionError(
        "REMOTE_CONTRACT_INVALID",
        "Remote ready assessment has invalid publicOrigin or reason fields.",
      );
    }

    let publicOrigin: string;
    try {
      const parsed = new URL(assessment.publicOrigin);
      if (
        (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/" ||
        parsed.search ||
        parsed.hash
      ) {
        throw new Error("invalid origin");
      }
      publicOrigin = parsed.origin;
    } catch {
      throw new ReleaseOriginInspectionError(
        "REMOTE_CONTRACT_INVALID",
        "Remote ready assessment publicOrigin is not a valid http(s) origin.",
      );
    }

    if (!health.ok && assessment.required) {
      throw new ReleaseOriginInspectionError(
        "REMOTE_CONTRACT_INVALID",
        "Remote platform reports an unhealthy required boundary as ready.",
      );
    }

    return {
      health: { httpStatus, ok: health.ok },
      assessment: {
        required: assessment.required,
        status,
        publicOrigin,
        reason: null,
      },
    };
  }

  if (
    assessment.publicOrigin !== null ||
    typeof assessment.reason !== "string" ||
    assessment.reason.length === 0
  ) {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote unavailable assessment has invalid publicOrigin or reason fields.",
    );
  }

  if (health.ok && assessment.required) {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote platform reports an unavailable required boundary as healthy.",
    );
  }

  return {
    health: { httpStatus, ok: health.ok },
    assessment: {
      required: assessment.required,
      status,
      publicOrigin: null,
      reason: assessment.reason,
    },
  };
};

const inspectRemotePlatform = async (
  platformUrl: string,
): Promise<RemoteReleaseOriginInspectionResult> => {
  const platformOrigin = parsePlatformOrigin(platformUrl);
  const healthUrl = new URL("/api/health", platformOrigin);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REMOTE_REQUEST_TIMEOUT_MS,
  );

  let body: string;
  let httpStatus: 200 | 503;
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });

    if (response.status !== 200 && response.status !== 503) {
      await response.body?.cancel();
      throw new ReleaseOriginInspectionError(
        "REMOTE_HTTP_ERROR",
        `Remote platform health request returned HTTP ${response.status}.`,
      );
    }

    httpStatus = response.status;
    body = await readBoundedResponseText(response);
  } catch (error: unknown) {
    if (error instanceof ReleaseOriginInspectionError) throw error;
    throw new ReleaseOriginInspectionError(
      "REMOTE_REQUEST_FAILED",
      controller.signal.aborted
        ? `Remote platform health request timed out after ${REMOTE_REQUEST_TIMEOUT_MS}ms.`
        : "Remote platform health request failed.",
    );
  } finally {
    clearTimeout(timeout);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ReleaseOriginInspectionError(
      "REMOTE_CONTRACT_INVALID",
      "Remote platform health response is not valid JSON.",
    );
  }

  const remoteHealth = parseRemoteHealth(parsed, httpStatus);
  return {
    source: { type: "remote" as const, platformOrigin },
    ...remoteHealth,
  };
};

const inspectLocalEnvironment = (): LocalReleaseOriginInspectionResult => ({
  source: { type: "local" as const },
  assessment: assessHostedReleaseOrigin(),
});

const main = async (): Promise<void> => {
  const input = parseInput(process.argv[2]);
  const result: ReleaseOriginInspectionResult = input.platformUrl
    ? await inspectRemotePlatform(input.platformUrl)
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
    `Platform health: ${result.health.ok ? "healthy" : "unhealthy"} (HTTP ${result.health.httpStatus})`,
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
    error instanceof ReleaseOriginInspectionError ? error : null;
  const message =
    error instanceof Error
      ? error.message
      : "Release-origin inspection failed.";

  if (jsonOutputWasRequested()) {
    console.log(
      JSON.stringify(
        {
          contractVersion: CLI_CONTRACT_VERSION,
          command: "release-origin.inspect",
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
