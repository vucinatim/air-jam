import { db } from "@/db";
import {
  gameReleases,
  games,
  productTelemetryDailyMetrics,
  productTelemetryDailySessionContributions,
  runtimeUsageDailyGameMetrics,
  runtimeUsageSessions,
  users,
} from "@/db/schema";
import {
  PRODUCT_TELEMETRY_ACTOR_CLASSES,
  PRODUCT_TELEMETRY_AGENT_FAMILIES,
  PRODUCT_TELEMETRY_AGENT_RESOURCES,
  type ProductTelemetryActorClass,
  type ProductTelemetryAgentFamily,
  type ProductTelemetryAgentResource,
  type ProductTelemetryDeploymentEnvironment,
  type ProductTelemetryReferrerSource,
  type ProductTelemetryStoredEventKind,
  type ProductTelemetrySurface,
} from "@/lib/product-telemetry-contract";
import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
  sum,
} from "drizzle-orm";

const INTENT_KINDS = [
  "quick_start_opened",
  "scaffold_command_copied",
  "arcade_entered",
  "external_link_opened",
] as const satisfies readonly ProductTelemetryStoredEventKind[];

const TRAFFIC_KINDS = [
  "page_view",
  "agent_resource_requested",
] as const satisfies readonly ProductTelemetryStoredEventKind[];

const toUtcDateString = (value: Date): string =>
  value.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const utcDayStart = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

const numeric = (value: number | string | null | undefined): number =>
  Number(value ?? 0);

export interface ProductTelemetryDailyPoint {
  bucketDate: string;
  pageViews: number;
  anonymousSessions: number;
  intentEvents: number;
  agentResourceRequests: number;
  trafficByActor: Record<ProductTelemetryActorClass, number>;
}

export interface ProductTelemetryOpsOverview {
  window: {
    days: number;
    from: Date;
    through: Date;
    deploymentEnvironment: ProductTelemetryDeploymentEnvironment;
  };
  productTelemetry: {
    authority: "approximate_product_telemetry";
    totals: {
      pageViews: number;
      anonymousSessions: number;
      intentEvents: number;
      agentResourceRequests: number;
    };
    daily: ProductTelemetryDailyPoint[];
    trafficByActor: Array<{
      actorClass: ProductTelemetryActorClass;
      count: number;
    }>;
    topPages: Array<{
      surface: ProductTelemetrySurface;
      pageKey: string;
      pageViews: number;
    }>;
    referrers: Array<{
      source: ProductTelemetryReferrerSource;
      pageViews: number;
    }>;
    intents: Array<{
      kind: (typeof INTENT_KINDS)[number];
      count: number;
    }>;
    agentResources: Array<{
      resource: ProductTelemetryAgentResource;
      requests: number;
    }>;
    agentFamilies: Array<{
      family: ProductTelemetryAgentFamily;
      requests: number;
    }>;
  };
  platformLifecycle: {
    authority: "authoritative_platform_database";
    accountsCreated: number;
    gamesCreated: number;
    releasesCreated: number;
    releasesPublished: number;
  };
  runtimeUsage: {
    authority: "authoritative_runtime_usage";
    runtimeSessions: number;
    gameSessions: number;
    eligiblePlaytimeSeconds: number;
  };
}

interface ProductTelemetryReportingRows {
  dailyEvents: Array<{
    bucketDate: string;
    kind: ProductTelemetryStoredEventKind;
    actorClass: ProductTelemetryActorClass;
    count: number | string | null;
  }>;
  dailySessions: Array<{
    bucketDate: string;
    count: number | string | null;
  }>;
  windowSessions: number | string;
  topPages: Array<{
    surface: ProductTelemetrySurface;
    pageKey: string;
    count: number | string | null;
  }>;
  referrers: Array<{
    source: ProductTelemetryReferrerSource;
    count: number | string | null;
  }>;
  intents: Array<{
    kind: ProductTelemetryStoredEventKind;
    count: number | string | null;
  }>;
  agentResources: Array<{
    resource: ProductTelemetryAgentResource | null;
    count: number | string | null;
  }>;
  agentFamilies: Array<{
    family: ProductTelemetryAgentFamily | null;
    count: number | string | null;
  }>;
  platformLifecycle: {
    accountsCreated: number | string;
    gamesCreated: number | string;
    releasesCreated: number | string;
    releasesPublished: number | string;
  };
  runtimeUsage: {
    runtimeSessions: number | string;
    gameSessions: number | string | null;
    eligiblePlaytimeSeconds: number | string | null;
  };
}

export const buildProductTelemetryOpsOverview = ({
  rows,
  days,
  deploymentEnvironment,
  now = new Date(),
}: {
  rows: ProductTelemetryReportingRows;
  days: number;
  deploymentEnvironment: ProductTelemetryDeploymentEnvironment;
  now?: Date;
}): ProductTelemetryOpsOverview => {
  const today = utcDayStart(now);
  const since = addUtcDays(today, -(days - 1));
  const dailyByDate = new Map<string, ProductTelemetryDailyPoint>();

  for (let offset = 0; offset < days; offset += 1) {
    const bucketDate = toUtcDateString(addUtcDays(since, offset));
    dailyByDate.set(bucketDate, {
      bucketDate,
      pageViews: 0,
      anonymousSessions: 0,
      intentEvents: 0,
      agentResourceRequests: 0,
      trafficByActor: {
        human: 0,
        bot: 0,
        agent: 0,
        unknown: 0,
      },
    });
  }

  for (const row of rows.dailyEvents) {
    const point = dailyByDate.get(row.bucketDate);
    if (!point) continue;
    const value = numeric(row.count);

    if (row.kind === "page_view") point.pageViews += value;
    if (row.kind === "agent_resource_requested") {
      point.agentResourceRequests += value;
    }
    if (INTENT_KINDS.includes(row.kind as (typeof INTENT_KINDS)[number])) {
      point.intentEvents += value;
    }
    if (TRAFFIC_KINDS.includes(row.kind as (typeof TRAFFIC_KINDS)[number])) {
      point.trafficByActor[row.actorClass] += value;
    }
  }

  for (const row of rows.dailySessions) {
    const point = dailyByDate.get(row.bucketDate);
    if (point) point.anonymousSessions = numeric(row.count);
  }

  const daily = [...dailyByDate.values()];
  const totals = daily.reduce(
    (accumulator, point) => ({
      pageViews: accumulator.pageViews + point.pageViews,
      anonymousSessions: numeric(rows.windowSessions),
      intentEvents: accumulator.intentEvents + point.intentEvents,
      agentResourceRequests:
        accumulator.agentResourceRequests + point.agentResourceRequests,
    }),
    {
      pageViews: 0,
      anonymousSessions: numeric(rows.windowSessions),
      intentEvents: 0,
      agentResourceRequests: 0,
    },
  );

  const trafficByActor = PRODUCT_TELEMETRY_ACTOR_CLASSES.map((actorClass) => ({
    actorClass,
    count: daily.reduce(
      (total, point) => total + point.trafficByActor[actorClass],
      0,
    ),
  }));

  const countByIntent = new Map(
    rows.intents.map((row) => [row.kind, numeric(row.count)]),
  );
  const countByResource = new Map(
    rows.agentResources
      .filter(
        (
          row,
        ): row is typeof row & { resource: ProductTelemetryAgentResource } =>
          row.resource !== null,
      )
      .map((row) => [row.resource, numeric(row.count)]),
  );
  const countByFamily = new Map(
    rows.agentFamilies
      .filter(
        (row): row is typeof row & { family: ProductTelemetryAgentFamily } =>
          row.family !== null,
      )
      .map((row) => [row.family, numeric(row.count)]),
  );

  return {
    window: {
      days,
      from: since,
      through: now,
      deploymentEnvironment,
    },
    productTelemetry: {
      authority: "approximate_product_telemetry",
      totals,
      daily,
      trafficByActor,
      topPages: rows.topPages.map((row) => ({
        surface: row.surface,
        pageKey: row.pageKey,
        pageViews: numeric(row.count),
      })),
      referrers: rows.referrers.map((row) => ({
        source: row.source,
        pageViews: numeric(row.count),
      })),
      intents: INTENT_KINDS.map((kind) => ({
        kind,
        count: countByIntent.get(kind) ?? 0,
      })),
      agentResources: PRODUCT_TELEMETRY_AGENT_RESOURCES.map((resource) => ({
        resource,
        requests: countByResource.get(resource) ?? 0,
      })),
      agentFamilies: PRODUCT_TELEMETRY_AGENT_FAMILIES.map((family) => ({
        family,
        requests: countByFamily.get(family) ?? 0,
      })),
    },
    platformLifecycle: {
      authority: "authoritative_platform_database",
      accountsCreated: numeric(rows.platformLifecycle.accountsCreated),
      gamesCreated: numeric(rows.platformLifecycle.gamesCreated),
      releasesCreated: numeric(rows.platformLifecycle.releasesCreated),
      releasesPublished: numeric(rows.platformLifecycle.releasesPublished),
    },
    runtimeUsage: {
      authority: "authoritative_runtime_usage",
      runtimeSessions: numeric(rows.runtimeUsage.runtimeSessions),
      gameSessions: numeric(rows.runtimeUsage.gameSessions),
      eligiblePlaytimeSeconds: numeric(
        rows.runtimeUsage.eligiblePlaytimeSeconds,
      ),
    },
  };
};

export const getProductTelemetryOpsOverview = async ({
  days,
  deploymentEnvironment,
  now = new Date(),
}: {
  days: number;
  deploymentEnvironment: ProductTelemetryDeploymentEnvironment;
  now?: Date;
}): Promise<ProductTelemetryOpsOverview> => {
  const today = utcDayStart(now);
  const since = addUtcDays(today, -(days - 1));
  const sinceDate = toUtcDateString(since);
  const throughDate = toUtcDateString(today);
  const metricWindow = and(
    gte(productTelemetryDailyMetrics.bucketDate, sinceDate),
    lte(productTelemetryDailyMetrics.bucketDate, throughDate),
    eq(
      productTelemetryDailyMetrics.deploymentEnvironment,
      deploymentEnvironment,
    ),
  );
  const [
    dailyEvents,
    dailySessions,
    windowSessions,
    topPages,
    referrers,
    intents,
    agentResources,
    agentFamilies,
    accountsCreated,
    gamesCreated,
    releasesCreated,
    releasesPublished,
    runtimeSessions,
    runtimeUsage,
  ] = await Promise.all([
    db
      .select({
        bucketDate: productTelemetryDailyMetrics.bucketDate,
        kind: productTelemetryDailyMetrics.kind,
        actorClass: productTelemetryDailyMetrics.actorClass,
        count: sum(productTelemetryDailyMetrics.eventCount),
      })
      .from(productTelemetryDailyMetrics)
      .where(metricWindow)
      .groupBy(
        productTelemetryDailyMetrics.bucketDate,
        productTelemetryDailyMetrics.kind,
        productTelemetryDailyMetrics.actorClass,
      ),
    db
      .select({
        bucketDate: productTelemetryDailySessionContributions.bucketDate,
        count: countDistinct(
          productTelemetryDailySessionContributions.anonymousSessionId,
        ),
      })
      .from(productTelemetryDailySessionContributions)
      .innerJoin(
        productTelemetryDailyMetrics,
        eq(
          productTelemetryDailySessionContributions.metricId,
          productTelemetryDailyMetrics.id,
        ),
      )
      .where(metricWindow)
      .groupBy(productTelemetryDailySessionContributions.bucketDate),
    db
      .select({
        count: countDistinct(
          productTelemetryDailySessionContributions.anonymousSessionId,
        ),
      })
      .from(productTelemetryDailySessionContributions)
      .innerJoin(
        productTelemetryDailyMetrics,
        eq(
          productTelemetryDailySessionContributions.metricId,
          productTelemetryDailyMetrics.id,
        ),
      )
      .where(metricWindow),
    db
      .select({
        surface: productTelemetryDailyMetrics.surface,
        pageKey: productTelemetryDailyMetrics.pageKey,
        count: sum(productTelemetryDailyMetrics.eventCount),
      })
      .from(productTelemetryDailyMetrics)
      .where(
        and(metricWindow, eq(productTelemetryDailyMetrics.kind, "page_view")),
      )
      .groupBy(
        productTelemetryDailyMetrics.surface,
        productTelemetryDailyMetrics.pageKey,
      )
      .orderBy(sql`sum(${productTelemetryDailyMetrics.eventCount}) desc`)
      .limit(12),
    db
      .select({
        source: productTelemetryDailyMetrics.referrerSource,
        count: sum(productTelemetryDailyMetrics.eventCount),
      })
      .from(productTelemetryDailyMetrics)
      .where(
        and(metricWindow, eq(productTelemetryDailyMetrics.kind, "page_view")),
      )
      .groupBy(productTelemetryDailyMetrics.referrerSource)
      .orderBy(sql`sum(${productTelemetryDailyMetrics.eventCount}) desc`),
    db
      .select({
        kind: productTelemetryDailyMetrics.kind,
        count: sum(productTelemetryDailyMetrics.eventCount),
      })
      .from(productTelemetryDailyMetrics)
      .where(
        and(
          metricWindow,
          inArray(productTelemetryDailyMetrics.kind, [...INTENT_KINDS]),
        ),
      )
      .groupBy(productTelemetryDailyMetrics.kind),
    db
      .select({
        resource: productTelemetryDailyMetrics.agentResource,
        count: sum(productTelemetryDailyMetrics.eventCount),
      })
      .from(productTelemetryDailyMetrics)
      .where(
        and(
          metricWindow,
          eq(productTelemetryDailyMetrics.kind, "agent_resource_requested"),
        ),
      )
      .groupBy(productTelemetryDailyMetrics.agentResource)
      .orderBy(sql`sum(${productTelemetryDailyMetrics.eventCount}) desc`),
    db
      .select({
        family: productTelemetryDailyMetrics.agentFamily,
        count: sum(productTelemetryDailyMetrics.eventCount),
      })
      .from(productTelemetryDailyMetrics)
      .where(
        and(
          metricWindow,
          eq(productTelemetryDailyMetrics.kind, "agent_resource_requested"),
          isNotNull(productTelemetryDailyMetrics.agentFamily),
        ),
      )
      .groupBy(productTelemetryDailyMetrics.agentFamily)
      .orderBy(sql`sum(${productTelemetryDailyMetrics.eventCount}) desc`),
    db
      .select({ count: count() })
      .from(users)
      .where(gte(users.createdAt, since)),
    db
      .select({ count: count() })
      .from(games)
      .where(gte(games.createdAt, since)),
    db
      .select({ count: count() })
      .from(gameReleases)
      .where(gte(gameReleases.createdAt, since)),
    db
      .select({ count: count() })
      .from(gameReleases)
      .where(
        and(
          isNotNull(gameReleases.publishedAt),
          gte(gameReleases.publishedAt, since),
        ),
      ),
    db
      .select({ count: count() })
      .from(runtimeUsageSessions)
      .where(gte(runtimeUsageSessions.startedAt, since)),
    db
      .select({
        gameSessions: sum(runtimeUsageDailyGameMetrics.sessionCount),
        eligiblePlaytimeSeconds: sum(
          runtimeUsageDailyGameMetrics.totalEligiblePlaytimeSeconds,
        ),
      })
      .from(runtimeUsageDailyGameMetrics)
      .where(gte(runtimeUsageDailyGameMetrics.bucketDate, sinceDate)),
  ]);

  return buildProductTelemetryOpsOverview({
    days,
    deploymentEnvironment,
    now,
    rows: {
      dailyEvents,
      dailySessions,
      windowSessions: windowSessions[0]?.count ?? 0,
      topPages,
      referrers,
      intents,
      agentResources,
      agentFamilies,
      platformLifecycle: {
        accountsCreated: accountsCreated[0]?.count ?? 0,
        gamesCreated: gamesCreated[0]?.count ?? 0,
        releasesCreated: releasesCreated[0]?.count ?? 0,
        releasesPublished: releasesPublished[0]?.count ?? 0,
      },
      runtimeUsage: {
        runtimeSessions: runtimeSessions[0]?.count ?? 0,
        gameSessions: runtimeUsage[0]?.gameSessions ?? 0,
        eligiblePlaytimeSeconds: runtimeUsage[0]?.eligiblePlaytimeSeconds ?? 0,
      },
    },
  });
};
