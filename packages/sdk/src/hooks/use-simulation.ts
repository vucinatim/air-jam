import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
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
      "This host component reads the game simulation, but the host runs none. Declare it with defineAirJamGame({ simulation }).",
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

/**
 * A value read from the simulation that re-renders only when it changes, for
 * UI such as a health bar or a list of entities. Pass `isEqual` (for example
 * zustand's `shallow`) when the selector builds a new object or array.
 */
export const useSimulationSelector = <TSim, TSelected>(
  selector: (sim: TSim) => TSelected,
  isEqual: (previous: TSelected, next: TSelected) => boolean = Object.is,
): TSelected => {
  const clock = useSimulation<TSim>();
  const selectedRef = useRef<{ value: TSelected } | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) => clock.onFrame(onChange),
    [clock],
  );
  const read = useCallback((): TSelected => {
    const next = selector(clock.sim);
    const previous = selectedRef.current;
    if (previous && isEqual(previous.value, next)) return previous.value;
    selectedRef.current = { value: next };
    return next;
  }, [clock, selector, isEqual]);
  return useSyncExternalStore(subscribe, read, read);
};
