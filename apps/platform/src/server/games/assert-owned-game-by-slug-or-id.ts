import { db } from "@/db";
import { games } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const assertOwnedGameBySlugOrId = async (
  slugOrId: string,
  userId: string,
) => {
  const normalized = slugOrId.trim();

  const gameBySlug = await db.query.games.findFirst({
    where: and(eq(games.slug, normalized), eq(games.userId, userId)),
  });
  if (gameBySlug) {
    return gameBySlug;
  }

  const gameById = await db.query.games.findFirst({
    where: and(eq(games.id, normalized), eq(games.userId, userId)),
  });
  if (gameById) {
    return gameById;
  }

  throw new Error("Game not found or unauthorized");
};
