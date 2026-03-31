import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHostAudioFacade,
  createHostMusicDriver,
  createRotatingMusicPlayback,
} from "../../../src/game/audio/host-audio-playback";

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

  it("rotates music tracks deterministically after unlock", async () => {
    vi.useFakeTimers();

    const audio = {
      play: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true),
      stop: vi.fn(),
      setMuted: vi.fn(),
      destroy: vi.fn(),
    };
    const playback = createRotatingMusicPlayback(audio, {
      cycleDurationMs: 10,
      tracks: ["bgm_track_1", "bgm_track_2"],
    });

    playback.sync(true);
    await Promise.resolve();
    expect(audio.play).toHaveBeenNthCalledWith(1, "bgm_track_1");

    await vi.advanceTimersByTimeAsync(10);
    expect(audio.play).toHaveBeenNthCalledWith(2, "bgm_track_2");

    playback.sync(false);
    expect(audio.stop).toHaveBeenCalledWith("bgm_track_1");
    expect(audio.stop).toHaveBeenCalledWith("bgm_track_2");
  });

  it("applies platform music settings to host music playback volume", () => {
    const created: Array<{
      src: string;
      loop: boolean;
      preload: string;
      muted: boolean;
      volume: number;
      currentTime: number;
      play: () => Promise<void>;
      pause: () => void;
    }> = [];

    const driver = createHostMusicDriver((src) => {
      const element = {
        src,
        loop: false,
        preload: "none",
        muted: false,
        volume: 1,
        currentTime: 0,
        play: vi.fn(async () => undefined),
        pause: vi.fn(),
      };
      created.push(element);
      return element as unknown as HTMLAudioElement;
    });
    driver.applyPlatformAudioSettings({
      masterVolume: 0.5,
      musicVolume: 0.25,
      sfxVolume: 1,
    });

    void driver.play("bgm_track_1");
    expect(created).toHaveLength(1);
    expect(created[0]?.volume).toBeCloseTo(0.05);

    driver.destroy();
  });
});
