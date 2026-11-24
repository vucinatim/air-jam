// @vitest-environment jsdom

import { afterEach, expect, it } from "vitest";
import { createAirJamConfig } from "../src/core/config";
import { createConnectionStore } from "../src/core/connection-store";
import { ControllerRuntime } from "../src/core/controller-runtime";
import { buildPreviewControllerUrl } from "../src/preview/url";
import type { SeatProfile } from "../src/room-protocol";
import { PhoneRoomSession } from "../src/room-session/phone-room-session";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { createBrowserControllerEnvironment } from "../src/runtime/browser-controller-environment";

afterEach(() => {
  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
});

const config = createAirJamConfig({
  topology: resolveRuntimeTopology({
    runtimeMode: "self-hosted-production",
    surfaceRole: "controller",
    appOrigin: "https://play.test",
    backendOrigin: "https://play.test",
    publicHost: "https://play.test",
  }),
});

it("joins a reloaded phone with its current seat label, separately from its ordinary nickname", () => {
  const joins: Array<{ profile?: SeatProfile; kind?: string }> = [];
  const launch = (localSeat?: string, nickname?: string) => {
    const url = buildPreviewControllerUrl({
      joinUrl: `${window.location.origin}/controller?room=ABCD`,
      previewDeviceId: "pd_phone-1",
      localSeat,
    });
    window.history.replaceState(null, "", url);
    const environment = createBrowserControllerEnvironment(config);
    const runtime = new ControllerRuntime({
      store: createConnectionStore(),
      environment: {
        ...environment,
        joinRoom: (options) => {
          joins.push({ profile: options.profile, kind: options.kind });
          return new PhoneRoomSession({
            ...options,
            connector: () => ({
              send: () => {},
              buffered: () => false,
              close: () => {},
            }),
            deviceWakeEvents: null,
          });
        },
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
  expect(joins).toEqual([
    {
      kind: "preview",
      profile: { label: "Alex", localSeatLabel: "Keyboard 1" },
    },
    { kind: "preview", profile: { label: "Alex" } },
    { kind: "preview", profile: { localSeatLabel: "Gamepad 1" } },
    { kind: "preview", profile: undefined },
  ]);
}, 1000);
