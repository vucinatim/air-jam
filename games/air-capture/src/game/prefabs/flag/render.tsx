import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { FlagModel } from "../../components/models/flag-model";
import { TEAM_CONFIG } from "../../domain/team";
import {
  useArenaEvents,
  useArenaView,
  useArenaViewReader,
} from "../../view/arena-view-context";
import type { AirCaptureFlagPrefabProps } from "./schema";

function FlagCarrierTrail({
  teamId,
  carrierId,
}: AirCaptureFlagPrefabProps & { carrierId: string }) {
  const groupRef = useRef<Group>(null);
  const color = TEAM_CONFIG[teamId].color;

  const readArena = useArenaViewReader();

  useFrame(() => {
    if (!groupRef.current) return;
    const pos = readArena().shipPosition(carrierId);
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
  const flagState = useArenaView((view) => view.flags[teamId]);
  const color = TEAM_CONFIG[teamId].color;
  const pulseRef = useRef(0);

  useArenaEvents((event) => {
    if (event.type === "flag-touched" && event.teamId === teamId)
      pulseRef.current = 1;
  });

  useFrame((_, delta) => {
    if (pulseRef.current > 0)
      pulseRef.current = Math.max(0, pulseRef.current - delta * 3);
  });

  return (
    <group position={flagState.position}>
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
  const flagState = useArenaView((view) => view.flags[teamId]);

  if (flagState?.status === "carried" && flagState.carrierId) {
    return <FlagCarrierTrail teamId={teamId} carrierId={flagState.carrierId} />;
  }

  return <GroundFlag teamId={teamId} />;
}
