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
import { useHostAudio } from "../../audio/use-host-audio";
import { TEAM_CONFIG } from "../../domain/team";
import { shipPositions } from "../../engine/ships/runtime";
import { useCaptureTheFlagStore } from "../../stores/match/capture-the-flag-store";
import { FlagModel } from "../../components/models/flag-model";
import type { AirCaptureFlagPrefabProps } from "./schema";

function FlagCarrierTrail({ teamId, carrierId }: AirCaptureFlagPrefabProps & { carrierId: string }) {
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

function GroundFlag({ teamId }: AirCaptureFlagPrefabProps) {
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
    if (!flagState) {
      return;
    }

    if (pulseRef.current > 0) {
      pulseRef.current = Math.max(0, pulseRef.current - delta * 3);
    }

    if (rigidBodyRef.current && groupRef.current) {
      const [x, y, z] = flagState.position;
      const currentPos: [number, number, number] = [x, y, z];

      const positionChanged =
        !prevPositionRef.current ||
        prevPositionRef.current[0] !== x ||
        prevPositionRef.current[1] !== y ||
        prevPositionRef.current[2] !== z;

      if (positionChanged) {
        groupRef.current.position.set(x, y, z);
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

export function AirCaptureFlag({ teamId }: AirCaptureFlagPrefabProps) {
  const flagState = useCaptureTheFlagStore((state) => state.flags[teamId]);

  if (flagState?.status === "carried" && flagState.carrierId) {
    return <FlagCarrierTrail teamId={teamId} carrierId={flagState.carrierId} />;
  }

  return <GroundFlag teamId={teamId} />;
}
