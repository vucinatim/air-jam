import { useSimulationSelector } from "@air-jam/sdk";
import { shallow } from "zustand/shallow";
import type { AirCaptureSim } from "../../simulation/state";
import { RocketEntity } from "./rocket";

const rocketsOf = (sim: AirCaptureSim) => [...sim.rockets.values()];

export function Rockets() {
  const rockets = useSimulationSelector(rocketsOf, shallow);
  return (
    <>
      {rockets.map((rocket) => (
        <RocketEntity key={rocket.id} rocket={rocket} />
      ))}
    </>
  );
}
