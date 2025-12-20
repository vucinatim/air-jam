"use client";

import { ArcadeLoader, ArcadeSystem } from "@/components/arcade";
import { api } from "@/trpc/react";
import { AirJamProvider } from "@air-jam/sdk";
import Link from "next/link";
import { useMemo, useState } from "react";

export default function ArcadePage() {
  // Persist Room ID for development convenience
  const [persistedRoomId] = useState(() => {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem("airjam_platform_room_id") || undefined;
    }
    return undefined;
  });

  const {
    data: games,
    isLoading,
    error,
  } = api.game.list.useQuery(undefined, {
    retry: false, // Don't retry on auth errors
  });

  // Convert games to ArcadeGame format - memoized to prevent unnecessary re-renders
  const arcadeGames = useMemo(
    () =>
      (games ?? []).map((game) => ({
        id: game.id,
        name: game.name,
        url: game.url,
      })),
    [games],
  );

  // Show loader while loading
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black">
        <ArcadeLoader />
      </div>
    );
  }

  // Handle error state (e.g., not authenticated)
  if (error) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-black font-mono text-white">
        <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
        <p className="text-slate-400">Please sign in to access the arcade.</p>
        <Link
          href="/?login=true"
          className="mt-4 rounded-md bg-cyan-600 px-6 py-2 font-semibold transition-colors hover:bg-cyan-500"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <AirJamProvider
      role="host"
      serverUrl={process.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL}
      apiKey={process.env.NEXT_PUBLIC_PLATFORM_API_KEY}
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
