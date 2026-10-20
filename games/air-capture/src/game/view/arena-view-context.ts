/**
 * What the arena's prefabs draw: flags, bases and the ships carrying flags.
 * The game feeds it from the simulation; the prefab preview feeds it fixed
 * state, so prefabs stay plain visuals either way.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { Vector3 } from "three";
import type { FlagState, TeamPositions } from "../domain/capture-the-flag";
import type { TeamId } from "../domain/team";
import type { AirCaptureEvent } from "../simulation/state";

export interface ArenaView {
  flags: Record<TeamId, FlagState>;
  basePositions: TeamPositions;
  baseOccupied: (teamId: TeamId) => boolean;
  shipPosition: (controllerId: string) => Vector3 | null;
}

export interface ArenaViewSource {
  read: () => ArenaView;
  subscribe: (onChange: () => void) => () => void;
  onEvent: (listener: (event: AirCaptureEvent) => void) => () => void;
}

export const arenaViewContext = createContext<ArenaViewSource | null>(null);

const useArenaViewSource = (): ArenaViewSource => {
  const source = useContext(arenaViewContext);
  if (!source)
    throw new Error("Arena prefabs need an ArenaViewProvider around them.");
  return source;
};

/** A value from the arena that re-renders only when it changes. */
export const useArenaView = <T>(selector: (view: ArenaView) => T): T => {
  const source = useArenaViewSource();
  const read = useCallback(() => selector(source.read()), [selector, source]);
  return useSyncExternalStore(source.subscribe, read, read);
};

/** The arena for per-frame reads such as a carrier's position. */
export const useArenaViewReader = (): (() => ArenaView) =>
  useArenaViewSource().read;

export const useArenaEvents = (
  listener: (event: AirCaptureEvent) => void,
): void => {
  const source = useArenaViewSource();
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  });
  useEffect(
    () => source.onEvent((event) => listenerRef.current(event)),
    [source],
  );
};
