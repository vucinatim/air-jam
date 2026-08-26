import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";
import { PRODUCT_TELEMETRY_MAX_REQUEST_BYTES } from "@/lib/product-telemetry-contract";
import { createHash } from "node:crypto";
import { resolveProductTelemetryDeployment } from "./classification";

export class ProductTelemetryRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ProductTelemetryRequestError";
  }
}

const parseContentLength = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  if (!/^\d+$/.test(value)) {
    throw new ProductTelemetryRequestError(
      "Invalid Content-Length header.",
      400,
      "invalid_content_length",
    );
  }
  return Number(value);
};

export const assertProductTelemetryRequestHeaders = ({
  request,
  env = process.env,
}: {
  request: Request;
  env?: NodeJS.ProcessEnv;
}): void => {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType || !/^application\/json(?:\s*;|$)/.test(contentType)) {
    throw new ProductTelemetryRequestError(
      "Telemetry requests require application/json.",
      415,
      "unsupported_content_type",
    );
  }

  const contentLength = parseContentLength(
    request.headers.get("content-length"),
  );
  if (
    contentLength !== null &&
    contentLength > PRODUCT_TELEMETRY_MAX_REQUEST_BYTES
  ) {
    throw new ProductTelemetryRequestError(
      "Telemetry request is too large.",
      413,
      "request_too_large",
    );
  }

  const deployment = resolveProductTelemetryDeployment(env);
  const expectedOrigin =
    resolvePlatformDeploymentConfig(env).platformPublicOrigin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const isHosted =
    deployment.environment === "production" ||
    deployment.environment === "preview";

  if (isHosted && (!origin || origin !== expectedOrigin)) {
    throw new ProductTelemetryRequestError(
      "Telemetry request origin is not allowed.",
      403,
      "origin_not_allowed",
    );
  }
  if (isHosted && fetchSite !== "same-origin") {
    throw new ProductTelemetryRequestError(
      "Telemetry request site context is not allowed.",
      403,
      "site_context_not_allowed",
    );
  }
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new ProductTelemetryRequestError(
      "Telemetry request site context is not allowed.",
      403,
      "site_context_not_allowed",
    );
  }
};

export const readBoundedProductTelemetryBody = async (
  request: Request,
): Promise<string> => {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > PRODUCT_TELEMETRY_MAX_REQUEST_BYTES) {
        await reader.cancel("Telemetry request exceeded the byte limit.");
        throw new ProductTelemetryRequestError(
          "Telemetry request is too large.",
          413,
          "request_too_large",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new ProductTelemetryRequestError(
      "Telemetry request body is not valid UTF-8.",
      400,
      "invalid_encoding",
    );
  }
};

const getTrustedRequestIp = (
  request: Request,
  env: NodeJS.ProcessEnv,
): string | null => {
  const isTrustedProxy = Boolean(
    env.RAILWAY_ENVIRONMENT_NAME?.trim() || env.VERCEL?.trim(),
  );
  if (!isTrustedProxy) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim().slice(0, 128) || null;
  }
  return request.headers.get("x-real-ip")?.trim().slice(0, 128) || null;
};

export const getTransientProductTelemetryRateLimitKey = ({
  request,
  env = process.env,
}: {
  request: Request;
  env?: NodeJS.ProcessEnv;
}): string => {
  const requestIp = getTrustedRequestIp(request, env) ?? "unavailable";
  return createHash("sha256").update(requestIp).digest("hex");
};
