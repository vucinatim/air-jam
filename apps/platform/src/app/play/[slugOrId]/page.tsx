"use client";

import { ArcadeAudioRuntime, ArcadeSystem } from "@/components/arcade";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getPlatformArcadeHostSessionConfig } from "@/lib/airjam-session-config";
import { toArcadeGame } from "@/lib/arcade-game-mapper";
import { api } from "@/trpc/react";
import { PlatformSettingsRuntime } from "@air-jam/sdk";
import { AirJamHostRuntime } from "@air-jam/sdk/arcade/runtime";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Flag,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import {
  getReleaseReportFailureMessage,
  useReleaseReportDraft,
} from "./use-release-report-draft";

export default function PlayGamePage({
  params,
}: {
  params: Promise<{ slugOrId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    data: game,
    isLoading,
    error,
  } = api.game.getBySlugOrId.useQuery({ slugOrId: resolvedParams.slugOrId });
  const reportPublicRelease = api.release.reportPublic.useMutation();
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const reportDraft = useReleaseReportDraft();
  const [reportFeedback, setReportFeedback] = useState<{
    variant: "default" | "destructive";
    title: string;
    description: string;
  } | null>(null);
  const sessionConfig = useMemo(() => getPlatformArcadeHostSessionConfig(), []);

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-slate-950">
        <div className="bg-airjam-cyan/10 flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Skeleton className="h-6 w-32 bg-slate-800" />
          <Skeleton className="h-6 w-48 bg-slate-800" />
        </div>
        <div className="flex flex-1 items-center justify-center text-slate-400">
          Loading Game Environment...
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 p-4">
        <div className="text-center">
          <h2 className="mb-2 text-2xl font-bold text-red-400">
            Error Loading Game
          </h2>
          <p className="mb-6 text-slate-400">
            The game could not be found or you don&apos;t have permission to
            view it.
          </p>
          <Link href="/arcade">
            <Button>Browse Arcade</Button>
          </Link>
        </div>
      </div>
    );
  }

  const arcadeGame = toArcadeGame({
    ...game,
    controllerUrl: game.controllerUrl,
  });
  const canReportPublicRelease =
    game.launchSource === "hosted_release" && Boolean(game.liveRelease?.id);

  const handleSubmitReport = async () => {
    if (!canReportPublicRelease || !game.liveRelease) return;
    const submission = reportDraft.begin(game.liveRelease.id);
    if (!submission) return;
    try {
      setReportFeedback(null);
      await reportPublicRelease.mutateAsync(submission);

      setReportDialogOpen(false);
      reportDraft.finish(true);
      setReportFeedback({
        variant: "default",
        title: "Report received",
        description:
          "Your report was received for review by Air Jam operators. Your report text and optional email are not shared with the game creator.",
      });
    } catch (submissionError) {
      reportDraft.finish(false);
      setReportFeedback({
        variant: "destructive",
        title: "Could not submit report",
        description: getReleaseReportFailureMessage(submissionError),
      });
    }
  };

  return (
    <PlatformSettingsRuntime persistence="local">
      <AirJamHostRuntime {...sessionConfig}>
        <div className="flex h-screen flex-col bg-slate-950">
          {/* Preview Header - Block element, z-100 to stay above SDK overlay */}
          <div className="relative z-100">
            <PreviewHeader
              gameId={game.id}
              gameName={game.name}
              gameUrl={game.url}
              launchSource={game.launchSource}
              canReport={canReportPublicRelease}
              onReport={() => setReportDialogOpen(true)}
              reportPending={reportDraft.pending}
            />
            {reportFeedback && !reportDialogOpen ? (
              <div className="border-b border-white/10 bg-slate-950/95 px-4 py-3">
                <Alert variant={reportFeedback.variant}>
                  {reportFeedback.variant === "destructive" ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <Flag className="h-4 w-4" />
                  )}
                  <AlertTitle>{reportFeedback.title}</AlertTitle>
                  <AlertDescription>
                    {reportFeedback.description}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}
          </div>
          <div className="relative flex-1">
            {/* Game Container - Takes remaining space */}
            <ArcadeAudioRuntime>
              <ArcadeSystem
                games={[arcadeGame]}
                mode="preview"
                initialGameId={game.id}
                onExitGame={() => router.push(`/dashboard/games/${game.id}`)}
                className="flex-1"
                previewControllersEnabled
              />
            </ArcadeAudioRuntime>
          </div>
        </div>
        <Dialog
          open={reportDialogOpen}
          onOpenChange={(open) => {
            if (!reportDraft.pending) setReportDialogOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report this hosted release</DialogTitle>
              <DialogDescription>
                Use this if the public Arcade release looks abusive, misleading,
                or inappropriate. Reports are attached to the live hosted
                release, not to the creator&apos;s optional preview URL. Your
                report text and optional email are private to Air Jam operators
                and are not shared with the game creator. Retrying an unchanged
                report does not submit it twice.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {reportFeedback?.variant === "destructive" && (
                <Alert variant="destructive">
                  <AlertTitle>{reportFeedback.title}</AlertTitle>
                  <AlertDescription>
                    {reportFeedback.description}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <Input
                  value={reportDraft.draft.reason}
                  onChange={(event) =>
                    reportDraft.change("reason", event.target.value)
                  }
                  disabled={reportDraft.pending}
                  placeholder="Example: explicit sexual content, phishing, hate symbols"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Details</label>
                <Textarea
                  value={reportDraft.draft.details}
                  onChange={(event) =>
                    reportDraft.change("details", event.target.value)
                  }
                  disabled={reportDraft.pending}
                  placeholder="Share any extra context that helps review the release."
                  maxLength={2000}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email (optional)</label>
                <Input
                  value={reportDraft.draft.reporterEmail}
                  onChange={(event) =>
                    reportDraft.change("reporterEmail", event.target.value)
                  }
                  disabled={reportDraft.pending}
                  placeholder="name@example.com"
                  type="email"
                  maxLength={320}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReportDialogOpen(false)}
                disabled={reportDraft.pending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleSubmitReport()}
                disabled={
                  reportDraft.pending ||
                  reportDraft.draft.reason.trim().length < 3
                }
              >
                {reportDraft.pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Flag className="mr-2 h-4 w-4" />
                    Submit report
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AirJamHostRuntime>
    </PlatformSettingsRuntime>
  );
}

/** Preview header - block element above the game */
const PreviewHeader = ({
  gameId,
  gameName,
  gameUrl,
  launchSource,
  canReport,
  onReport,
  reportPending,
}: {
  gameId: string;
  gameName: string;
  gameUrl: string;
  launchSource?: "self_hosted" | "hosted_release";
  canReport?: boolean;
  onReport?: () => void;
  reportPending?: boolean;
}) => {
  return (
    <div className="bg-airjam-cyan/10 flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/games/${gameId}`}>
          <Button
            variant="ghost"
            size="icon"
            title="Back to Game"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-sm leading-none font-bold text-white">
            {gameName}
          </h1>
          <span className="text-airjam-cyan mt-1 text-xs">Preview Mode</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="mr-2 hidden items-center rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 md:flex">
          Source:{" "}
          <span className="ml-1 font-medium text-slate-200">
            {launchSource === "hosted_release"
              ? "Hosted release"
              : "Preview URL"}
          </span>
          <span className="mx-1">·</span>
          <span className="ml-1 max-w-[200px] truncate font-mono">
            {gameUrl}
          </span>
        </div>
        <a href={gameUrl} target="_blank" rel="noopener noreferrer">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-white/20 text-xs text-white hover:bg-white/10"
          >
            <ExternalLink className="mr-2 h-3 w-3" />
            Open in New Tab
          </Button>
        </a>
        {canReport ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onReport}
            disabled={reportPending}
            className="h-8 border-white/20 text-xs text-white hover:bg-white/10"
          >
            {reportPending ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Flag className="mr-2 h-3 w-3" />
            )}
            Report
          </Button>
        ) : null}
      </div>
    </div>
  );
};
