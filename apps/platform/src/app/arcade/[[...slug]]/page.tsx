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
  const arcadeGames: ArcadeGame[] = [
    ...(localReferenceGame &&
    !localReferenceGames.some((game) => game.id === localReferenceGame.id)
      ? [localReferenceGame]
      : []),
    ...localReferenceGames,
    ...publicArcadeGames,
  ];

  const targetGame = slugOrId
    ? arcadeGames.find(
        (game) => game.slug === slugOrId || game.id === slugOrId,
      ) ?? null
    : null;

  const routeGame = localReferenceGame ?? targetGame;
  const initialGameId = routeGame?.id;
  const shouldAutoLaunch = !!slugOrId && !!initialGameId;
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
