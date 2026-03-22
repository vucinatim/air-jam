"use client";

import { ArcadeLoader, ArcadeSystem } from "@/components/arcade";
import { toArcadeGames } from "@/lib/arcade-game-mapper";
import { platformArcadeHostSessionConfig } from "@/lib/airjam-session-config";
import { api } from "@/trpc/react";
import { HostSessionProvider } from "@air-jam/sdk";
import { use } from "react";

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

  const arcadeGames = toArcadeGames(games);

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
