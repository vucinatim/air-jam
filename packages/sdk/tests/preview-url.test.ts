import { describe, expect, it } from "vitest";
import {
  AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM,
  AIR_JAM_PREVIEW_FLAG_QUERY_PARAM,
  buildPreviewControllerUrl,
  createPreviewControllerLaunch,
  readPreviewControllerDeviceIdFromSearchParams,
} from "../src/preview";

describe("preview controller launch helpers", () => {
  it("builds a preview controller url from the canonical join url", () => {
    const result = buildPreviewControllerUrl({
      joinUrl:
        "https://platform.example/controller?room=ROOM2&aj_controller_cap=cap_123",
      controllerId: "ctrl_preview_1",
      previewDeviceId: "pd_preview_1",
    });

    expect(result).toBe(
      "https://platform.example/controller?room=ROOM2&aj_controller_cap=cap_123&controllerId=ctrl_preview_1&aj_preview=1&aj_preview_device=pd_preview_1",
    );
  });

  it("rejects invalid preview controller join urls", () => {
    expect(
      buildPreviewControllerUrl({
        joinUrl: "javascript:alert(1)",
        controllerId: "ctrl_preview_1",
      }),
    ).toBeNull();
  });

  it("can reject preview launches outside an allowed origin set", () => {
    expect(
      buildPreviewControllerUrl({
        joinUrl: "https://game.example/controller?room=ROOM2",
        controllerId: "ctrl_preview_1",
        allowedOrigins: ["https://platform.example"],
      }),
    ).toBeNull();

    expect(
      buildPreviewControllerUrl({
        joinUrl: "https://platform.example/controller?room=ROOM2",
        controllerId: "ctrl_preview_1",
        allowedOrigins: ["https://platform.example"],
      }),
    ).toBe(
      "https://platform.example/controller?room=ROOM2&controllerId=ctrl_preview_1&aj_preview=1",
    );
  });

  it("creates a full preview launch contract with fresh ids", () => {
    const launch = createPreviewControllerLaunch({
      joinUrl: "https://platform.example/controller?room=ROOM2",
    });

    expect(launch).not.toBeNull();
    expect(launch?.controllerId.length).toBeGreaterThan(0);
    expect(launch?.deviceId.startsWith("pd_")).toBe(true);

    const params = new URL(launch!.url).searchParams;
    expect(params.get("controllerId")).toBe(launch?.controllerId);
    expect(params.get(AIR_JAM_PREVIEW_FLAG_QUERY_PARAM)).toBe("1");
    expect(params.get(AIR_JAM_PREVIEW_DEVICE_QUERY_PARAM)).toBe(
      launch?.deviceId,
    );
  });

  it("only reads preview device ids from explicit preview launches", () => {
    expect(
      readPreviewControllerDeviceIdFromSearchParams(
        new URLSearchParams(
          "room=ROOM2&aj_preview=1&aj_preview_device=pd_preview_1",
        ),
      ),
    ).toBe("pd_preview_1");

    expect(
      readPreviewControllerDeviceIdFromSearchParams(
        new URLSearchParams("room=ROOM2&aj_preview_device=pd_preview_1"),
      ),
    ).toBeNull();
  });
});
