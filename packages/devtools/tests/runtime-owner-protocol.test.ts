import { describe, expect, it } from "vitest";
import {
  AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST,
  AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
  AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT,
  isRuntimeOwnerActionRequest,
  isRuntimeOwnerActionResult,
  isRuntimeOwnerCaptureResult,
  resolveProjectRelativeRuntimeCaptureDir,
} from "../src/runtime-owner-protocol.js";

describe("runtime owner semantic action messages", () => {
  it("accepts a narrow typed request and canonical result, rejecting malformed messages", () => {
    const request = {
      type: AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST,
      requestId: "r1",
      action: {
        roomId: "ROOM",
        storeDomain: "default",
        actionName: "finishMatch",
        payload: { score: 2 },
      },
    };
    expect(isRuntimeOwnerActionRequest(request)).toBe(true);
    expect(
      isRuntimeOwnerActionRequest({
        ...request,
        action: { ...request.action, payload: [] },
      }),
    ).toBe(false);
    expect(isRuntimeOwnerActionRequest({ ...request, requestId: "" })).toBe(
      false,
    );
    const result = {
      type: AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
      requestId: "r1",
      acknowledgement: { ok: true, status: "accepted", source: "host" },
    };
    expect(isRuntimeOwnerActionResult(result)).toBe(true);
    expect(
      isRuntimeOwnerActionResult({
        ...result,
        acknowledgement: { ok: true, status: "invented", source: "host" },
      }),
    ).toBe(false);
  });
});

describe("runtime owner visual capture paths", () => {
  it("keeps capture artifacts inside the owning project", () => {
    expect(
      resolveProjectRelativeRuntimeCaptureDir({
        projectDir: "/tmp/game",
        relativeDir: ".airjam/artifacts/session-visuals/capture-1",
      }),
    ).toBe("/tmp/game/.airjam/artifacts/session-visuals/capture-1");

    expect(() =>
      resolveProjectRelativeRuntimeCaptureDir({
        projectDir: "/tmp/game",
        relativeDir: "../../private-repo",
      }),
    ).toThrow("must stay in the project");
    expect(() =>
      resolveProjectRelativeRuntimeCaptureDir({
        projectDir: "/tmp/game",
        relativeDir: "/tmp/outside",
      }),
    ).toThrow("must be project-relative");
  });
});

describe("runtime owner visual capture messages", () => {
  it("accepts complete screenshot metadata and rejects malformed IPC data", () => {
    const result = {
      type: AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT,
      requestId: "request-1",
      ok: true,
      capturedAt: "2026-09-09T00:00:00.000Z",
      screenshots: [
        {
          surface: "host",
          width: 1440,
          height: 900,
          relativePath: ".airjam/artifacts/session-visuals/host.png",
        },
      ],
      error: null,
    };

    expect(isRuntimeOwnerCaptureResult(result)).toBe(true);
    expect(
      isRuntimeOwnerCaptureResult({
        ...result,
        screenshots: [{ ...result.screenshots[0], width: 0 }],
      }),
    ).toBe(false);
  });
});
