"use client";

import { ArcadeSystem } from "@/components/arcade";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { useState } from "react";

export default function ArcadePage() {
  // Persist Room ID for development convenience
  const [persistedRoomId] = useState(() => {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem("airjam_platform_room_id") || undefined;
    }
    return undefined;
  });

  const { data: games, isLoading } = api.game.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Skeleton className="h-32 w-32 rounded-lg" />
      </div>
    );
  }

  // Convert games to ArcadeGame format
  const arcadeGames = (games ?? []).map((game) => ({
    id: game.id,
    name: game.name,
    url: game.url,
  }));

  return (
    <ArcadeSystem
      games={arcadeGames}
      mode="arcade"
      initialRoomId={persistedRoomId}
      onRoomIdChange={(roomId) => {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("airjam_platform_room_id", roomId);
        }
      }}
      className="h-screen"
    />
  );
}
