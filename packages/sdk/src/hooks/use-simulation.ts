import { useContext, useEffect, useRef } from "react";
import type { SimulationClock, SimulationFrame } from "../core/simulation";
import { createAirJamDiagnosticError } from "../diagnostics";
import { hostRuntimeContext } from "../runtime/runtime-owner-contexts";

/** The game's simulation clock; the game must declare a simulation. */
export const useSimulation = <TSim, TEvent = never>(): SimulationClock<
  TSim,
  unknown,
  TEvent
> => {
  const runtime = useContext(hostRuntimeContext) as {
    simulation: SimulationClock<unknown, unknown, unknown> | null;
  } | null;
  if (!runtime?.simulation)
    throw createAirJamDiagnosticError(
      "AJ_SIMULATION_NOT_DECLARED",
      "This host component reads the game simulation, but the host runs none. Declare it with createAirJamApp({ simulation }).",
    );
  return runtime.simulation as SimulationClock<TSim, unknown, TEvent>;
};

/** Calls `onFrame` after every simulation frame, for drawing. */
export const useSimulationFrame = <TSim>(
  onFrame: (frame: SimulationFrame<TSim>) => void,
): void => {
  const clock = useSimulation<TSim>();
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  });
  useEffect(() => clock.onFrame((frame) => onFrameRef.current(frame)), [clock]);
};

/** Calls `listener` for every event the simulation emits, such as a hit. */
export const useSimulationEvents = <TEvent>(
  listener: (event: TEvent) => void,
): void => {
  const clock = useSimulation<unknown, TEvent>();
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  });
  useEffect(
    () => clock.onEvent((event) => listenerRef.current(event)),
    [clock],
  );
};
