// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useArcadeRuntimeManager } from "./arcade-runtime-manager";

it("applies consecutive commands and the launch lock before React commits", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  let runtime: ReturnType<typeof useArcadeRuntimeManager> | undefined;
  const Harness = () => {
    const current = useArcadeRuntimeManager({
      mode: "arcade",
      games: [
        {
          id: "one",
          name: "One",
          url: "https://one.test",
          controllerUrl: "https://one.test/controller",
        },
        {
          id: "two",
          name: "Two",
          url: "https://two.test",
          controllerUrl: "https://two.test/controller",
        },
        {
          id: "three",
          name: "Three",
          url: "https://three.test",
          controllerUrl: "https://three.test/controller",
        },
      ],
    });
    useEffect(() => {
      runtime = current;
    }, [current]);
    return null;
  };
  try {
    act(() => root.render(createElement(Harness)));
    act(() => {
      runtime!.moveSelection("right", 3);
      runtime!.moveSelection("right", 3);
      expect(runtime!.stateRef.current.selectedIndex).toBe(2);
      expect(runtime!.beginLaunch()).toBe(true);
      expect(runtime!.beginLaunch()).toBe(false);
    });
    expect(runtime!.state).toBe(runtime!.stateRef.current);
    expect(runtime!.selectedGame?.id).toBe("three");
    act(() => {
      runtime!.failLaunch();
      expect(runtime!.stateRef.current.launchFailed).toBe(true);
      expect(runtime!.beginLaunch()).toBe(true);
      runtime!.completeLaunch({
        normalizedGameUrl: "https://three.test",
        launchCapability: { token: "test", expiresAt: 20_000 },
      });
      expect(runtime!.beginLaunch()).toBe(false);
      runtime!.exitGame();
      expect(runtime!.stateRef.current.launchCapability).toBeNull();
      expect(runtime!.stateRef.current.isLaunching).toBe(false);
    });
    expect(runtime!.state).toBe(runtime!.stateRef.current);
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
