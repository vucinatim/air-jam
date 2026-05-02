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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function GameSecurityPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const utils = api.useUtils();
  const [allowedOriginsText, setAllowedOriginsText] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const { data: appId, isLoading } = api.game.getAppId.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  const updateAppIdPolicy = api.game.updateAppIdPolicy.useMutation({
    onSuccess: async () => {
      await utils.game.getAppId.invalidate({ gameId });
      alert("Security settings saved successfully.");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const regenerateAppId = api.game.regenerateAppId.useMutation({
    onSuccess: async () => {
      await utils.game.getAppId.invalidate({ gameId });
      setShowKey(true);
      setCopied(false);
      setShowRegenerateDialog(false);
    },
  });

  const displayedAllowedOriginsText =
    allowedOriginsText ?? (appId?.allowedOrigins ?? []).join("\n");

  const handleCopyAppId = async () => {
    if (!appId?.key) return;
    await navigator.clipboard.writeText(appId.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSavePolicy = () => {
    const allowedOrigins =
      allowedOriginsText ?? (appId?.allowedOrigins ?? []).join("\n");

    const normalizedAllowedOrigins = allowedOrigins
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    void updateAppIdPolicy.mutateAsync({
      gameId,
      allowedOrigins: normalizedAllowedOrigins,
    });
  };

  if (isLoading) {
    return <div>Loading security settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground max-w-3xl">
          Manage the game App ID and origin allowlist used by the Air Jam
          runtime. Keep this separate from preview URL details and Arcade
          release management.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>App ID</CardTitle>
          <CardDescription>
            This is the runtime identity your game uses when it connects to Air
            Jam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-medium">Current App ID</div>
              <div className="text-muted-foreground">
                Regenerate this only if the current key is compromised or you
                want to rotate it deliberately.
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCopyAppId}
                disabled={!appId?.key}
              >
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRegenerateDialog(true)}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </div>
          </div>
          <div className="bg-muted relative rounded-md p-3 pr-10 font-mono text-xs break-all">
            {appId?.key
              ? showKey
                ? appId.key
                : "•".repeat(Math.min(appId.key.length, 40))
              : "No App ID found"}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKey((value) => !value)}
              className="hover:bg-muted-foreground/10 absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0"
            >
              {showKey ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed Origins</CardTitle>
          <CardDescription>
            Restrict which origins can bootstrap this App ID. This is especially
            useful once you know your stable production origin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={
              "https://my-game.vercel.app\nhttps://my-game.netlify.app"
            }
            rows={6}
            value={displayedAllowedOriginsText}
            onChange={(event) => setAllowedOriginsText(event.target.value)}
          />
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-3 text-sm text-zinc-300">
            Leave this empty if you want to allow any origin using this App ID.
            Add one origin per line when you want to lock runtime bootstrap down
            to known production hosts.
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSavePolicy}
              disabled={updateAppIdPolicy.isPending}
            >
              {updateAppIdPolicy.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Save Security Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate App ID?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current App ID immediately. Any
              self-hosted or externally deployed build using the old key will
              stop working until you update it with the new value.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateAppId.mutate({ gameId })}
              disabled={regenerateAppId.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {regenerateAppId.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Regenerate
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
