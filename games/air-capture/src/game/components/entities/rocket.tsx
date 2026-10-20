import { useSimulationFrame } from "@air-jam/sdk";
import { memo, useMemo, useRef } from "react";
import type { Group } from "three";
import { getProjectileRotation } from "../../engine/projectiles/flight";
import type { AirCaptureSim, RocketSim } from "../../simulation/state";
import { RocketModel } from "../models/rocket-model";

/** Draws one rocket where the simulation flies it; its blast is an effect. */
function RocketComponent({ rocket }: { rocket: RocketSim }) {
  const groupRef = useRef<Group>(null);
  const rotation = useMemo(
    () => getProjectileRotation(rocket.direction),
    [rocket.direction],
  );

  useSimulationFrame<AirCaptureSim>(({ alpha }) => {
    groupRef.current?.position.lerpVectors(
      rocket.previousPosition,
      rocket.position,
      alpha,
    );
  });

  return (
    <group ref={groupRef} position={rocket.position} quaternion={rotation}>
      <RocketModel showParticles={true} horizontal={true} />
    </group>
  );
}

export const RocketEntity = memo(RocketComponent);
