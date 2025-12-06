"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { Activity, Gamepad2, Globe, Key, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function GameOverviewPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const { data: game, isLoading } = api.game.get.useQuery({ id: gameId });
  const { data: apiKeys } = api.game.getApiKeys.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  if (!game) {
    return <div>Game not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
          <p className="text-muted-foreground">
            {game.description || "No description provided."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/play/${game.id}`}>
            <Button
              variant="outline"
              className="border-airjam text-airjam hover:bg-airjam/10"
            >
              <Gamepad2 className="mr-2 h-4 w-4" />
              Test Play
            </Button>
          </Link>
          <Link href={`/dashboard/games/${gameId}/settings`}>
            <Button variant="outline">Edit Settings</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {game.isPublished ? "Published" : "Draft"}
            </div>
            <p className="text-muted-foreground text-xs">
              {game.isPublished
                ? "Visible in Arcade"
                : "Only accessible via link"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Slug</CardTitle>
            <Globe className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div
              className="truncate text-2xl font-bold"
              title={game.slug || "Not set"}
            >
              {game.slug || "Not set"}
            </div>
            <p className="text-muted-foreground text-xs">
              airjam.io/play/{game.slug || "..."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Players</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {game.minPlayers} - {game.maxPlayers || "∞"}
            </div>
            <p className="text-muted-foreground text-xs">Supported count</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Key className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKeys?.filter((key) => key.isActive).length || 0}
            </div>
            <p className="text-muted-foreground text-xs">Active keys</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="text-muted-foreground flex h-[200px] items-center justify-center">
              No recent activity (Analytics coming soon)
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Quick access to game config</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Orientation</span>
                <span className="text-muted-foreground text-sm capitalize">
                  {game.orientation}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Game URL</span>
                <span className="text-muted-foreground max-w-[200px] truncate text-sm">
                  {game.url}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
