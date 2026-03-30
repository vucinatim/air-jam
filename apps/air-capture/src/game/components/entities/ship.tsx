/* eslint-disable react-refresh/only-export-components */

import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { memo, useRef, useState } from "react";
import { type Group } from "three";

import { getAbilityVisual, useAbilitiesStore } from "../../abilities-store";
import { useGameStore } from "../../stores/players/game-store";
import { useHealthStore } from "../../stores/players/health-store";
import { ShipExplosion } from "../effects/ship-explosion";
import { ShipModel } from "../models/ship-model";
import { useShipRuntime } from "../../engine/ships/use-ship-runtime";
export { shipPositions, shipRotations } from "../../engine/ships/runtime";

interface ShipProps {
  controllerId: string;
  position: [number, number, number];
}

function ShipComponent({ controllerId, position: initialPosition }: ShipProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const planeGroupRef = useRef<Group>(null);
  const currentThrustRef = useRef(0);
  const thrustInputRef = useRef(0);
  const [explosionPosition, setExplosionPosition] = useState<
    [number, number, number] | null
  >(null);

  const currentAbility = useAbilitiesStore((state) =>
    state.getAbility(controllerId),
  );
  const isAbilityActive = useAbilitiesStore((state) =>
    state.isAbilityActive(controllerId),
  );
  const abilityVisual =
    currentAbility && !isAbilityActive
      ? getAbilityVisual(currentAbility.id, controllerId)
      : null;

  const playerColor =
    useGameStore(
      (state) =>
        state.players.find((p) => p.controllerId === controllerId)?.color,
    ) || "#ff4444";

  const isDead = useHealthStore((state) => state.getIsDead(controllerId));

  useShipRuntime({
    controllerId,
    rigidBodyRef,
    planeGroupRef,
    thrustRef: currentThrustRef,
    thrustInputRef,
    setExplosionPosition,
  });

  return (
    <>
      {!isDead && (
        <RigidBody
          ref={rigidBodyRef}
          type="dynamic"
          position={initialPosition}
          lockRotations
          linearDamping={0.5}
          colliders="cuboid"
          userData={{ controllerId }}
        >
          <ShipModel
            playerColor={playerColor}
            thrustRef={currentThrustRef}
            thrustInputRef={thrustInputRef}
            abilityVisual={abilityVisual}
            planeGroupRef={planeGroupRef}
          />
        </RigidBody>
      )}
      {explosionPosition && (
        <ShipExplosion
          position={explosionPosition}
          onComplete={() => {
            setExplosionPosition(null);
          }}
        />
      )}
    </>
  );
}

export const Ship = memo(ShipComponent, (prev, next) => {
  return (
    prev.controllerId === next.controllerId &&
    prev.position.every((v, i) => v === next.position[i])
  );
});
