import { useAudio } from "@air-jam/sdk";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  type CollisionPayload,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AdditiveBlending, CylinderGeometry } from "three";
import {
  TEAM_CONFIG,
  useCaptureTheFlagStore,
  type TeamId,
} from "../capture-the-flag-store";
import { SOUND_MANIFEST } from "../sounds";

const BASE_RADIUS = 10;
const BASE_HEIGHT = 8;
const COLLISION_HEIGHT = 10;
const GRADIENT_EXTEND_BELOW = 2;

const baseVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const baseFragment = `
  varying vec2 vUv;
  uniform vec3 baseColor;
  uniform float whiteAmount;
  void main() {
    float alpha = 1.0 - vUv.y;
    alpha = pow(alpha, 1.2); 
    vec3 color = mix(baseColor, vec3(1.0), whiteAmount);
    gl_FragColor = vec4(color, alpha * 0.8);
  }
`;

interface TeamBaseProps {
  teamId: TeamId;
}

function TeamBase({ teamId }: TeamBaseProps) {
  const handleBaseEntry = useCaptureTheFlagStore(
    (state) => state.handleBaseEntry,
  );
  const basePosition = useCaptureTheFlagStore(
    (state) => state.basePositions[teamId],
  );
  const team = TEAM_CONFIG[teamId];
  const audio = useAudio(SOUND_MANIFEST);

  const playersInsideRef = useRef<Set<string>>(new Set());
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  const uniformsRef = useRef({
    baseColor: { value: new THREE.Color(team.color) },
    whiteAmount: { value: 0 },
  });

  const gradientGeometry = useMemo(
    () =>
      new CylinderGeometry(
        BASE_RADIUS,
        BASE_RADIUS,
        BASE_HEIGHT + GRADIENT_EXTEND_BELOW,
        32,
        1, // heightSegments
        true, // openEnded - remove top and bottom caps
      ),
    [],
  );

  const collisionGeometry = useMemo(
    () => new CylinderGeometry(BASE_RADIUS, BASE_RADIUS, COLLISION_HEIGHT, 32),
    [],
  );

  // Sync Physics Position
  useEffect(() => {
    if (rigidBodyRef.current && basePosition) {
      const [x, , z] = basePosition;
      // setTranslation uses WORLD coordinates.
      // By keeping the parent group at [0,0,0], this sets the absolute position correctly.
      rigidBodyRef.current.setTranslation(
        { x, y: COLLISION_HEIGHT / 2, z },
        true,
      );
    }
  }, [basePosition]);

  useFrame(() => {
    uniformsRef.current.whiteAmount.value =
      playersInsideRef.current.size > 0 ? 1.0 : 0.0;
  });

  const handleIntersectionEnter = (payload: CollisionPayload) => {
    const userData = payload.other.rigidBody?.userData as
      | { controllerId?: string }
      | undefined;
    if (!userData?.controllerId) return;

    if (playersInsideRef.current.has(userData.controllerId)) {
      return;
    }

    playersInsideRef.current.add(userData.controllerId);
    audio.play("touch_base");

    const store = useCaptureTheFlagStore.getState();
    const playerTeam = store.getPlayerTeam(userData.controllerId);

    if (playerTeam) {
      if (playerTeam === teamId) {
        const enemyTeam = Object.keys(TEAM_CONFIG).find(
          (id) => id !== playerTeam,
        ) as TeamId;
        const enemyFlag = store.flags[enemyTeam];

        if (
          enemyFlag &&
          enemyFlag.status === "carried" &&
          enemyFlag.carrierId === userData.controllerId
        ) {
          audio.play("score_point");
        }

        const ownFlag = store.flags[playerTeam];
        if (ownFlag && ownFlag.status === "dropped") {
          audio.play("success");
        }
      } else {
        const enemyFlag = store.flags[teamId];
        if (enemyFlag && enemyFlag.status === "atBase") {
          audio.play("pickup_flag");
        }
      }
    }

    handleBaseEntry(userData.controllerId, teamId);
  };

  const handleIntersectionExit = (payload: CollisionPayload) => {
    const userData = payload.other.rigidBody?.userData as
      | { controllerId?: string }
      | undefined;
    if (!userData?.controllerId) return;

    playersInsideRef.current.delete(userData.controllerId);
  };

  // FIX: Removed position={[...]} from this group
  return (
    <group>
      <RigidBody
        ref={rigidBodyRef}
        type="fixed"
        // Initial position set here, subsequent updates handled by useEffect
        position={[basePosition[0], COLLISION_HEIGHT / 2, basePosition[2]]}
        sensor
        colliders="hull"
        onIntersectionEnter={handleIntersectionEnter}
        onIntersectionExit={handleIntersectionExit}
      >
        <mesh geometry={collisionGeometry} visible={false}>
          <meshStandardMaterial visible={false} />
        </mesh>

        <group position={[0, -COLLISION_HEIGHT / 2, 0]}>
          <mesh position={[0, (BASE_HEIGHT - GRADIENT_EXTEND_BELOW) / 2, 0]}>
            <primitive object={gradientGeometry} attach="geometry" />
            <shaderMaterial
              vertexShader={baseVertex}
              fragmentShader={baseFragment}
              transparent
              blending={AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              uniforms={uniformsRef.current}
            />
          </mesh>
        </group>
      </RigidBody>
    </group>
  );
}

export function PlayerBases() {
  return (
    <>
      {(Object.keys(TEAM_CONFIG) as TeamId[]).map((teamId) => (
        <TeamBase key={teamId} teamId={teamId} />
      ))}
    </>
  );
}
