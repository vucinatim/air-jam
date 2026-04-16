import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { memo, useMemo, useRef, useState } from "react";
import {
  MeshBasicMaterial,
  SphereGeometry,
  type Group,
} from "three";

import { getAbilityVisual, useAbilitiesStore } from "../../abilities-store";
import { useGameStore } from "../../stores/players/game-store";
import { useDebugStore } from "../../stores/debug/debug-store";
import { useHealthStore } from "../../stores/players/health-store";
import { ShipExplosion } from "../effects/ship-explosion";
import { useShipRuntime } from "../../engine/ships/use-ship-runtime";
import { AirCaptureShipVisual } from "../../prefabs/ship";

interface ShipProps {
  controllerId: string;
  position: [number, number, number];
}

const SHIP_GAMEPLAY_HITBOX_RADIUS = 3.8;
const SHIP_PHYSICS_COLLIDER_HALF_HEIGHT = 1.5;
const SHIP_PHYSICS_COLLIDER_RADIUS = 1.8;
const SHIP_COLLIDER_CENTER_OFFSET: [number, number, number] = [0, 1.8, 0];

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
  const debugHitboxesVisible = useDebugStore((state) => state.isOpen);

  const isDead = useHealthStore((state) => state.getIsDead(controllerId));
  const gameplayHitboxGeometry = useMemo(
    () => new SphereGeometry(SHIP_GAMEPLAY_HITBOX_RADIUS, 18, 18),
    [],
  );
  const gameplayHitboxMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: playerColor,
        transparent: true,
        opacity: debugHitboxesVisible ? 0.22 : 0,
        wireframe: debugHitboxesVisible,
        depthWrite: false,
      }),
    [debugHitboxesVisible, playerColor],
  );

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
          colliders={false}
          userData={{ controllerId }}
        >
          <CapsuleCollider
            args={[
              SHIP_PHYSICS_COLLIDER_HALF_HEIGHT,
              SHIP_PHYSICS_COLLIDER_RADIUS,
            ]}
            position={SHIP_COLLIDER_CENTER_OFFSET}
          />
          <mesh
            geometry={gameplayHitboxGeometry}
            material={gameplayHitboxMaterial}
            position={SHIP_COLLIDER_CENTER_OFFSET}
            userData={{
              controllerId,
              gameplayHitbox: true,
              type: "ship-hitbox",
            }}
            renderOrder={debugHitboxesVisible ? 20 : 0}
          />
          <AirCaptureShipVisual
            playerColor={playerColor}
            thrustRef={currentThrustRef}
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
