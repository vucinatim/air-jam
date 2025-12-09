"use client";

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

export default function GamesPage() {
  const { data: games, isLoading } = api.game.list.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Games</h1>
          <p className="text-muted-foreground">
            Manage and monitor your Air Jam projects.
          </p>
        </div>
        <Link href="/dashboard/games/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Game
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
          <Input type="search" placeholder="Search games..." className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
      ) : games?.length === 0 ? (
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
            <Link href="/dashboard/games/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Game
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games?.map((game) => (
            <Card
              key={game.id}
              className="group relative overflow-hidden transition-all hover:shadow-md"
            >
              <Link
                href={`/dashboard/games/${game.id}`}
                className="absolute inset-0 z-10"
              >
                <span className="sr-only">View {game.name}</span>
              </Link>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="bg-airjam-cyan/10 text-airjam-cyan flex h-10 w-10 items-center justify-center rounded-lg">
                    <Gamepad2 className="h-5 w-5" />
                  </div>
                  <div className="relative z-20 flex gap-2">
                    {/* Actions that shouldn't trigger the card click */}
                  </div>
                </div>
                <CardTitle className="mt-4 line-clamp-1">{game.name}</CardTitle>
                <CardDescription className="line-clamp-1">
                  {game.url}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">
                      {game.isPublished ? "Live" : "Development"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p className="font-medium">
                      {/* We'd want a real date here, falling back for now */}
                      {new Date(game.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
