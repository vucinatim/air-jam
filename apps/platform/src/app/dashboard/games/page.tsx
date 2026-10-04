"use client";

import { RetryNotice } from "@/components/retry-notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { Gamepad2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function GamesPage() {
  const [search, setSearch] = useState("");
  const {
    data: games,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = api.game.list.useQuery();
  const matchingGames = (games ?? []).filter((game) =>
    game.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Games</h1>
          <p className="text-muted-foreground">
            Manage and monitor your Air Jam projects.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/games/new">
            <Plus className="mr-2 h-4 w-4" />
            New Game
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input
            type="search"
            aria-label="Search your games"
            placeholder="Search games..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {isError ? (
        <RetryNotice
          message="We couldn’t load your games."
          detail={
            games?.length
              ? "Your previously loaded games are still available below."
              : undefined
          }
          isRetrying={isFetching}
          onRetry={() => void refetch()}
        />
      ) : null}

      {isLoading ? (
        <div
          role="status"
          aria-label="Loading your games"
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
      ) : games?.length === 0 && !isError ? (
        <div className="flex h-[450px] shrink-0 items-center justify-center rounded-md border border-dashed">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <div className="bg-airjam-cyan/10 flex h-20 w-20 items-center justify-center rounded-full">
              <Gamepad2 className="text-airjam-cyan h-10 w-10" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No games created</h3>
            <p className="text-muted-foreground mt-2 mb-4 text-sm">
              You haven&apos;t created any games yet. Start building your first
              Air Jam experience.
            </p>
            <Button asChild>
              <Link href="/dashboard/games/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Game
              </Link>
            </Button>
          </div>
        </div>
      ) : games && games.length > 0 && matchingGames.length === 0 ? (
        <p role="status" className="text-muted-foreground py-12 text-center">
          No games match “{search.trim()}”. Try a different name.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {matchingGames.map((game) => {
            const hasThumbnail = !!game.thumbnailUrl;

            return (
              <Link
                key={game.id}
                href={`/dashboard/games/${game.id}`}
                className="group focus-visible:outline-airjam-cyan block rounded-xl focus-visible:outline-2"
              >
                <Card className="relative overflow-hidden transition-all hover:shadow-md">
                  {hasThumbnail && (
                    <>
                      <div
                        className="absolute inset-0 z-0 scale-105 bg-cover bg-center blur-[1.5px]"
                        style={{ backgroundImage: `url(${game.thumbnailUrl})` }}
                      />
                      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/95 via-black/80 to-black/55" />
                    </>
                  )}
                  <CardHeader className="relative z-20">
                    <div className="flex items-center justify-between">
                      <div
                        className={
                          hasThumbnail
                            ? "flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-xs"
                            : "bg-airjam-cyan/10 text-airjam-cyan flex h-10 w-10 items-center justify-center rounded-lg"
                        }
                      >
                        <Gamepad2 className="h-5 w-5" />
                      </div>
                    </div>
                    <CardTitle
                      className={
                        hasThumbnail
                          ? "mt-4 line-clamp-1 text-white"
                          : "mt-4 line-clamp-1"
                      }
                    >
                      {game.name}
                    </CardTitle>
                    <CardDescription
                      className={
                        hasThumbnail
                          ? "line-clamp-1 text-white/80"
                          : "line-clamp-1"
                      }
                    >
                      {game.url
                        ? `Preview URL: ${game.url}`
                        : "No preview URL configured"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-20">
                    <div
                      className={
                        hasThumbnail
                          ? "grid grid-cols-2 gap-4 text-sm text-white"
                          : "grid grid-cols-2 gap-4 text-sm"
                      }
                    >
                      <div>
                        <p
                          className={
                            hasThumbnail
                              ? "text-white/70"
                              : "text-muted-foreground"
                          }
                        >
                          Status
                        </p>
                        <p className="inline-flex items-center gap-2 font-medium">
                          <span
                            className={
                              game.arcadeVisibility === "listed"
                                ? "h-2 w-2 rounded-full bg-emerald-400"
                                : hasThumbnail
                                  ? "h-2 w-2 rounded-full bg-white/60"
                                  : "bg-muted-foreground h-2 w-2 rounded-full"
                            }
                          />
                          {game.arcadeVisibility === "listed"
                            ? "Listed in Arcade"
                            : "Hidden from Arcade"}
                        </p>
                      </div>
                      <div>
                        <p
                          className={
                            hasThumbnail
                              ? "text-white/70"
                              : "text-muted-foreground"
                          }
                        >
                          Created
                        </p>
                        <p className="font-medium">
                          {new Date(game.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
