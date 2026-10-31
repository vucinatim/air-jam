import { useSimulationFrame, useSimulationSelector } from "@air-jam/sdk";
import { memo, useEffect, useMemo, useRef } from "react";
import { MeshBasicMaterial, SphereGeometry, type Group } from "three";
import { useHostAudio } from "../../audio/use-host-audio";
import {
  executeShipEngineAudioTransition,
  resolveShipEngineAudioTransition,
  stopShipEngineAudio,
  type ShipEngineAudioState,
} from "../../engine/ships/audio";
import { AirCaptureShipVisual } from "../../prefabs/ship";
import { isMatchActive } from "../../simulation/match";
import { SHIP_COLLIDER_CENTER_Y } from "../../simulation/physics";
import type { AirCaptureSim } from "../../simulation/state";
import { useDebugStore } from "../../stores/debug/debug-store";
import { airCaptureTheme } from "../../theme";
import { AbilityVisual } from "./ability-visual";

const SHIP_GAMEPLAY_HITBOX_RADIUS = 3.8;

/** Draws one ship where the simulation flies it, with its engine sound. */
function ShipComponent({ controllerId }: { controllerId: string }) {
  const groupRef = useRef<Group>(null);
  const planeGroupRef = useRef<Group>(null);
  const thrustRef = useRef(0);
  const engineRef = useRef<ShipEngineAudioState>({
    idleSoundId: null,
    thrustSoundId: null,
  });
  const audio = useHostAudio();
  const driver = useMemo(
    () => ({
      play: (sound: "engine_idle" | "engine_thrust") => audio.play(sound),
      stop: (sound: "engine_idle" | "engine_thrust", soundId: number) =>
        audio.stop(sound, soundId),
    }),
    [audio],
  );

  const color = useSimulationSelector(
    (sim: AirCaptureSim) =>
      sim.ships.get(controllerId)?.color ?? airCaptureTheme.colors.warning,
  );
  const dead = useSimulationSelector(
    (sim: AirCaptureSim) => sim.ships.get(controllerId)?.dead ?? true,
  );
  // An equipped ability shows on the hull until it is used.
  const equippedAbility = useSimulationSelector((sim: AirCaptureSim) => {
    const ship = sim.ships.get(controllerId);
    return ship && !ship.activeAbility
      ? (ship.queuedAbility?.id ?? null)
      : null;
  });
  const debugHitboxesVisible = useDebugStore((state) => state.isOpen);
  const hitboxGeometry = useMemo(
    () => new SphereGeometry(SHIP_GAMEPLAY_HITBOX_RADIUS, 18, 18),
    [],
  );
  const hitboxMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: debugHitboxesVisible ? 0.22 : 0,
        wireframe: debugHitboxesVisible,
        depthWrite: false,
      }),
    [debugHitboxesVisible, color],
  );

  useSimulationFrame<AirCaptureSim>(({ sim, alpha }) => {
    const ship = sim.ships.get(controllerId);
    const group = groupRef.current;
    if (!ship || !group) return;
    group.position.lerpVectors(ship.previousPosition, ship.position, alpha);
    group.quaternion.slerpQuaternions(
      ship.previousRotation,
      ship.rotation,
      alpha,
    );
    if (planeGroupRef.current) planeGroupRef.current.rotation.z = ship.wingRoll;
    thrustRef.current = ship.thrustVisual;
    engineRef.current = executeShipEngineAudioTransition(
      resolveShipEngineAudioTransition({
        audioState: engineRef.current,
        isThrusting: ship.thrusting,
        // Engines go quiet between matches as well as when a ship is down.
        isDead: ship.dead || !isMatchActive(sim.matchPhase),
      }),
      driver,
    );
  });

  useEffect(
    () => () => {
      engineRef.current = stopShipEngineAudio(engineRef.current, driver);
    },
    [driver],
  );

  return (
    <group ref={groupRef} visible={!dead}>
      <mesh
        geometry={hitboxGeometry}
        material={hitboxMaterial}
        position={[0, SHIP_COLLIDER_CENTER_Y, 0]}
        renderOrder={debugHitboxesVisible ? 20 : 0}
      />
      <AirCaptureShipVisual
        playerColor={color}
        thrustRef={thrustRef}
        abilityVisual={
          equippedAbility ? <AbilityVisual abilityId={equippedAbility} /> : null
        }
        planeGroupRef={planeGroupRef}
      />
    </group>
  );
}

export const Ship = memo(ShipComponent);
