"use client";

import {
  GameAnalyticsDeepDive,
  type GameAnalyticsDailyPoint,
  type GameAnalyticsSession,
  type GameAnalyticsTotals,
} from "@/components/game-analytics/game-analytics-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";
import { useParams } from "next/navigation";

export default function GameAnalyticsPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const { data: game, isLoading: isLoadingGame } = api.game.get.useQuery(
    { id: gameId },
    { enabled: !!gameId },
  );
  const { data: analyticsOverview, isLoading: isLoadingOverview } =
    api.analytics.getGameOverview.useQuery(
      { gameId, days: 14 },
      { enabled: !!gameId },
    );
  const { data: recentSessions, isLoading: isLoadingSessions } =
    api.analytics.getRecentGameSessions.useQuery(
      { gameId, limit: 8 },
      { enabled: !!gameId },
    );

  if (isLoadingGame || isLoadingOverview || isLoadingSessions) {
    return <Skeleton className="h-[640px] w-full" />;
  }

  if (!game) {
    return <div>Game not found</div>;
  }

  const dailyAnalytics: GameAnalyticsDailyPoint[] = analyticsOverview?.daily ?? [];
  const analyticsTotals: GameAnalyticsTotals = analyticsOverview?.totals ?? {
    sessionCount: 0,
    totalGameActiveSeconds: 0,
    totalControllerSeconds: 0,
    totalEligiblePlaytimeSeconds: 0,
    peakConcurrentControllers: 0,
    lastActivityAt: null,
  };
  const sessions: GameAnalyticsSession[] = recentSessions ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Detailed usage breakdown for {game.name}. The overview page keeps the
          primary trend chart; this page holds the deeper metrics.
        </p>
      </div>

      <GameAnalyticsDeepDive
        daily={dailyAnalytics}
        totals={analyticsTotals}
        recentSessions={sessions}
      />
    </div>
  );
}
