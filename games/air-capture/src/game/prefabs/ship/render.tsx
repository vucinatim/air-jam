import { useEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";
import { TEAM_CONFIG } from "../../domain/team";
import { ShipModel } from "../../components/models/ship-model";
import type { AirCaptureShipPrefabProps } from "./schema";

export function AirCaptureShipVisual({
  playerColor,
  thrustRef,
  abilityVisual = null,
  planeGroupRef,
}: {
  playerColor: string;
  thrustRef: React.MutableRefObject<number>;
  abilityVisual?: ReactNode;
  planeGroupRef: React.RefObject<Group | null>;
}) {
  return (
    <ShipModel
      playerColor={playerColor}
      thrustRef={thrustRef}
      abilityVisual={abilityVisual}
      planeGroupRef={planeGroupRef}
    />
  );
}

export function AirCaptureShip({
  teamId,
  thrust,
}: AirCaptureShipPrefabProps) {
  const thrustRef = useRef(thrust);
  const planeGroupRef = useRef<Group>(null);

  useEffect(() => {
    thrustRef.current = thrust;
  }, [thrust]);

  return (
    <group position={[0, 5, 0]} rotation={[0, Math.PI * 1.18, 0]}>
      <AirCaptureShipVisual
        playerColor={TEAM_CONFIG[teamId].color}
        thrustRef={thrustRef}
        planeGroupRef={planeGroupRef}
      />
    </group>
  );
}
