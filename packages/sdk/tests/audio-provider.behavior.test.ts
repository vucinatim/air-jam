// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HostSessionProvider } from "../src/context/session-providers";

const howlerCtx = {
  state: "running" as "running" | "suspended",
  resume: vi.fn(async () => {
    howlerCtx.state = "running";
  }),
};

vi.mock("howler", () => ({
  Howl: class MockHowl {
    play = vi.fn(() => 1);
    volume = vi.fn();
    loop = vi.fn();
    rate = vi.fn();
    once = vi.fn();
    stop = vi.fn();
    pos = vi.fn();
    pannerAttr = vi.fn();
    mute = vi.fn();
  },
  Howler: {
    ctx: howlerCtx,
    stop: vi.fn(),
    volume: vi.fn(),
    mute: vi.fn(),
    pos: vi.fn(),
    orientation: vi.fn(),
  },
}));

const mocked = vi.hoisted(() => ({
  useAirJamContext: vi.fn(),
}));

vi.mock("../src/context/air-jam-context", async () => {
  const actual =
    await vi.importActual<typeof import("../src/context/air-jam-context")>(
      "../src/context/air-jam-context",
    );

  return {
    ...actual,
    useAirJamContext: mocked.useAirJamContext,
  };
});

const manifest = {
  hit: { src: ["/sounds/hit.wav"] },
};

const createWrapper = async () => {
  const hooks = await import("../src/audio/hooks");
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      HostSessionProvider,
      null,
      createElement(hooks.AudioRuntime, { manifest, children }),
    );

  return { hooks, wrapper };
};

describe("AudioRuntime", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    howlerCtx.state = "running";
    mocked.useAirJamContext.mockReturnValue({
      getSocket: () => null,
      store: {
        getState: () => ({ role: "host", roomId: "room-1" }),
        subscribe: () => () => {},
      },
    });
  });

  it("returns the runtime-owned manager to consumers", async () => {
    const { hooks, wrapper } = await createWrapper();
    const { result } = renderHook(() => hooks.useAudio<"hit">(), {
      wrapper,
    });
    await act(async () => {});

    expect(typeof result.current.play).toBe("function");
  });

  it("throws outside an audio runtime", async () => {
    const hooks = await import("../src/audio/hooks");
    expect(() => renderHook(() => hooks.useAudio())).toThrow(
      "useAudio must be used within an AudioRuntime or ControllerRemoteAudioRuntime",
    );
  });

  it("exposes blocked and ready runtime states with an explicit retry path", async () => {
    howlerCtx.state = "suspended";
    howlerCtx.resume.mockImplementationOnce(async () => {
      throw new Error("blocked");
    });
    howlerCtx.resume.mockImplementationOnce(async () => {
      howlerCtx.state = "running";
    });

    const { hooks, wrapper } = await createWrapper();
    const runtime = renderHook(
      () => ({
        status: hooks.useAudioRuntimeStatus(),
        controls: hooks.useAudioRuntimeControls(),
      }),
      {
        wrapper,
      },
    );

    await waitFor(() => {
      expect(runtime.result.current.status).toBe("blocked");
    });

    await act(async () => {
      await runtime.result.current.controls.retry();
    });

    await waitFor(() => {
      expect(runtime.result.current.status).toBe("ready");
    });
  });
});
