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
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewGamePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const utils = api.useUtils();
  const createGame = api.game.create.useMutation({
    onSuccess: (game) => {
      utils.game.list.invalidate();
      router.push(`/dashboard/games/${game.id}`);
    },
    onError: (err) => alert(err.message),
  });

  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Game</h1>
        <p className="text-muted-foreground">
          Register a new game to start integrating with Air Jam.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Basic information about your game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Game Name</Label>
            <Input
              placeholder="e.g. Space Racers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Game URL</Label>
            <Input
              placeholder="https://your-game-url.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Where your game is hosted. You can change this later.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky bottom-0 -mx-4 border-t px-4 py-4 backdrop-blur md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            onClick={() => createGame.mutate({ name, url })}
            disabled={createGame.isPending || !name || !url}
          >
            {createGame.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create Game
          </Button>
        </div>
      </div>
    </div>
  );
}
