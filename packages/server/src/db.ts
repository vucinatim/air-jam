import * as dotenv from "dotenv";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

dotenv.config();

// Define only the schema we need for verification
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().unique(), // One API key per game
  key: text("key").notNull().unique(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

const connectionString = process.env.DATABASE_URL;

// Only create database client if DATABASE_URL is provided
// In dev mode (no DATABASE_URL), the server runs without database
const client = connectionString ? postgres(connectionString) : null;
export const db = client ? drizzle(client) : null;
