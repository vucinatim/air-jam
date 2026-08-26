import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createTRPCContext } from "../trpc";

const getProductTelemetryOpsOverview = vi.hoisted(() => vi.fn());

vi.mock("@/server/product-telemetry/reporting", () => ({
  getProductTelemetryOpsOverview,
}));

import { productTelemetryRouter } from "./product-telemetry";

type RouterContext = Awaited<ReturnType<typeof createTRPCContext>>;

const makeContext = (role: "creator" | "ops_admin" | null): RouterContext => ({
  headers: new Headers(),
  clientIp: "127.0.0.1",
  session: role === null ? null : ({} as NonNullable<RouterContext["session"]>),
  user:
    role === null
      ? null
      : {
          id: "user-1",
          name: "Operator",
          email: "operator@example.com",
          emailVerified: true,
          image: null,
          role,
          createdAt: new Date("2026-08-26T00:00:00.000Z"),
          updatedAt: new Date("2026-08-26T00:00:00.000Z"),
        },
});

const input = {
  days: 30 as const,
  deploymentEnvironment: "production" as const,
};

beforeEach(() => {
  getProductTelemetryOpsOverview.mockReset();
});

describe("product telemetry ops router", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = productTelemetryRouter.createCaller(makeContext(null));

    await expect(caller.getOpsOverview(input)).rejects.toMatchObject<TRPCError>(
      {
        code: "UNAUTHORIZED",
      },
    );
    expect(getProductTelemetryOpsOverview).not.toHaveBeenCalled();
  });

  it("rejects authenticated non-ops callers", async () => {
    const caller = productTelemetryRouter.createCaller(makeContext("creator"));

    await expect(caller.getOpsOverview(input)).rejects.toMatchObject<TRPCError>(
      {
        code: "FORBIDDEN",
      },
    );
    expect(getProductTelemetryOpsOverview).not.toHaveBeenCalled();
  });

  it("allows ops callers and forwards only validated reporting input", async () => {
    const result = { authority: "test-result" };
    getProductTelemetryOpsOverview.mockResolvedValue(result);
    const caller = productTelemetryRouter.createCaller(
      makeContext("ops_admin"),
    );

    await expect(caller.getOpsOverview(input)).resolves.toBe(result);
    expect(getProductTelemetryOpsOverview).toHaveBeenCalledWith(input);
  });
});
