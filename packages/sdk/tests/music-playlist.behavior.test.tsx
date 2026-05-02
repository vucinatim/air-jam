// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  audio: {
    fadeOutAndStop: vi.fn(),
    play: vi.fn(() => 101 as number | null),
  },
  platformSettingsStatus: "ready" as "ready" | "waiting",
  status: "ready" as "idle" | "blocked" | "ready",
}));

vi.mock("../src/audio/hooks", () => ({
  useAudio: () => mocked.audio,
  useAudioRuntimeStatus: () => mocked.status,
}));

vi.mock("../src/settings/platform-settings-runtime", () => ({
  usePlatformSettingsRuntimeStatus: () => mocked.platformSettingsStatus,
  useResolvedPlatformSettingsSnapshot: () => ({
    audio: {
      masterVolume: 0.5,
      musicVolume: 0.25,
      sfxVolume: 0.8,
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
    },
    feedback: {
      hapticsEnabled: true,
    },
    previewControllers: {
      activeOpacity: 1,
    },
  }),
}));

import {
  MusicPlaylist,
  useAudioCategoryVolume,
  useMusicVolume,
} from "../src/audio/music";

describe("MusicPlaylist", () => {
  beforeEach(() => {
    mocked.audio.fadeOutAndStop.mockReset();
    mocked.audio.play.mockReset();
    mocked.audio.play.mockReturnValue(101);
    mocked.platformSettingsStatus = "ready";
    mocked.status = "ready";
  });

  it("starts the first track while the runtime is ready", () => {
    render(
      <MusicPlaylist
        fadeMs={250}
        playing
        tracks={["track-one", "track-two"]}
      />,
    );

    expect(mocked.audio.play).toHaveBeenCalledWith("track-one", {
      fadeInMs: 250,
      loop: false,
      onEnd: expect.any(Function),
    });
  });

  it("advances to the next sequence track when the current track ends", () => {
    render(
      <MusicPlaylist
        fadeMs={250}
        playing
        tracks={["track-one", "track-two"]}
      />,
    );

    const playOptions = mocked.audio.play.mock.calls[0]?.[1];
    act(() => {
      playOptions?.onEnd?.(101);
    });

    expect(mocked.audio.play).toHaveBeenNthCalledWith(2, "track-two", {
      fadeInMs: 250,
      loop: false,
      onEnd: expect.any(Function),
    });
  });

  it("fades out the active track on unmount", () => {
    const { unmount } = render(
      <MusicPlaylist fadeMs={250} playing tracks={["track-one"]} />,
    );

    unmount();

    expect(mocked.audio.fadeOutAndStop).toHaveBeenCalledWith(
      "track-one",
      101,
      250,
    );
  });

  it("returns effective platform volume for external media adapters", () => {
    const VolumeProbe = () => (
      <output>
        {useAudioCategoryVolume("master")}:{useMusicVolume()}:
        {useAudioCategoryVolume("sfx")}
      </output>
    );

    const { container } = render(<VolumeProbe />);

    expect(container.textContent).toBe("0.5:0.125:0.4");
  });

  it("returns silence for external media while inherited settings are waiting", () => {
    mocked.platformSettingsStatus = "waiting";

    const VolumeProbe = () => <output>{useMusicVolume()}</output>;

    const { container } = render(<VolumeProbe />);

    expect(container.textContent).toBe("0");
  });
});
