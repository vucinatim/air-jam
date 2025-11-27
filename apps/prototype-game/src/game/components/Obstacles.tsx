import { RigidBody } from "@react-three/rapier";
import { BoxGeometry, MeshStandardMaterial } from "three";
import { useMemo } from "react";
import { OBSTACLES } from "../constants";

interface ObstacleProps {
  position: [number, number, number];
  rotationY: number;
  size: [number, number, number];
}

function Obstacle({ position, rotationY, size }: ObstacleProps) {
  const geometry = useMemo(
    () => new BoxGeometry(size[0], size[1], size[2]),
    [size]
  );
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
    <RigidBody
      type="fixed"
      position={position}
      rotation={[0, rotationY, 0]}
      colliders="cuboid"
      userData={{ type: "obstacle" }}
    >
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        userData={{ type: "obstacle" }}
      />
    </RigidBody>
  );
}

export function Obstacles() {
  return (
    <>
      {OBSTACLES.map((obstacle, index) => (
        <Obstacle
          key={index}
          position={obstacle.position}
          rotationY={obstacle.rotationY}
          size={obstacle.size}
        />
      ))}
    </>
  );
}
