import type { productTelemetryEvents } from "@/db/schema";

export type NormalizedProductTelemetryEvent =
  typeof productTelemetryEvents.$inferSelect;
