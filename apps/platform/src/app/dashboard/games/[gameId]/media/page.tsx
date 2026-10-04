"use client";

import { RetryNotice } from "@/components/retry-notice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { GameMediaKind } from "@/lib/games/game-media-contract";
import { MAX_GAME_MEDIA_BYTES } from "@/lib/games/game-media-policy";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/trpc/react";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { CheckCircle2, Loader2, Upload, Video } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const MEDIA_KIND_ORDER: GameMediaKind[] = [
  "thumbnail",
  "cover",
  "preview_video",
];

const MEDIA_KIND_LABEL: Record<GameMediaKind, string> = {
  thumbnail: "Thumbnail",
  cover: "Cover",
  preview_video: "Preview Video",
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDateTime = (value?: Date | string | null): string => {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const MediaPreview = ({
  kind,
  url,
}: {
  kind: GameMediaKind;
  url: string | null;
}) => {
  if (!url) {
    return (
      <div className="text-muted-foreground flex aspect-video items-center justify-center rounded-md border border-dashed text-sm">
        No asset assigned
      </div>
    );
  }

  if (kind === "preview_video") {
    return (
      <video
        src={url}
        className="aspect-video w-full rounded-md border object-cover"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${MEDIA_KIND_LABEL[kind]} preview`}
      className="aspect-video w-full rounded-md border object-cover"
      loading="lazy"
    />
  );
};

function MediaKindCard({
  gameId,
  kind,
  assets,
  onChanged,
}: {
  gameId: string;
  kind: GameMediaKind;
  assets: inferRouterOutputs<AppRouter>["gameMedia"]["listByGame"]["assets"];
  onChanged: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const requestUploadTarget = api.gameMedia.requestUploadTarget.useMutation();
  const finalizeUpload = api.gameMedia.finalizeUpload.useMutation();
  const assignAsset = api.gameMedia.assignAsset.useMutation({
    onSuccess: onChanged,
  });
  const archiveAsset = api.gameMedia.archiveAsset.useMutation({
    onSuccess: onChanged,
  });

  const uploadMedia = useMutation({
    retry: false,
    mutationFn: async (file: File) => {
      if (file.size > MAX_GAME_MEDIA_BYTES[kind]) {
        throw new Error(
          `${MEDIA_KIND_LABEL[kind]} exceeds the ${formatBytes(MAX_GAME_MEDIA_BYTES[kind])} limit.`,
        );
      }
      const created = await requestUploadTarget.mutateAsync({
        gameId,
        kind,
        originalFilename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      const uploadResponse = await fetch(created.upload.url, {
        method: created.upload.method,
        headers: created.upload.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Media upload failed with status ${uploadResponse.status}. Check R2 bucket CORS and credentials.`,
        );
      }

      await finalizeUpload.mutateAsync({
        gameId,
        assetId: created.asset.id,
      });
    },
    onSuccess: async () => {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await onChanged();
    },
  });
  const activeAsset = assets.find((asset) => asset.isActive) ?? null;
  const busy =
    uploadMedia.isPending || assignAsset.isPending || archiveAsset.isPending;
  const actionError = assignAsset.error ?? archiveAsset.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{MEDIA_KIND_LABEL[kind]}</CardTitle>
        <CardDescription>
          Max size: {formatBytes(MAX_GAME_MEDIA_BYTES[kind])}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="text-sm font-medium">Current asset</div>
            <MediaPreview kind={kind} url={activeAsset?.publicUrl ?? null} />
            {activeAsset ? (
              <div className="text-muted-foreground text-sm">
                {activeAsset.originalFilename} ·{" "}
                {formatBytes(activeAsset.sizeBytes)} · Updated{" "}
                {formatDateTime(activeAsset.updatedAt)}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                No {MEDIA_KIND_LABEL[kind].toLowerCase()} has been assigned yet.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium">Upload new asset</div>
            <Input
              ref={fileInputRef}
              aria-label={`${MEDIA_KIND_LABEL[kind]} file`}
              disabled={busy}
              type="file"
              accept={
                kind === "preview_video"
                  ? "video/mp4,video/webm"
                  : "image/png,image/jpeg,image/webp"
              }
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                uploadMedia.reset();
              }}
            />
            <Button
              onClick={() => {
                if (selectedFile && !busy) uploadMedia.mutate(selectedFile);
              }}
              disabled={!selectedFile || busy}
            >
              {uploadMedia.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : kind === "preview_video" ? (
                <Video className="mr-2 h-4 w-4" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload {MEDIA_KIND_LABEL[kind]}
            </Button>
            {uploadMedia.error ? (
              <Alert variant="destructive">
                <AlertTitle>Media upload failed</AlertTitle>
                <AlertDescription>
                  {uploadMedia.error.message} Your file is still selected;
                  correct it or try again.
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="text-muted-foreground text-sm">
              Uploading a new ready asset automatically makes it the active{" "}
              {MEDIA_KIND_LABEL[kind].toLowerCase()}.
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Asset history</div>
          {actionError ? (
            <Alert variant="destructive">
              <AlertTitle>Media action failed</AlertTitle>
              <AlertDescription>{actionError.message}</AlertDescription>
            </Alert>
          ) : null}
          {assets.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
              No uploaded assets yet.
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {asset.originalFilename}
                      </span>
                      {asset.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {asset.mimeType} · {formatBytes(asset.sizeBytes)} ·{" "}
                      {asset.status} · {formatDateTime(asset.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!asset.isActive && asset.status === "ready" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          archiveAsset.reset();
                          assignAsset.mutate({ gameId, assetId: asset.id });
                        }}
                        disabled={busy}
                      >
                        Make Active
                      </Button>
                    ) : null}
                    {asset.status !== "archived" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          assignAsset.reset();
                          archiveAsset.mutate({ gameId, assetId: asset.id });
                        }}
                        disabled={busy}
                      >
                        {archiveAsset.isPending &&
                        archiveAsset.variables?.assetId === asset.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Archive"
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GameMediaPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const utils = api.useUtils();
  const { data: game } = api.game.get.useQuery(
    { id: gameId },
    { enabled: !!gameId },
  );
  const {
    data: mediaData,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = api.gameMedia.listByGame.useQuery({ gameId }, { enabled: !!gameId });

  const refreshMediaData = async () => {
    await Promise.all([
      utils.gameMedia.listByGame.invalidate({ gameId }),
      utils.game.get.invalidate({ id: gameId }),
      utils.game.list.invalidate(),
      utils.game.getAllPublic.invalidate(),
    ]);
  };
  const assetsByKind = useMemo(() => {
    const grouped = new Map<
      GameMediaKind,
      NonNullable<typeof mediaData>["assets"]
    >();
    for (const kind of MEDIA_KIND_ORDER) grouped.set(kind, []);
    for (const asset of mediaData?.assets ?? [])
      grouped.get(asset.kind)?.push(asset);
    return grouped;
  }, [mediaData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Media</h1>
        <p className="text-muted-foreground max-w-3xl">
          Managed catalog visuals for {game?.name ?? "this game"}. These assets
          power Arcade cards, landing showcase surfaces, and public
          presentation. They are stored in Air Jam-managed storage, not external
          URLs.
        </p>
      </div>
      {isError ? (
        <RetryNotice
          message="We couldn’t load your media."
          detail={
            mediaData
              ? "Previously loaded media is still shown below."
              : undefined
          }
          isRetrying={isFetching}
          onRetry={() => void refetch()}
        />
      ) : null}
      {isLoading ? (
        <div role="status">Loading managed media...</div>
      ) : mediaData ? (
        <div className="grid gap-6">
          {MEDIA_KIND_ORDER.map((kind) => (
            <MediaKindCard
              key={kind}
              kind={kind}
              gameId={gameId}
              assets={assetsByKind.get(kind) ?? []}
              onChanged={refreshMediaData}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
