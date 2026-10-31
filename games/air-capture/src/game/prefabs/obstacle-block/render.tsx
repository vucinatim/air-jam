import { useMemo } from "react";
import { BoxGeometry, MeshStandardMaterial } from "three";
import { airCaptureTheme } from "../../theme";
import type { AirCaptureObstacleBlockPrefabProps } from "./schema";

export function AirCaptureObstacleBlock({
  position,
  rotationY,
  size,
}: AirCaptureObstacleBlockPrefabProps) {
  const geometry = useMemo(
    () => new BoxGeometry(size[0], size[1], size[2]),
    [size],
  );
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: airCaptureTheme.colors.rocketBand,
        roughness: 0.7,
        metalness: 0.3,
      }),
    [],
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      position={position}
      rotation={[0, rotationY, 0]}
      castShadow
      receiveShadow
    />
  );
}
