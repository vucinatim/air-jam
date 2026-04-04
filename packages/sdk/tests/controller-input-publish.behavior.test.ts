// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";
import { useControllerTick } from "../src/hooks/use-controller-tick";
import { useInputWriter } from "../src/hooks/use-input-writer";

const mocked = vi.hoisted(() => {
  const state = {
    roomId: "ROOM1",
    controllerId: "ctrl_1",
  };

  const socket = {
    connected: true,
    emit: vi.fn(),
  };

  return {
    state,
    socket,
    useAirJamContext: vi.fn(),
    useAssertSessionScope: vi.fn(),
  };
});

vi.mock("../src/context/air-jam-context", () => ({
  useAirJamContext: mocked.useAirJamContext,
}));

vi.mock("../src/context/session-providers", () => ({
  useAssertSessionScope: mocked.useAssertSessionScope,
}));

describe("controller input publishing", () => {
  beforeEach(() => {
    resetAirJamDiagnosticsForTests();
    setAirJamDiagnosticsEnabled(true);
    vi.useFakeTimers();
    mocked.socket.connected = true;
    mocked.socket.emit.mockReset();
    mocked.state.roomId = "ROOM1";
    mocked.state.controllerId = "ctrl_1";

    mocked.useAirJamContext.mockReturnValue({
      store: {
        getState: () => mocked.state,
      },
      getSocket: () => mocked.socket,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetAirJamDiagnosticsForTests();
  });

  it("publishes controller input at a fixed tick cadence via useControllerTick + useInputWriter", () => {
    const { unmount } = renderHook(() => {
      const writeInput = useInputWriter();

      useControllerTick(
        () => {
          writeInput({
            vector: { x: 0, y: 0 },
            action: false,
          });
        },
        { intervalMs: 10 },
      );
    });

    act(() => {
      vi.advanceTimersByTime(35);
    });

    expect(mocked.socket.emit).toHaveBeenCalled();
    const firstEmit = mocked.socket.emit.mock.calls[0];
    expect(firstEmit[0]).toBe("controller:input");
    expect(firstEmit[1]).toEqual({
      roomId: "ROOM1",
      controllerId: "ctrl_1",
      input: {
        vector: { x: 0, y: 0 },
        action: false,
      },
    });
    expect(
      mocked.socket.emit.mock.calls.some(
        (call: unknown[]) => call[0] === "controller:action_rpc",
      ),
    ).toBe(false);

    const callsBeforeUnmount = mocked.socket.emit.mock.calls.length;
    unmount();
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(mocked.socket.emit.mock.calls.length).toBe(callsBeforeUnmount);
  });

  it("rejects non-serializable input payloads", () => {
    const diagnosticCodes: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      diagnosticCodes.push(diagnostic.code);
    });

    const { result } = renderHook(() => useInputWriter());

    const accepted = result.current({
      action: true,
      bad: () => "not-serializable",
    });

    expect(accepted).toBe(false);
    expect(mocked.socket.emit).not.toHaveBeenCalled();
    expect(diagnosticCodes).toContain("AJ_INPUT_WRITER_NOT_SERIALIZABLE");
    unsubscribe();
  });
});
