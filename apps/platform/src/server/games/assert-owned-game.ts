import { db } from "@/db";

export const assertOwnedGame = async (gameId: string, userId: string) => {
  const game = await db.query.games.findFirst({
    where: (games, { eq, and }) =>
      and(eq(games.id, gameId), eq(games.userId, userId)),
  });

  if (!game) {
    throw new Error("Game not found or unauthorized");
  }

  return game;
};
