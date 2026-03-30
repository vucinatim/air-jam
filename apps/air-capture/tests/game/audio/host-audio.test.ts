import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHostAudioFacade,
  createRotatingMusicPlayback,
} from "../../../src/game/audio/host-audio";

describe("host audio", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("routes facade calls to the runtime-owned manager", async () => {
    const audio = {
      init: vi.fn(async () => true),
      isMuted: vi.fn(() => false),
      mute: vi.fn(),
      play: vi.fn(() => 11),
      stop: vi.fn(),
    };
    const facade = createHostAudioFacade(audio);

    await facade.init();
    expect(facade.isMuted()).toBe(false);
    expect(facade.play("player_join")).toBe(11);
    facade.mute(true);
    facade.stop("success", 22);

    expect(audio.init).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledWith("player_join", undefined);
    expect(audio.mute).toHaveBeenCalledWith(true);
    expect(audio.stop).toHaveBeenCalledWith("success", 22);
  });

  it("lazy-loads and rotates music tracks deterministically after unlock", () => {
    vi.useFakeTimers();

    const audio = {
      load: vi.fn(),
      play: vi.fn().mockReturnValueOnce(101).mockReturnValueOnce(102),
      stop: vi.fn(),
    };
    const playback = createRotatingMusicPlayback(audio, {
      cycleDurationMs: 10,
      tracks: ["bgm_track_1", "bgm_track_2"],
    });

    playback.sync(true);
    expect(audio.load).toHaveBeenNthCalledWith(1, {
      bgm_track_1: expect.any(Object),
    });
    expect(audio.play).toHaveBeenCalledWith("bgm_track_1", { loop: true });

    vi.advanceTimersByTime(10);
    expect(audio.load).toHaveBeenNthCalledWith(2, {
      bgm_track_2: expect.any(Object),
    });
    expect(audio.play).toHaveBeenNthCalledWith(2, "bgm_track_2", {
      loop: true,
    });

    playback.sync(false);
    expect(audio.stop).toHaveBeenCalledWith("bgm_track_1");
    expect(audio.stop).toHaveBeenCalledWith("bgm_track_2");
  });
});
