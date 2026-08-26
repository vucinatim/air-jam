import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import {
  applyProductTelemetryRetention,
  rebuildProductTelemetryProjections,
} from "../src/server/product-telemetry/persistence";

const main = async (): Promise<void> => {
  const command = process.argv[2];
  if (command !== "rebuild" && command !== "retain") {
    throw new Error(
      "Usage: tsx scripts/product-telemetry-maintenance.ts <rebuild|retain>",
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for telemetry maintenance.");
  }

  const client = postgres(databaseUrl, { max: 1 });
  const maintenanceDatabase = drizzle(client, { schema });

  try {
    if (command === "rebuild") {
      const result =
        await rebuildProductTelemetryProjections(maintenanceDatabase);
      console.log(
        `Rebuilt telemetry projections from ${result.rawEventCount} raw events: ${result.metricCount} daily metrics and ${result.sessionContributionCount} session contributions.`,
      );
    } else {
      const result = await applyProductTelemetryRetention({
        database: maintenanceDatabase,
      });
      console.log(
        `Applied telemetry retention: deleted ${result.rawEventsDeleted} raw events before ${result.rawCutoff.toISOString()} and ${result.sessionContributionsDeleted} session contributions before ${result.sessionContributionCutoffDate}.`,
      );
    }
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Telemetry maintenance failed.",
  );
  process.exitCode = 1;
});
