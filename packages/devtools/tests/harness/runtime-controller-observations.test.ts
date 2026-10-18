import { controllerBridgeSnapshotSchema } from "@air-jam/sdk/controller-bridge";
import { randomUUID } from "node:crypto";
import type { Browser, Page } from "playwright-core";
import { beforeEach, expect, it, vi } from "vitest";
import type { openControllerObservation } from "../../src/harness/visual/controller-observation.js";
import { RuntimeControllerObservations } from "../../src/harness/visual/runtime-controller-observations.js";
const open = vi.hoisted(() => vi.fn<typeof openControllerObservation>());
vi.mock("../../src/harness/visual/controller-observation.js", () => ({
  openControllerObservation: open,
}));
beforeEach(() => {
  open.mockReset();
});
function fixture() {
  const send = vi.fn();
  const observations = new RuntimeControllerObservations({
    browser: {} as Browser,
    send,
    readInspection: async () => ({
      role: "host",
      roomId: "ROOM",
      joinUrl: "http://localhost/controller?room=ROOM",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      players: [],
      controllers: [],
      mode: "standalone",
      runtimeState: "playing",
    }),
  });
  const context = {
    snapshot: controllerBridgeSnapshotSchema.parse({
      harnessSessionId: randomUUID(),
      roomId: "ROOM",
      controllerId: "player",
      connected: true,
    }),
    stores: [],
  };
  return { observations, context, send };
}
it("bounds delivery while a mirror starts and reports the failure instead of growing forever", async () => {
  const f = fixture();
  const onError = vi.fn();
  let finish: (
    observation: Awaited<ReturnType<typeof openControllerObservation>>,
  ) => void = () => {};
  open.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const opening = f.observations.open("capture", f.context, onError);
  const rejected = expect(opening).rejects.toThrow("allowance");
  await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
  for (let index = 0; index < 1000; index++)
    f.observations.deliver({
      type: "air-jam-runtime-owner.capture-event/v1",
      requestId: "capture",
      event: "airjam:state_sync",
      args: [],
    });
  expect(onError).toHaveBeenCalledOnce();
  const close = vi.fn(async () => {});
  finish({ page: {} as Page, deliver: vi.fn(), close });
  await rejected;
  expect(close).toHaveBeenCalledOnce();
});
it("closing during mirror startup aborts that context and settles without waiting for readiness", async () => {
  const f = fixture();
  open.mockImplementation(async ({ signal }) => {
    await new Promise<void>((_resolve, reject) =>
      signal?.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      }),
    );
    throw new Error("Unexpected mirror readiness");
  });
  const opening = f.observations.open("watch", f.context, vi.fn());
  const rejected = expect(opening).rejects.toThrow();
  await vi.waitFor(() => expect(open).toHaveBeenCalledOnce());
  await f.observations.close("watch");
  await rejected;
});

it("cancels in-flight mirror delivery when closing without mistaking that cancellation for a failed watch", async () => {
  const f = fixture();
  const onError = vi.fn();
  let interrupt: (error: Error) => void = () => {};
  const deliver = vi.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        interrupt = reject;
      }),
  );
  const close = vi.fn(async () => {
    interrupt(new Error("Target context closed"));
  });
  open.mockResolvedValue({ page: {} as Page, deliver, close });
  await f.observations.open("watch", f.context, onError);
  f.observations.deliver({
    type: "air-jam-runtime-owner.capture-event/v1",
    requestId: "watch",
    event: "airjam:state_sync",
    args: [],
  });
  await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce());
  await f.observations.close("watch");
  expect(close).toHaveBeenCalledOnce();
  expect(onError).not.toHaveBeenCalled();
});
