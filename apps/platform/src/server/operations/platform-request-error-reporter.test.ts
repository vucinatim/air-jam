import { describe, expect, it } from "vitest";
import { createPlatformRequestFailureEvent } from "./platform-request-error-reporter";

describe("platform request error reporting", () => {
  it("creates an authoritative bounded event without raw request or exception data", () => {
    const event = createPlatformRequestFailureEvent({
      error: new Error(
        "postgres://user:password@secret.invalid/airjam authorization=Bearer-token",
      ),
      context: {
        method: "POST",
        routerKind: "App Router",
        routeType: "route",
      },
      environment: "test",
      eventId: "platform-request-failure:test",
      observedAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect(event).toMatchObject({
      kind: "platform.request.failed",
      authority: "airjam_authoritative",
      source: { service: "platform", component: "next-request-boundary" },
      payload: {
        failure: {
          code: "platform.request_failed",
          class: "internal",
          retryable: false,
          details: {
            method: "POST",
            routerKind: "App Router",
            routeType: "route",
          },
        },
      },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("secret.invalid");
    expect(serialized).not.toContain("Bearer-token");
    expect(serialized).not.toContain("stack");
  });
});
