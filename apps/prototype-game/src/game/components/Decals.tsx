import { useFrame } from "@react-three/fiber";
import { useRef, useMemo, useEffect } from "react";
import {
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
  Vector3,
  Euler,
  Quaternion,
} from "three";
import { useDecalsStore } from "../decals-store";

const DECAL_LIFETIME = 5; // seconds
const DECAL_SIZE = 0.4; // Size of the hit mark decal

interface DecalProps {
  id: string;
  position: [number, number, number];
  normal: Vector3;
  timestamp: number;
}

function Decal({ id, position, normal }: DecalProps) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<MeshStandardMaterial | null>(null);
  const removeDecal = useDecalsStore((state) => state.removeDecal);
  const ageRef = useRef(0);

  const geometry = useMemo(() => new SphereGeometry(DECAL_SIZE, 16, 16), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 10, // Make it brighter
        toneMapped: false,
        transparent: true,
        opacity: 1,
      }),
    []
  );

  useEffect(() => {
    materialRef.current = material;
  }, [material]);

  useFrame((_state, delta) => {
    if (!meshRef.current || !materialRef.current) return;

    ageRef.current += delta;

    // Remove decal after lifetime expires
    if (ageRef.current > DECAL_LIFETIME) {
      removeDecal(id);
      return;
    }

    // Fade out over time
    const fadeProgress = ageRef.current / DECAL_LIFETIME;
    const opacity = 1 - fadeProgress;
    const intensity = 1 + (1 - fadeProgress) * 2; // Start bright, fade out

    materialRef.current.emissiveIntensity = intensity * 10; // Keep it bright
    materialRef.current.opacity = opacity;
    materialRef.current.transparent = opacity < 1;
  });

  // Calculate rotation to align decal with surface normal
  const rotation = useMemo(() => {
    const up = new Vector3(0, 1, 0);
    const normalizedNormal = normal.clone().normalize();

    // If normal is parallel to up, use default rotation
    if (Math.abs(up.dot(normalizedNormal)) > 0.99) {
      return [0, 0, 0] as [number, number, number];
    }

    // Calculate rotation to align sphere's up (Y) with surface normal
    const quaternion = new Quaternion().setFromUnitVectors(
      up,
      normalizedNormal
    );
    const euler = new Euler().setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [normal]);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      geometry={geometry}
      material={material}
    />
  );
}

export function Decals() {
  const decals = useDecalsStore((state) => state.decals);

  return (
    <>
      {decals.map((decal) => (
        <Decal
          key={decal.id}
          id={decal.id}
          position={decal.position}
          normal={decal.normal}
          timestamp={decal.timestamp}
        />
      ))}
    </>
  );
}
