import { useSendSignal } from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import {
  CylinderCollider,
  RigidBody,
  type CollisionPayload,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useRef } from "react";
import type { Group } from "three";
import { useHostAudio } from "../../audio/host-audio";
import { TEAM_CONFIG, TEAM_IDS, type TeamId } from "../../domain/team";
import { useCaptureTheFlagStore } from "../../stores/match/capture-the-flag-store";
import { FlagModel } from "../../components/models/flag-model";
import { shipPositions } from "../../engine/ships/runtime";

function FlagCarrierTrail({
  teamId,
  carrierId,
}: {
  teamId: TeamId;
  carrierId: string;
}) {
  const groupRef = useRef<Group>(null);
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
  const audio = useHostAudio();
  const sendSignal = useSendSignal();
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const groupRef = useRef<Group>(null);
  const prevPositionRef = useRef<[number, number, number] | null>(null);

  const handlePickup = (payload: CollisionPayload) => {
    const userData = payload.other.rigidBody?.userData as
      | { controllerId?: string }
      | undefined;
    if (!userData?.controllerId) return;

    const outcome = tryPickup(userData.controllerId, teamId);

    if (outcome === "returnedFriendlyFlag") {
      pulseRef.current = 1;
      audio.play("success");
      sendSignal?.("HAPTIC", { pattern: "success" }, userData.controllerId);
    } else if (outcome === "pickedUpEnemyFlag") {
      pulseRef.current = 1;
      audio.play("pickup_flag");
      sendSignal?.("HAPTIC", { pattern: "medium" }, userData.controllerId);
    }
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
        colliders={false}
        sensor
        onIntersectionEnter={handlePickup}
      >
        {/* Explicit cylinder collider: [halfHeight, radius] */}
        {/* Cylinder was height 6, radius 4.5 -> args are [3, 4.5] */}
        <CylinderCollider args={[3, 4.5]} />
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
      {TEAM_IDS.map((teamId) => (
        <Flag key={teamId} teamId={teamId} />
      ))}
    </>
  );
}
