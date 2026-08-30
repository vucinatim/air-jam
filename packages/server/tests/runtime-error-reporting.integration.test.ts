import type { RuntimeErrorReportAck } from "@air-jam/sdk/protocol";
import { describe, expect, it, vi } from "vitest";
import type {
  ServerOperationalEventPublisher,
  ServerRuntimeErrorReportInput,
} from "../src/operations/operational-event-publisher";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

const allowAllAuthService = {
  verifyHostBootstrap: async ({ appId }: { appId?: string }) => ({
    isVerified: true,
    appId,
    verifiedVia: "appId" as const,
  }),
} as AuthService;

describe("hosted-runtime error reporting", () => {
  const reports: ServerRuntimeErrorReportInput[] = [];
  const operationalEventPublisher: ServerOperationalEventPublisher = {
    publishFailure: async () => {},
    publishRuntimeErrorReport: vi.fn(async (input) => {
      reports.push(input);
    }),
  };
  const harness = setupServerTestHarness({
    server: {
      authService: allowAllAuthService,
      operationalEventPublisher,
      runtimeErrorReportRateLimitMax: 2,
    },
  });

  it("accepts a bounded report only from the socket authorized for its role and room", async () => {
    reports.length = 0;
    const host = await harness.connectSocket();
    expect((await harness.bootstrapHost(host, "fixture-app", "game")).ok).toBe(
      true,
    );
    const createAck = await harness.emitWithAck<{
      ok: boolean;
      roomId?: string;
    }>(host, "host:createRoom", { maxPlayers: 4 });
    const roomId = createAck.roomId!;
    const reportId = crypto.randomUUID();

    const accepted = await harness.emitWithAck<RuntimeErrorReportAck>(
      host,
      "runtime:error_report",
      {
        contractVersion: 1,
        reportId,
        roomId,
        role: "host",
        code: "AJ_RUNTIME_RENDER_CRASH",
        errorName: "TypeError",
        digest: "deadbeef",
        occurredAt: "2020-01-01T00:00:00.000Z",
      },
    );

    expect(accepted).toEqual({ ok: true, reportId });
    expect(reports).toEqual([
      expect.objectContaining({
        reportId,
        roomId,
        role: "host",
        code: "AJ_RUNTIME_RENDER_CRASH",
        errorName: "TypeError",
        digest: "deadbeef",
      }),
    ]);
    expect(reports[0]?.runtimeSessionId).toBeTypeOf("string");

    const wrongRole = await harness.emitWithAck<RuntimeErrorReportAck>(
      host,
      "runtime:error_report",
      {
        contractVersion: 1,
        reportId: crypto.randomUUID(),
        roomId,
        role: "controller",
        code: "AJ_RUNTIME_RENDER_CRASH",
        errorName: "Error",
        digest: "cafebabe",
        occurredAt: "2020-01-01T00:00:00.000Z",
      },
    );
    expect(wrongRole).toMatchObject({ ok: false, code: "unauthorized" });

    const rateLimited = await harness.emitWithAck<RuntimeErrorReportAck>(
      host,
      "runtime:error_report",
      {
        contractVersion: 1,
        reportId: crypto.randomUUID(),
        roomId,
        role: "host",
        code: "AJ_RUNTIME_RENDER_CRASH",
        errorName: "Error",
        digest: "01234567",
        occurredAt: "2020-01-01T00:00:00.000Z",
      },
    );
    expect(rateLimited).toMatchObject({ ok: false, code: "rate_limited" });
    expect(reports).toHaveLength(1);
  });

  it("rejects raw or unauthorized payloads before persistence", async () => {
    reports.length = 0;
    const socket = await harness.connectSocket();
    const reportId = crypto.randomUUID();
    const invalid = await harness.emitWithAck<RuntimeErrorReportAck>(
      socket,
      "runtime:error_report",
      {
        contractVersion: 1,
        reportId,
        roomId: "ABCD",
        role: "host",
        code: "AJ_RUNTIME_RENDER_CRASH",
        errorName: "Error",
        digest: "deadbeef",
        occurredAt: "2020-01-01T00:00:00.000Z",
        message: "password=must-not-persist",
        stack: "secret stack",
      },
    );
    expect(invalid).toEqual({ ok: false, code: "invalid_payload" });

    const unauthorized = await harness.emitWithAck<RuntimeErrorReportAck>(
      socket,
      "runtime:error_report",
      {
        contractVersion: 1,
        reportId,
        roomId: "ABCD",
        role: "host",
        code: "AJ_RUNTIME_RENDER_CRASH",
        errorName: "Error",
        digest: "deadbeef",
        occurredAt: "2020-01-01T00:00:00.000Z",
      },
    );
    expect(unauthorized).toEqual({
      ok: false,
      reportId,
      code: "unauthorized",
    });
    expect(reports).toHaveLength(0);
  });
});
