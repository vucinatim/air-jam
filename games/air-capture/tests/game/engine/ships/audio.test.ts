import { describe, expect, it } from "vitest";
import { resolveShipEngineAudioTransition } from "../../../../src/game/engine/ships/audio";

describe("air-capture ship audio engine", () => {
  it("switches cleanly from idle to thrust audio", () => {
    const transition = resolveShipEngineAudioTransition({
      audioState: {
        idleSoundId: 11,
        thrustSoundId: null,
      },
      isThrusting: true,
      isDead: false,
    });

    expect(transition.actions).toEqual([
      {
        type: "stop",
        sound: "engine_idle",
        soundId: 11,
      },
      {
        type: "start",
        sound: "engine_thrust",
      },
    ]);
  });

  it("kills all engine sounds while dead", () => {
    const transition = resolveShipEngineAudioTransition({
      audioState: {
        idleSoundId: 11,
        thrustSoundId: 12,
      },
      isThrusting: true,
      isDead: true,
    });

    expect(transition.nextState).toEqual({
      idleSoundId: null,
      thrustSoundId: null,
    });
    expect(transition.actions).toHaveLength(2);
  });
});
