import { handleProductTelemetryRequest } from "@/server/product-telemetry/ingestion";

export const POST = async (request: Request): Promise<Response> =>
  handleProductTelemetryRequest({ request });
