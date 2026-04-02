import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  ShaderMaterial,
  type DirectionalLight,
} from "three";
import type { AirCaptureArenaPrefabProps } from "./schema";

function Forcefield({ arenaRadius, forcefieldColor }: AirCaptureArenaPrefabProps) {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[arenaRadius, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new Color(forcefieldColor) },
        }}
        vertexShader={forcefieldVertex}
        fragmentShader={forcefieldFragment}
        transparent
        side={BackSide}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

const forcefieldVertex = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const forcefieldFragment = `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    if (abs(vWorldNormal.y) > 0.85) discard;

    float verticalFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
    verticalFade = pow(verticalFade, 2.0);

    float energy = sin(vUv.y * 40.0 - uTime * 1.0) * 0.5 + 0.5;

    float alpha = verticalFade * 0.1 + (verticalFade * energy * 0.15);
    vec3 color = uColor;

    gl_FragColor = vec4(color, alpha);
  }
`;

export function SpaceEnvironment({
  props,
}: {
  props: AirCaptureArenaPrefabProps;
}) {
  const lightRef = useRef<DirectionalLight>(null);

  useFrame(() => {
    if (lightRef.current?.shadow) {
      // Lock shadow camera to center - prevent Three.js from auto-updating it
      const cam = lightRef.current.shadow.camera;
      cam.position.set(0, 0, 0);
      cam.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Scene settings */}
      <color args={[0x000000]} attach="background" />
      <fogExp2 args={[0x000000, props.fogDensity]} />

      {/* Space skybox with stars */}
      <Stars
        radius={props.arenaRadius * 5}
        depth={100}
        count={10000}
        factor={8}
        saturation={0}
        fade={false}
        speed={0.1}
      />

      {/* Lighting */}
      <ambientLight intensity={props.ambientLightIntensity} />
      <directionalLight
        ref={lightRef}
        position={[
          props.directionalLightPosition.x,
          props.directionalLightPosition.y,
          props.directionalLightPosition.z,
        ]}
        intensity={props.directionalLightIntensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-props.arenaRadius * 2}
        shadow-camera-right={props.arenaRadius * 2}
        shadow-camera-top={props.arenaRadius * 2}
        shadow-camera-bottom={-props.arenaRadius * 2}
      />

      {/* Ground plane */}
      <RigidBody
        type="fixed"
        rotation={[-Math.PI / 2, 0, 0]}
        colliders="cuboid"
        userData={{ type: "ground" }}
      >
        <mesh receiveShadow userData={{ type: "ground" }}>
          <planeGeometry args={[props.arenaRadius * 3, props.arenaRadius * 3]} />
          <meshStandardMaterial
            color={props.groundColor}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>
      </RigidBody>

      {/* Grid helper */}
      <gridHelper
        args={[
          props.arenaRadius * 2.5,
          40,
          props.gridColorMajor,
          props.gridColorMinor,
        ]}
      />

      {/* Forcefield */}
      <Forcefield {...props} />
    </>
  );
}
