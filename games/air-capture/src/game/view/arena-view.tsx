import { useSimulation, useSimulationEvents } from "@air-jam/sdk";
import { useMemo, useRef, type ReactNode } from "react";
import type { AirCaptureEvent, AirCaptureSim } from "../simulation/state";
import {
  arenaViewContext,
  type ArenaView,
  type ArenaViewSource,
} from "./arena-view-context";

const viewOf = (sim: AirCaptureSim): ArenaView => ({
  flags: sim.ctf.flags,
  basePositions: sim.ctf.basePositions,
  baseOccupied: (teamId) => sim.baseOccupants[teamId].size > 0,
  shipPosition: (controllerId) => {
    const ship = sim.ships.get(controllerId);
    return ship && !ship.dead ? ship.position : null;
  },
});

/** Draws the arena the simulation plays. */
export function SimulationArenaView({ children }: { children: ReactNode }) {
  const clock = useSimulation<AirCaptureSim, AirCaptureEvent>();
  const listeners = useRef(new Set<(event: AirCaptureEvent) => void>());
  useSimulationEvents<AirCaptureEvent>((event) => {
    for (const listener of listeners.current) listener(event);
  });
  const source = useMemo<ArenaViewSource>(
    () => ({
      read: () => viewOf(clock.sim),
      subscribe: (onChange) => clock.onFrame(onChange),
      onEvent: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [clock],
  );
  return (
    <arenaViewContext.Provider value={source}>
      {children}
    </arenaViewContext.Provider>
  );
}

/** Draws prefabs over fixed arena state, as the prefab preview does. */
export function StaticArenaView({
  view,
  children,
}: {
  view: ArenaView;
  children: ReactNode;
}) {
  const source = useMemo<ArenaViewSource>(
    () => ({
      read: () => view,
      subscribe: () => () => {},
      onEvent: () => () => {},
    }),
    [view],
  );
  return (
    <arenaViewContext.Provider value={source}>
      {children}
    </arenaViewContext.Provider>
  );
}
