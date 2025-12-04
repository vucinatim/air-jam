"use client";

import { api } from "@/trpc/react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PlayGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const resolvedParams = use(params);
  const { data: game, isLoading, error } = api.game.get.useQuery({ id: resolvedParams.gameId });

  if (isLoading) {
      return (
          <div className="flex flex-col h-screen bg-background">
              <div className="bg-background border-b px-6 py-3 flex items-center justify-between shadow-sm h-16">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex-1 w-full bg-muted animate-pulse flex items-center justify-center text-muted-foreground">
                  Loading Game Environment...
              </div>
          </div>
      )
  }

  if (error || !game) return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive mb-2">Error Loading Game</h2>
            <p className="text-muted-foreground mb-6">The game could not be found or you don't have permission to view it.</p>
            <Link href="/dashboard">
                <Button>Return to Dashboard</Button>
            </Link>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="bg-background border-b px-4 py-2 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
             <Link href="/dashboard">
                 <Button variant="ghost" size="icon" title="Back to Dashboard">
                     <ArrowLeft className="w-5 h-5" />
                 </Button>
             </Link>
             <div className="flex flex-col">
                 <h1 className="text-sm font-bold leading-none">{game.name}</h1>
                 <span className="text-xs text-muted-foreground mt-1">Preview Mode</span>
             </div>
        </div>
        <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center text-xs text-muted-foreground mr-2 bg-muted/50 px-2 py-1 rounded border border-border">
                Source: <span className="font-mono ml-1 max-w-[200px] truncate">{game.url}</span>
            </div>
            <a href={game.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="h-8 text-xs">
                    <ExternalLink className="w-3 h-3 mr-2" />
                    Open in New Tab
                </Button>
            </a>
        </div>
      </div>
      <div className="flex-1 w-full bg-black relative overflow-hidden">
        <iframe
            src={game.url}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
            allowFullScreen
            title={game.name}
        />
      </div>
    </div>
  );
}
