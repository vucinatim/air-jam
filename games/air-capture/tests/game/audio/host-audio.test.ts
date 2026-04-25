import { describe, expect, it, vi } from "vitest";
import { createHostAudioFacade } from "../../../src/game/audio/host-audio-playback";

describe("host audio", () => {
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
});
