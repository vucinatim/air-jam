import { drizzle } from "drizzle-orm/postgres-js";
// Side-effect import: keeps drizzle-orm/postgres-js/migrator in the
// Next.js standalone trace so apps/platform/scripts/run-platform.mjs
// can dynamic-import it at preview-environment boot. The migrator
// itself is invoked only outside Next.js (before server.js starts).
import "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
