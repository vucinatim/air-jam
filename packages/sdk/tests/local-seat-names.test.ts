// @vitest-environment jsdom

import { afterEach, expect, it } from "vitest";
import { createConnectionStore } from "../src/core/connection-store";
import { ControllerRuntime } from "../src/core/controller-runtime";
import { buildPreviewControllerUrl } from "../src/preview/url";
import type { ControllerJoinPayload } from "../src/protocol/controller";
import { createBrowserControllerEnvironment } from "../src/runtime/browser-controller-environment";
import { createMemorySocket } from "./fixtures/memory-socket";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
});

it("joins a reloaded phone with its current seat label, separately from its ordinary nickname", () => {
  const joins: ControllerJoinPayload[] = [];
  const launch = (localSeat?: string, nickname?: string) => {
    const url = buildPreviewControllerUrl({
      joinUrl: `${window.location.origin}/controller?room=ABCD`,
      controllerId: "phone-1",
      previewDeviceId: "pd_phone-1",
      localSeat,
    });
    window.history.replaceState(null, "", url);
    const socket = createMemorySocket((event, payload) => {
      if (event === "controller:join") {
        joins.push(payload as ControllerJoinPayload);
        return {
          ok: true,
          controllerId: "phone-1",
          resumeCapabilityToken: "resume",
        };
      }
      return { ok: true };
    });
    const runtime = new ControllerRuntime({
      store: createConnectionStore(),
      getSocket: () => {
        throw new Error("Use the in-process transport.");
      },
      disconnectSocket: () => {},
      environment: {
        ...createBrowserControllerEnvironment(),
        transport: () => socket,
        emitDevEvent: () => {},
        setDevLogContext: () => {},
      },
      stores: [],
    });
    runtime.setNickname(nickname ?? "");
    const stop = runtime.start();
    stop();
  };

  launch("Keyboard 1", "Alex");
  launch(undefined, "Alex");
  launch("Gamepad 1");
  launch();
  expect(
    joins.map(({ nickname, localSeatLabel }) => ({ nickname, localSeatLabel })),
  ).toEqual([
    { nickname: "Alex", localSeatLabel: "Keyboard 1" },
    { nickname: "Alex", localSeatLabel: undefined },
    { nickname: undefined, localSeatLabel: "Gamepad 1" },
    { nickname: undefined, localSeatLabel: undefined },
  ]);
  expect(
    joins.every(
      ({ controllerId, deviceId }) =>
        controllerId === "phone-1" && deviceId === "pd_phone-1",
    ),
  ).toBe(true);
}, 1000);
