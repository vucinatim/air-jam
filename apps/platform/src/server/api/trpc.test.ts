import {
  OperationalAdmissionDeniedError,
  type OperationalAdmissionDecision,
} from "@/server/operations/production-control-service";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it } from "vitest";
import { createTRPCRouter, getTRPCResponseMeta, publicProcedure } from "./trpc";

const pausedDecision: OperationalAdmissionDecision = {
  contractVersion: 1,
  decisionId: "decision-trpc",
  lane: "release_submission",
  controlStatus: "available",
  mode: "paused",
  outcome: "denied",
  reason: "lane_paused",
  retryAfterSeconds: 60,
  controlRevision: 3,
};

describe("platform application error middleware", () => {
  it("preserves operational decisions for human HTTP clients", async () => {
    const router = createTRPCRouter({
      guarded: publicProcedure.query(() => {
        throw new OperationalAdmissionDeniedError(pausedDecision);
      }),
    });
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request("https://airjam.test/api/trpc/guarded?input=%7B%7D"),
      router,
      responseMeta: getTRPCResponseMeta,
      createContext: async () => ({
        headers: new Headers(),
        session: null,
        user: null,
        clientIp: "127.0.0.1",
      }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        json: {
          data: {
            code: "SERVICE_UNAVAILABLE",
            operationalDecision: pausedDecision,
          },
        },
      },
    });
  });
});
