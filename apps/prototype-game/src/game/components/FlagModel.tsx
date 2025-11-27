import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FLAG_HEIGHT = 8;

interface FlagModelProps {
  /** Team color for the flag banner */
  color: string;
  /** Whether to animate the flag (wave effect) */
  animate?: boolean;
  /** Animation speed multiplier */
  animationSpeed?: number;
}

/**
 * Reusable flag model component
 * Can be used in both preview and actual game flags
 */
export function FlagModel({
  color,
  animate = true,
  animationSpeed = 1,
}: FlagModelProps) {
  const poleGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.25, 0.25, FLAG_HEIGHT, 8),
    []
  );
  const bannerGeometry = useMemo(
    () => new THREE.PlaneGeometry(3.5, 2.5, 8, 6),
    []
  );

  const bannerRef = useRef<THREE.Mesh | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);

  // Store original positions on mount
  useEffect(() => {
    if (bannerRef.current && bannerGeometry) {
      const positions = bannerGeometry.attributes.position;
      originalPositionsRef.current = new Float32Array(positions.array);
    }
  }, [bannerGeometry]);

  // Animate flag waving
  useFrame((state) => {
    if (!animate || !bannerRef.current || !originalPositionsRef.current) return;

    const time = state.clock.elapsedTime * animationSpeed;
    const vertices = bannerRef.current.geometry.attributes.position;
    const original = originalPositionsRef.current;

    // Create wave effect on the flag
    // The flag plane is in XY plane, width 3.5 (x: -1.75 to 1.75), height 2.5 (y: -1.25 to 1.25)
    // After rotation 90° around Y: local X -> world -Z, local Y -> world Y, local Z -> world X
    // The flag extends in world +X direction from the pole
    // We want the left edge (local x = -1.75) to stay attached to the pole
    for (let i = 0; i < vertices.count; i++) {
      const i3 = i * 3;
      const localX = original[i3];
      const localY = original[i3 + 1];
      const localZ = original[i3 + 2];

      // localX ranges from -1.75 (left edge, attached to pole) to 1.75 (right edge, free)
      // Normalize to 0-1 where 0 is at the pole (left edge)
      const distanceFromPole = (localX + 1.75) / 3.5;
      
      // Only apply wave to vertices away from the pole (left edge stays fixed)
      // More wave at the right edge (farthest from pole)
      const waveAmount = distanceFromPole * 0.3;
      const wave = Math.sin(time * 2 + localY * 2) * waveAmount;

      // Apply wave in local Z direction (which becomes world X after rotation)
      // This makes the flag wave forward/backward from the pole
      // Keep the left edge (localX = -1.75) fixed by ensuring wave is 0 when distanceFromPole is 0
      vertices.setXYZ(i, localX, localY, localZ + wave);
    }

    vertices.needsUpdate = true;
  });

  return (
    <group>
      {/* Flag pole */}
      <mesh geometry={poleGeometry} position={[0, FLAG_HEIGHT / 2, 0]}>
        <meshStandardMaterial
          color="#f3f4f6"
          emissive="#9ca3af"
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Flag banner */}
      {/* Position so left edge (local x = -1.75) is at the pole (world x = 0, z = 0) */}
      {/* After rotation 90° around Y: local x = -1.75 -> world z = 1.75 */}
      {/* To get world z = 0, position mesh at z = -1.75 */}
      <mesh
        ref={(el) => {
          bannerRef.current = el;
        }}
        geometry={bannerGeometry}
        position={[0, FLAG_HEIGHT - 2, -1.75]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

