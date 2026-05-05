// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHostAudioMutePreference } from "../src/hooks/use-host-audio-mute-preference";

const getStorageKey = (scope: string) => `air-jam-host-audio-muted:${scope}`;

describe("useHostAudioMutePreference", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads an existing persisted preference on mount", () => {
    window.localStorage.setItem(getStorageKey("air-capture"), "true");

    const { result } = renderHook(() =>
      useHostAudioMutePreference("air-capture"),
    );

    expect(result.current.muted).toBe(true);
  });

  it("persists toggle updates", () => {
    const { result } = renderHook(() =>
      useHostAudioMutePreference("code-review"),
    );

    act(() => {
      result.current.toggleMuted();
    });

    expect(result.current.muted).toBe(true);
    expect(window.localStorage.getItem(getStorageKey("code-review"))).toBe(
      "true",
    );
  });

  it("isolates preferences by game scope", () => {
    const airCapture = renderHook(() =>
      useHostAudioMutePreference("air-capture"),
    );
    const office = renderHook(() => useHostAudioMutePreference("the-office"));

    act(() => {
      airCapture.result.current.toggleMuted();
    });

    expect(airCapture.result.current.muted).toBe(true);
    expect(office.result.current.muted).toBe(false);
  });

  it("reacts to localStorage changes from another tab", async () => {
    const { result } = renderHook(() =>
      useHostAudioMutePreference("last-band-standing"),
    );

    act(() => {
      window.localStorage.setItem(
        getStorageKey("last-band-standing"),
        "true",
      );
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getStorageKey("last-band-standing"),
          newValue: "true",
          storageArea: window.localStorage,
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.muted).toBe(true);
    });
  });
});
