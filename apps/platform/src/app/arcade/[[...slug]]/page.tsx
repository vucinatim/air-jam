"use client";

import {
  ArcadeAudioRuntime,
  ArcadeSystem,
  type ArcadeGame,
} from "@/components/arcade";
import { toArcadeGames } from "@/lib/arcade-game-mapper";
import { platformArcadeHostSessionConfig } from "@/lib/airjam-session-config";
import {
  getLocalReferenceArcadeGame,
  getLocalReferenceArcadeGames,
} from "@/lib/local-reference-games";
import { api } from "@/trpc/react";
import { AirJamHostRuntime, PlatformSettingsRuntime } from "@air-jam/sdk";
import { use } from "react";

/** In development, repeat each game N times to stress-test the grid (unique ids). */
const ARCADE_DEV_GRID_REPEAT = 3;

function expandArcadeGamesForDev(games: ArcadeGame[]): ArcadeGame[] {
  if (process.env.NODE_ENV !== "development") return games;
  if (ARCADE_DEV_GRID_REPEAT < 2) return games;

  return games.flatMap((game) =>
    game.catalogSource === "local_dev"
      ? [game]
      : Array.from({ length: ARCADE_DEV_GRID_REPEAT }, (_, row) => ({
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
  const localReferenceGames = getLocalReferenceArcadeGames();
  const localReferenceGame = getLocalReferenceArcadeGame(slugOrId ?? null);
  const { data: games, isLoading: gamesLoading } = api.game.getAllPublic.useQuery();
  const publicArcadeGames = games ? toArcadeGames(games) : [];
  const arcadeGames = expandArcadeGamesForDev([
    ...localReferenceGames,
    ...publicArcadeGames,
  ]);

  const targetGame = slugOrId
    ? arcadeGames.find(
        (game) => game.slug === slugOrId || game.id === slugOrId,
      ) ?? null
    : null;

  const initialGameId = localReferenceGame?.id ?? targetGame?.id;
  const shouldAutoLaunch = !!slugOrId && !!targetGame;
  const hostRouteIntent = slugOrId
    ? { kind: "game" as const, gameId: initialGameId ?? null }
    : { kind: "browser" as const };

  return (
    <PlatformSettingsRuntime persistence="local">
      <AirJamHostRuntime {...platformArcadeHostSessionConfig}>
        <ArcadeAudioRuntime>
          <ArcadeSystem
            games={arcadeGames}
            gamesCatalogReady={!gamesLoading}
            mode="arcade"
            initialGameId={initialGameId}
            hostRouteIntent={hostRouteIntent}
            autoLaunch={shouldAutoLaunch}
            className="h-screen"
          />
        </ArcadeAudioRuntime>
      </AirJamHostRuntime>
    </PlatformSettingsRuntime>
  );
}
