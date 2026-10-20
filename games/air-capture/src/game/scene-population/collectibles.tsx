import { useSimulationSelector } from "@air-jam/sdk";
import { shallow } from "zustand/shallow";
import { Collectible } from "../components/entities/collectible";
import type { AirCaptureSim } from "../simulation/state";

const collectiblesOf = (sim: AirCaptureSim) => [...sim.collectibles.values()];

export function Collectibles() {
  const collectibles = useSimulationSelector(collectiblesOf, shallow);

  return (
    <>
      {collectibles.map((collectible) => (
        <Collectible key={collectible.id} collectible={collectible} />
      ))}
    </>
  );
}
