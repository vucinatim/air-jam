import { describe, expect, it } from "vitest";
import {
  AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST,
  AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
  AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST,
  AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT,
  isRuntimeOwnerActionRequest,
  isRuntimeOwnerActionResult,
  isRuntimeOwnerCaptureRequest,
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
  it("requires the acting controller snapshot and actual store revisions for capture", () => {
    const request = {
      type: AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST,
      requestId: "ffbabd80-9635-4b56-b914-4a1eb2c80db2",
      relativeDir: ".airjam/artifacts/session-visuals/capture",
      snapshot: {
        harnessSessionId: "493ac595-ac37-41f1-8a49-620e716be238",
        roomId: "ROOM",
        controllerId: "acting-controller",
        connected: true,
        player: { id: "acting-controller", label: "Acting player" },
      },
      stores: [
        {
          roomId: "ROOM",
          storeDomain: "pong",
          revision: 4,
          data: { score: 2 },
        },
      ],
    };
    expect(isRuntimeOwnerCaptureRequest(request)).toBe(true);
    expect(
      isRuntimeOwnerCaptureRequest({ ...request, snapshot: undefined }),
    ).toBe(false);
    expect(
      isRuntimeOwnerCaptureRequest({
        ...request,
        stores: [{ ...request.stores[0], revision: -1 }],
      }),
    ).toBe(false);
    expect(
      isRuntimeOwnerCaptureRequest({
        ...request,
        snapshot: { ...request.snapshot, harnessSessionId: "invalid" },
      }),
    ).toBe(false);
  });
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
