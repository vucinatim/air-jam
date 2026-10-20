import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  MeshStandardMaterial,
  RingGeometry,
  type Mesh,
} from "three";
import { JUMP_PAD_RADIUS } from "../../constants";
import { useArenaEvents } from "../../view/arena-view-context";

interface JumpPadProps {
  position: [number, number, number];
  id: string;
}
const JUMP_PAD_HEIGHT = 6; // Height of the barrel (much taller)
const BARREL_BAND_COUNT = 3; // Number of metal bands around the barrel
const GRADIENT_EXTEND_BELOW = 2; // How far below ground the gradient extends

// Shader for gradient effect cylinder
const gradientCylinderVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const gradientCylinderFragment = `
  varying vec2 vUv;
  void main() {
    // Vertical gradient - full opacity at bottom (vUv.y = 0), transparent at top (vUv.y = 1)
    // For cylinder, vUv.y goes from 0 (bottom) to 1 (top)
    float alpha = 1.0 - vUv.y;
    alpha = pow(alpha, 1.2); // Slight curve for smoother fade
    
    // Orange color matching jump pad
    vec3 color = vec3(1.0, 0.4, 0.0); // Orange: RGB(255, 102, 0) normalized
    
    gl_FragColor = vec4(color, alpha * 0.8);
  }
`;

export function JumpPad({ position, id }: JumpPadProps) {
  // Visual geometry and materials
  const gradientGeometry = useMemo(
    () =>
      new CylinderGeometry(
        JUMP_PAD_RADIUS,
        JUMP_PAD_RADIUS,
        JUMP_PAD_HEIGHT + GRADIENT_EXTEND_BELOW,
        32,
        1, // heightSegments
        true, // openEnded - remove top and bottom caps
      ),
    [],
  );

  const baseGeometry = useMemo(
    () =>
      new CylinderGeometry(
        JUMP_PAD_RADIUS,
        JUMP_PAD_RADIUS,
        JUMP_PAD_HEIGHT,
        32,
      ),
    [],
  );
  const baseMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xff6600, // Orange
        emissive: 0xff4400,
        emissiveIntensity: 0.5,
        metalness: 0.3,
        roughness: 0.7,
      }),
    [],
  );

  // Barrel band geometry and material (metal rings around barrel)
  const bandGeometry = useMemo(
    () =>
      new CylinderGeometry(
        JUMP_PAD_RADIUS * 1.01, // Slightly larger than barrel
        JUMP_PAD_RADIUS * 1.01,
        0.15, // Band thickness
        32,
      ),
    [],
  );
  const bandMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x666666, // Dark metal
        metalness: 0.9,
        roughness: 0.2,
        emissive: 0x222222,
        emissiveIntensity: 0.1,
      }),
    [],
  );

  // Top ring/glow effect
  const ringGeometry = useMemo(
    () => new RingGeometry(JUMP_PAD_RADIUS * 0.7, JUMP_PAD_RADIUS, 32),
    [],
  );
  const ringMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xff8800,
        emissive: 0xff6600,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.8,
        side: 2, // DoubleSide
      }),
    [],
  );

  const baseRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const bandRefs = useRef<Array<Mesh | null>>(
    Array(BARREL_BAND_COUNT).fill(null),
  );

  // Animated rings constants
  const RING_COUNT = 5; // Number of animated rings
  const LOOP_DURATION = 2.0; // Time for one full cycle
  const MAX_HEIGHT = 6.0; // Maximum height the rings reach

  // Animated rings state
  // Animated rings state
  const animatedRingMeshRefs = useRef<Array<Mesh | null>>(
    Array(RING_COUNT).fill(null),
  );

  // Initialize animated rings - start with staggered positions for continuous animation
  // No initialization effect needed for stateless animation

  // Animated ring geometry and material
  const animatedRingGeometry = useMemo(
    () => new RingGeometry(JUMP_PAD_RADIUS * 0.8, JUMP_PAD_RADIUS * 1.1, 32),
    [],
  );
  const animatedRingMaterialBase = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0xff8800,
        emissive: 0xff6600,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0,
        side: 2, // DoubleSide
      }),
    [],
  );

  // Create materials for each ring once using useMemo
  const animatedRingMaterials = useMemo(() => {
    return Array.from({ length: RING_COUNT }, () => {
      const mat = animatedRingMaterialBase.clone();
      mat.transparent = true;
      mat.opacity = 0;
      return mat;
    });
  }, [animatedRingMaterialBase]);

  // Initialize animated rings state

  // Animate the glow effect and animated rings
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Pulsing glow effect
    if (baseRef.current) {
      const material = baseRef.current.material as MeshStandardMaterial;
      const pulse = Math.sin(time * 2) * 0.3 + 0.7; // Pulse between 0.4 and 1.0
      material.emissiveIntensity = 0.5 * pulse;
    }

    // Rotating ring
    if (ringRef.current) {
      ringRef.current.rotation.z = time * 0.5;
      const material = ringRef.current.material as MeshStandardMaterial;
      const pulse = Math.sin(time * 3) * 0.2 + 0.8; // Pulse between 0.6 and 1.0
      material.opacity = 0.8 * pulse;
      material.emissiveIntensity = pulse;
    }

    // Animated rings - continuous loop based on time
    // No state required, position is purely a function of time
    animatedRingMeshRefs.current.forEach((mesh, i) => {
      const material = animatedRingMaterials[i];
      if (!mesh || !material) return;

      // Calculate progress (0 to 1) based on time and index offset
      // This ensures perfect spacing and looping
      const offset = i * (LOOP_DURATION / RING_COUNT);
      const loopTime = (time + offset) % LOOP_DURATION;
      const progress = loopTime / LOOP_DURATION;

      // Calculate position and opacity
      const y = progress * MAX_HEIGHT;

      // Fade in at bottom, fade out at top
      // Fade in quickly (first 10%), fade out slowly (last 40%)
      let opacity = 1;
      if (progress < 0.1) {
        opacity = progress / 0.1;
      } else if (progress > 0.6) {
        opacity = 1 - (progress - 0.6) / 0.4;
      }

      mesh.position.setY(y);
      material.opacity = opacity;
      material.emissiveIntensity = 2 * opacity;
      mesh.visible = true;
    });
  });

  useArenaEvents((event) => {
    if (event.type !== "jump-pad" || event.padId !== id) return;
    const flashes: Array<[Mesh | null, number, number]> = [
      [baseRef.current, 2.0, 0.5],
      [ringRef.current, 2.5, 1.0],
    ];
    for (const [mesh, peak] of flashes)
      if (mesh)
        (mesh.material as MeshStandardMaterial).emissiveIntensity = peak;
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => {
      for (const [mesh, , rest] of flashes)
        if (mesh)
          (mesh.material as MeshStandardMaterial).emissiveIntensity = rest;
    }, 200);
  });

  return (
    <group position={position}>
      {/* Visual elements positioned at ground level */}
      <group>
        {/* Gradient effect cylinder - full opacity at bottom, transparent at top */}
        {/* Positioned to extend below ground by GRADIENT_EXTEND_BELOW */}
        <mesh position={[0, (JUMP_PAD_HEIGHT - GRADIENT_EXTEND_BELOW) / 2, 0]}>
          <primitive object={gradientGeometry} attach="geometry" />
          <shaderMaterial
            vertexShader={gradientCylinderVertex}
            fragmentShader={gradientCylinderFragment}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
        {/* Barrel cylinder - hidden, only gradient effect visible */}
        <mesh
          ref={baseRef}
          geometry={baseGeometry}
          material={baseMaterial}
          position={[0, JUMP_PAD_HEIGHT / 2, 0]}
          visible={false}
        />
        {/* Metal bands around barrel - hidden, only gradient effect visible */}
        {Array.from({ length: BARREL_BAND_COUNT }).map((_, i) => {
          const bandY = (JUMP_PAD_HEIGHT / (BARREL_BAND_COUNT + 1)) * (i + 1);
          return (
            <mesh
              key={i}
              ref={(el) => {
                bandRefs.current[i] = el;
              }}
              geometry={bandGeometry}
              material={bandMaterial}
              position={[0, bandY, 0]}
              visible={false}
            />
          );
        })}
        {/* Glowing ring on top - hidden, only gradient effect visible */}
        <mesh
          ref={ringRef}
          geometry={ringGeometry}
          material={ringMaterial}
          position={[0, JUMP_PAD_HEIGHT + 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        />
        {/* Animated rings moving upward - always render all rings */}
        {animatedRingMaterials.map((material, i) => (
          <mesh
            key={i}
            ref={(el) => {
              animatedRingMeshRefs.current[i] = el;
            }}
            geometry={animatedRingGeometry}
            material={material}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        ))}
      </group>
    </group>
  );
}
