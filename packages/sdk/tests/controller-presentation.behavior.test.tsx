// @vitest-environment jsdom
import {
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/runtime-topology";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionScopeContext } from "../src/context/session-scope";
import {
  AIRJAM_CONTROLLER_PRESENTATION_SYNC,
  parseControllerPresentationSyncMessage,
} from "../src/runtime/controller-bridge";
import { publishEmbeddedControllerPresentation } from "../src/runtime/controller-presentation";
import { SurfaceViewport } from "../src/ui";

const setEmbeddedControllerUrl = () => {
  const topology = resolveRuntimeTopology({
    runtimeMode: "arcade-live",
    surfaceRole: "controller",
    appOrigin: window.location.origin,
    backendOrigin: window.location.origin,
    publicHost: window.location.origin,
    assetBasePath: "/",
    embedded: true,
    embedParentOrigin: "https://platform.example",
    proxyStrategy: "none",
  });
  const params = new URLSearchParams({
    aj_room: "ROOM",
    aj_controller_id: "controller-1",
    aj_arcade_epoch: "7",
    aj_arcade_kind: "game",
    aj_arcade_game_id: "air-capture",
    ...runtimeTopologyToQueryParams(topology),
  });

  window.history.replaceState(null, "", `/controller?${params.toString()}`);
};

const installParentPostMessageSpy = () => {
  const postMessage = vi.fn();
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: {
      postMessage,
    },
  });
  return postMessage;
};

const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
};

describe("controller presentation sync", () => {
  const originalParent = window.parent;

  afterEach(() => {
    vi.restoreAllMocks();
    setViewportSize(1024, 768);
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: originalParent,
    });
    window.history.replaceState(null, "", "/");
  });

  it("publishes embedded controller orientation to the Arcade parent", () => {
    setEmbeddedControllerUrl();
    const postMessage = installParentPostMessageSpy();

    publishEmbeddedControllerPresentation("landscape");

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: AIRJAM_CONTROLLER_PRESENTATION_SYNC,
        payload: {
          orientation: "landscape",
          arcadeSurface: {
            epoch: 7,
            kind: "game",
            gameId: "air-capture",
          },
        },
      },
      "https://platform.example",
    );
    expect(
      parseControllerPresentationSyncMessage(postMessage.mock.calls[0]?.[0]),
    ).not.toBeNull();
  });

  it("is a no-op outside an embedded controller iframe", () => {
    const postMessage = vi.spyOn(window.parent, "postMessage");

    publishEmbeddedControllerPresentation("landscape");

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("lets controller SurfaceViewport drive the embedded Arcade presentation", async () => {
    setEmbeddedControllerUrl();
    const postMessage = installParentPostMessageSpy();

    render(
      <SessionScopeContext.Provider value="controller">
        <SurfaceViewport orientation="landscape">Controller</SurfaceViewport>
      </SessionScopeContext.Provider>,
    );

    await waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AIRJAM_CONTROLLER_PRESENTATION_SYNC,
          payload: expect.objectContaining({
            orientation: "landscape",
          }),
        }),
        "https://platform.example",
      );
    });
  });

  it("keeps controller scale stable during keyboard-like input focus resize", async () => {
    setViewportSize(412, 915);

    const { container, getByLabelText } = render(
      <SessionScopeContext.Provider value="controller">
        <SurfaceViewport orientation="portrait">
          <label htmlFor="name">Name</label>
          <input id="name" />
        </SurfaceViewport>
      </SessionScopeContext.Provider>,
    );

    const viewport = container.querySelector<HTMLElement>(
      "[data-airjam-surface-viewport]",
    );

    await waitFor(() => {
      expect(viewport?.style.getPropertyValue("--airjam-ui-scale")).toBe("1");
    });

    getByLabelText("Name").focus();
    setViewportSize(412, 520);
    fireEvent(window, new Event("resize"));

    expect(viewport?.style.getPropertyValue("--airjam-ui-scale")).toBe("1");
  });

  it("keeps portrait controller scale stable when mobile browser chrome changes height", async () => {
    setViewportSize(360, 640);

    const { container } = render(
      <SessionScopeContext.Provider value="controller">
        <SurfaceViewport orientation="portrait">Controller</SurfaceViewport>
      </SessionScopeContext.Provider>,
    );

    const viewport = container.querySelector<HTMLElement>(
      "[data-airjam-surface-viewport]",
    );
    const expectedScale = String(360 / 412);

    await waitFor(() => {
      expect(viewport?.style.getPropertyValue("--airjam-ui-scale")).toBe(
        expectedScale,
      );
    });

    setViewportSize(360, 780);
    fireEvent(window, new Event("resize"));

    expect(viewport?.style.getPropertyValue("--airjam-ui-scale")).toBe(
      expectedScale,
    );
  });
});
