import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { AdditiveBlending, BackSide, ShaderMaterial } from "three";
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
  return (
    <>
      {/* Scene settings */}
      <color args={[0x202025]} attach="background" />
      <fogExp2 args={[0x202025, 0.008]} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 50, 20]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={500}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA_RADIUS * 3, ARENA_RADIUS * 3]} />
        <meshStandardMaterial
          color={0x222222}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Grid helper */}
      <gridHelper args={[ARENA_RADIUS * 2.5, 40, 0x555555, 0x333333]} />

      {/* Forcefield */}
      <Forcefield />
    </>
  );
}
