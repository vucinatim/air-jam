import { db } from "@/db";
import type { OperationalLane } from "@air-jam/database-contract";
import { sql } from "drizzle-orm";

type PlatformTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const acquireOperationalLaneLock = async (
  tx: PlatformTransaction,
  lane: OperationalLane,
): Promise<void> => {
  const scope = `airjam:operational-lane:${lane}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${scope}))`);
};
