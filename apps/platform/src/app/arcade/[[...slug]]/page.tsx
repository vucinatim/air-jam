"use client";

import {
  ArcadeLoader,
  ArcadeSystem,
  type ArcadeGame,
} from "@/components/arcade";
import { toArcadeGames } from "@/lib/arcade-game-mapper";
import { platformArcadeHostSessionConfig } from "@/lib/airjam-session-config";
import { api } from "@/trpc/react";
import { HostSessionProvider } from "@air-jam/sdk";
import { use } from "react";

/** In development, repeat each game N times to stress-test the grid (unique ids). */
const ARCADE_DEV_GRID_REPEAT = 3;

function expandArcadeGamesForDev(games: ArcadeGame[]): ArcadeGame[] {
  if (process.env.NODE_ENV !== "development") return games;
  if (ARCADE_DEV_GRID_REPEAT < 2) return games;

  return games.flatMap((game) =>
    Array.from({ length: ARCADE_DEV_GRID_REPEAT }, (_, row) => ({
      ...game,
      id: row === 0 ? game.id : `${game.id}__arcade-dev-${row}`,
      name: row === 0 ? game.name : `${game.name} · ${row + 1}`,
      slug: row === 0 ? game.slug : undefined,
    })),
  );
}

export default function ArcadePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = use(params);
  // Extract slug from optional catch-all (e.g., /arcade/space-battle → ["space-battle"])
  const slugOrId = resolvedParams.slug?.[0];

  const { data: games, isLoading: gamesLoading } =
    api.game.getAllPublic.useQuery();

  // If a slug is provided, look up that specific game for auto-launch
  const { data: targetGame, isLoading: targetLoading } =
    api.game.getBySlugOrId.useQuery(
      { slugOrId: slugOrId! },
      { enabled: !!slugOrId },
    );

  const isLoading = gamesLoading || (slugOrId && targetLoading);

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black">
        <ArcadeLoader />
      </div>
    );
  }

  const arcadeGames = expandArcadeGamesForDev(toArcadeGames(games));

  // Determine if we should auto-launch a game
  const initialGameId = targetGame?.id;
  const shouldAutoLaunch = !!slugOrId && !!targetGame;

  return (
    <HostSessionProvider {...platformArcadeHostSessionConfig}>
      <ArcadeSystem
        games={arcadeGames}
        mode="arcade"
        initialGameId={initialGameId}
        autoLaunch={shouldAutoLaunch}
        className="h-screen"
      />
    </HostSessionProvider>
  );
}
