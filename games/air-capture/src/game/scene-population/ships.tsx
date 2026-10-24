import { useSimulationSelector } from "@air-jam/sdk";
import { shallow } from "zustand/shallow";
import { Ship } from "../components/entities/ship";
import type { AirCaptureSim } from "../simulation/state";

const shipIdsOf = (sim: AirCaptureSim) => [...sim.ships.keys()];

export function Ships() {
  const controllerIds = useSimulationSelector(shipIdsOf, shallow);
  return (
    <>
      {controllerIds.map((controllerId) => (
        <Ship key={controllerId} controllerId={controllerId} />
      ))}
    </>
  );
}
