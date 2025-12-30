"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api } from "@/trpc/react";
import {
  Activity,
  Check,
  Copy,
  Eye,
  EyeOff,
  Gamepad2,
  Globe,
  Key,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function GameOverviewPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const [copied, setCopied] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const utils = api.useUtils();
  const { data: game, isLoading } = api.game.get.useQuery({ id: gameId });
  const { data: apiKey } = api.game.getApiKey.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  const regenerateApiKey = api.game.regenerateApiKey.useMutation({
    onSuccess: () => {
      utils.game.getApiKey.invalidate({ gameId });
      setIsKeyVisible(true); // Show the new key
      setCopied(false);
      setShowRegenerateDialog(false);
    },
  });

  const updatePublishStatus = api.game.update.useMutation({
    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await utils.game.get.cancel({ id: gameId });

      // Snapshot previous value
      const previousGame = utils.game.get.getData({ id: gameId });

      // Optimistically update
      utils.game.get.setData({ id: gameId }, (old) => {
        if (!old) return old;
        return { ...old, isPublished: newData.isPublished ?? old.isPublished };
      });

      return { previousGame };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      if (context?.previousGame) {
        utils.game.get.setData({ id: gameId }, context.previousGame);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      utils.game.get.invalidate({ id: gameId });
      utils.game.getAllPublic.invalidate();
    },
  });

  const handleCopyApiKey = async () => {
    if (apiKey?.key) {
      await navigator.clipboard.writeText(apiKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="publish-toggle" className="cursor-pointer">
              {game.isPublished ? "Published" : "Draft"}
            </Label>
            <Switch
              id="publish-toggle"
              checked={game.isPublished}
              onCheckedChange={(checked) => {
                updatePublishStatus.mutate({
                  id: gameId,
                  isPublished: checked,
                });
              }}
              disabled={updatePublishStatus.isPending}
            />
          </div>
          <Link href={`/play/${game.slug || game.id}`}>
            <Button
              variant="outline"
              className="border-airjam-cyan text-airjam-cyan hover:bg-airjam-cyan/10"
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
              title={game.slug || game.id}
            >
              {game.slug || (
                <span className="text-muted-foreground text-sm">Using ID</span>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              /play/{game.slug || game.id}
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
            <CardTitle className="text-sm font-medium">API Key</CardTitle>
            <Key className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {apiKey?.isActive ? "Active" : "Inactive"}
            </div>
            <p className="text-muted-foreground text-xs">
              {apiKey?.isActive ? "Ready to use" : "Not available"}
            </p>
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
              Analytics coming soon...
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">API Key</span>
                  {apiKey?.key && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowRegenerateDialog(true)}
                        className="h-7 px-2"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span className="text-xs">Regenerate</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyApiKey}
                        className="h-7 px-2"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span className="text-xs">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span className="text-xs">Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                {apiKey?.key ? (
                  <div className="bg-muted relative rounded-md p-2 pr-8 font-mono text-xs break-all">
                    {isKeyVisible
                      ? apiKey.key
                      : "•".repeat(Math.min(apiKey.key.length, 40))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsKeyVisible(!isKeyVisible)}
                      className="hover:bg-muted-foreground/10 absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0"
                    >
                      {isKeyVisible ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-xs">
                    No API key found
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current API key with a new one. The
              previous API key will be immediately invalidated and your game
              will stop working until you update it with the new key. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateApiKey.mutate({ gameId })}
              disabled={regenerateApiKey.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {regenerateApiKey.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
