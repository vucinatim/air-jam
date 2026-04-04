"use client";

import { ReleaseDetailPanels } from "@/components/releases/release-detail-panels";
import { ReleaseStatusBadge } from "@/components/releases/release-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/trpc/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

const formatDateShort = (value?: Date | string | null): string => {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

export function OpsReleasesPageClient() {
  const utils = api.useUtils();
  const [actionReleaseId, setActionReleaseId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    variant: "default" | "destructive";
    title: string;
    description: string;
  } | null>(null);

  const { data: releases, isLoading } = api.release.listOps.useQuery();
  const quarantineRelease = api.release.quarantine.useMutation();
  const runModeration = api.release.runModeration.useMutation();

  const attentionReleases = useMemo(
    () =>
      (releases ?? []).filter((release) => {
        const openReportCount = release.reports.filter(
          (report) => report.status === "open",
        ).length;
        const hasFailedChecks = release.checks.some(
          (check) => check.status === "failed" || check.status === "warning",
        );
        return (
          release.status === "quarantined" ||
          openReportCount > 0 ||
          hasFailedChecks
        );
      }),
    [releases],
  );

  const refresh = async () => {
    await utils.release.listOps.invalidate();
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
      await refresh();
      setFeedback({
        variant: "default",
        title: successTitle,
        description: successDescription,
      });
    } catch (error) {
      setFeedback({
        variant: "destructive",
        title: "Ops action failed",
        description:
          error instanceof Error ? error.message : "The ops action failed.",
      });
    } finally {
      setActionReleaseId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Release Ops</h1>
        <p className="text-muted-foreground mt-1">
          Internal moderation, quarantine, and report triage for hosted Arcade
          releases.
        </p>
      </div>

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

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Attention queue</AlertTitle>
        <AlertDescription>
          {attentionReleases.length === 0
            ? "No releases currently need manual ops attention."
            : `${attentionReleases.length} release${attentionReleases.length === 1 ? "" : "s"} currently need ops review.`}
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center text-sm">
          Loading releases...
        </div>
      ) : releases && releases.length > 0 ? (
        <div className="space-y-3">
          {releases.map((release) => {
            const openReportCount = release.reports.filter(
              (report) => report.status === "open",
            ).length;
            const needsAttention =
              release.status === "quarantined" ||
              openReportCount > 0 ||
              release.checks.some(
                (check) =>
                  check.status === "failed" || check.status === "warning",
              );
            const isActionPending = actionReleaseId === release.id;
            const hasDetails =
              !!release.artifact ||
              release.checks.length > 0 ||
              release.reports.length > 0;

            return (
              <Collapsible key={release.id}>
                <div
                  className={`rounded-xl border ${needsAttention ? "border-destructive/50" : ""}`}
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {release.versionLabel?.trim() || "Untitled release"}
                        </span>
                        <ReleaseStatusBadge status={release.status} />
                        {needsAttention && (
                          <Badge variant="destructive" className="text-[10px]">
                            Needs attention
                          </Badge>
                        )}
                        {openReportCount > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            {openReportCount} open report
                            {openReportCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
                        <span>{release.game?.name ?? "Unknown game"}</span>
                        <span>{release.game?.owner?.email ?? "Unknown owner"}</span>
                        <span>{formatDateShort(release.createdAt)}</span>
                        <span className="font-mono">{release.id.slice(0, 8)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {["checking", "ready", "live"].includes(release.status) && (
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
                          {isActionPending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Quarantine
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

                      {hasDetails && (
                        <CollapsibleTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                      )}
                    </div>
                  </div>

                  {hasDetails && (
                    <CollapsibleContent>
                      <div className="border-t px-4 pt-4 pb-4">
                        <ReleaseDetailPanels
                          artifact={release.artifact}
                          checks={release.checks}
                          reports={release.reports}
                        />
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <div className="text-muted-foreground py-12 text-center text-sm">
          No releases to review yet.
        </div>
      )}
    </div>
  );
}
