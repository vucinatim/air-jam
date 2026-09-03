import { db } from "@/db";
import { sql } from "drizzle-orm";

type DatabaseAuthorityTransaction = Parameters<
  Parameters<(typeof db)["transaction"]>[0]
>[0];

export const resolveDatabaseAuthorityNow = async (
  tx: DatabaseAuthorityTransaction,
  testNow?: Date,
): Promise<Date> => {
  if (testNow) return new Date(testNow);
  const rows = await tx.execute(sql`select clock_timestamp() as authority_now`);
  const value = (rows[0] as { authority_now?: Date | string } | undefined)
    ?.authority_now;
  if (!value) throw new Error("Database authority time was unavailable.");
  const authorityNow = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(authorityNow.getTime())) {
    throw new Error("Database authority time was invalid.");
  }
  return authorityNow;
};
