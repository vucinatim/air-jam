
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
    <div className="max-w-2xl mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Game</CardTitle>
          <CardDescription>
            Register a new game to start integrating with Air Jam.
          </CardDescription>
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
            <p className="text-xs text-muted-foreground">
              Where your game is hosted. You can change this later.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
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
        </CardFooter>
      </Card>
    </div>
  );
}

