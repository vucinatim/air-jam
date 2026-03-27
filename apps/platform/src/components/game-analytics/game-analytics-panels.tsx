import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Activity, BarChart3, Clock3, TrendingUp, Users } from "lucide-react";

export interface GameAnalyticsDailyPoint {
  bucketDate: string;
  sessionCount: number;
  totalGameActiveSeconds: number;
  totalControllerSeconds: number;
  totalEligiblePlaytimeSeconds: number;
  peakConcurrentControllers: number;
  lastActivityAt: Date | null;
}

export interface GameAnalyticsTotals {
  sessionCount: number;
  totalGameActiveSeconds: number;
  totalControllerSeconds: number;
  totalEligiblePlaytimeSeconds: number;
  peakConcurrentControllers: number;
  lastActivityAt: Date | null;
}

export interface GameAnalyticsSession {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  controllerSeconds: number;
  eligiblePlaytimeSeconds: number;
  peakConcurrentControllers: number;
}

interface GameAnalyticsActivityCardProps {
  daily: GameAnalyticsDailyPoint[];
  totals: GameAnalyticsTotals;
}

interface GameAnalyticsDeepDiveProps {
  daily: GameAnalyticsDailyPoint[];
  totals: GameAnalyticsTotals;
  recentSessions: GameAnalyticsSession[];
}

const hasAnalyticsActivity = (daily: GameAnalyticsDailyPoint[]): boolean => {
  return daily.some(
    (day) => day.sessionCount > 0 || day.totalEligiblePlaytimeSeconds > 0,
  );
};

export const formatAnalyticsDuration = (seconds: number): string => {
  if (seconds <= 0) {
    return "0s";
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
};

export const formatAnalyticsTimestamp = (value?: Date | null): string => {
  if (!value) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
};

export function GameAnalyticsActivityCard({
  daily,
  totals,
}: GameAnalyticsActivityCardProps) {
  const peakDailyEligibleSeconds = Math.max(
    1,
    ...daily.map((day) => day.totalEligiblePlaytimeSeconds),
  );

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Aggregate read model only. No raw-event math in the dashboard path.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasAnalyticsActivity(daily) ? (
          <>
            <div className="flex items-end gap-2">
              {daily.map((day) => {
                const height = Math.max(
                  10,
                  Math.round(
                    (day.totalEligiblePlaytimeSeconds /
                      peakDailyEligibleSeconds) *
                      100,
                  ),
                );

                return (
                  <div
                    key={day.bucketDate}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="bg-airjam-cyan/20 flex h-28 w-full cursor-default items-end rounded-sm">
                          <div
                            className="bg-airjam-cyan w-full rounded-sm"
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8}>
                        <div className="space-y-1">
                          <div className="font-medium">{day.bucketDate}</div>
                          <div>
                            Eligible:{" "}
                            {formatAnalyticsDuration(
                              day.totalEligiblePlaytimeSeconds,
                            )}
                          </div>
                          <div>
                            Active:{" "}
                            {formatAnalyticsDuration(
                              day.totalGameActiveSeconds,
                            )}
                          </div>
                          <div>Sessions: {day.sessionCount}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-muted-foreground text-[10px]">
                      {day.bucketDate.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
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
                  Last Activity
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {formatAnalyticsTimestamp(totals.lastActivityAt)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">
                  Eligible Share
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {totals.totalGameActiveSeconds > 0
                    ? `${Math.round(
                        (totals.totalEligiblePlaytimeSeconds /
                          totals.totalGameActiveSeconds) *
                          100,
                      )}%`
                    : "0%"}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground flex h-[200px] items-center justify-center rounded-lg border border-dashed text-sm">
            No analytics yet. Start a session and this view will populate from
            aggregate metrics.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GameAnalyticsDeepDive({
  daily,
  totals,
  recentSessions,
}: GameAnalyticsDeepDiveProps) {
  const peakDailySessions = Math.max(
    1,
    ...daily.map((day) => day.sessionCount),
  );
  const peakDailyControllerSeconds = Math.max(
    1,
    ...daily.map((day) => day.totalControllerSeconds),
  );
  const averageEligibleSessionSeconds =
    totals.sessionCount > 0
      ? Math.round(totals.totalEligiblePlaytimeSeconds / totals.sessionCount)
      : 0;
  const averageControllerLoadSeconds =
    totals.sessionCount > 0
      ? Math.round(totals.totalControllerSeconds / totals.sessionCount)
      : 0;
  const mostActiveDay = daily.reduce<GameAnalyticsDailyPoint | null>(
    (best, day) => {
      if (day.totalEligiblePlaytimeSeconds <= 0) {
        return best;
      }
      if (!best) {
        return day;
      }

      return day.totalEligiblePlaytimeSeconds >
        best.totalEligiblePlaytimeSeconds
        ? day
        : best;
    },
    null,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.sessionCount}</div>
            <p className="text-muted-foreground text-xs">Last 14 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Eligible Playtime
            </CardTitle>
            <Clock3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAnalyticsDuration(totals.totalEligiblePlaytimeSeconds)}
            </div>
            <p className="text-muted-foreground text-xs">
              Reward-grade active time
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Controller Time
            </CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAnalyticsDuration(totals.totalControllerSeconds)}
            </div>
            <p className="text-muted-foreground text-xs">
              Sum across all connected players
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Peak Controllers
            </CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals.peakConcurrentControllers}
            </div>
            <p className="text-muted-foreground text-xs">
              Highest concurrent count
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Session Cadence</CardTitle>
            <CardDescription>
              Daily completed-session volume over the same analytics window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasAnalyticsActivity(daily) ? (
              <div className="flex h-48 items-end gap-2">
                {daily.map((day) => {
                  const height = Math.max(
                    10,
                    Math.round((day.sessionCount / peakDailySessions) * 100),
                  );

                  return (
                    <div
                      key={day.bucketDate}
                      className="flex min-w-0 flex-1 flex-col items-center gap-2"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="bg-muted flex h-36 w-full cursor-default items-end rounded-sm">
                            <div
                              className="bg-airjam-cyan/70 w-full rounded-sm"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8}>
                          <div className="space-y-1">
                            <div className="font-medium">{day.bucketDate}</div>
                            <div>Sessions: {day.sessionCount}</div>
                            <div>
                              Eligible:{" "}
                              {formatAnalyticsDuration(
                                day.totalEligiblePlaytimeSeconds,
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <span className="text-muted-foreground text-[10px]">
                        {day.bucketDate.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
                No completed sessions yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Controller Load</CardTitle>
            <CardDescription>
              Daily connected-player time and quality signals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasAnalyticsActivity(daily) ? (
              <>
                <div className="space-y-3">
                  {daily
                    .filter(
                      (day) =>
                        day.totalControllerSeconds > 0 ||
                        day.totalEligiblePlaytimeSeconds > 0,
                    )
                    .slice(-5)
                    .map((day) => {
                      const controllerWidth = Math.max(
                        8,
                        Math.round(
                          (day.totalControllerSeconds /
                            peakDailyControllerSeconds) *
                            100,
                        ),
                      );
                      const eligibleWidth =
                        day.totalControllerSeconds > 0
                          ? Math.max(
                              8,
                              Math.round(
                                (day.totalEligiblePlaytimeSeconds /
                                  day.totalControllerSeconds) *
                                  controllerWidth,
                              ),
                            )
                          : 0;

                      return (
                        <div key={day.bucketDate} className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {day.bucketDate}
                            </span>
                            <span className="font-medium">
                              {formatAnalyticsDuration(
                                day.totalControllerSeconds,
                              )}
                            </span>
                          </div>
                          <div className="bg-muted h-2 overflow-hidden rounded-full">
                            <div
                              className="bg-airjam-cyan/40 relative h-full rounded-full"
                              style={{ width: `${controllerWidth}%` }}
                            >
                              <div
                                className="bg-airjam-cyan absolute inset-y-0 left-0 rounded-full"
                                style={{ width: `${eligibleWidth}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">
                      Avg eligible session
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {formatAnalyticsDuration(averageEligibleSessionSeconds)}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">
                      Avg controller load
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {formatAnalyticsDuration(averageControllerLoadSeconds)}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
                No controller load data yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Session Quality</CardTitle>
            <CardDescription>
              Quick read on how healthy the current engagement looks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">
                  Game active time
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {formatAnalyticsDuration(totals.totalGameActiveSeconds)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">
                  Last activity
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {formatAnalyticsTimestamp(totals.lastActivityAt)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">
                  Eligible share
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {totals.totalGameActiveSeconds > 0
                    ? `${Math.round(
                        (totals.totalEligiblePlaytimeSeconds /
                          totals.totalGameActiveSeconds) *
                          100,
                      )}%`
                    : "0%"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-muted-foreground text-xs">
                  Most active day
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {mostActiveDay
                    ? `${mostActiveDay.bucketDate} (${formatAnalyticsDuration(
                        mostActiveDay.totalEligiblePlaytimeSeconds,
                      )})`
                    : "No activity yet"}
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="text-airjam-cyan h-4 w-4" />
                Current read
              </div>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {totals.totalEligiblePlaytimeSeconds > 0
                  ? `This game converted ${formatAnalyticsDuration(
                      totals.totalEligiblePlaytimeSeconds,
                    )} of reward-grade playtime from ${formatAnalyticsDuration(
                      totals.totalGameActiveSeconds,
                    )} of active runtime in the current window.`
                  : "No reward-grade playtime has been recorded yet in the current window."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
            <CardDescription>
              Most recent completed sessions from the aggregate session table.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSessions.length > 0 ? (
              recentSessions.map((session) => (
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
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {formatAnalyticsDuration(session.eligiblePlaytimeSeconds)}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatAnalyticsDuration(session.controllerSeconds)}{" "}
                      controller time
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
                No completed sessions yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
