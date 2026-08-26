import type { ProductTelemetryAgentResource } from "@/lib/product-telemetry-contract";
import { normalizeAgentResourceTelemetryEvent } from "./normalization";
import { ingestProductTelemetryEvents } from "./persistence";

/**
 * Records agent-resource reach without ever becoming part of the resource's
 * availability contract. Failures are intentionally contained so telemetry
 * cannot change the canonical response status or body.
 */
export const recordAgentResourceRequestBestEffort = async ({
  resource,
  request,
}: {
  resource: ProductTelemetryAgentResource;
  request: Request;
}): Promise<void> => {
  try {
    const event = normalizeAgentResourceTelemetryEvent({
      id: crypto.randomUUID(),
      resource,
      headers: request.headers,
    });
    await ingestProductTelemetryEvents([event]);
  } catch (error) {
    console.warn(
      `[product-telemetry] Could not record ${resource} request:`,
      error instanceof Error ? error.message : "unknown error",
    );
  }
};
