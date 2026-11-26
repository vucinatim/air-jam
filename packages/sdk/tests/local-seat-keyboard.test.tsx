// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ControllerInput } from "../src/core/controller-input";
import { defineAirJamInput, stick } from "../src/core/input";
import { defineAirJamInputBindings, wasd } from "../src/core/input-bindings";
import type { PreviewControllerSession } from "../src/preview/manager";
import { useWorkspaceLocalSeats } from "../src/preview/workspace-local-seats";
import {
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "../src/runtime-topology";
import {
  connectParentSeats,
  listenForLocalSeatInput,
  relayLocalSeatInput,
  serveLocalSeats,
  startLocalPlayers,
} from "../src/runtime/local-seats";

const arcade = window;
const stops: (() => void)[] = [];
const inPage = <T,>(page: Window, run: () => T): T => {
  const previous = { window, document, HTMLElement };
  Object.assign(globalThis, {
    window: page,
    document: page.document,
    HTMLElement: (page as Window & typeof globalThis).HTMLElement,
  });
  try {
    return run();
  } finally {
    Object.assign(globalThis, previous);
  }
};
const child = (parent: Window, query: string) => {
  const frame = document.createElement("iframe");
  frame.src = `${arcade.location.origin}/?${query}`;
  document.body.append(frame);
  const page = frame.contentWindow!;
  page.document.open();
  page.document.write("<!doctype html><body></body>");
  page.document.close();
  Object.defineProperty(page, "parent", { configurable: true, value: parent });
  return page;
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => {
  for (const stop of stops.reverse()) stop();
  stops.length = 0;
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

it("returns a seat phone's keys through its checked parents to the host capture, leaving editable fields alone", async () => {
  const origin = arcade.location.origin;
  const host = child(arcade, "");
  const phone = child(
    arcade,
    `aj_preview=1&aj_preview_device=pd_keyboard_1&airjamLocalSeat=Keyboard%201&aj_preview_parent=${encodeURIComponent(origin)}`,
  );
  const topology = resolveRuntimeTopology({
    runtimeMode: "arcade-live",
    surfaceRole: "controller",
    appOrigin: origin,
    backendOrigin: origin,
    publicHost: origin,
    assetBasePath: "/",
    embedded: true,
    embedParentOrigin: origin,
    proxyStrategy: "none",
  });
  const controller = child(
    phone,
    new URLSearchParams({
      aj_room: "ROOM",
      aj_controller_id: "controller-1",
      aj_arcade_epoch: "1",
      aj_arcade_kind: "game",
      aj_arcade_game_id: "game",
      ...runtimeTopologyToQueryParams(topology),
    }).toString(),
  );
  const deliver = (
    page: Window,
    source: Window,
    data: unknown,
    from = origin,
  ) =>
    inPage(page, () =>
      page.dispatchEvent(
        new MessageEvent("message", { source, origin: from, data }),
      ),
    );
  for (const page of [arcade, host, phone, controller]) {
    vi.spyOn(page, "postMessage").mockImplementation((data, targetOrigin) => {
      expect(targetOrigin).toBe(origin);
      const returning =
        data.type === "airjam.local-seat.ready" ||
        data.type === "airjam.local-seat.keyboard";
      const source =
        page === arcade
          ? returning
            ? phone
            : host
          : page === phone
            ? returning
              ? controller
              : arcade
            : page === host
              ? arcade
              : phone;
      queueMicrotask(() => deliver(page, source, data));
    });
  }
  const input = defineAirJamInput({ move: stick() });
  const bindings = defineAirJamInputBindings(input, {
    keyboard: [{ move: wasd() }],
  });
  const controls = new ControllerInput(input, {
    send: () => {},
    requestFrame: () => {},
  });
  const session = {
    id: "phone",
    localSeat: { key: "keyboard-1", label: "Keyboard 1" },
    url: phone.location.href,
  } as PreviewControllerSession;
  const phoneFrame = [...document.querySelectorAll("iframe")].find(
    (frame) => frame.contentWindow === phone,
  )!;
  const hook = renderHook(() =>
    useWorkspaceLocalSeats({
      enabled: true,
      sessions: [session],
      canSpawn: false,
      spawn: vi.fn(),
      remove: vi.fn(),
      frames: new Map([[session.id, phoneFrame]]),
    }),
  );
  stops.push(() => hook.unmount());
  const server = serveLocalSeats({ window: () => host, origin });
  stops.push(() => server.stop());
  const stopRelay = inPage(phone, () =>
    relayLocalSeatInput({ window: () => controller, origin }),
  );
  stops.push(() => inPage(phone, stopRelay));
  const stopController = inPage(controller, () =>
    listenForLocalSeatInput(controls),
  );
  stops.push(() => inPage(controller, stopController));
  await act(async () => {
    server.provide(hook.result.current);
    const stop = inPage(host, () =>
      connectParentSeats({ window: arcade, origin }, {}, (provider) => {
        const stopPlayers = startLocalPlayers(input, bindings, provider);
        stops.push(() => inPage(host, stopPlayers));
      }),
    );
    stops.push(() => inPage(host, stop));
    await settle();
  });
  const key = (
    page: Window,
    kind: "keydown" | "keyup",
    target: EventTarget = page,
  ) =>
    inPage(page, () =>
      target.dispatchEvent(
        new KeyboardEvent(kind, { code: "KeyD", bubbles: true }),
      ),
    );
  await act(async () => {
    key(host, "keydown");
    key(host, "keyup");
    await settle();
  });
  const button = controller.document.createElement("button");
  controller.document.body.append(button);
  await act(async () => {
    key(controller, "keydown", button);
    await settle();
  });
  expect(controls.value("move")).toEqual({ x: 1, y: 0 });
  await act(async () => {
    key(controller, "keyup", button);
    await settle();
  });
  expect(controls.value("move")).toEqual({ x: 0, y: 0 });

  for (const tag of ["input", "textarea", "select", "div"]) {
    const field = controller.document.createElement(tag);
    if (tag === "div") field.setAttribute("contenteditable", "true");
    controller.document.body.append(field);
    await act(async () => {
      key(controller, "keydown", field);
      key(controller, "keyup", field);
      await settle();
    });
    expect(controls.value("move")).toEqual({ x: 0, y: 0 });
  }
  const forged = {
    type: "airjam.local-seat.keyboard",
    event: { kind: "keydown", code: "KeyD", repeat: false },
  };
  await act(async () => {
    deliver(phone, host, forged);
    deliver(phone, controller, forged, "https://wrong.example");
    deliver(arcade, controller, forged);
    deliver(arcade, phone, forged, "https://wrong.example");
    deliver(host, phone, forged);
    deliver(host, arcade, forged, "https://wrong.example");
    await settle();
  });
  expect(controls.value("move")).toEqual({ x: 0, y: 0 });
  await act(async () => {
    key(controller, "keydown", button);
    await settle();
  });
  expect(controls.value("move")).toEqual({ x: 1, y: 0 });
  await act(async () => {
    controller.dispatchEvent(new Event("blur"));
    await settle();
  });
  expect(controls.value("move")).toEqual({ x: 0, y: 0 });
});
