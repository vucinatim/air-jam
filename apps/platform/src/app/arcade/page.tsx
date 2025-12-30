"use client";

import { ArcadeLoader, ArcadeSystem } from "@/components/arcade";
import { api } from "@/trpc/react";
import { AirJamProvider } from "@air-jam/sdk";
import { useState } from "react";
import { z } from "zod";

// Input schema for arcade navigation
export const arcadeInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
});

export default function ArcadePage() {
  // Generate fresh room ID on each load (no persistence)
  // This prevents stale controller connections from previous sessions
  const [persistedRoomId] = useState(() => {
    // Clear any existing sessionStorage entry to ensure fresh room ID
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("airjam_platform_room_id");
    }
    return undefined;
  });

  const { data: games, isLoading } = api.game.getAllPublic.useQuery();

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
          // No longer persisting room ID to sessionStorage
          // Each host reload generates a fresh room ID to prevent stale controller connections
        }}
        className="h-screen"
      />
    </AirJamProvider>
  );
}
