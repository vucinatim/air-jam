// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { PreviewControllerSession } from "../src/preview/manager";
import { PreviewControllerWindow } from "../src/preview/window";

const session = (minimized: boolean): PreviewControllerSession => ({
  id: "session-1",
  ordinal: 1,
  label: "Keyboard 1",
  localSeat: { key: "keyboard-1", label: "Keyboard 1" },
  controllerId: "controller-1",
  deviceId: "device-1",
  url: "http://localhost:3000/controller?room=ABCD",
  surfaceState: "ready",
  orientation: "portrait",
  minimized,
  active: true,
  x: 0,
  y: 0,
  width: 240,
  height: 480,
  viewportWidth: 393,
  viewportHeight: 740,
  displayScale: 0.6,
  zIndex: 1,
});

const show = (minimized: boolean) => {
  const handler = vi.fn();
  return render(
    <PreviewControllerWindow
      session={session(minimized)}
      activeOpacity={1}
      onFocus={handler}
      onMinimize={handler}
      onRemove={handler}
      onRotate={handler}
      onReady={handler}
      onFailed={handler}
      onTitlePointerDown={handler}
      onTitlePointerMove={handler}
      onTitlePointerUp={handler}
      onTitlePointerCancel={handler}
      onResizePointerDown={handler}
      onResizePointerMove={handler}
      onResizePointerUp={handler}
      onResizePointerCancel={handler}
    />,
  );
};

it("keeps a minimized phone's controller playing, out of sight", () => {
  const { container } = show(true);
  const frame = container.querySelector("iframe");
  expect(frame).not.toBeNull();
  expect((container.firstElementChild as HTMLElement).hidden).toBe(true);
});

it("shows an open phone", () => {
  const { container } = show(false);
  expect((container.firstElementChild as HTMLElement).hidden).toBe(false);
});
