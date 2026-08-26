"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ProductTelemetryActorClass,
  ProductTelemetryDeploymentEnvironment,
} from "@/lib/product-telemetry-contract";
import { api } from "@/trpc/react";
import {
  Activity,
  Bot,
  Clock3,
  Database,
  Eye,
  Gauge,
  Loader2,
  MousePointerClick,
  Radio,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";

type WindowDays = 7 | 30 | 90;

const ENVIRONMENTS = [
  "production",
  "preview",
  "development",
  "test",
] as const satisfies readonly ProductTelemetryDeploymentEnvironment[];

const INTENT_LABELS = {
  quick_start_opened: "Quick start opened",
  scaffold_command_copied: "Scaffold copied",
  arcade_entered: "Arcade entered",
  external_link_opened: "GitHub / npm opened",
} as const;

const RESOURCE_LABELS = {
  llms_txt: "llms.txt",
  docs_manifest: "Docs manifest",
  docs_search_index: "Docs search index",
  ai_pack_manifest: "AI-pack manifest",
} as const;

const ACTOR_LABELS: Record<ProductTelemetryActorClass, string> = {
  human: "Human",
  bot: "Bot",
  agent: "AI agent",
  unknown: "Unknown",
};

const DEFAULT_ENVIRONMENT: ProductTelemetryDeploymentEnvironment =
  process.env.NODE_ENV === "production" ? "production" : "development";

const numberFormat = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const formatCount = (value: number): string => numberFormat.format(value);

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3_600).toFixed(seconds < 36_000 ? 1 : 0)}h`;
};

function AuthorityHeading({
  title,
  description,
  authority,
}: {
  title: string;
  description: string;
  authority: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          {description}
        </p>
      </div>
      <Badge variant="outline" className="font-mono text-[10px]">
        {authority}
      </Badge>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="grid grid-cols-[1fr_auto] px-5">
        <CardDescription>{label}</CardDescription>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent className="px-5">
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}

function RankedRows({
  rows,
}: {
  rows: Array<{ label: string; value: number; detail?: string }>;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={`${row.label}:${row.detail ?? ""}`}>
          <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
            <div className="min-w-0">
              <span className="truncate font-medium">{row.label}</span>
              {row.detail && (
                <span className="text-muted-foreground ml-2 text-xs">
                  {row.detail}
                </span>
              )}
            </div>
            <span className="font-mono text-xs">{formatCount(row.value)}</span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-airjam-cyan h-full rounded-full"
              style={{ width: `${Math.max((row.value / max) * 100, 1)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OpsTelemetryPageClient() {
  const [days, setDays] = useState<WindowDays>(30);
  const [deploymentEnvironment, setDeploymentEnvironment] =
    useState<ProductTelemetryDeploymentEnvironment>(DEFAULT_ENVIRONMENT);
  const { data, isLoading, error } =
    api.productTelemetry.getOpsOverview.useQuery({
      days,
      deploymentEnvironment,
    });

  const dailyMax = useMemo(
    () =>
      Math.max(
        ...(data?.productTelemetry.daily ?? []).map((d) => d.pageViews),
        1,
      ),
    [data],
  );

  return (
    <div className="space-y-10 pb-12">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="text-airjam-cyan size-6" />
            <h1 className="text-3xl font-bold tracking-tight">
              Product Telemetry
            </h1>
          </div>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Discovery and intent evidence for Air Jam, kept separate from
            authoritative platform lifecycle and runtime usage facts.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div className="flex flex-wrap gap-1">
            {([7, 30, 90] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={days === value ? "default" : "outline"}
                onClick={() => setDays(value)}
              >
                {value} days
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {ENVIRONMENTS.map((environment) => (
              <Button
                key={environment}
                type="button"
                size="sm"
                variant={
                  deploymentEnvironment === environment ? "secondary" : "ghost"
                }
                className="capitalize"
                onClick={() => setDeploymentEnvironment(environment)}
              >
                {environment}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-24 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading telemetry…
        </div>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="text-destructive text-sm">
            Could not load product telemetry: {error.message}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <section className="space-y-5">
            <AuthorityHeading
              title="Discovery evidence"
              description="Approximate public page, session, intent, and agent-resource activity. Anonymous sessions are ephemeral browsing sessions—not unique people."
              authority={data.productTelemetry.authority}
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Page views"
                value={formatCount(data.productTelemetry.totals.pageViews)}
                detail={`${deploymentEnvironment} traffic`}
                icon={Eye}
              />
              <MetricCard
                label="Anonymous sessions"
                value={formatCount(
                  data.productTelemetry.totals.anonymousSessions,
                )}
                detail="Ephemeral, not unique people"
                icon={UsersRound}
              />
              <MetricCard
                label="Intent events"
                value={formatCount(data.productTelemetry.totals.intentEvents)}
                detail="Closed, product-specific actions"
                icon={MousePointerClick}
              />
              <MetricCard
                label="Agent-resource requests"
                value={formatCount(
                  data.productTelemetry.totals.agentResourceRequests,
                )}
                detail="Server observed"
                icon={Bot}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Daily page views</CardTitle>
                <CardDescription>
                  UTC buckets. Hover a bar for its exact count.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-44 min-w-[640px] items-end gap-1 overflow-hidden">
                  {data.productTelemetry.daily.map((point, index) => (
                    <div
                      key={point.bucketDate}
                      className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
                      title={`${point.bucketDate}: ${point.pageViews} page views, ${point.anonymousSessions} anonymous sessions`}
                    >
                      <div className="flex flex-1 items-end">
                        <div
                          className="bg-airjam-cyan/80 hover:bg-airjam-cyan w-full rounded-t-sm transition-colors"
                          style={{
                            height: `${Math.max((point.pageViews / dailyMax) * 100, point.pageViews > 0 ? 3 : 0)}%`,
                          }}
                        />
                      </div>
                      {(data.productTelemetry.daily.length <= 30 ||
                        index % 7 === 0 ||
                        index === data.productTelemetry.daily.length - 1) && (
                        <span className="text-muted-foreground truncate text-center text-[9px]">
                          {dateFormat.format(
                            new Date(`${point.bucketDate}T00:00:00Z`),
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Traffic actors</CardTitle>
                  <CardDescription>
                    Page and agent-resource traffic, classified without storing
                    raw user agents.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RankedRows
                    rows={data.productTelemetry.trafficByActor.map((row) => ({
                      label: ACTOR_LABELS[row.actorClass],
                      value: row.count,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Referrer sources</CardTitle>
                  <CardDescription>
                    Normalized source classes; no full referrer URLs are stored.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RankedRows
                    rows={data.productTelemetry.referrers.map((row) => ({
                      label: row.source,
                      value: row.pageViews,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top canonical pages</CardTitle>
                  <CardDescription>
                    Bounded page keys, never full URLs or query strings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RankedRows
                    rows={data.productTelemetry.topPages.map((row) => ({
                      label: row.pageKey,
                      detail: row.surface,
                      value: row.pageViews,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Meaningful intent</CardTitle>
                  <CardDescription>
                    Air Jam-specific actions rather than a generic event stream.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RankedRows
                    rows={data.productTelemetry.intents.map((row) => ({
                      label: INTENT_LABELS[row.kind],
                      value: row.count,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Agent-facing resources</CardTitle>
                  <CardDescription>
                    Server-observed reach. A request does not prove a later
                    model recommendation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RankedRows
                    rows={data.productTelemetry.agentResources.map((row) => ({
                      label: RESOURCE_LABELS[row.resource],
                      value: row.requests,
                    }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recognized agent families</CardTitle>
                  <CardDescription>
                    Indicative request-header classification, not model
                    identity.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RankedRows
                    rows={data.productTelemetry.agentFamilies.map((row) => ({
                      label: row.family,
                      value: row.requests,
                    }))}
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-5">
            <AuthorityHeading
              title="Platform lifecycle facts"
              description="Direct counts from platform-owned account, game, and release records in the same UTC window. These are authoritative facts, not inferred conversions."
              authority={data.platformLifecycle.authority}
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Accounts created"
                value={formatCount(data.platformLifecycle.accountsCreated)}
                detail="Platform database"
                icon={Database}
              />
              <MetricCard
                label="Games created"
                value={formatCount(data.platformLifecycle.gamesCreated)}
                detail="Platform database"
                icon={Database}
              />
              <MetricCard
                label="Releases created"
                value={formatCount(data.platformLifecycle.releasesCreated)}
                detail="Platform database"
                icon={Database}
              />
              <MetricCard
                label="Releases published"
                value={formatCount(data.platformLifecycle.releasesPublished)}
                detail="Platform database"
                icon={Radio}
              />
            </div>
          </section>

          <section className="space-y-5">
            <AuthorityHeading
              title="Runtime usage facts"
              description="Server-observed room and gameplay accounting. This remains the authority for actual multiplayer usage and eligible playtime."
              authority={data.runtimeUsage.authority}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="Runtime sessions"
                value={formatCount(data.runtimeUsage.runtimeSessions)}
                detail="Verified runtime ledger"
                icon={Gauge}
              />
              <MetricCard
                label="Game sessions"
                value={formatCount(data.runtimeUsage.gameSessions)}
                detail="Derived runtime metrics"
                icon={Activity}
              />
              <MetricCard
                label="Eligible playtime"
                value={formatDuration(
                  data.runtimeUsage.eligiblePlaytimeSeconds,
                )}
                detail="Accounting-grade runtime metric"
                icon={Clock3}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
