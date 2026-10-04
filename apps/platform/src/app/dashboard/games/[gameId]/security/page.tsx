"use client";

import { RetryNotice } from "@/components/retry-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { useMutation } from "@tanstack/react-query";
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
  const [showKey, setShowKey] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const {
    data: appId,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = api.game.getAppId.useQuery({ gameId }, { enabled: !!gameId });

  const updateAppIdPolicy = api.game.updateAppIdPolicy.useMutation({
    retry: false,
    onSuccess: async (updatedAppId) => {
      await utils.game.getAppId.cancel({ gameId });
      utils.game.getAppId.setData({ gameId }, updatedAppId);
      setAllowedOriginsText(null);
      void utils.game.getAppId.invalidate({ gameId });
    },
  });

  const regenerateAppId = api.game.regenerateAppId.useMutation({
    retry: false,
    onSuccess: async (updatedAppId) => {
      await utils.game.getAppId.cancel({ gameId });
      utils.game.getAppId.setData({ gameId }, updatedAppId);
      setShowKey(true);
      copyAppId.reset();
      setShowRegenerateDialog(false);
      void utils.game.getAppId.invalidate({ gameId });
    },
  });

  const copyAppId = useMutation({
    mutationFn: (key: string) => navigator.clipboard.writeText(key),
    retry: false,
  });

  if (isLoading) {
    return <div role="status">Loading security settings...</div>;
  }

  const isBusy = updateAppIdPolicy.isPending || regenerateAppId.isPending;
  const readError = isError ? (
    <RetryNotice
      message="We couldn’t load your security settings."
      detail={appId ? "Previously loaded settings are still shown." : undefined}
      isRetrying={isFetching}
      disabled={isBusy}
      onRetry={() => void refetch()}
    />
  ) : null;

  if (!appId) {
    return readError ?? <div role="status">No App ID found.</div>;
  }

  const displayedAllowedOriginsText =
    allowedOriginsText ?? (appId.allowedOrigins ?? []).join("\n");
  const copied = copyAppId.isSuccess && copyAppId.variables === appId.key;

  const handleSavePolicy = () => {
    if (isBusy) return;

    const normalizedAllowedOrigins = displayedAllowedOriginsText
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    updateAppIdPolicy.mutate({
      gameId,
      allowedOrigins: normalizedAllowedOrigins,
    });
  };

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

      {readError}

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
                onClick={() => copyAppId.mutate(appId.key)}
                disabled={copyAppId.isPending || isBusy}
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
                onClick={() => {
                  regenerateAppId.reset();
                  setShowRegenerateDialog(true);
                }}
                disabled={isBusy}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
            </div>
          </div>
          <div className="bg-muted relative rounded-md p-3 pr-10 font-mono text-xs break-all">
            {showKey ? appId.key : "•".repeat(Math.min(appId.key.length, 40))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKey((value) => !value)}
              aria-label={showKey ? "Hide App ID" : "Show App ID"}
              className="hover:bg-muted-foreground/10 absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0"
            >
              {showKey ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
          </div>
          {copyAppId.error && (
            <Alert variant="destructive">
              <AlertDescription>
                Could not copy the App ID. {copyAppId.error.message}
              </AlertDescription>
            </Alert>
          )}
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
          <Label htmlFor="allowed-origins">Allowed origins</Label>
          <Textarea
            id="allowed-origins"
            placeholder={
              "https://my-game.vercel.app\nhttps://my-game.netlify.app"
            }
            rows={6}
            value={displayedAllowedOriginsText}
            disabled={isBusy}
            onChange={(event) => {
              updateAppIdPolicy.reset();
              setAllowedOriginsText(event.target.value);
            }}
          />
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-3 text-sm text-zinc-300">
            Leave this empty if you want to allow any origin using this App ID.
            Add one origin per line when you want to lock runtime bootstrap down
            to known production hosts.
          </div>
          {updateAppIdPolicy.error && (
            <Alert variant="destructive">
              <AlertDescription>
                Could not save security settings.{" "}
                {updateAppIdPolicy.error.message}
              </AlertDescription>
            </Alert>
          )}
          {updateAppIdPolicy.isSuccess && (
            <p role="status" className="text-muted-foreground text-sm">
              Security settings saved.
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={handleSavePolicy} disabled={isBusy}>
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
        onOpenChange={(open) => {
          if (!regenerateAppId.isPending) setShowRegenerateDialog(open);
        }}
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
          {regenerateAppId.error && (
            <Alert variant="destructive">
              <AlertDescription>
                Could not regenerate the App ID. {regenerateAppId.error.message}
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerateAppId.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (!regenerateAppId.isPending)
                  regenerateAppId.mutate({ gameId });
              }}
              disabled={regenerateAppId.isPending}
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
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
