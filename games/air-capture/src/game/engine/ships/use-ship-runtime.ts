import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";
import { useEffect, useRef } from "react";
import { Euler, MathUtils, Vector3, type Group } from "three";

import { useSendSignal } from "@air-jam/sdk";
import { useAbilitiesStore } from "../../abilities-store";
import { useHostAudio } from "../../audio/use-host-audio";
import { useGameInput } from "../../hooks/use-game-input";
import { useCaptureTheFlagStore } from "../../stores/match/capture-the-flag-store";
import { useFlightStateStore } from "../../stores/players/flight-state-store";
import { useHealthStore } from "../../stores/players/health-store";
import { usePlayerStatsStore } from "../../stores/players/player-stats-store";
import { useLasersStore } from "../../stores/projectiles/lasers-store";
import { useRocketsStore } from "../../stores/projectiles/rockets-store";
import { stepShipAbility } from "./abilities";
import {
  executeShipEngineAudioTransition,
  resolveShipEngineAudioTransition,
  stopShipEngineAudio,
} from "./audio";
import {
  advanceShipRotation,
  calculateShipPitchVelocity,
  calculateShipVelocity,
  calculateShipVerticalVelocityDelta,
  calculateShipWingRoll,
  calculateShipYawVelocity,
  resolveShipControls,
  smoothShipInput,
  stepAirControlEnergy,
} from "./flight";
import {
  buildShipRespawnPosition,
  getShipDeathPosition,
  scheduleShipRespawn,
  shouldRespawnShip,
} from "./lifecycle";
import {
  applyPendingShipRespawn,
  applyShipPhysics,
  clearTrackedShipPose,
  createShipRuntimeState,
  readShipPhysicsSnapshot,
  updateTrackedShipPose,
} from "./runtime";
import { buildShipLaserShots, shouldFireShipWeapons } from "./weapons";

interface UseShipRuntimeParams {
  controllerId: string;
  rigidBodyRef: React.RefObject<RapierRigidBody | null>;
  planeGroupRef: React.RefObject<Group | null>;
  thrustRef: React.MutableRefObject<number>;
  thrustInputRef: React.MutableRefObject<number>;
  setExplosionPosition(position: [number, number, number] | null): void;
}

export function useShipRuntime({
  controllerId,
  rigidBodyRef,
  planeGroupRef,
  thrustRef,
  thrustInputRef,
  setExplosionPosition,
}: UseShipRuntimeParams) {
  const runtimeRef = useRef(createShipRuntimeState());
  const addLaser = useLasersStore((state) => state.addLaser);
  const abilitiesStore = useAbilitiesStore.getState();
  const playerStatsStore = usePlayerStatsStore.getState();
  const flightStateStore = useFlightStateStore.getState();
  const healthStore = useHealthStore.getState();
  const rocketsStore = useRocketsStore.getState();
  const audio = useHostAudio();
  const sendSignal = useSendSignal();
  const { popInput } = useGameInput();

  useEffect(() => {
    playerStatsStore.initializeStats(controllerId);
    flightStateStore.initializeFlightState(controllerId);
    return () => {
      playerStatsStore.removeStats(controllerId);
      flightStateStore.removeFlightState(controllerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    return () => {
      clearTrackedShipPose(controllerId);
      const nextAudioState = stopShipEngineAudio(
        {
          idleSoundId: runtime.idleSoundId,
          thrustSoundId: runtime.thrustSoundId,
        },
        createAudioDriver(audio),
      );
      runtime.idleSoundId = nextAudioState.idleSoundId;
      runtime.thrustSoundId = nextAudioState.thrustSoundId;
    };
  }, [audio, controllerId]);

  useFrame((state, delta) => {
    if (!rigidBodyRef.current) {
      return;
    }

    const runtime = runtimeRef.current;
    const time = state.clock.elapsedTime;
    const isDeadFrame = healthStore.getIsDead(controllerId);
    const justDied = healthStore.checkDeath(controllerId);
    const audioDriver = createAudioDriver(audio);

    if (isDeadFrame && !justDied) {
      const nextAudioState = stopShipEngineAudio(
        {
          idleSoundId: runtime.idleSoundId,
          thrustSoundId: runtime.thrustSoundId,
        },
        audioDriver,
      );
      runtime.idleSoundId = nextAudioState.idleSoundId;
      runtime.thrustSoundId = nextAudioState.thrustSoundId;

      if (shouldRespawnShip(time, runtime.respawnAt)) {
        const ctfStore = useCaptureTheFlagStore.getState();
        const playerTeam = ctfStore.getPlayerTeam(controllerId);
        if (playerTeam) {
          const basePos = ctfStore.getBasePosition(playerTeam);
          runtime.pendingRespawnPosition = buildShipRespawnPosition(basePos);
          healthStore.respawn(controllerId);
          runtime.respawnAt = 0;
          setExplosionPosition(null);
          console.log(`[SHIP] ${controllerId} respawned at base`);
        }
      }
      return;
    }

    if (runtime.pendingRespawnPosition) {
      try {
        applyPendingShipRespawn(rigidBodyRef.current, runtime);
      } catch (error) {
        console.error(
          `[SHIP] Error applying respawn teleport for ${controllerId}:`,
          error,
        );
        runtime.pendingRespawnPosition = null;
      }
    }

    let physicsSnapshot;
    try {
      physicsSnapshot = readShipPhysicsSnapshot(rigidBodyRef.current);
    } catch (error) {
      console.error(
        `[SHIP] Error accessing RigidBody for ${controllerId}:`,
        error,
      );
      return;
    }

    const {
      position: physicsPos,
      linearVelocity: physicsVel,
      worldPosition: shipWorldPos,
    } = physicsSnapshot;

    const input = popInput(controllerId);
    updateTrackedShipPose(controllerId, shipWorldPos, runtime.rotation);

    if (justDied) {
      const nextAudioState = stopShipEngineAudio(
        {
          idleSoundId: runtime.idleSoundId,
          thrustSoundId: runtime.thrustSoundId,
        },
        audioDriver,
      );
      runtime.idleSoundId = nextAudioState.idleSoundId;
      runtime.thrustSoundId = nextAudioState.thrustSoundId;

      const deathPosition = getShipDeathPosition(shipWorldPos);
      try {
        useCaptureTheFlagStore
          .getState()
          .dropFlagAtPosition(controllerId, deathPosition);
        runtime.respawnAt = scheduleShipRespawn(time);
        setExplosionPosition(deathPosition);
        audio.play("explosion");

        console.log(
          `[SHIP] ${controllerId} died at (${deathPosition[0].toFixed(
            1,
          )}, ${deathPosition[1].toFixed(1)}, ${deathPosition[2].toFixed(1)})`,
        );
      } catch (error) {
        console.error(
          `[SHIP] Error handling death for ${controllerId}:`,
          error,
        );
      }
      return;
    }

    if (!input) {
      return;
    }

    runtime.smoothedInput = smoothShipInput(
      runtime.smoothedInput,
      input.vector,
      delta,
    );

    const currentFlightState = flightStateStore.getFlightState(controllerId);
    const controls = resolveShipControls(
      physicsPos.y,
      physicsVel.y,
      runtime.smoothedInput,
      currentFlightState,
    );
    thrustInputRef.current = controls.thrustInput;

    const nextAudioState = executeShipEngineAudioTransition(
      resolveShipEngineAudioTransition({
        audioState: {
          idleSoundId: runtime.idleSoundId,
          thrustSoundId: runtime.thrustSoundId,
        },
        isThrusting: controls.isThrusting,
        isDead: isDeadFrame,
      }),
      audioDriver,
    );
    runtime.idleSoundId = nextAudioState.idleSoundId;
    runtime.thrustSoundId = nextAudioState.thrustSoundId;

    stepShipAbility({
      controllerId,
      abilityPressed: input.ability,
      wasAbilityPressed: runtime.lastAbilityPressed,
      currentAbility: abilitiesStore.getAbility(controllerId),
      delta,
      activateAbility: (targetId, abilityId) =>
        abilitiesStore.activateAbility(targetId, abilityId),
      getActiveRocketId: (targetId) => rocketsStore.getActiveRocketId(targetId),
      requestDetonateRocket: (id) => rocketsStore.requestDetonateRocket(id),
      updateActiveAbilities: (targetId, stepDelta) =>
        abilitiesStore.updateActiveAbilities(targetId, stepDelta),
      playSound: (sound) => audio.play(sound),
      sendHaptic: (pattern, targetId) =>
        sendSignal?.("HAPTIC", { pattern }, targetId),
      log: (message) => console.log(message),
    });
    runtime.lastAbilityPressed = input.ability ?? false;

    const speedMultiplier = playerStatsStore.getSpeedMultiplier(controllerId);
    const actionPressed = input.action ?? false;
    if (
      shouldFireShipWeapons({
        actionPressed,
        wasActionPressed: runtime.lastActionPressed,
        time,
        lastShotAt: runtime.lastShotAt,
      })
    ) {
      runtime.lastShotAt = time;
      audio.play("laser_fire");
      sendSignal?.("HAPTIC", { pattern: "light" }, controllerId);

      for (const shot of buildShipLaserShots({
        controllerId,
        shipWorldPosition: shipWorldPos,
        shipRotation: runtime.rotation,
        time,
      })) {
        addLaser(shot);
      }
    }
    runtime.lastActionPressed = actionPressed;

    const forward = new Vector3(0, 0, -1).applyQuaternion(runtime.rotation);
    const newVelocity = calculateShipVelocity(
      new Vector3(physicsVel.x, physicsVel.y, physicsVel.z),
      forward,
      controls.thrustInput,
      speedMultiplier,
      delta,
      controls.isInAir,
    );
    runtime.velocity.copy(newVelocity);

    const newYawVel = calculateShipYawVelocity(
      runtime.angularVelocity,
      controls.turnInput,
      delta,
    );
    runtime.angularVelocity = newYawVel;

    const newPitchVel = calculateShipPitchVelocity(
      controls.isInAir,
      physicsPos.y,
      runtime.rotation,
      runtime.pitchAngularVelocity,
      controls.pitchInput,
      delta,
    );
    runtime.pitchAngularVelocity = newPitchVel;

    runtime.rotation.copy(
      advanceShipRotation(
        runtime.rotation,
        newYawVel,
        newPitchVel,
        controls.isInAir,
        delta,
      ),
    );

    const currentEuler = new Euler().setFromQuaternion(runtime.rotation, "YXZ");
    const nextFlightState = stepAirControlEnergy(
      currentFlightState,
      controls,
      currentEuler.x,
      delta,
    );
    flightStateStore.setFlightState(controllerId, nextFlightState);
    const forwardSpeed = Math.max(0, newVelocity.dot(forward));
    const finalVelocity = newVelocity.clone();
    finalVelocity.y += calculateShipVerticalVelocityDelta(
      controls.isInAir,
      physicsPos.y,
      newVelocity.y,
      currentEuler.x,
      forwardSpeed,
      delta,
    );

    try {
      applyShipPhysics(rigidBodyRef.current, finalVelocity, runtime.rotation);
    } catch (error) {
      console.error(`[SHIP] Error applying physics to ${controllerId}:`, error);
      return;
    }

    updateTrackedShipPose(controllerId, shipWorldPos, runtime.rotation);

    runtime.wingRoll = calculateShipWingRoll(
      runtime.wingRoll,
      controls.turnInput,
      delta,
    );
    if (planeGroupRef.current) {
      planeGroupRef.current.rotation.z = runtime.wingRoll;
    }

    thrustRef.current = MathUtils.lerp(
      thrustRef.current,
      controls.targetThrustVisual,
      0.15,
    );
  });
}

function createAudioDriver(audio: ReturnType<typeof useHostAudio>) {
  return {
    play: (sound: "engine_idle" | "engine_thrust") => audio.play(sound),
    stop: (sound: "engine_idle" | "engine_thrust", soundId: number) =>
      audio.stop(sound, soundId),
  };
}
