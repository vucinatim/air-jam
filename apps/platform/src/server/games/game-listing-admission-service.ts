import { db } from "@/db";
import type { games } from "@/db/schema";
import type { ArcadeVisibility } from "@/lib/games/arcade-visibility";
import { PlatformApplicationError } from "../application-error";
import { assertOperationalLaneAccepting } from "../operations/production-control-service";

/** Call after ownership verification; null denotes a not-yet-created game. */
export const assertGameListingAllowed = async ({
  database = db,
  game,
  arcadeVisibility,
}: {
  database?: typeof db;
  game: Pick<typeof games.$inferSelect, "id" | "arcadeVisibility"> | null;
  arcadeVisibility?: ArcadeVisibility;
}) => {
  if (arcadeVisibility !== "listed") return;

  if (game?.arcadeVisibility === "hidden") {
    await assertOperationalLaneAccepting({ database, lane: "game_listing" });
  }

  const liveRelease = game
    ? await database.query.gameReleases.findFirst({
        where: (table, { and, eq }) =>
          and(eq(table.gameId, game.id), eq(table.status, "live")),
      })
    : null;

  if (!liveRelease) {
    throw new PlatformApplicationError({
      code: "validation_failed",
      message:
        "A game can only be listed in Arcade after a hosted release is made live.",
    });
  }
};
