export type ShipEngineSound = "engine_idle" | "engine_thrust";

export interface ShipEngineAudioState {
  idleSoundId: number | null;
  thrustSoundId: number | null;
}

export interface ShipEngineAudioAction {
  type: "start" | "stop";
  sound: ShipEngineSound;
  soundId?: number;
}

export interface ShipEngineAudioTransition {
  actions: ShipEngineAudioAction[];
  nextState: ShipEngineAudioState;
}

export interface ShipEngineAudioDriver {
  play(sound: ShipEngineSound): number | null;
  stop(sound: ShipEngineSound, soundId: number): void;
}

export function resolveShipEngineAudioTransition(params: {
  audioState: ShipEngineAudioState;
  isThrusting: boolean;
  isDead: boolean;
}): ShipEngineAudioTransition {
  const { audioState, isThrusting, isDead } = params;
  const actions: ShipEngineAudioAction[] = [];
  const nextState: ShipEngineAudioState = { ...audioState };

  if (isDead) {
    if (audioState.idleSoundId !== null) {
      actions.push({
        type: "stop",
        sound: "engine_idle",
        soundId: audioState.idleSoundId,
      });
    }

    if (audioState.thrustSoundId !== null) {
      actions.push({
        type: "stop",
        sound: "engine_thrust",
        soundId: audioState.thrustSoundId,
      });
    }

    return {
      actions,
      nextState: {
        idleSoundId: null,
        thrustSoundId: null,
      },
    };
  }

  if (isThrusting) {
    if (audioState.idleSoundId !== null) {
      actions.push({
        type: "stop",
        sound: "engine_idle",
        soundId: audioState.idleSoundId,
      });
      nextState.idleSoundId = null;
    }

    if (audioState.thrustSoundId === null) {
      actions.push({
        type: "start",
        sound: "engine_thrust",
      });
    }
  } else {
    if (audioState.thrustSoundId !== null) {
      actions.push({
        type: "stop",
        sound: "engine_thrust",
        soundId: audioState.thrustSoundId,
      });
      nextState.thrustSoundId = null;
    }

    if (audioState.idleSoundId === null) {
      actions.push({
        type: "start",
        sound: "engine_idle",
      });
    }
  }

  return { actions, nextState };
}

export function executeShipEngineAudioTransition(
  transition: ShipEngineAudioTransition,
  driver: ShipEngineAudioDriver,
): ShipEngineAudioState {
  const nextState = { ...transition.nextState };

  for (const action of transition.actions) {
    if (action.type === "start") {
      const soundId = driver.play(action.sound);
      if (action.sound === "engine_idle") {
        nextState.idleSoundId = soundId;
      } else {
        nextState.thrustSoundId = soundId;
      }
      continue;
    }

    if (action.soundId !== undefined) {
      driver.stop(action.sound, action.soundId);
    }
  }

  return nextState;
}

export function stopShipEngineAudio(
  audioState: ShipEngineAudioState,
  driver: ShipEngineAudioDriver,
): ShipEngineAudioState {
  if (audioState.idleSoundId !== null) {
    driver.stop("engine_idle", audioState.idleSoundId);
  }

  if (audioState.thrustSoundId !== null) {
    driver.stop("engine_thrust", audioState.thrustSoundId);
  }

  return {
    idleSoundId: null,
    thrustSoundId: null,
  };
}
