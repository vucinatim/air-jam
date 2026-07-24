"use client";

import {
  ArcadeAudioRuntime,
  ArcadeSystem,
  type ArcadeGame,
} from "@/components/arcade";
import {
  parseArcadeLaunchQuery,
  type ArcadeLaunchQuerySource,
} from "@/components/arcade/arcade-launch-query";
import { getPlatformArcadeHostSessionConfig } from "@/lib/airjam-session-config";
import { toArcadeGames } from "@/lib/arcade-game-mapper";
import {
  getLocalReferenceArcadeGame,
  getLocalReferenceArcadeGames,
} from "@/lib/local-reference-games";
import { api } from "@/trpc/react";
import { AirJamHostRuntime, PlatformSettingsRuntime } from "@air-jam/sdk";
import { use, useMemo } from "react";

export default function ArcadePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<ArcadeLaunchQuerySource>;
}) {
  const resolvedParams = use(params);
  const resolvedSearchParams = use(searchParams);
  const launchQuery = useMemo(
    () => parseArcadeLaunchQuery(resolvedSearchParams),
    [resolvedSearchParams],
  );
  // Extract slug from optional catch-all (e.g., /arcade/space-battle → ["space-battle"])
  const slugOrId = resolvedParams.slug?.[0];
  const localReferenceGames = getLocalReferenceArcadeGames();
  const localReferenceGame = getLocalReferenceArcadeGame(slugOrId ?? null);
  const { data: games, isLoading: gamesLoading } =
    api.game.getAllPublic.useQuery();
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
    ? (arcadeGames.find(
        (game) => game.slug === slugOrId || game.id === slugOrId,
      ) ?? null)
    : null;

  const routeGame = localReferenceGame ?? targetGame;
  const initialGameId = routeGame?.id;
  const shouldAutoLaunch = !!slugOrId && !!initialGameId;
  const hostRouteIntent = slugOrId
    ? { kind: "game" as const, gameId: initialGameId ?? null }
    : { kind: "browser" as const };
  const sessionConfig = useMemo(() => getPlatformArcadeHostSessionConfig(), []);

  return (
    <PlatformSettingsRuntime persistence="local">
      <AirJamHostRuntime {...sessionConfig}>
        <ArcadeAudioRuntime>
          <ArcadeSystem
            games={arcadeGames}
            gamesCatalogReady={!gamesLoading}
            mode="arcade"
            initialGameId={initialGameId}
            hostRouteIntent={hostRouteIntent}
            autoLaunch={shouldAutoLaunch}
            launchQuery={launchQuery}
            className="h-screen"
            previewControllersEnabled
          />
        </ArcadeAudioRuntime>
      </AirJamHostRuntime>
    </PlatformSettingsRuntime>
  );
}
