import { db } from "@/db";
import { games } from "@/db/schema";
import { PlatformApplicationError } from "@/server/application-error";
import type { AuthenticatedPlatformActor } from "@/server/auth/application-actor";
import { and, eq } from "drizzle-orm";

export type OwnedGameReference =
  | { kind: "id"; gameId: string }
  | { kind: "slug-or-id"; slugOrId: string };

export const resolveOwnedGame = async ({
  actor,
  reference,
}: {
  actor: AuthenticatedPlatformActor;
  reference: OwnedGameReference;
}): Promise<typeof games.$inferSelect> => {
  if (reference.kind === "id") {
    const game = await db.query.games.findFirst({
      where: and(
        eq(games.id, reference.gameId),
        eq(games.userId, actor.userId),
      ),
    });

    if (game) {
      return game;
    }
  } else {
    const slugOrId = reference.slugOrId.trim();
    const game = await db.query.games.findFirst({
      where: (table, { and, eq, or }) =>
        and(
          eq(table.userId, actor.userId),
          or(eq(table.slug, slugOrId), eq(table.id, slugOrId)),
        ),
    });

    if (game) {
      return game;
    }
  }

  throw new PlatformApplicationError({
    code: "not_found",
    message: "Game not found or unauthorized.",
  });
};
