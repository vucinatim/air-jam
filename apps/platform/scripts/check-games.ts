import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Use relative path to avoid alias issues in simple script
import { sql } from "drizzle-orm";
import { db } from "../src/db/index";

async function main() {
  console.log("Fetching games raw...");
  try {
    const result = await db.execute(sql`SELECT id, name, url FROM games`);
    console.log("Found games:", result);
  } catch (e) {
    console.error("Error fetching games:", e);
  }
  process.exit(0);
}

main();
