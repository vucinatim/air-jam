import * as dotenv from "dotenv";
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

dotenv.config();

// Define only the schema we need for verification
export const appIds = pgTable("app_ids", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().unique(), // One app identity record per game
  key: text("key").notNull().unique(),
  allowedOrigins: jsonb("allowed_origins").$type<string[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

const connectionString = process.env.DATABASE_URL;

// Only create database client if DATABASE_URL is provided
// In dev mode (no DATABASE_URL), the server runs without database
const client = connectionString ? postgres(connectionString) : null;
export const db = client ? drizzle(client) : null;
