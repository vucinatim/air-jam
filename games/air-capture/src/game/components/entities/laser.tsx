import { useSimulationFrame } from "@air-jam/sdk";
import { memo, useMemo, useRef } from "react";
import type { Mesh } from "three";
import { BoxGeometry, MeshStandardMaterial } from "three";
import { getProjectileRotation } from "../../engine/projectiles/flight";
import type { AirCaptureSim, LaserSim } from "../../simulation/state";
import { airCaptureTheme } from "../../theme";

/** Draws one laser where the simulation flies it. */
const LaserComponent = ({ laser }: { laser: LaserSim }) => {
  const meshRef = useRef<Mesh>(null);
  const geometry = useMemo(() => new BoxGeometry(0.2, 0.2, 5), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: airCaptureTheme.colors.cyan,
        emissive: airCaptureTheme.colors.cyan,
        emissiveIntensity: 5,
        toneMapped: false,
      }),
    [],
  );
  const rotation = useMemo(
    () => getProjectileRotation(laser.direction),
    [laser.direction],
  );

  useSimulationFrame<AirCaptureSim>(({ alpha }) => {
    meshRef.current?.position.lerpVectors(
      laser.previousPosition,
      laser.position,
      alpha,
    );
  });

  return (
    <mesh
      ref={meshRef}
      position={laser.position}
      geometry={geometry}
      material={material}
      castShadow
      quaternion={rotation}
    />
  );
};

export const Laser = memo(LaserComponent);
