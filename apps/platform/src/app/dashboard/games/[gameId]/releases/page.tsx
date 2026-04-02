"use client";

import { ReleaseStatusBadge } from "@/components/releases/release-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  MAX_RELEASE_EXTRACTED_BYTES,
  MAX_RELEASE_FILE_COUNT,
  MAX_RELEASE_ZIP_BYTES,
} from "@/lib/releases/release-policy";
import { api } from "@/trpc/react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Package,
  Rocket,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDateTime = (value?: Date | string | null): string => {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatDateShort = (value?: Date | string | null): string => {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const formatBytes = (value?: number | null): string => {
  if (!value || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
};

const formatCheckKind = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GameReleasesPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  const utils = api.useUtils();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [versionLabel, setVersionLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState<{
    variant: "default" | "destructive";
    title: string;
    description: string;
  } | null>(null);
  const [uploadingReleaseId, setUploadingReleaseId] = useState<string | null>(
    null,
  );
  const [actionReleaseId, setActionReleaseId] = useState<string | null>(null);

  const { data: releases, isLoading } = api.release.listByGame.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  const createDraft = api.release.createDraft.useMutation();
  const requestUploadTarget = api.release.requestUploadTarget.useMutation();
  const finalizeUpload = api.release.finalizeUpload.useMutation();
  const publishRelease = api.release.publish.useMutation();
  const archiveRelease = api.release.archive.useMutation();
  const quarantineRelease = api.release.quarantine.useMutation();
  const runModeration = api.release.runModeration.useMutation();

  const refreshReleaseData = async () => {
    await Promise.all([
      utils.release.listByGame.invalidate({ gameId }),
      utils.game.get.invalidate({ id: gameId }),
    ]);
  };

  const liveRelease =
    releases?.find((release) => release.status === "live") ?? null;

  const handleUploadRelease = async () => {
    if (!selectedFile) {
      setFeedback({
        variant: "destructive",
        title: "Choose an archive first",
        description:
          "Select a .zip file containing your built static game output.",
      });
      return;
    }

    if (selectedFile.size > MAX_RELEASE_ZIP_BYTES) {
      setFeedback({
        variant: "destructive",
        title: "Archive too large",
        description: `This archive is ${formatBytes(selectedFile.size)} but the current limit is ${formatBytes(MAX_RELEASE_ZIP_BYTES)}.`,
      });
      return;
    }

    let createdReleaseId: string | null = null;

    try {
      setFeedback(null);
      const createdRelease = await createDraft.mutateAsync({
        gameId,
        versionLabel: versionLabel.trim() || undefined,
      });
      createdReleaseId = createdRelease.id;
      setUploadingReleaseId(createdRelease.id);

      const uploadTarget = await requestUploadTarget.mutateAsync({
        releaseId: createdRelease.id,
        originalFilename: selectedFile.name,
        sizeBytes: selectedFile.size,
      });

      const uploadResponse = await fetch(uploadTarget.upload.url, {
        method: uploadTarget.upload.method,
        headers: uploadTarget.upload.headers,
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Artifact upload failed with status ${uploadResponse.status}. Check the R2 bucket CORS rules and upload credentials.`,
        );
      }

      await finalizeUpload.mutateAsync({
        releaseId: createdRelease.id,
      });

      setSelectedFile(null);
      setVersionLabel("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setFeedback({
        variant: "default",
        title: "Release uploaded",
        description:
          "The artifact passed structural validation and is now ready to publish.",
      });
      await refreshReleaseData();
    } catch (error) {
      setFeedback({
        variant: "destructive",
        title: "Release upload failed",
        description:
          error instanceof Error
            ? error.message
            : "The release could not be uploaded or validated.",
      });

      if (createdReleaseId) {
        await refreshReleaseData();
      }
    } finally {
      setUploadingReleaseId(null);
    }
  };

  const runReleaseAction = async ({
    releaseId,
    action,
    successTitle,
    successDescription,
  }: {
    releaseId: string;
    action: () => Promise<unknown>;
    successTitle: string;
    successDescription: string;
  }) => {
    try {
      setActionReleaseId(releaseId);
      setFeedback(null);
      await action();
      await refreshReleaseData();
      setFeedback({
        variant: "default",
        title: successTitle,
        description: successDescription,
      });
    } catch (error) {
      setFeedback({
        variant: "destructive",
        title: "Release action failed",
        description:
          error instanceof Error ? error.message : "The release action failed.",
      });
    } finally {
      setActionReleaseId(null);
    }
  };

  const isUploading =
    createDraft.isPending ||
    requestUploadTarget.isPending ||
    finalizeUpload.isPending ||
    uploadingReleaseId !== null;

  /* ---- render ---------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------ */}
      {/*  Header                                                       */}
      {/* ------------------------------------------------------------ */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Arcade Releases</h1>
        <p className="text-muted-foreground mt-1">
          {liveRelease ? (
            <>
              Live:{" "}
              <span className="text-foreground font-medium">
                {liveRelease.versionLabel?.trim() || "Untitled"}
              </span>
              {" \u00B7 "}
              Published {formatDateShort(liveRelease.publishedAt)}
            </>
          ) : (
            "No live release yet. Upload a build artifact and make it live."
          )}
        </p>
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Feedback alert                                                */}
      {/* ------------------------------------------------------------ */}
      {feedback && (
        <Alert variant={feedback.variant}>
          {feedback.variant === "destructive" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Upload                                                        */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Release</CardTitle>
          <CardDescription>
            Upload a .zip containing your built static game. Must include a root{" "}
            <code className="text-xs">index.html</code> and the Air Jam hosted
            release manifest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Version label</label>
              <Input
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="v1.0.0"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Artifact (.zip)</label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => void handleUploadRelease()}
                disabled={!selectedFile || isUploading}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="font-medium">{selectedFile.name}</span>
              <span className="text-muted-foreground">
                {formatBytes(selectedFile.size)}
              </span>
            </div>
          )}

          <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>
              Max zip:{" "}
              <span className="text-foreground">
                {formatBytes(MAX_RELEASE_ZIP_BYTES)}
              </span>
            </span>
            <span>
              Max extracted:{" "}
              <span className="text-foreground">
                {formatBytes(MAX_RELEASE_EXTRACTED_BYTES)}
              </span>
            </span>
            <span>
              Max files:{" "}
              <span className="text-foreground">
                {MAX_RELEASE_FILE_COUNT.toLocaleString()}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/*  Release History                                               */}
      {/* ------------------------------------------------------------ */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Release History</h2>

        {isLoading ? (
          <div className="text-muted-foreground py-12 text-center text-sm">
            Loading releases...
          </div>
        ) : releases && releases.length > 0 ? (
          <div className="space-y-3">
            {releases.map((release) => {
              const isActionPending = actionReleaseId === release.id;
              const openReportCount = release.reports.filter(
                (r) => r.status === "open",
              ).length;
              const hasDetails =
                !!release.artifact ||
                release.checks.length > 0 ||
                release.reports.length > 0;

              return (
                <Collapsible key={release.id}>
                  <div className="rounded-xl border">
                    {/* Release row */}
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">
                              {release.versionLabel?.trim() ||
                                "Untitled release"}
                            </span>
                            <ReleaseStatusBadge status={release.status} />
                            {openReportCount > 0 && (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                {openReportCount} report
                                {openReportCount === 1 ? "" : "s"}
                              </Badge>
                            )}
                          </div>
                          <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                            <span>{formatDateShort(release.createdAt)}</span>
                            {release.artifact && (
                              <span>
                                {formatBytes(release.artifact.sizeBytes)}
                              </span>
                            )}
                            <span className="font-mono">
                              {release.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {release.status === "ready" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              void runReleaseAction({
                                releaseId: release.id,
                                action: () =>
                                  publishRelease.mutateAsync({
                                    releaseId: release.id,
                                  }),
                                successTitle: "Release made live",
                                successDescription:
                                  "This artifact is now the live hosted release.",
                              })
                            }
                            disabled={isActionPending}
                          >
                            {isActionPending ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Rocket className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Make Live
                          </Button>
                        )}

                        {release.status === "uploading" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void runReleaseAction({
                                releaseId: release.id,
                                action: () =>
                                  finalizeUpload.mutateAsync({
                                    releaseId: release.id,
                                  }),
                                successTitle: "Upload finalized",
                                successDescription:
                                  "The artifact was re-checked and the release state was refreshed.",
                              })
                            }
                            disabled={isActionPending}
                          >
                            {isActionPending ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Upload className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Finalize
                          </Button>
                        )}

                        {["ready", "quarantined", "live"].includes(
                          release.status,
                        ) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void runReleaseAction({
                                releaseId: release.id,
                                action: () =>
                                  runModeration.mutateAsync({
                                    releaseId: release.id,
                                  }),
                                successTitle: "Moderation completed",
                                successDescription:
                                  "Screenshot and image moderation checks were refreshed.",
                              })
                            }
                            disabled={isActionPending}
                          >
                            {isActionPending ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Moderate
                          </Button>
                        )}

                        {release.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void runReleaseAction({
                                releaseId: release.id,
                                action: () =>
                                  archiveRelease.mutateAsync({
                                    releaseId: release.id,
                                  }),
                                successTitle: "Release archived",
                                successDescription:
                                  "The release was moved out of the active deployment lane.",
                              })
                            }
                            disabled={isActionPending}
                          >
                            <Archive className="mr-1.5 h-3.5 w-3.5" />
                            Archive
                          </Button>
                        )}

                        {["checking", "ready", "live"].includes(
                          release.status,
                        ) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              void runReleaseAction({
                                releaseId: release.id,
                                action: () =>
                                  quarantineRelease.mutateAsync({
                                    releaseId: release.id,
                                  }),
                                successTitle: "Release quarantined",
                                successDescription:
                                  "The release is now blocked from the public deployment lane.",
                              })
                            }
                            disabled={isActionPending}
                          >
                            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                            Quarantine
                          </Button>
                        )}

                        {hasDetails && (
                          <CollapsibleTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-180" />
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>
                    </div>

                    {/* Collapsible detail panels */}
                    {hasDetails && (
                      <CollapsibleContent>
                        <div className="border-t px-4 pt-4 pb-4">
                          <div className="grid gap-4 lg:grid-cols-3">
                            {/* Artifact */}
                            <div className="space-y-2">
                              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
                                <Package className="h-3 w-3" />
                                Artifact
                              </div>
                              {release.artifact ? (
                                <div className="space-y-1.5 text-sm">
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">
                                      File
                                    </span>
                                    <span className="max-w-[65%] truncate text-right">
                                      {release.artifact.originalFilename}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">
                                      Uploaded
                                    </span>
                                    <span>
                                      {formatBytes(release.artifact.sizeBytes)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">
                                      Extracted
                                    </span>
                                    <span>
                                      {formatBytes(
                                        release.artifact.extractedSizeBytes,
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-muted-foreground">
                                      Files
                                    </span>
                                    <span>
                                      {release.artifact.fileCount?.toLocaleString() ??
                                        "Unknown"}
                                    </span>
                                  </div>
                                  {release.artifact.contentHash && (
                                    <div className="flex justify-between gap-2">
                                      <span className="text-muted-foreground">
                                        Hash
                                      </span>
                                      <code className="max-w-[65%] truncate text-right text-[11px]">
                                        {release.artifact.contentHash}
                                      </code>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  No artifact metadata yet.
                                </p>
                              )}
                            </div>

                            {/* Checks */}
                            <div className="space-y-2">
                              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
                                <CheckCircle2 className="h-3 w-3" />
                                Checks
                              </div>
                              {release.checks.length > 0 ? (
                                <div className="space-y-2">
                                  {release.checks.map((check) => (
                                    <div
                                      key={check.id}
                                      className="rounded-md border p-2.5 text-sm"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">
                                          {formatCheckKind(check.kind)}
                                        </span>
                                        <Badge
                                          variant={
                                            check.status === "passed"
                                              ? "default"
                                              : check.status === "failed"
                                                ? "destructive"
                                                : "secondary"
                                          }
                                          className="text-[10px]"
                                        >
                                          {check.status}
                                        </Badge>
                                      </div>
                                      {check.summary && (
                                        <p className="text-muted-foreground mt-1 text-xs">
                                          {check.summary}
                                        </p>
                                      )}
                                      <p className="text-muted-foreground mt-1 text-[10px]">
                                        {formatDateTime(check.createdAt)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  No checks recorded yet.
                                </p>
                              )}
                            </div>

                            {/* Reports */}
                            <div className="space-y-2">
                              <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wider uppercase">
                                <FileText className="h-3 w-3" />
                                Reports
                              </div>
                              {release.reports.length > 0 ? (
                                <div className="space-y-2">
                                  {release.reports.map((report) => (
                                    <div
                                      key={report.id}
                                      className="rounded-md border p-2.5 text-sm"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">
                                          {report.reason}
                                        </span>
                                        <Badge
                                          variant={
                                            report.status === "open"
                                              ? "destructive"
                                              : "secondary"
                                          }
                                          className="text-[10px]"
                                        >
                                          {report.status}
                                        </Badge>
                                      </div>
                                      {report.details && (
                                        <p className="text-muted-foreground mt-1 text-xs">
                                          {report.details}
                                        </p>
                                      )}
                                      <p className="text-muted-foreground mt-1 text-[10px]">
                                        {formatDateTime(report.createdAt)}
                                        {report.reporterEmail &&
                                          ` \u00B7 ${report.reporterEmail}`}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">
                                  No reports filed.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    )}
                  </div>
                </Collapsible>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <Package className="text-muted-foreground h-6 w-6" />
            </div>
            <p className="mt-4 font-medium">No releases yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Upload your first static build artifact above to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
