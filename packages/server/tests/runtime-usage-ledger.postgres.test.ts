import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { persistRuntimeUsageEvent } from "../src/analytics/runtime-usage-ledger.js";
import { rebuildRuntimeUsageSessionFromLedger } from "../src/analytics/runtime-usage-rebuilder.js";
import {
  createRuntimeUsageEvent,
  type RuntimeUsageEvent,
} from "../src/analytics/runtime-usage.js";
import { runtimeDatabaseSchema, type ServerDatabase } from "../src/db.js";
import {
  createDisposablePostgresDatabase,
  validateLocalDatabaseUrl,
} from "./helpers/postgres-fixture.js";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const pgDescribe = databaseUrl ? describe : describe.skip;

pgDescribe("runtime usage ledger concurrent PostgreSQL projection", () => {
  let fixture: Awaited<ReturnType<typeof createDisposablePostgresDatabase>>;
  let client: ReturnType<typeof postgres>;
  let database: ServerDatabase;
  const startedAt = Date.parse("2026-09-10T12:00:00Z");
  beforeAll(async () => {
    fixture = await createDisposablePostgresDatabase(
      validateLocalDatabaseUrl(databaseUrl),
      `usage-regression-${crypto.randomUUID()}`,
    );
    client = postgres(fixture.url.toString(), { max: 10 });
    database = drizzle(client, { schema: runtimeDatabaseSchema });
  }, 30_000);
  afterAll(async () => {
    await client?.end({ timeout: 5 });
    await fixture?.cleanup();
  });

  const event = (
    session: string,
    game: number,
    kind: RuntimeUsageEvent["kind"],
    occurredAt: number,
    controllerId?: string,
  ) =>
    createRuntimeUsageEvent({
      runtimeSessionId: session,
      runtimeSessionStartedAt: startedAt,
      roomId: "ABCD",
      appId: `load-app-${game}`,
      gameId: `load-game-${game}`,
      kind,
      occurredAt,
      payload: controllerId ? { controllerId } : {},
    });
  const persistAll = async (events: RuntimeUsageEvent[]) => {
    const results = await Promise.allSettled(
      events.map((entry) => persistRuntimeUsageEvent(database, entry)),
    );
    const failures = results.flatMap((result) => {
      if (result.status === "fulfilled") return [];
      let cause: unknown = result.reason;
      while (cause && typeof cause === "object") {
        const value = cause as {
          code?: unknown;
          constraint_name?: unknown;
          cause?: unknown;
        };
        if (typeof value.code === "string")
          return [{ code: value.code, constraint: value.constraint_name }];
        cause = value.cause;
      }
      return [{ code: "unknown", constraint: undefined }];
    });
    expect(failures).toEqual([]);
  };

  it("retains every concurrent join/disconnect and one eligible segment for a room", async () => {
    const session = crypto.randomUUID();
    await persistRuntimeUsageEvent(
      database,
      event(session, 0, "game_became_active", startedAt),
    );
    const controllers = Array.from(
      { length: 16 },
      (_, index) => `controller-${index}`,
    );
    const joins = controllers.map((id) =>
      event(session, 0, "controller_joined", startedAt + 1000, id),
    );
    await persistAll(joins);
    await persistAll(joins); // Event-id replay must not add segments or aggregates.
    await persistAll(
      controllers.map((id) =>
        event(session, 0, "controller_disconnected", startedAt + 11_000, id),
      ),
    );
    await persistRuntimeUsageEvent(
      database,
      event(session, 0, "room_closed", startedAt + 20_000),
    );
    const [row] = await client`select
      (select count(*)::integer from runtime_usage_events where runtime_session_id=${session}) as events,
      (select count(*)::integer from runtime_usage_controller_segments where runtime_session_id=${session} and ended_at is not null) as controllers,
      (select count(*)::integer from runtime_usage_eligible_segments where runtime_session_id=${session} and ended_at is not null) as eligible,
      (select controller_seconds from runtime_usage_game_session_metrics where runtime_session_id=${session}) as seconds`;
    expect(row).toMatchObject({
      events: 34,
      controllers: 16,
      eligible: 1,
      seconds: 160,
    });
  });

  it("preserves shared daily totals across concurrent rooms playing the same game", async () => {
    const sessions = Array.from({ length: 8 }, () => crypto.randomUUID());
    await persistAll(
      sessions.map((id) => event(id, 1, "game_became_active", startedAt)),
    );
    await persistAll(
      sessions.map((id) =>
        event(id, 1, "controller_joined", startedAt + 1000, "player"),
      ),
    );
    await persistAll(
      sessions.map((id) =>
        event(id, 1, "controller_disconnected", startedAt + 11_000, "player"),
      ),
    );
    await persistAll(
      sessions.map((id) => event(id, 1, "room_closed", startedAt + 20_000)),
    );
    const rows =
      await client`select session_count, total_game_active_seconds, total_controller_seconds
      from runtime_usage_daily_game_metrics where game_id='load-game-1'`;
    expect(rows).toEqual([
      expect.objectContaining({
        session_count: 8,
        total_game_active_seconds: 160,
        total_controller_seconds: 80,
      }),
    ]);
  });

  it("serializes rebuilding with live writes and other rooms sharing daily totals", async () => {
    const sessions = Array.from({ length: 4 }, () => crypto.randomUUID());
    await persistAll(
      sessions.map((id) => event(id, 2, "game_became_active", startedAt)),
    );
    await persistAll(
      sessions.map((id) =>
        event(id, 2, "controller_joined", startedAt + 1000, "player"),
      ),
    );
    await Promise.all(
      sessions.flatMap((id) => [
        persistRuntimeUsageEvent(
          database,
          event(id, 2, "controller_disconnected", startedAt + 11_000, "player"),
        ),
        rebuildRuntimeUsageSessionFromLedger(
          database,
          id,
          new Date(startedAt + 12_000),
        ),
      ]),
    );
    await persistAll(
      sessions.map((id) => event(id, 2, "room_closed", startedAt + 20_000)),
    );
    await Promise.all(
      sessions.map((id) =>
        rebuildRuntimeUsageSessionFromLedger(
          database,
          id,
          new Date(startedAt + 20_000),
        ),
      ),
    );
    const [row] =
      await client`select session_count, total_controller_seconds, total_game_active_seconds
      from runtime_usage_daily_game_metrics where game_id='load-game-2'`;
    expect(row).toMatchObject({
      session_count: 4,
      total_controller_seconds: 40,
      total_game_active_seconds: 80,
    });
    const [counts] = await client`select
      (select count(*)::integer from runtime_usage_events where game_id='load-game-2') as events,
      (select count(*)::integer from runtime_usage_controller_segments where runtime_session_id=any(${sessions}) and ended_at is null) as open`;
    expect(counts).toMatchObject({ events: 16, open: 0 });
  });
});
