"use client";

import { ArcadeLoader, ArcadeSystem } from "@/components/arcade";
import { api } from "@/trpc/react";
import { AirJamProvider } from "@air-jam/sdk";
import { useState } from "react";
import { z } from "zod";

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
      <div className="h-screen w-screen bg-black">
        <ArcadeLoader />
      </div>
    );
  }

  // Convert games to ArcadeGame format
  const arcadeGames = (games ?? []).map((game) => ({
    id: game.id,
    name: game.name,
    url: game.url,
  }));

  // Input schema for arcade navigation
  const arcadeInputSchema = z.object({
    vector: z.object({
      x: z.number(),
      y: z.number(),
    }),
    action: z.boolean(),
  });

  return (
    <AirJamProvider
      serverUrl={process.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL}
      input={{
        schema: arcadeInputSchema,
        latch: {
          booleanFields: ["action"],
          vectorFields: ["vector"],
        },
      }}
    >
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
    </AirJamProvider>
  );
}
