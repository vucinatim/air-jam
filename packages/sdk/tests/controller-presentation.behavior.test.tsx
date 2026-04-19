// @vitest-environment jsdom
import {
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/runtime-topology";
import { render, waitFor } from "@testing-library/react";
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

describe("controller presentation sync", () => {
  const originalParent = window.parent;

  afterEach(() => {
    vi.restoreAllMocks();
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
        <SurfaceViewport orientation="landscape" preset="controller-phone">
          Controller
        </SurfaceViewport>
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
});
