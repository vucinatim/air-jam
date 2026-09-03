import { createRuntimeDatabaseSchema } from "@air-jam/database-contract";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const runtimeDatabaseSchema = createRuntimeDatabaseSchema();

export const {
  appIds,
  operationalEventOutbox,
  operationalEvents,
  runtimeUsageSessions,
  runtimeUsageEvents,
  runtimeUsageControllerSegments,
  runtimeUsageGameSegments,
  runtimeUsageEligibleSegments,
  runtimeUsageGameSessionMetrics,
  runtimeUsageDailyGameMetrics,
} = runtimeDatabaseSchema;

export type ServerDatabase =
  | PostgresJsDatabase<Record<string, never>>
  | PostgresJsDatabase<typeof runtimeDatabaseSchema>;

export const createServerDatabase = (
  databaseUrl: string | undefined,
): ServerDatabase | null => {
  if (!databaseUrl) {
    return null;
  }

  return drizzle(postgres(databaseUrl), { schema: runtimeDatabaseSchema });
};
