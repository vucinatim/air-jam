import { describe, expect, it } from "vitest";
import {
  controllerAgentRequestMessageSchema,
  controllerAgentResultMessageSchema,
} from "../src/runtime/contracts/controller-agent";

const base = {
  type: "AIRJAM_CONTROLLER_AGENT_RESULT",
  requestId: "request",
  roomId: "ABCD",
  controllerId: "phone",
};
describe("controller capture channel", () => {
  it("names the exact room and phone and only permits capture", () => {
    expect(
      controllerAgentRequestMessageSchema.parse({
        type: "AIRJAM_CONTROLLER_AGENT",
        requestId: "request",
        request: {
          operation: "capture",
          roomId: "ABCD",
          controllerId: "phone",
        },
      }).request.controllerId,
    ).toBe("phone");
    expect(
      controllerAgentRequestMessageSchema.safeParse({
        type: "AIRJAM_CONTROLLER_AGENT",
        requestId: "request",
        request: { operation: "invoke", roomId: "ABCD", controllerId: "phone" },
      }).success,
    ).toBe(false);
  });
  it("requires JPEG, controller-view coverage, bounded size and max edge 1280", () => {
    const image = {
      mimeType: "image/jpeg",
      data: "AAAA",
      width: 1280,
      height: 720,
      coverage: "controller-view",
    };
    expect(
      controllerAgentResultMessageSchema.safeParse({
        ...base,
        capture: { status: "captured", image },
      }).success,
    ).toBe(true);
    for (const patch of [
      { coverage: "render-surface" },
      { width: 1281 },
      { mimeType: "image/png" },
      { data: "AAAA".repeat(220_000) },
    ])
      expect(
        controllerAgentResultMessageSchema.safeParse({
          ...base,
          capture: { status: "captured", image: { ...image, ...patch } },
        }).success,
      ).toBe(false);
  });
  it.each(["unsupported", "surface-unavailable", "timeout"])(
    "returns %s explicitly",
    (reason) => {
      expect(
        controllerAgentResultMessageSchema.parse({
          ...base,
          capture: { status: "unavailable", reason },
        }),
      ).toMatchObject({ capture: { reason } });
    },
  );
  it("rejects a substitute image on an unavailable response", () => {
    expect(
      controllerAgentResultMessageSchema.safeParse({
        ...base,
        capture: { status: "unavailable", reason: "unsupported", image: {} },
      }).success,
    ).toBe(false);
  });
});
