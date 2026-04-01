"use client";

import { ReleaseStatusBadge } from "@/components/releases/release-status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_RELEASE_EXTRACTED_BYTES,
  MAX_RELEASE_FILE_COUNT,
  MAX_RELEASE_ZIP_BYTES,
} from "@/lib/releases/release-policy";
import {
  HOSTED_RELEASE_CONTROLLER_PATH,
  HOSTED_RELEASE_HOST_PATH,
  HOSTED_RELEASE_MANIFEST_PATH,
} from "@/lib/releases/hosted-release-artifact";
import { api } from "@/trpc/react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  Rocket,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

const formatDateTime = (value?: Date | string | null): string => {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

  const digits = unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
};

const formatCheckKind = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatReportSource = (value: string): string =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

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

  const { data: game } = api.game.get.useQuery({ id: gameId }, { enabled: !!gameId });
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

  const liveRelease = releases?.find((release) => release.status === "live") ?? null;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Arcade Releases</h1>
          <p className="text-muted-foreground max-w-3xl">
            Upload immutable static build artifacts for public Arcade hosting.
            The optional preview URL now lives on Overview; this surface is only
            for Air Jam-hosted releases.
          </p>
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current hosted state</CardTitle>
            <CardDescription>
              {game?.name ?? "Game"}{" "}
              {liveRelease
                ? "has a live hosted release."
                : "does not have a live hosted release yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {liveRelease ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Live release</span>
                  <ReleaseStatusBadge status={liveRelease.status} />
                </div>
                <div className="font-medium">
                  {liveRelease.versionLabel?.trim() || liveRelease.id}
                </div>
                <div className="text-muted-foreground">
                  Made live {formatDateTime(liveRelease.publishedAt)}
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                Upload and make a validated artifact live here before the public
                Arcade can move onto hosted releases.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {feedback ? (
        <Alert variant={feedback.variant}>
          {feedback.variant === "destructive" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>{feedback.title}</AlertTitle>
          <AlertDescription>{feedback.description}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Upload a new release</CardTitle>
            <CardDescription>
              Create a new immutable artifact release. The archive must contain a
              root <code>index.html</code>, the hosted release manifest at{" "}
              <code>{HOSTED_RELEASE_MANIFEST_PATH}</code>, or one single wrapper
              directory containing both.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Version label</label>
                <Input
                  value={versionLabel}
                  onChange={(event) => setVersionLabel(event.target.value)}
                  placeholder="v1.0.0 or 2026-03-30-build-1"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Artifact (.zip)</label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(event) =>
                    setSelectedFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => void handleUploadRelease()}
                  disabled={
                    !selectedFile ||
                    createDraft.isPending ||
                    requestUploadTarget.isPending ||
                    finalizeUpload.isPending ||
                    uploadingReleaseId !== null
                  }
                  className="w-full"
                >
                  {uploadingReleaseId ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload release
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="text-muted-foreground grid gap-2 text-sm md:grid-cols-3">
              <div>
                <span className="font-medium text-foreground">Zip size:</span>{" "}
                {formatBytes(MAX_RELEASE_ZIP_BYTES)} max
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Extracted size:
                </span>{" "}
                {formatBytes(MAX_RELEASE_EXTRACTED_BYTES)} max
              </div>
              <div>
                <span className="font-medium text-foreground">File count:</span>{" "}
                {MAX_RELEASE_FILE_COUNT.toLocaleString()} max
              </div>
            </div>

            {selectedFile ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{selectedFile.name}</div>
                  <div className="text-muted-foreground">
                    {formatBytes(selectedFile.size)}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hosted release contract</CardTitle>
            <CardDescription>
              This is the static-only lane for public Arcade hosting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border p-3">
              <div className="mb-1 font-medium">What is allowed</div>
              <p className="text-muted-foreground">
                One ZIP containing built static output. The release must be
                hostable as a static SPA with a valid `index.html` entry point,
                the Air Jam hosted manifest, host at{" "}
                <code>{HOSTED_RELEASE_HOST_PATH}</code>, and controller at{" "}
                <code>{HOSTED_RELEASE_CONTROLLER_PATH}</code>.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 font-medium">What happens next</div>
              <p className="text-muted-foreground">
                Uploads run structural validation first. Publishing now also
                attempts screenshot capture and image moderation when that
                infrastructure is configured. If it is not configured yet, the
                release still publishes and the dashboard records that moderation
                was skipped.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 font-medium">What stays separate</div>
              <p className="text-muted-foreground">
                Your optional preview URL remains available on Overview for
                localhost, staging, or external private preview.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Release history</CardTitle>
          <CardDescription>
            Inspect artifacts, validation results, and publish state for this
            game.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Loading releases...</div>
          ) : releases && releases.length > 0 ? (
            <div className="space-y-4">
              {releases.map((release) => {
                const latestValidationCheck =
                  release.checks.find(
                    (check) => check.kind === "artifact_validation",
                  ) ?? release.checks[0];
                const isActionPending = actionReleaseId === release.id;
                const openReportCount = release.reports.filter(
                  (report) => report.status === "open",
                ).length;

                return (
                  <div
                    key={release.id}
                    className="space-y-4 rounded-xl border p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {release.versionLabel?.trim() || "Untitled release"}
                          </h3>
                          <ReleaseStatusBadge status={release.status} />
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span>Created {formatDateTime(release.createdAt)}</span>
                          <span>Release ID {release.id}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {release.status === "ready" ? (
                          <Button
                            onClick={() =>
                              void runReleaseAction({
                                releaseId: release.id,
                                action: () =>
                                  publishRelease.mutateAsync({
                                    releaseId: release.id,
                                  }),
                                successTitle: "Release made live",
                                successDescription:
                                  "This hosted artifact is now the live release for the game.",
                              })
                            }
                            disabled={isActionPending}
                          >
                            {isActionPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Rocket className="mr-2 h-4 w-4" />
                            )}
                            Make Live
                          </Button>
                        ) : null}

                        {["ready", "quarantined", "live"].includes(release.status) ? (
                          <Button
                            variant="outline"
                            onClick={() =>
                              void runReleaseAction({
                                releaseId: release.id,
                                action: () =>
                                  runModeration.mutateAsync({
                                    releaseId: release.id,
                                  }),
                                successTitle: "Moderation completed",
                                successDescription:
                                  "The canonical screenshot and image moderation checks were refreshed for this release.",
                              })
                            }
                            disabled={isActionPending}
                          >
                            {isActionPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldAlert className="mr-2 h-4 w-4" />
                            )}
                            Run moderation
                          </Button>
                        ) : null}

                        {release.status === "uploading" ? (
                          <Button
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
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="mr-2 h-4 w-4" />
                            )}
                            Finalize upload
                          </Button>
                        ) : null}

                        {release.status !== "archived" ? (
                          <Button
                            variant="outline"
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
                            Archive
                          </Button>
                        ) : null}

                        {["checking", "ready", "live"].includes(release.status) ? (
                          <Button
                            variant="outline"
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
                            <ShieldAlert className="mr-2 h-4 w-4" />
                            Quarantine
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                          <Package className="text-muted-foreground h-4 w-4" />
                          <div className="font-medium">Artifact</div>
                        </div>
                        {release.artifact ? (
                          <div className="grid gap-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">File</span>
                              <span className="max-w-[70%] truncate text-right">
                                {release.artifact.originalFilename}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Uploaded size</span>
                              <span>{formatBytes(release.artifact.sizeBytes)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Extracted size
                              </span>
                              <span>
                                {formatBytes(release.artifact.extractedSizeBytes)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Files</span>
                              <span>
                                {release.artifact.fileCount?.toLocaleString() ??
                                  "Unknown"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">
                                Hosted routes
                              </span>
                              <span>
                                {HOSTED_RELEASE_HOST_PATH} and{" "}
                                {HOSTED_RELEASE_CONTROLLER_PATH}
                              </span>
                            </div>
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-muted-foreground">
                                Content hash
                              </span>
                              <code className="max-w-[70%] break-all text-right text-xs">
                                {release.artifact.contentHash ?? "Pending"}
                              </code>
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">
                            No validated artifact metadata exists for this release
                            yet.
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                          <div className="font-medium">Checks</div>
                        </div>
                        {release.checks.length > 0 ? (
                          <div className="space-y-3">
                            {latestValidationCheck ? (
                              <div className="rounded-lg border p-3 text-sm">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="font-medium">
                                    {formatCheckKind(latestValidationCheck.kind)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatDateTime(
                                      latestValidationCheck.createdAt,
                                    )}
                                  </span>
                                </div>
                                <div>
                                  {latestValidationCheck.summary ||
                                    "No summary recorded."}
                                </div>
                              </div>
                            ) : null}
                            <div className="space-y-2">
                              {release.checks.map((check) => (
                                <div
                                  key={check.id}
                                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                                >
                                  <div>
                                    <div className="font-medium">
                                      {formatCheckKind(check.kind)}
                                    </div>
                                    <div className="text-muted-foreground">
                                      {check.summary || "No summary recorded."}
                                    </div>
                                  </div>
                                  <div className="text-muted-foreground text-right text-xs">
                                    <div>{check.status}</div>
                                    <div>{formatDateTime(check.createdAt)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">
                            No checks have been recorded for this release yet.
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="text-muted-foreground h-4 w-4" />
                          <div className="font-medium">Reports</div>
                        </div>
                        {release.reports.length > 0 ? (
                          <div className="space-y-3">
                            <div className="rounded-lg border p-3 text-sm">
                              <div className="mb-1 font-medium">
                                {openReportCount} open report
                                {openReportCount === 1 ? "" : "s"}
                              </div>
                              <div className="text-muted-foreground">
                                Public abuse reports are attached directly to the
                                hosted release so creators can quarantine fast if
                                needed.
                              </div>
                            </div>
                            <div className="space-y-2">
                              {release.reports.map((report) => (
                                <div
                                  key={report.id}
                                  className="space-y-2 rounded-md border px-3 py-2 text-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-medium">{report.reason}</div>
                                      <div className="text-muted-foreground text-xs">
                                        {formatReportSource(report.source)} · {report.status}
                                      </div>
                                    </div>
                                    <div className="text-muted-foreground text-right text-xs">
                                      {formatDateTime(report.createdAt)}
                                    </div>
                                  </div>
                                  {report.details ? (
                                    <Textarea
                                      value={report.details}
                                      readOnly
                                      rows={3}
                                      className="bg-muted resize-none text-xs"
                                    />
                                  ) : null}
                                  {report.reporterEmail ? (
                                    <div className="text-muted-foreground text-xs">
                                      Reporter email: {report.reporterEmail}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground text-sm">
                            No public reports have been filed for this release.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">
              No hosted releases yet. Upload your first static artifact above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
