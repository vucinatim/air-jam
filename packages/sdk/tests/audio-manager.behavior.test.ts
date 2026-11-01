// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const howlPlay = vi.fn(() => 101);
  const howlVolume = vi.fn();
  const howlLoop = vi.fn();
  const howlRate = vi.fn();
  const howlOnce = vi.fn();
  const howlStop = vi.fn();
  const howlFade = vi.fn();
  const howlPos = vi.fn();
  const howlPannerAttr = vi.fn();
  const howlMute = vi.fn();

  const instances: MockHowl[] = [];

  class MockHowl {
    unload = vi.fn();
    play = howlPlay;
    volume = howlVolume;
    loop = howlLoop;
    rate = howlRate;
    once = howlOnce;
    stop = howlStop;
    fade = howlFade;
    pos = howlPos;
    pannerAttr = howlPannerAttr;
    mute = howlMute;

    constructor(_config: unknown) {
      instances.push(this);
    }
  }

  const howler = {
    ctx: {
      state: "suspended" as "suspended" | "running",
      resume: vi.fn(),
    },
    stop: vi.fn(),
    volume: vi.fn(),
    mute: vi.fn(),
    pos: vi.fn(),
    orientation: vi.fn(),
  };

  return {
    MockHowl,
    instances,
    howler,
    howlPlay,
    howlVolume,
    howlLoop,
    howlOnce,
    howlStop,
    howlFade,
  };
});

vi.mock("howler", () => ({
  Howl: mocked.MockHowl,
  Howler: mocked.howler,
}));

import { AudioManager } from "../src/audio/audio-manager";

describe("AudioManager", () => {
  beforeEach(() => {
    mocked.howler.ctx.state = "suspended";
    mocked.howler.ctx.resume.mockReset();
    mocked.howlPlay.mockReset();
    mocked.howlVolume.mockReset();
    mocked.howlLoop.mockReset();
    mocked.howlOnce.mockReset();
    mocked.howlStop.mockReset();
    mocked.howlFade.mockReset();
    mocked.instances.length = 0;
    vi.useRealTimers();
  });

  it("drops local playback while the audio context is still suspended", () => {
    const audio = new AudioManager({
      hit: { src: ["/sounds/hit.wav"] },
    });

    expect(audio.play("hit")).toBeNull();
    expect(mocked.howler.ctx.resume).toHaveBeenCalledTimes(1);
    expect(mocked.howlPlay).not.toHaveBeenCalled();
  });

  it("plays normally once the audio context is running", () => {
    mocked.howler.ctx.state = "running";

    const audio = new AudioManager({
      hit: { src: ["/sounds/hit.wav"], volume: 0.5 },
    });

    expect(audio.play("hit")).toBe(101);
    expect(mocked.howlPlay).toHaveBeenCalledTimes(1);
    expect(mocked.howlVolume).toHaveBeenCalled();
  });

  it("recomputes loaded sound volume from platform settings", () => {
    mocked.howler.ctx.state = "running";

    const audio = new AudioManager({
      hit: { src: ["/sounds/hit.wav"], volume: 0.5 },
      music: {
        src: ["/sounds/music.mp3"],
        volume: 0.75,
        category: "music",
      },
    });

    audio.applyPlatformAudioSettings({
      masterVolume: 0.4,
      musicVolume: 0.5,
      sfxVolume: 0.25,
    });

    expect(mocked.howlVolume).toHaveBeenNthCalledWith(1, 0.05);
    expect(mocked.howlVolume).toHaveBeenNthCalledWith(
      2,
      expect.closeTo(0.15, 5),
    );
  });

  it("unloads every owned sound and clears playback and manifest bookkeeping", () => {
    mocked.howler.ctx.state = "running";
    const audio = new AudioManager({
      hit: { src: ["/sounds/hit.wav"], volume: 0.5, category: "music" },
    });
    audio.load({ score: { src: ["/sounds/score.wav"] } });
    audio.play("hit");
    const ownedSounds = [...mocked.instances];
    const otherAudio = new AudioManager({
      ambient: { src: ["/sounds/ambient.wav"] },
    });
    const otherSound = mocked.instances[2];

    audio.destroy();
    audio.destroy();

    for (const sound of ownedSounds) {
      expect(sound.unload).toHaveBeenCalledTimes(1);
    }
    expect(otherSound.unload).not.toHaveBeenCalled();
    expect(audio.getCategory("hit")).toBe("sfx");

    mocked.howlVolume.mockClear();
    audio.applyPlatformAudioSettings({
      masterVolume: 1,
      musicVolume: 1,
      sfxVolume: 1,
    });
    expect(mocked.howlVolume).not.toHaveBeenCalled();

    audio.load({ hit: { src: ["/sounds/new-hit.wav"] } });
    expect(mocked.instances).toHaveLength(4);
    mocked.howlVolume.mockClear();
    expect(audio.play("hit")).toBe(101);
    expect(mocked.howlVolume).toHaveBeenCalledExactlyOnceWith(1, 101);
    audio.destroy();
    otherAudio.destroy();
  });

  it("fades in local playback when requested", () => {
    mocked.howler.ctx.state = "running";

    const audio = new AudioManager({
      music: {
        src: ["/sounds/music.mp3"],
        volume: 0.5,
        category: "music",
      },
    });

    expect(audio.play("music", { fadeInMs: 300 })).toBe(101);

    expect(mocked.howlVolume).toHaveBeenCalledWith(0, 101);
    expect(mocked.howlFade).toHaveBeenCalledWith(0, 0.4, 300, 101);
  });

  it("fades out before stopping an active playback id", () => {
    vi.useFakeTimers();
    mocked.howler.ctx.state = "running";

    const audio = new AudioManager({
      music: {
        src: ["/sounds/music.mp3"],
        volume: 0.5,
        category: "music",
      },
    });

    const soundId = audio.play("music");
    expect(soundId).toBe(101);

    audio.fadeOutAndStop("music", 101, 250);

    expect(mocked.howlFade).toHaveBeenCalledWith(0.4, 0, 250, 101);
    expect(mocked.howlStop).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);

    expect(mocked.howlStop).toHaveBeenCalledWith(101);
  });
});
