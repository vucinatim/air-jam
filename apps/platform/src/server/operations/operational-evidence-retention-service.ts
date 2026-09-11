import { db } from "@/db";
import {
  operationalEventDeliveryCommands,
  operationalEventOutbox,
  operationalEvents,
  operationalSloEvaluations,
  operationalSyntheticRuns,
} from "@/db/schema";
import { acquireOperationalEvidenceRetentionFence } from "@air-jam/database-contract";
import {
  OPERATIONAL_EVIDENCE_REFERENCE_PREFIXES,
  OPERATIONAL_EVIDENCE_RETENTION_LIMITS,
} from "@air-jam/operations-contract";
import { inArray, sql, type SQL } from "drizzle-orm";
import { resolveDatabaseAuthorityNow } from "./database-authority";
import { OPERATIONAL_SLO_DEFINITIONS } from "./operational-reliability-policy";

const tables = {
  commands: operationalEventDeliveryCommands,
  evaluations: operationalSloEvaluations,
  syntheticRuns: operationalSyntheticRuns,
  outbox: operationalEventOutbox,
  events: operationalEvents,
} as const;
type EvidenceTable = keyof typeof tables;
type ScanPositions = Partial<
  Record<EvidenceTable, { age: string; id: string }>
>;

const readCursor = (cursor?: string): ScanPositions => {
  if (cursor === undefined) return {};
  try {
    if (!cursor || cursor.length > 16_384 || !/^[A-Za-z0-9_-]+$/.test(cursor))
      throw Error();
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !Object.keys(value).length
    )
      throw Error();
    for (const [kind, position] of Object.entries(value)) {
      if (
        !Object.hasOwn(tables, kind) ||
        !position ||
        typeof position !== "object" ||
        Array.isArray(position)
      )
        throw Error();
      const p = position as Record<string, unknown>;
      if (
        Object.keys(p).length !== 2 ||
        typeof p.id !== "string" ||
        !p.id ||
        p.id.length > 2048 ||
        typeof p.age !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(p.age) ||
        !Number.isFinite(Date.parse(p.age)) ||
        new Date(p.age).toISOString() !== p.age.slice(0, 23) + "Z" ||
        p.id.includes("\0")
      )
        throw Error();
    }
    return value as ScanPositions;
  } catch {
    throw new Error("Invalid operational evidence retention cursor.");
  }
};

/**
 * Collect expired incoming-reference closures, not individual rows: retained
 * evidence must never point at deleted evidence, and old cycles must expire.
 * Five fixed indexed source queries walk only bounded old seed pages. A cursor
 * advances over protected/oversized seeds too, and an empty page wraps the scan.
 */
export const retainOperationalEvidence = async ({
  database = db,
  apply = false,
  limit = OPERATIONAL_EVIDENCE_RETENTION_LIMITS.default,
  cursor,
}: {
  database?: typeof db;
  apply?: boolean;
  limit?: number;
  cursor?: string;
} = {}) => {
  if (
    !Number.isInteger(limit) ||
    limit < OPERATIONAL_EVIDENCE_RETENTION_LIMITS.min ||
    limit > OPERATIONAL_EVIDENCE_RETENTION_LIMITS.max
  )
    throw new Error(
      `Retention limit must be an integer from ${OPERATIONAL_EVIDENCE_RETENTION_LIMITS.min} to ${OPERATIONAL_EVIDENCE_RETENTION_LIMITS.max} per table.`,
    );
  const positions = readCursor(cursor);
  return database.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '2s'`);
    await tx.execute(sql`set local statement_timeout = '5s'`);
    await tx.execute(sql`set local jit = off`);
    await acquireOperationalEvidenceRetentionFence(tx);
    const now = await resolveDatabaseAuthorityNow(tx);
    const historyCutoff = new Date(
      now.getTime() - 30 * 86_400_000,
    ).toISOString();
    const commandCutoff = new Date(
      now.getTime() - 90 * 86_400_000,
    ).toISOString();
    const definitions = JSON.stringify(
      OPERATIONAL_SLO_DEFINITIONS.map((d) => ({
        slo_id: d.sloId,
        check_ids: d.syntheticCheckIds,
        window_seconds: d.windowSeconds,
      })),
    );
    const eventTarget = sql`a.kind in ('outbox', 'events')`;
    const reference = sql`jsonb_build_array(jsonb_build_object('reference',
      case a.kind when 'outbox' then ${OPERATIONAL_EVIDENCE_REFERENCE_PREFIXES.event}
        when 'events' then ${OPERATIONAL_EVIDENCE_REFERENCE_PREFIXES.event}
        when 'syntheticRuns' then ${OPERATIONAL_EVIDENCE_REFERENCE_PREFIXES.syntheticRun}
        when 'commands' then ${OPERATIONAL_EVIDENCE_REFERENCE_PREFIXES.eventDeliveryCommand} end || a.id))`;
    // These are the existing documents' complete inbound-reference predicates;
    // keep them aligned with the ordinary indexes in database-contract.
    const sources: {
      kind: EvidenceTable;
      relation: SQL;
      age: SQL;
      expired: SQL;
      unprotected: SQL;
      incoming: SQL;
    }[] = [
      {
        kind: "commands",
        relation: sql`operational_event_delivery_commands`,
        age: sql`greatest(s.created_at,s.completed_at)`,
        expired: sql`s.completed_at is not null and greatest(s.created_at,s.completed_at)<${commandCutoff}::timestamptz`,
        unprotected: sql`true`,
        incoming: sql`${eventTarget} and (s.event_id=a.id or s.result->>'auditEventId'=a.id)`,
      },
      {
        kind: "evaluations",
        relation: sql`operational_slo_evaluations`,
        age: sql`greatest(s.created_at,s.evaluated_at)`,
        expired: sql`greatest(s.created_at,s.evaluated_at)<${historyCutoff}::timestamptz`,
        unprotected: sql`not exists(select 1 from latest_evaluations l where l.slo_id=s.slo_id and l.environment=s.environment and l.evaluated_at=s.evaluated_at)
          and not exists(select 1 from sample_windows w where w.incident and w.slo_id=s.slo_id and w.environment=s.environment and s.evaluated_at between w.incident_started_at and w.ended_at)`,
        incoming: sql`(${eventTarget} and s.trigger_event_id=a.id) or (s.document->'evidence') @> ${reference}`,
      },
      {
        kind: "syntheticRuns",
        relation: sql`operational_synthetic_runs`,
        age: sql`greatest(s.created_at,s.completed_at)`,
        expired: sql`greatest(s.created_at,s.completed_at)<${historyCutoff}::timestamptz`,
        unprotected: sql`not exists(select 1 from sample_windows w where w.environment=s.environment
          and (w.check_ids is null or w.check_ids ? s.check_id) and s.completed_at between w.started_at and w.ended_at)`,
        incoming: sql`(${eventTarget} and s.event_id=a.id) or (s.document->'evidence') @> ${reference}`,
      },
      ...(["outbox", "events"] as const).map((kind) => ({
        kind,
        relation:
          kind === "outbox"
            ? sql`operational_event_outbox`
            : sql`operational_events`,
        age:
          kind === "outbox"
            ? sql`greatest(s.created_at,s.updated_at,s.delivered_at)`
            : sql`greatest(s.stored_at,s.occurred_at,s.observed_at)`,
        expired:
          kind === "outbox"
            ? sql`s.status='delivered' and greatest(s.created_at,s.updated_at,s.delivered_at)<${historyCutoff}::timestamptz`
            : sql`greatest(s.stored_at,s.occurred_at,s.observed_at)<${historyCutoff}::timestamptz`,
        unprotected: sql`true`,
        incoming: sql`(${eventTarget} and (s.id=a.id or s.envelope#>>'{correlation,causationEventId}'=a.id))
          or (a.kind='evaluations' and s.envelope#>>'{payload,evaluationId}'=a.id)
          or (s.envelope->'evidence') @> ${reference}`,
      })),
    ];
    const eligible = (
      source: (typeof sources)[number],
    ) => sql`(${source.expired}) and (${source.unprotected})
      and not exists(select 1 from live_pointers p where p.kind=${source.kind} and p.id=s.id)`;
    const seeds = sources.map((source) => {
      const position = positions[source.kind];
      const after = position
        ? sql`(${source.age},s.id)>(${position.age}::timestamptz,${position.id})`
        : sql`true`;
      return sql`(select ${source.kind}::text as kind,s.id,${source.age} as age,${eligible(source)} as eligible
        from ${source.relation} s where (${source.expired}) and ${after} order by ${source.age},s.id limit ${limit})`;
    });
    const incoming = sources.map(
      (
        source,
      ) => sql`select ${source.kind}::text as kind,s.id,${eligible(source)} as eligible
      from ${source.relation} s where a.eligible and (${source.incoming}) and (${source.kind}<>a.kind or s.id<>a.id)`,
    );
    const selected = await tx.execute(sql`
      with recursive
      definitions as materialized (
        select * from jsonb_to_recordset(${definitions}::text::jsonb) as d(slo_id text,check_ids jsonb,window_seconds integer)
      ),
      latest_evaluations as materialized (
        select slo_id,environment,max(evaluated_at) as evaluated_at from operational_slo_evaluations group by slo_id,environment
      ),
      incident_windows as (
        select policy_id as slo_id,environment,(document->>'firstTriggeredAt')::timestamptz as started_at,${now.toISOString()}::timestamptz as ended_at
        from operational_alerts where status='open'
        union all
        select target_alert->>'policyId',target_alert->>'environment',(target_alert->>'firstTriggeredAt')::timestamptz,
          coalesce((target_alert->>'recoveredAt')::timestamptz,${now.toISOString()}::timestamptz)
        from operational_alert_issue_projections where status<>'delivered' or issue_state='open'
          or projected_alert_revision<target_alert_revision or target_alert->>'status'<>'recovered'
      ),
      sample_windows as materialized (
        select e.slo_id,e.environment,d.check_ids,(e.document->>'windowStartedAt')::timestamptz as started_at,
          (e.document->>'windowEndedAt')::timestamptz as ended_at,false as incident,null::timestamptz as incident_started_at
        from latest_evaluations l join operational_slo_evaluations e using(slo_id,environment,evaluated_at)
        left join definitions d using(slo_id)
        union all
        select w.slo_id,w.environment,d.check_ids,w.started_at-make_interval(secs=>coalesce(d.window_seconds,(select max(window_seconds) from definitions))),w.ended_at,true,w.started_at
        from incident_windows w left join definitions d using(slo_id)
      ),
      live_pointers as materialized (
        select k.kind,r.id from (
          select 'event' as type,latest_event_id as id from operational_alerts
          union all select 'evaluation',latest_evaluation_id from operational_alerts
          union all select 'event',target_alert->>'latestEventId' from operational_alert_issue_projections
          union all select 'evaluation',target_alert->>'latestEvaluationId' from operational_alert_issue_projections
        ) r join(values('event','outbox'),('event','events'),('evaluation','evaluations')) k(type,kind) using(type)
      ),
      seeds as materialized (${sql.join(seeds, sql` union all `)}),
      ancestors(seed_kind,seed_id,kind,id,eligible) as (
        select kind,id,kind,id,eligible from seeds
        union
        select a.seed_kind,a.seed_id,p.kind,p.id,p.eligible from ancestors a
        cross join lateral (${sql.join(incoming, sql` union all `)}) p
      ),
      sizes as (
        select seed_kind,seed_id,bool_and(eligible) as eligible,
          count(*) filter(where kind='commands') as commands,
          count(*) filter(where kind='evaluations') as evaluations,
          count(*) filter(where kind='syntheticRuns') as runs,
          count(*) filter(where kind='outbox') as outbox,
          count(*) filter(where kind='events') as events
        from ancestors group by seed_kind,seed_id
      ),
      fitting as (
        select z.*,s.age from sizes z join seeds s on s.kind=z.seed_kind and s.id=z.seed_id
        where z.eligible and greatest(commands,evaluations,runs,outbox,events)<=${limit}
      ),
      packed as (
        select *,sum(commands) over w as total_commands,sum(evaluations) over w as total_evaluations,
          sum(runs) over w as total_runs,sum(outbox) over w as total_outbox,sum(events) over w as total_events
        from fitting window w as(order by age,seed_kind,seed_id rows unbounded preceding)
      ),
      selected as (
        select distinct a.kind,a.id from ancestors a join packed p using(seed_kind,seed_id)
        where greatest(total_commands,total_evaluations,total_runs,total_outbox,total_events)<=${limit}
      ),
      skipped as (
        select count(*) filter(where eligible and greatest(commands,evaluations,runs,outbox,events)>${limit})::integer as oversized,
          count(*) filter(where not eligible)::integer as blocked from sizes
      ),
      scan_positions as (
        select jsonb_object_agg(kind,jsonb_build_object('id',id,'age',to_char(age at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))) as positions
        from(select distinct on(kind) kind,id,age from seeds order by kind,age desc,id desc) last_scanned
      )
      select s.kind,s.id,skipped.oversized,skipped.blocked,scan_positions.positions
      from skipped cross join scan_positions left join selected s on true
    `);
    const ids: Record<EvidenceTable, string[]> = {
      commands: [],
      evaluations: [],
      syntheticRuns: [],
      outbox: [],
      events: [],
    };
    let skippedOversizedCandidates = 0;
    let blockedCandidates = 0;
    let nextCursor: string | null = null;
    for (const row of selected) {
      skippedOversizedCandidates = Number(row.oversized);
      blockedCandidates = Number(row.blocked);
      if (row.positions)
        nextCursor = Buffer.from(
          JSON.stringify({ ...positions, ...(row.positions as ScanPositions) }),
        ).toString("base64url");
      if (
        typeof row.kind === "string" &&
        row.kind in ids &&
        typeof row.id === "string"
      )
        ids[row.kind as EvidenceTable].push(row.id);
    }
    // Conservative overlap packing keeps actual rows below each table's limit.
    // Delete FK dependents before referenced outbox rows.
    const counts = {
      commands: 0,
      evaluations: 0,
      syntheticRuns: 0,
      outbox: 0,
      events: 0,
    };
    for (const kind of Object.keys(tables) as EvidenceTable[]) {
      counts[kind] = ids[kind].length;
      if (apply && ids[kind].length)
        await tx
          .delete(tables[kind])
          .where(inArray(tables[kind].id, ids[kind]));
    }
    return {
      contractVersion: 1 as const,
      mode: apply ? ("apply" as const) : ("preview" as const),
      evaluatedAt: now.toISOString(),
      historyCutoff,
      commandCutoff,
      limit,
      counts,
      skippedOversizedCandidates,
      blockedCandidates,
      nextCursor,
    };
  });
};
