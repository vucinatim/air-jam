import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type CollisionPayload } from "@react-three/rapier";
import { CylinderGeometry, AdditiveBlending } from "three";
import * as THREE from "three";
import {
  TEAM_CONFIG,
  type TeamId,
  useCaptureTheFlagStore,
} from "../capture-the-flag-store";
import { useAudio } from "@air-jam/sdk";
import { SOUND_MANIFEST } from "../sounds";

const BASE_RADIUS = 10;
const BASE_HEIGHT = 8;
const COLLISION_HEIGHT = 10;
const GRADIENT_EXTEND_BELOW = 2;

// Shader for gradient effect cylinder (similar to jump pad)
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
    // Vertical gradient - full opacity at bottom (vUv.y = 0), transparent at top (vUv.y = 1)
    float alpha = 1.0 - vUv.y;
    alpha = pow(alpha, 1.2); // Slight curve for smoother fade
    
    // Mix between team color and white based on whiteAmount
    vec3 color = mix(baseColor, vec3(1.0), whiteAmount);
    
    gl_FragColor = vec4(color, alpha * 0.8);
  }
`;

interface TeamBaseProps {
  teamId: TeamId;
}

function TeamBase({ teamId }: TeamBaseProps) {
  const handleBaseEntry = useCaptureTheFlagStore(
    (state) => state.handleBaseEntry
  );
  const team = TEAM_CONFIG[teamId];
  const audio = useAudio(SOUND_MANIFEST);

  // Track players currently inside the base
  const playersInsideRef = useRef<Set<string>>(new Set());

  // Use ref for uniforms so we can modify values in useFrame
  const uniformsRef = useRef({
    baseColor: { value: new THREE.Color(team.color) },
    whiteAmount: { value: 0 },
  });

  // Gradient cylinder geometry (similar to jump pad, no rings)
  const gradientGeometry = useMemo(
    () =>
      new CylinderGeometry(
        BASE_RADIUS,
        BASE_RADIUS,
        BASE_HEIGHT + GRADIENT_EXTEND_BELOW,
        32,
        1, // heightSegments
        true // openEnded - remove top and bottom caps
      ),
    []
  );

  const collisionGeometry = useMemo(
    () => new CylinderGeometry(BASE_RADIUS, BASE_RADIUS, COLLISION_HEIGHT, 32),
    []
  );

  useFrame(() => {
    // Keep white while any player is inside
    uniformsRef.current.whiteAmount.value =
      playersInsideRef.current.size > 0 ? 1.0 : 0.0;
  });

  const handleIntersectionEnter = (payload: CollisionPayload) => {
    const userData = payload.other.rigidBody?.userData as
      | { controllerId?: string }
      | undefined;
    if (!userData?.controllerId) return;

    // Prevent duplicate events - if player is already inside, ignore this event
    if (playersInsideRef.current.has(userData.controllerId)) {
      return;
    }

    // Mark player as inside before processing
    playersInsideRef.current.add(userData.controllerId);

    // Play base entry sound (only once per entry)
    audio.play("touch_base");

    // Audio Logic
    const store = useCaptureTheFlagStore.getState();
    const playerTeam = store.getPlayerTeam(userData.controllerId);

    if (playerTeam) {
      if (playerTeam === teamId) {
        // In own base
        // 1. Check for Scoring
        // We need to find the enemy team ID. Since there are only 2 teams, it's the other one.
        const enemyTeam = Object.keys(TEAM_CONFIG).find(
          (id) => id !== playerTeam
        ) as TeamId;
        const enemyFlag = store.flags[enemyTeam];

        if (
          enemyFlag &&
          enemyFlag.status === "carried" &&
          enemyFlag.carrierId === userData.controllerId
        ) {
          // Player is carrying enemy flag and entered own base -> SCORE!
          audio.play("score_point");
        }

        // 2. Check for Flag Return
        const ownFlag = store.flags[playerTeam];
        if (ownFlag && ownFlag.status === "dropped") {
          // Player entered own base while own flag is dropped -> Return it?
          // Wait, logic says "If ownFlag.status === dropped ... return to base".
          // But does entering base return it?
          // handleBaseEntry line 160: if (ownFlag.status === "dropped") -> return to base.
          // Yes.
          audio.play("success");
        }
      } else {
        // In enemy base - trying to steal flag
        const enemyFlag = store.flags[teamId]; // The flag of this base
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

  return (
    <group position={[team.basePosition[0], 0, team.basePosition[2]]}>
      <RigidBody
        type="fixed"
        position={[0, COLLISION_HEIGHT / 2, 0]}
        sensor
        colliders="hull"
        onIntersectionEnter={handleIntersectionEnter}
        onIntersectionExit={handleIntersectionExit}
      >
        {/* Invisible collision cylinder */}
        <mesh geometry={collisionGeometry} visible={false}>
          <meshStandardMaterial visible={false} />
        </mesh>

        {/* Visual gradient cylinder (similar to jump pad, no rings) */}
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
