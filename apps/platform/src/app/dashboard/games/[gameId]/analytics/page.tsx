"use client";

import {
  formatAnalyticsDuration,
  formatAnalyticsTimestamp,
  type GameAnalyticsDailyPoint,
  type GameAnalyticsDebugSnapshot,
  type GameAnalyticsSession,
  type GameAnalyticsTotals,
} from "@/components/game-analytics/game-analytics-panels";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/trpc/react";
import {
  Activity,
  BarChart3,
  Bug,
  ChevronDown,
  Clock3,
  Gamepad2,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GameAnalyticsPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const { data: game, isLoading: isLoadingGame } = api.game.get.useQuery(
    { id: gameId },
    { enabled: !!gameId },
  );
  const { data: analyticsOverview, isLoading: isLoadingOverview } =
    api.analytics.getGameOverview.useQuery(
      { gameId, days: 30 },
      { enabled: !!gameId },
    );
  const { data: recentSessions, isLoading: isLoadingSessions } =
    api.analytics.getRecentGameSessions.useQuery(
      { gameId, limit: 10 },
      { enabled: !!gameId },
    );
  const { data: debugSnapshot } = api.analytics.getGameDebugSnapshot.useQuery(
    { gameId },
    { enabled: !!gameId },
  );

  if (isLoadingGame || isLoadingOverview || isLoadingSessions) {
    return <Skeleton className="h-[640px] w-full" />;
  }

  if (!game) {
    return <div>Game not found</div>;
  }

  const daily: GameAnalyticsDailyPoint[] = analyticsOverview?.daily ?? [];
  const totals: GameAnalyticsTotals = analyticsOverview?.totals ?? {
    sessionCount: 0,
    totalGameActiveSeconds: 0,
    totalControllerSeconds: 0,
    totalRawEligiblePlaytimeSeconds: 0,
    totalEligiblePlaytimeSeconds: 0,
    guardedSessionCount: 0,
    peakConcurrentControllers: 0,
    lastActivityAt: null,
  };
  const sessions: GameAnalyticsSession[] = recentSessions ?? [];
  const debug: GameAnalyticsDebugSnapshot | null = debugSnapshot ?? null;

  const hasActivity = daily.some(
    (d) => d.sessionCount > 0 || d.totalEligiblePlaytimeSeconds > 0,
  );

  const peakDailySessions = Math.max(1, ...daily.map((d) => d.sessionCount));
  const peakDailyEligible = Math.max(
    1,
    ...daily.map((d) => d.totalEligiblePlaytimeSeconds),
  );
  const peakDailyController = Math.max(
    1,
    ...daily.map((d) => d.totalControllerSeconds),
  );

  const avgSessionSeconds =
    totals.sessionCount > 0
      ? Math.round(totals.totalEligiblePlaytimeSeconds / totals.sessionCount)
      : 0;

  const trustedSharePct =
    totals.totalGameActiveSeconds > 0
      ? Math.round(
          (totals.totalEligiblePlaytimeSeconds /
            totals.totalGameActiveSeconds) *
            100,
        )
      : 0;

  const mostActiveDay = daily.reduce<GameAnalyticsDailyPoint | null>(
    (best, d) => {
      if (d.totalEligiblePlaytimeSeconds <= 0) return best;
      if (!best) return d;
      return d.totalEligiblePlaytimeSeconds > best.totalEligiblePlaytimeSeconds
        ? d
        : best;
    },
    null,
  );

  /* ---- render ---------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Last 30 days for {game.name}.
          {totals.lastActivityAt && (
            <>
              {" "}
              Last activity {formatAnalyticsTimestamp(totals.lastActivityAt)}.
            </>
          )}
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <BarChart3 className="h-3.5 w-3.5" />
            Sessions
          </div>
          <div className="mt-2 text-2xl font-bold">{totals.sessionCount}</div>
          <div className="text-muted-foreground text-xs">
            {totals.guardedSessionCount > 0
              ? `${totals.guardedSessionCount} guarded`
              : "No guarded sessions"}
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Clock3 className="h-3.5 w-3.5" />
            Trusted Eligible
          </div>
          <div className="mt-2 text-2xl font-bold">
            {formatAnalyticsDuration(totals.totalEligiblePlaytimeSeconds)}
          </div>
          <div className="text-muted-foreground text-xs">
            {formatAnalyticsDuration(totals.totalRawEligiblePlaytimeSeconds)}{" "}
            raw {"\u00B7"} {trustedSharePct}% trusted share
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Activity className="h-3.5 w-3.5" />
            Controller Time
          </div>
          <div className="mt-2 text-2xl font-bold">
            {formatAnalyticsDuration(totals.totalControllerSeconds)}
          </div>
          <div className="text-muted-foreground text-xs">
            Avg {formatAnalyticsDuration(avgSessionSeconds)} per session
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Users className="h-3.5 w-3.5" />
            Peak Controllers
          </div>
          <div className="mt-2 text-2xl font-bold">
            {totals.peakConcurrentControllers}
          </div>
          <div className="text-muted-foreground text-xs">
            {mostActiveDay
              ? `Best day: ${mostActiveDay.bucketDate.slice(5)}`
              : "No activity yet"}
          </div>
        </div>
      </div>

      {/* Charts: Session Cadence + Controller Load */}
      {hasActivity ? (
        <div className="grid gap-4 lg:grid-cols-7">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Session Cadence</CardTitle>
              <CardDescription>
                Daily completed sessions over the last 30 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-44 items-end gap-1">
                {daily.map((day) => {
                  const height = Math.max(
                    6,
                    Math.round((day.sessionCount / peakDailySessions) * 100),
                  );
                  return (
                    <div
                      key={day.bucketDate}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="bg-muted flex h-36 w-full cursor-default items-end rounded-sm">
                            <div
                              className="bg-airjam-cyan/70 w-full rounded-sm transition-all"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8}>
                          <div className="space-y-0.5 text-xs">
                            <div className="font-medium">{day.bucketDate}</div>
                            <div>Sessions: {day.sessionCount}</div>
                            <div>
                              Eligible:{" "}
                              {formatAnalyticsDuration(
                                day.totalEligiblePlaytimeSeconds,
                              )}
                            </div>
                            <div>Guarded: {day.guardedSessionCount}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-muted-foreground text-[9px]">
                        {day.bucketDate.slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Controller Load</CardTitle>
              <CardDescription>
                Daily connected-player time. Lighter = total, solid = trusted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {daily
                .filter(
                  (d) =>
                    d.totalControllerSeconds > 0 ||
                    d.totalEligiblePlaytimeSeconds > 0,
                )
                .slice(-7)
                .map((day) => {
                  const controllerPct = Math.max(
                    6,
                    Math.round(
                      (day.totalControllerSeconds / peakDailyController) * 100,
                    ),
                  );
                  const eligiblePct =
                    day.totalControllerSeconds > 0
                      ? Math.round(
                          (day.totalEligiblePlaytimeSeconds /
                            day.totalControllerSeconds) *
                            100,
                        )
                      : 0;
                  return (
                    <div key={day.bucketDate} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {day.bucketDate.slice(5)}
                        </span>
                        <span className="font-medium">
                          {formatAnalyticsDuration(day.totalControllerSeconds)}
                        </span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-airjam-cyan/30 relative h-full rounded-full"
                          style={{ width: `${controllerPct}%` }}
                        >
                          <div
                            className="bg-airjam-cyan absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${eligiblePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                <Gamepad2 className="text-muted-foreground h-6 w-6" />
              </div>
              <p className="mt-4 font-medium">No activity yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Start a game session to see analytics populate here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Eligible Playtime + Recent Sessions */}
      {hasActivity && (
        <div className="grid grid-rows-[1fr] gap-4 lg:grid-cols-7">
          {/* Eligible Playtime */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Eligible Playtime</CardTitle>
              <CardDescription>
                Daily trusted eligible time over the last 30 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-36 items-end gap-1">
                {daily.map((day) => {
                  const height = Math.max(
                    6,
                    Math.round(
                      (day.totalEligiblePlaytimeSeconds / peakDailyEligible) *
                        100,
                    ),
                  );
                  return (
                    <div
                      key={day.bucketDate}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="bg-airjam-cyan/15 flex h-28 w-full cursor-default items-end rounded-sm">
                            <div
                              className="bg-airjam-cyan w-full rounded-sm transition-all"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8}>
                          <div className="space-y-0.5 text-xs">
                            <div className="font-medium">{day.bucketDate}</div>
                            <div>
                              Trusted:{" "}
                              {formatAnalyticsDuration(
                                day.totalEligiblePlaytimeSeconds,
                              )}
                            </div>
                            <div>
                              Raw:{" "}
                              {formatAnalyticsDuration(
                                day.totalRawEligiblePlaytimeSeconds,
                              )}
                            </div>
                            <div>
                              Active:{" "}
                              {formatAnalyticsDuration(
                                day.totalGameActiveSeconds,
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-muted-foreground text-[9px]">
                        {day.bucketDate.slice(8)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">
                    Game Active Time
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatAnalyticsDuration(totals.totalGameActiveSeconds)}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-muted-foreground text-xs">
                    Trusted Share
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {trustedSharePct}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Sessions -- capped height, scrollable */}
          <Card className="flex max-h-[480px] flex-col overflow-hidden lg:col-span-4">
            <CardHeader className="shrink-0">
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>
                Last {sessions.length} completed sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {sessions.length > 0 ? (
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {formatAnalyticsTimestamp(session.startedAt)}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          Peak {session.peakConcurrentControllers} controller
                          {session.peakConcurrentControllers === 1 ? "" : "s"}
                        </div>
                        {session.trustFlags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {session.trustFlags.map((flag) => (
                              <Badge
                                key={flag}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatAnalyticsDuration(
                            session.eligiblePlaytimeSeconds,
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {formatAnalyticsDuration(session.controllerSeconds)}{" "}
                          controller
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground flex h-32 items-center justify-center rounded-lg border border-dashed text-sm">
                  No completed sessions yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Debug (collapsible) */}
      <Collapsible>
        <div className="rounded-xl border">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <Bug className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-medium">Pipeline Debug</span>
                <span className="text-muted-foreground text-xs">
                  Latest tracked runtime session
                </span>
              </div>
              <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <DebugPanel debug={debug} />
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Debug Panel                                                        */
/* ------------------------------------------------------------------ */

function DebugPanel({ debug }: { debug: GameAnalyticsDebugSnapshot | null }) {
  if (!debug?.runtimeSessionId) {
    return (
      <div className="text-muted-foreground border-t px-4 py-6 text-center text-sm">
        No analytics session has been recorded yet for this game.
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t px-4 pt-4 pb-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">Runtime session</div>
          <div className="mt-1 font-mono text-xs">
            {debug.runtimeSessionId.slice(0, 12)}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">Raw events</div>
          <div className="mt-1 text-lg font-semibold">
            {debug.rawEventCount}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">Latest event</div>
          <div className="mt-1 text-sm font-semibold">
            {formatAnalyticsTimestamp(debug.latestEventAt)}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">Aggregate refresh</div>
          <div className="mt-1 text-sm font-semibold">
            {formatAnalyticsTimestamp(debug.latestMetricUpdatedAt)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="mb-3 text-sm font-medium">Segment State</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["controller", "game", "eligible"] as const).map((key) => (
              <div key={key}>
                <div className="text-muted-foreground text-xs capitalize">
                  {key}
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {debug.totalSegmentCounts[key]}
                </div>
                <div className="text-muted-foreground text-xs">
                  {debug.openSegmentCounts[key]} open
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 text-sm font-medium">Trust Evaluation</div>
          {debug.latestSessionMetric ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground text-xs">
                    Raw eligible
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatAnalyticsDuration(
                      debug.latestSessionMetric.rawEligiblePlaytimeSeconds,
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">
                    Trusted eligible
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {formatAnalyticsDuration(
                      debug.latestSessionMetric.eligiblePlaytimeSeconds,
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {debug.latestSessionMetric.trustFlags.length > 0 ? (
                  debug.latestSessionMetric.trustFlags.map((flag) => (
                    <Badge key={flag} variant="outline" className="text-[10px]">
                      {flag}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    trusted
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No completed session metric yet.
            </p>
          )}
        </div>
      </div>

      {debug.recentEvents.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-180" />
            Recent raw events ({debug.recentEvents.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1.5">
            {debug.recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between rounded-md border px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium">{event.kind}</span>
                  <span className="text-muted-foreground ml-2">
                    {formatAnalyticsTimestamp(event.occurredAt)}
                  </span>
                </div>
                <span className="text-muted-foreground max-w-[40%] truncate text-right">
                  {event.payloadSummary ?? ""}
                </span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
