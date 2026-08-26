import { productTelemetryBrowserBatchSchema } from "@/lib/product-telemetry-contract";
import { checkRateLimit } from "@/server/api/rate-limit";
import {
  normalizeProductTelemetryBrowserEvent,
  ProductTelemetryTimeSkewError,
} from "./normalization";
import {
  ingestProductTelemetryEvents,
  type ProductTelemetryIngestResult,
} from "./persistence";
import {
  assertProductTelemetryRequestHeaders,
  getTransientProductTelemetryRateLimitKey,
  ProductTelemetryRequestError,
  readBoundedProductTelemetryBody,
} from "./request-guards";
import type { NormalizedProductTelemetryEvent } from "./types";

export const PRODUCT_TELEMETRY_RATE_LIMIT = {
  windowMs: 60_000,
  max: 60,
} as const;

type ProductTelemetryWriter = (
  events: NormalizedProductTelemetryEvent[],
) => Promise<ProductTelemetryIngestResult>;

const jsonResponse = (body: unknown, status: number): Response =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });

export const handleProductTelemetryRequest = async ({
  request,
  env = process.env,
  now = new Date(),
  write = (events) => ingestProductTelemetryEvents(events),
}: {
  request: Request;
  env?: NodeJS.ProcessEnv;
  now?: Date;
  write?: ProductTelemetryWriter;
}): Promise<Response> => {
  try {
    assertProductTelemetryRequestHeaders({ request, env });

    const rateLimit = checkRateLimit(
      `product-telemetry:${getTransientProductTelemetryRateLimitKey({ request, env })}`,
      PRODUCT_TELEMETRY_RATE_LIMIT,
    );
    if (rateLimit.limited) {
      return Response.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "cache-control": "no-store",
            "retry-after": String(rateLimit.retryAfter),
          },
        },
      );
    }

    const rawBody = await readBoundedProductTelemetryBody(request);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new ProductTelemetryRequestError(
        "Telemetry request body is not valid JSON.",
        400,
        "invalid_json",
      );
    }

    const batch = productTelemetryBrowserBatchSchema.safeParse(parsedBody);
    if (!batch.success) {
      throw new ProductTelemetryRequestError(
        "Telemetry request body does not match the event contract.",
        400,
        "invalid_batch",
      );
    }

    const events = batch.data.events.map((event) =>
      normalizeProductTelemetryBrowserEvent({
        event,
        headers: request.headers,
        now,
        env,
      }),
    );
    const result = await write(events);
    return jsonResponse(result, 202);
  } catch (error) {
    if (error instanceof ProductTelemetryRequestError) {
      return jsonResponse({ error: error.code }, error.status);
    }
    if (error instanceof ProductTelemetryTimeSkewError) {
      return jsonResponse({ error: "event_time_out_of_bounds" }, 422);
    }
    return jsonResponse({ error: "telemetry_unavailable" }, 503);
  }
};
