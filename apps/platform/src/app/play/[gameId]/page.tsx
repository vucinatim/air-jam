"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { AirJamOverlay, useAirJamHost } from "@air-jam/sdk";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

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

  const host = useAirJamHost({
    onChildClose: () => {
      router.push("/dashboard");
    },
  });

  const normalizeUrlForMobile = (url: string): string => {
    if (typeof window === "undefined") return url;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1") {
        urlObj.hostname = window.location.hostname;
        return urlObj.toString();
      }
      return url;
    } catch {
      return url;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-background flex h-screen flex-col">
        <div className="bg-background flex h-16 items-center justify-between border-b px-6 py-3 shadow-sm">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="bg-muted text-muted-foreground flex w-full flex-1 animate-pulse items-center justify-center">
          Loading Game Environment...
        </div>
      </div>
    );
  }

  if (error || !game)
    return (
      <div className="bg-background flex h-screen flex-col items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-destructive mb-2 text-2xl font-bold">
            Error Loading Game
          </h2>
          <p className="text-muted-foreground mb-6">
            The game could not be found or you don't have permission to view it.
          </p>
          <Link href="/dashboard">
            <Button>Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );

  return (
    <div className="bg-background relative flex h-screen flex-col">
      <div className="bg-background z-10 flex items-center justify-between border-b px-4 py-2 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" title="Back to Dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-sm leading-none font-bold">{game.name}</h1>
            <span className="text-muted-foreground mt-1 text-xs">
              Preview Mode
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground bg-muted/50 border-border mr-2 hidden items-center rounded border px-2 py-1 text-xs md:flex">
            Source:{" "}
            <span className="ml-1 max-w-[200px] truncate font-mono">
              {game.url}
            </span>
          </div>
          <a href={game.url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <ExternalLink className="mr-2 h-3 w-3" />
              Open in New Tab
            </Button>
          </a>
        </div>
      </div>
      <div className="relative w-full flex-1 overflow-hidden bg-black">
        <iframe
          src={`${normalizeUrlForMobile(game.url)}${game.url.includes("?") ? "&" : "?"}airjam_mode=child&room=${host.roomId}&airjam_force_connect=true`}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
          allowFullScreen
          title={game.name}
        />
      </div>
      <AirJamOverlay {...host} />
    </div>
  );
}
