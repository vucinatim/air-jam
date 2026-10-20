import { useSimulationSelector } from "@air-jam/sdk";
import { shallow } from "zustand/shallow";
import type { AirCaptureSim } from "../../simulation/state";
import { Laser } from "./laser";

const lasersOf = (sim: AirCaptureSim) => [...sim.lasers.values()];

export function Lasers() {
  const lasers = useSimulationSelector(lasersOf, shallow);
  return (
    <>
      {lasers.map((laser) => (
        <Laser key={laser.id} laser={laser} />
      ))}
    </>
  );
}
