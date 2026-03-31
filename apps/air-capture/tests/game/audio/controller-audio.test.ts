import { describe, expect, it, vi } from "vitest";
import { createControllerAudioFacade } from "../../../src/game/audio/controller-audio-facade";

describe("controller audio", () => {
  it("routes facade calls to the runtime-owned manager", async () => {
    const audio = {
      init: vi.fn(async () => true),
      isMuted: vi.fn(() => false),
      mute: vi.fn(),
      play: vi.fn(() => 21),
      stop: vi.fn(),
    };
    const facade = createControllerAudioFacade(audio);

    await facade.init();
    expect(facade.isMuted()).toBe(false);
    expect(facade.play("success")).toBe(21);
    facade.mute(true);
    facade.stop("laser", 22);

    expect(audio.init).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledWith("success", undefined);
    expect(audio.mute).toHaveBeenCalledWith(true);
    expect(audio.stop).toHaveBeenCalledWith("laser", 22);
  });
});
