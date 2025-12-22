"use client";

import { ArcadeSystem } from "@/components/arcade";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { AirJamProvider } from "@air-jam/sdk";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { z } from "zod";

export default function PlayGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    data: game,
    isLoading,
    error,
  } = api.game.get.useQuery({ id: resolvedParams.gameId });

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-slate-950">
        <div className="bg-airjam-cyan/10 flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Skeleton className="h-6 w-32 bg-slate-800" />
          <Skeleton className="h-6 w-48 bg-slate-800" />
        </div>
        <div className="flex flex-1 items-center justify-center text-slate-400">
          Loading Game Environment...
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 p-4">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold text-red-400">
            Error Loading Game
          </h2>
          <p className="mb-6 text-slate-400">
            The game could not be found or you don&apos;t have permission to
            view it.
          </p>
          <Link href="/dashboard/games">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Convert to ArcadeGame format
  const arcadeGame = {
    id: game.id,
    name: game.name,
    url: game.url,
  };

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
      input={{
        schema: arcadeInputSchema,
        latch: {
          booleanFields: ["action"],
          vectorFields: ["vector"],
        },
      }}
    >
      <div className="flex h-screen flex-col bg-slate-950">
        {/* Preview Header - Block element, z-100 to stay above SDK overlay */}
        <div className="relative z-100">
          <PreviewHeader
            gameId={game.id}
            gameName={game.name}
            gameUrl={game.url}
          />
        </div>
        <div className="relative flex-1">
          {/* Game Container - Takes remaining space */}
          <ArcadeSystem
            games={[arcadeGame]}
            mode="preview"
            initialGameId={game.id}
            onExitGame={() => router.push(`/dashboard/games/${game.id}`)}
            showGameExitOverlay={false}
            className="flex-1"
          />
        </div>
      </div>
    </AirJamProvider>
  );
}

/** Preview header - block element above the game */
const PreviewHeader = ({
  gameId,
  gameName,
  gameUrl,
}: {
  gameId: string;
  gameName: string;
  gameUrl: string;
}) => {
  return (
    <div className="bg-airjam-cyan/10 flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/games/${gameId}`}>
          <Button
            variant="ghost"
            size="icon"
            title="Back to Game"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-sm leading-none font-bold text-white">
            {gameName}
          </h1>
          <span className="text-airjam-cyan mt-1 text-xs">Preview Mode</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="mr-2 hidden items-center rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 md:flex">
          Source:{" "}
          <span className="ml-1 max-w-[200px] truncate font-mono">
            {gameUrl}
          </span>
        </div>
        <a href={gameUrl} target="_blank" rel="noopener noreferrer">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-white/20 text-xs text-white hover:bg-white/10"
          >
            <ExternalLink className="mr-2 h-3 w-3" />
            Open in New Tab
          </Button>
        </a>
      </div>
    </div>
  );
};
