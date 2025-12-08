
import dotenv from "dotenv";
import { resolve } from "path";
import { db } from "../src/db/index";
import { games } from "../src/db/schema";
import { eq, isNull } from "drizzle-orm";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start of text
    .replace(/-+$/, '');      // Trim - from end of text
}

async function main() {
  console.log("Starting data migration for Games...");

  try {
    // 1. Fetch games with missing slugs
    // Note: We use raw sql or simple select. Since we updated schema.ts, 
    // db.select() will try to select 'slug' column which might not exist if migration failed.
    // However, if migration succeeded but data is null, this works.
    // If migration failed, this script will fail, which is expected.
    
    const gamesToUpdate = await db.select().from(games).where(isNull(games.slug));
    
    console.log(`Found ${gamesToUpdate.length} games to update.`);

    for (const game of gamesToUpdate) {
      const newSlug = slugify(game.name) || `game-${game.id.substring(0, 8)}`;
      
      console.log(`Updating game "${game.name}" (${game.id}) -> slug: "${newSlug}"`);
      
      await db.update(games)
        .set({ slug: newSlug })
        .where(eq(games.id, game.id));
    }

    console.log("Migration completed successfully.");

  } catch (error) {
    console.error("Migration failed:", error);
    console.log("\nTIP: If columns are missing, run 'pnpm drizzle-kit push' first.");
  }

  process.exit(0);
}

main();


