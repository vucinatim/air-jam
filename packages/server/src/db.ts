import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import postgres from 'postgres';
import * as dotenv from "dotenv";

dotenv.config();

// Define only the schema we need for verification
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  key: text("key").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("[server] DATABASE_URL not found. API Key verification will fail unless using master key.");
}

const client = postgres(connectionString || "");
export const db = drizzle(client);


