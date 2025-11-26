import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  ShaderMaterial,
  type DirectionalLight,
} from "three";
import { RigidBody } from "@react-three/rapier";
import { Stars } from "@react-three/drei";
import { ARENA_RADIUS } from "../constants";

function Forcefield() {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[ARENA_RADIUS, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
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
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    if (abs(vWorldNormal.y) > 0.85) discard;

    float verticalFade = 1.0 - abs(vUv.y - 0.5) * 2.0;
    verticalFade = pow(verticalFade, 2.0);

    float energy = sin(vUv.y * 40.0 - uTime * 1.0) * 0.5 + 0.5;

    float alpha = verticalFade * 0.1 + (verticalFade * energy * 0.15);
    vec3 color = vec3(0.0, 0.9, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

export function SpaceEnvironment() {
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
      <fogExp2 args={[0x000000, 0.0005]} />

      {/* Space skybox with stars */}
      <Stars
        radius={ARENA_RADIUS * 5}
        depth={100}
        count={10000}
        factor={8}
        saturation={0}
        fade={false}
        speed={0.1}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        ref={lightRef}
        position={[60, 100, 60]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-ARENA_RADIUS * 2}
        shadow-camera-right={ARENA_RADIUS * 2}
        shadow-camera-top={ARENA_RADIUS * 2}
        shadow-camera-bottom={-ARENA_RADIUS * 2}
      />

      {/* Ground plane */}
      <RigidBody
        type="fixed"
        rotation={[-Math.PI / 2, 0, 0]}
        colliders="cuboid"
        userData={{ type: "ground" }}
      >
        <mesh receiveShadow userData={{ type: "ground" }}>
          <planeGeometry args={[ARENA_RADIUS * 3, ARENA_RADIUS * 3]} />
          <meshStandardMaterial
            color={0x222222}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>
      </RigidBody>

      {/* Grid helper */}
      <gridHelper args={[ARENA_RADIUS * 2.5, 40, 0x555555, 0x333333]} />

      {/* Forcefield */}
      <Forcefield />
    </>
  );
}
