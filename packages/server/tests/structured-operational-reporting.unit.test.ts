import { describe, expect, it, vi } from "vitest";
import { createDatabaseRuntimeUsageLedgerPublisher } from "../src/analytics/runtime-usage-ledger";
import type { ServerDatabase } from "../src/db";
import type { ServerLogger } from "../src/logging/logger";
import type {
  ServerOperationalEventPublisher,
  ServerOperationalFailureInput,
} from "../src/operations/operational-event-publisher";
import { AuthService } from "../src/services/auth-service";

const createMockLogger = () => {
  const warn = vi.fn();
  const error = vi.fn();
  const mock = {
    child: vi.fn(),
    info: vi.fn(),
    warn,
    error,
  };
  mock.child.mockReturnValue(mock);
  return { logger: mock as unknown as ServerLogger, warn, error };
};

const collectingPublisher = () => {
  const failures: ServerOperationalFailureInput[] = [];
  let resolvePublished!: () => void;
  const published = new Promise<void>((resolve) => {
    resolvePublished = resolve;
  });
  const publisher: ServerOperationalEventPublisher = {
    publishFailure: async (input) => {
      failures.push(input);
      resolvePublished();
    },
    publishRuntimeErrorReport: async () => {},
  };
  return { failures, published, publisher };
};

describe("structured server operational reporting", () => {
  it("reports runtime-usage persistence failure without raw database errors", async () => {
    const collector = collectingPublisher();
    const { logger, warn } = createMockLogger();
    const database = {
      transaction: async () => {
        throw new Error("postgres://user:secret@database.invalid/airjam");
      },
    } as unknown as ServerDatabase;
    const publisher = createDatabaseRuntimeUsageLedgerPublisher(
      logger,
      database,
      collector.publisher,
    );
    publisher.publish({
      id: "usage-event:1",
      kind: "room_created",
      occurredAt: Date.now(),
      runtimeSessionId: "runtime:1",
      roomId: "ABC123",
    });
    await collector.published;

    expect(collector.failures).toEqual([
      expect.objectContaining({
        code: "runtime_usage.persistence_failed",
        component: "runtime-usage-ledger",
        subject: { type: "runtime_session", id: "runtime:1" },
        details: {
          failedEventId: "usage-event:1",
          failedEventKind: "room_created",
        },
      }),
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("postgres://");
  });

  it("reports auth authority failure without persisting the submitted app credential", async () => {
    const collector = collectingPublisher();
    const { logger, error } = createMockLogger();
    const database = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              throw new Error("database password=must-not-escape");
            },
          }),
        }),
      }),
    } as unknown as ServerDatabase;
    const auth = new AuthService({
      logger,
      db: database,
      operationalEventPublisher: collector.publisher,
      env: {
        authMode: "required",
        databaseUrl: "postgresql://local.test/airjam",
      },
    });
    const appCredential = "aj_app_secret_credential";
    await expect(
      auth.verifyHostBootstrap({ appId: appCredential }),
    ).resolves.toMatchObject({
      isVerified: false,
      error: "Internal Server Error",
    });
    await collector.published;

    expect(collector.failures[0]).toMatchObject({
      code: "auth.app_id_verification_failed",
      details: { operation: "verify_app_id" },
    });
    expect(JSON.stringify(collector.failures)).not.toContain(appCredential);
    expect(JSON.stringify(error.mock.calls)).not.toContain("must-not-escape");
  });
});
