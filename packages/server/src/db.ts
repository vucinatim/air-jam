import { createRuntimeDatabaseSchema } from "@air-jam/database-contract";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const {
  appIds,
  runtimeUsageSessions,
  runtimeUsageEvents,
  runtimeUsageControllerSegments,
  runtimeUsageGameSegments,
  runtimeUsageEligibleSegments,
  runtimeUsageGameSessionMetrics,
  runtimeUsageDailyGameMetrics,
} = createRuntimeDatabaseSchema();

export type ServerDatabase = PostgresJsDatabase<Record<string, never>>;

export const createServerDatabase = (
  databaseUrl: string | undefined,
): ServerDatabase | null => {
  if (!databaseUrl) {
    return null;
  }

  return drizzle(postgres(databaseUrl));
};
