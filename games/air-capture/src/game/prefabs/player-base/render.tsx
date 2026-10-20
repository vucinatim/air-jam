import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide } from "three";
import { TEAM_CONFIG } from "../../domain/team";
import {
  useArenaView,
  useArenaViewReader,
} from "../../view/arena-view-context";
import type { AirCapturePlayerBasePrefabProps } from "./schema";

const BASE_RADIUS = 10;
const BASE_HEIGHT = 8;
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

export function AirCapturePlayerBase({
  teamId,
}: AirCapturePlayerBasePrefabProps) {
  const basePosition = useArenaView((view) => view.basePositions[teamId]);
  const readArena = useArenaViewReader();
  const team = TEAM_CONFIG[teamId];
  const uniformsRef = useRef({
    baseColor: { value: new Color(team.color) },
    whiteAmount: { value: 0 },
  });

  const gradientGeometry = useMemo(
    () =>
      new CylinderGeometry(
        BASE_RADIUS,
        BASE_RADIUS,
        BASE_HEIGHT + GRADIENT_EXTEND_BELOW,
        32,
        1,
        true,
      ),
    [],
  );

  useFrame(() => {
    uniformsRef.current.whiteAmount.value = readArena().baseOccupied(teamId)
      ? 1.0
      : 0.0;
  });

  return (
    <group position={[basePosition[0], 0, basePosition[2]]}>
      <mesh position={[0, (BASE_HEIGHT - GRADIENT_EXTEND_BELOW) / 2, 0]}>
        <primitive object={gradientGeometry} attach="geometry" />
        <shaderMaterial
          vertexShader={baseVertex}
          fragmentShader={baseFragment}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          uniforms={uniformsRef.current}
        />
      </mesh>
    </group>
  );
}
