import { RigidBody } from "@react-three/rapier";
import { BoxGeometry, MeshStandardMaterial } from "three";
import { useMemo } from "react";
import { ARENA_RADIUS } from "../constants";

interface ObstacleProps {
  position: [number, number, number];
  rotationY: number;
}

function Obstacle({ position, rotationY }: ObstacleProps) {
  const geometry = useMemo(() => new BoxGeometry(8, 8, 8), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: 0x666666,
        roughness: 0.7,
        metalness: 0.3,
      }),
    []
  );

  return (
    <RigidBody type="fixed" position={position} rotation={[0, rotationY, 0]}>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
      />
    </RigidBody>
  );
}

export function Obstacles() {
  // Generate obstacles positioned around the arena
  // Big cubes with Y-axis rotation
  const obstacles = useMemo(
    () => [
      // Center area obstacles
      { position: [30, 4, 20] as [number, number, number], rotationY: Math.PI / 4 },
      { position: [-25, 4, 30] as [number, number, number], rotationY: Math.PI / 6 },
      { position: [40, 4, -20] as [number, number, number], rotationY: Math.PI / 3 },
      { position: [-35, 4, -25] as [number, number, number], rotationY: -Math.PI / 4 },
      
      // Mid-range obstacles
      { position: [60, 4, 50] as [number, number, number], rotationY: Math.PI / 5 },
      { position: [-50, 4, 60] as [number, number, number], rotationY: -Math.PI / 6 },
      { position: [70, 4, -40] as [number, number, number], rotationY: Math.PI / 2 },
      { position: [-60, 4, -50] as [number, number, number], rotationY: -Math.PI / 3 },
      
      // Outer area obstacles
      { position: [90, 4, 80] as [number, number, number], rotationY: Math.PI / 4 },
      { position: [-80, 4, 90] as [number, number, number], rotationY: -Math.PI / 5 },
      { position: [100, 4, -70] as [number, number, number], rotationY: Math.PI / 3 },
      { position: [-90, 4, -80] as [number, number, number], rotationY: -Math.PI / 4 },
      
      // Additional scattered obstacles
      { position: [0, 4, 50] as [number, number, number], rotationY: Math.PI / 6 },
      { position: [50, 4, 0] as [number, number, number], rotationY: -Math.PI / 4 },
      { position: [-50, 4, 0] as [number, number, number], rotationY: Math.PI / 3 },
      { position: [0, 4, -50] as [number, number, number], rotationY: -Math.PI / 6 },
    ],
    []
  );

  return (
    <>
      {obstacles.map((obstacle, index) => (
        <Obstacle
          key={index}
          position={obstacle.position}
          rotationY={obstacle.rotationY}
        />
      ))}
    </>
  );
}

