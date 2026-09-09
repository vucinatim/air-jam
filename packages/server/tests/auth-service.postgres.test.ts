import { createHostGrant, type HostGrantClaims } from "@air-jam/sdk/protocol";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { runtimeDatabaseSchema, type ServerDatabase } from "../src/db";
import type { ServerLogger } from "../src/logging/logger";
import { AuthService } from "../src/services/auth-service";

const databaseUrl = process.env.AIR_JAM_TEST_DATABASE_URL?.trim();
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("host bootstrap PostgreSQL identity", () => {
  const client = postgres(databaseUrl!, { max: 2 });
  const database = drizzle(client, {
    schema: runtimeDatabaseSchema,
  }) as ServerDatabase;
  const suffix = crypto.randomUUID();
  const creatorId = `auth-creator-${suffix}`;
  const gameId = `auth-game-${suffix}`;
  const appKey = `aj_app_${suffix.replaceAll("-", "")}`;
  const hostGrantSecret = `auth-host-grant-${suffix}`;
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as ServerLogger;

  beforeAll(async () => {
    await client`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (
        ${creatorId}, 'Realtime identity test', ${`${creatorId}@example.invalid`},
        true, now(), now()
      )
    `;
    await client`
      insert into games (id, user_id, name, config, created_at, updated_at)
      values (${gameId}, ${creatorId}, 'Realtime identity game', '{}'::jsonb, now(), now())
    `;
    await client`
      insert into app_ids (id, game_id, creator_id, key, is_active, created_at)
      values (${`auth-app-id-${suffix}`}, ${gameId}, ${creatorId}, ${appKey}, true, now())
    `;
  });

  afterAll(async () => {
    await client`delete from realtime_host_grant_consumptions where app_id = ${appKey}`;
    await client`delete from app_ids where key = ${appKey}`;
    await client`delete from games where id = ${gameId}`;
    await client`delete from users where id = ${creatorId}`;
    await client.end();
  });

  it("binds an app credential to its canonical game and creator", async () => {
    const auth = new AuthService({
      db: database,
      logger,
      env: {
        authMode: "required",
        databaseUrl,
      },
    });
    await expect(auth.verifyHostBootstrap({ appId: appKey })).resolves.toEqual(
      expect.objectContaining({
        isVerified: true,
        appId: appKey,
        gameId,
        creatorId,
        verifiedVia: "appId",
      }),
    );
  });

  const createSystemHostGrant = async (
    overrides: Partial<Omit<HostGrantClaims, "typ">> = {},
  ) => {
    const now = Math.floor(Date.now() / 1_000);
    return createHostGrant({
      secret: hostGrantSecret,
      claims: {
        jti: crypto.randomUUID(),
        aud: "airjam:realtime",
        appId: appKey,
        gameId,
        creatorId,
        iat: now,
        exp: now + 60,
        origins: ["https://airjam.io"],
        sessionKind: "system",
        ...overrides,
      },
    });
  };

  const createHostGrantAuth = () =>
    new AuthService({
      db: database,
      logger,
      env: {
        authMode: "required",
        databaseUrl,
        hostGrantSecret,
      },
    });

  it("consumes a signed host grant exactly once", async () => {
    const auth = createHostGrantAuth();
    const hostGrant = await createSystemHostGrant();

    await expect(
      auth.verifyHostBootstrap({
        hostGrant,
        origin: "https://airjam.io",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        isVerified: true,
        appId: appKey,
        gameId,
        creatorId,
        verifiedVia: "hostGrant",
        hostSessionKind: "system",
      }),
    );

    await expect(
      auth.verifyHostBootstrap({
        hostGrant,
        origin: "https://airjam.io",
      }),
    ).resolves.toEqual({
      isVerified: false,
      error: "Unauthorized: Host grant was already consumed",
    });
  });

  it("allows only one concurrent consumer of a host grant", async () => {
    const auth = createHostGrantAuth();
    const hostGrant = await createSystemHostGrant();

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        auth.verifyHostBootstrap({
          hostGrant,
          origin: "https://airjam.io",
        }),
      ),
    );

    expect(results.filter((result) => result.isVerified)).toHaveLength(1);
    expect(
      results.filter(
        (result) =>
          !result.isVerified &&
          result.error === "Unauthorized: Host grant was already consumed",
      ),
    ).toHaveLength(7);
  });

  it("takes session authority from the grant instead of the client request", async () => {
    const auth = createHostGrantAuth();
    const hostGrant = await createSystemHostGrant({ sessionKind: "game" });

    await expect(
      auth.verifyHostBootstrap({
        hostGrant,
        hostSessionKind: "system",
        origin: "https://airjam.io",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        isVerified: true,
        hostSessionKind: "game",
      }),
    );
  });

  it("rejects a missing origin without consuming the grant", async () => {
    const auth = createHostGrantAuth();
    const hostGrant = await createSystemHostGrant();

    await expect(auth.verifyHostBootstrap({ hostGrant })).resolves.toEqual({
      isVerified: false,
      error: "Unauthorized: Missing or Invalid Origin",
    });

    await expect(
      auth.verifyHostBootstrap({
        hostGrant,
        origin: "https://airjam.io",
      }),
    ).resolves.toEqual(expect.objectContaining({ isVerified: true }));
  });

  it("rejects stale or forged app ownership without consuming the grant", async () => {
    const auth = createHostGrantAuth();
    const jti = crypto.randomUUID();
    const hostGrant = await createSystemHostGrant({
      jti,
      creatorId: "different-creator",
    });

    await expect(
      auth.verifyHostBootstrap({
        hostGrant,
        origin: "https://airjam.io",
      }),
    ).resolves.toEqual({
      isVerified: false,
      error: "Unauthorized: Host grant identity is not active",
    });

    const [remaining] = await client<[{ count: number }]>`
      select count(*)::int as count
      from realtime_host_grant_consumptions
      where jti = ${jti}
    `;
    expect(remaining?.count).toBe(0);
  });

  it("cleans only grant consumptions beyond the retention margin", async () => {
    const staleJti = crypto.randomUUID();
    const recentJti = crypto.randomUUID();
    await client`
      insert into realtime_host_grant_consumptions (
        jti, app_id, session_kind, consumed_at, expires_at
      ) values (
        ${staleJti}, ${appKey}, 'system',
        now() - interval '12 minutes', now() - interval '10 minutes'
      ), (
        ${recentJti}, ${appKey}, 'system',
        now() - interval '2 minutes', now() - interval '1 minute'
      )
    `;

    const auth = createHostGrantAuth();
    const hostGrant = await createSystemHostGrant();
    await expect(
      auth.verifyHostBootstrap({
        hostGrant,
        origin: "https://airjam.io",
      }),
    ).resolves.toEqual(expect.objectContaining({ isVerified: true }));

    const [remaining] = await client<[{ count: number }]>`
      select count(*)::int as count
      from realtime_host_grant_consumptions
      where jti in (${staleJti}, ${recentJti})
    `;
    expect(remaining?.count).toBe(1);
    const [recent] = await client<[{ count: number }]>`
      select count(*)::int as count
      from realtime_host_grant_consumptions
      where jti = ${recentJti}
    `;
    expect(recent?.count).toBe(1);
  });
});
