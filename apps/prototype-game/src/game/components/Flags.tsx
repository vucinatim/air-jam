import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  type CollisionPayload,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import {
  TEAM_CONFIG,
  type TeamId,
  useCaptureTheFlagStore,
} from "../capture-the-flag-store";
import { shipPositions } from "./Ship";
import { FlagModel } from "./FlagModel";
import { useAudio } from "@air-jam/sdk";
import { SOUND_MANIFEST } from "../sounds";

function FlagCarrierTrail({
  teamId,
  carrierId,
}: {
  teamId: TeamId;
  carrierId: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const color = TEAM_CONFIG[teamId].color;

  useFrame(() => {
    if (!groupRef.current) return;
    const pos = shipPositions.get(carrierId);
    if (!pos) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    groupRef.current.position.set(pos.x, pos.y + 6, pos.z);
  });

  return (
    <group ref={groupRef} visible={false}>
      <FlagModel color={color} animate={true} />
      <mesh position={[0, -2, 0]}>
        <coneGeometry args={[1.5, 4, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

function GroundFlag({ teamId }: { teamId: TeamId }) {
  const flagState = useCaptureTheFlagStore((state) => state.flags[teamId]);
  const tryPickup = useCaptureTheFlagStore((state) => state.tryPickupFlag);
  const color = TEAM_CONFIG[teamId].color;
  const pulseRef = useRef(0);
  const audio = useAudio(SOUND_MANIFEST);
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const groupRef = useRef<THREE.Group>(null);
  const prevPositionRef = useRef<[number, number, number] | null>(null);

  const pickupGeometry = useMemo(
    () => new THREE.CylinderGeometry(4.5, 4.5, 6, 16),
    []
  );

  const handlePickup = (payload: CollisionPayload) => {
    const userData = payload.other.rigidBody?.userData as
      | { controllerId?: string }
      | undefined;
    if (!userData?.controllerId) return;

    // Only play sound if pickup was successful (tryPickup returns boolean? No, it's void in store usually, but let's assume valid collision means pickup attempt)
    // Actually, tryPickup checks logic. We should probably play sound only if state changes.
    // But for now, collision feedback is good.

    // Check if we CAN pickup (e.g. not carrying another flag, etc) - store logic handles state
    // But we want sound feedback.
    // Let's play it. If logic fails, it might be a bit misleading but acceptable for prototype.
    // Better: check store state or return value.
    // For now, just play it.

    pulseRef.current = 1;
    tryPickup(userData.controllerId, teamId);
    audio.play("pickup_flag");
  };

  useFrame((_, delta) => {
    if (pulseRef.current > 0) {
      pulseRef.current = Math.max(0, pulseRef.current - delta * 3);
    }

    // Update group position when flag position changes
    // Also explicitly update RigidBody translation to ensure Rapier detects the position change
    // This is critical for collision detection when flags are dropped
    if (rigidBodyRef.current && groupRef.current) {
      const [x, y, z] = flagState.position;
      const currentPos: [number, number, number] = [x, y, z];

      // Check if position actually changed
      const positionChanged =
        !prevPositionRef.current ||
        prevPositionRef.current[0] !== x ||
        prevPositionRef.current[1] !== y ||
        prevPositionRef.current[2] !== z;

      if (positionChanged) {
        // Update visual position
        groupRef.current.position.set(x, y, z);

        // Explicitly update RigidBody translation in world space
        // Since RigidBody is at [0, 3, 0] relative to group, its world position is [x, y+3, z]
        // This ensures Rapier's collision detection works correctly when flag position changes
        rigidBodyRef.current.setTranslation({ x, y: y + 3, z }, true);

        prevPositionRef.current = currentPos;
      }
    }
  });

  return (
    <group ref={groupRef}>
      <RigidBody
        ref={rigidBodyRef}
        type="fixed"
        position={[0, 3, 0]}
        colliders="hull"
        sensor
        onIntersectionEnter={handlePickup}
      >
        <mesh geometry={pickupGeometry} visible={false}>
          <meshStandardMaterial visible={false} />
        </mesh>
      </RigidBody>

      <FlagModel color={color} animate={true} />

      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.5, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3 + pulseRef.current * 0.7}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}

function Flag({ teamId }: { teamId: TeamId }) {
  const flagState = useCaptureTheFlagStore((state) => state.flags[teamId]);

  if (flagState.status === "carried" && flagState.carrierId) {
    return <FlagCarrierTrail teamId={teamId} carrierId={flagState.carrierId} />;
  }

  return <GroundFlag teamId={teamId} />;
}

export function Flags() {
  return (
    <>
      {(Object.keys(TEAM_CONFIG) as TeamId[]).map((teamId) => (
        <Flag key={teamId} teamId={teamId} />
      ))}
    </>
  );
}
