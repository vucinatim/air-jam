"use client";

import { ArcadeAudioRuntime, ArcadeSystem } from "@/components/arcade";
import { toArcadeGame } from "@/lib/arcade-game-mapper";
import { platformArcadeHostSessionConfig } from "@/lib/airjam-session-config";
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
import { api } from "@/trpc/react";
import { AirJamHostRuntime, PlatformSettingsRuntime } from "@air-jam/sdk";
import { AlertCircle, ArrowLeft, ExternalLink, Flag, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

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
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reportFeedback, setReportFeedback] = useState<{
    variant: "default" | "destructive";
    title: string;
    description: string;
  } | null>(null);

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

  const arcadeGame = toArcadeGame(game);
  const canReportPublicRelease = game.launchSource === "hosted_release";

  const handleSubmitReport = async () => {
    try {
      setReportFeedback(null);
      await reportPublicRelease.mutateAsync({
        slugOrId: resolvedParams.slugOrId,
        source: "play_page",
        reason: reportReason,
        details: reportDetails || undefined,
        reporterEmail: reporterEmail || undefined,
      });

      setReportDialogOpen(false);
      setReportReason("");
      setReportDetails("");
      setReporterEmail("");
      setReportFeedback({
        variant: "default",
        title: "Report received",
        description:
          "The hosted release report was recorded and will be reviewed from the release dashboard.",
      });
    } catch (submissionError) {
      setReportFeedback({
        variant: "destructive",
        title: "Could not submit report",
        description:
          submissionError instanceof Error
            ? submissionError.message
            : "The report could not be submitted.",
      });
    }
  };

  return (
    <PlatformSettingsRuntime persistence="local">
      <AirJamHostRuntime {...platformArcadeHostSessionConfig}>
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
            reportPending={reportPublicRelease.isPending}
          />
          {reportFeedback ? (
            <div className="border-b border-white/10 bg-slate-950/95 px-4 py-3">
              <Alert variant={reportFeedback.variant}>
                {reportFeedback.variant === "destructive" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <Flag className="h-4 w-4" />
                )}
                <AlertTitle>{reportFeedback.title}</AlertTitle>
                <AlertDescription>{reportFeedback.description}</AlertDescription>
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
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this hosted release</DialogTitle>
            <DialogDescription>
              Use this if the public Arcade release looks abusive, misleading, or
              inappropriate. Reports are attached to the live hosted release, not
              to the creator&apos;s optional preview URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason</label>
              <Input
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder="Example: explicit sexual content, phishing, hate symbols"
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Details</label>
              <Textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder="Share any extra context that helps review the release."
                maxLength={2000}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email (optional)</label>
              <Input
                value={reporterEmail}
                onChange={(event) => setReporterEmail(event.target.value)}
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
              disabled={reportPublicRelease.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmitReport()}
              disabled={reportPublicRelease.isPending || reportReason.trim().length < 3}
            >
              {reportPublicRelease.isPending ? (
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
