/**
 * The time a session or room host reads and the one way it waits. Tests pass
 * a clock they drive; everything else uses the system's.
 */
export interface RoomClock {
  now(): number;
  /** Calls `callback` at `time` or as soon after it as the clock can; returns a cancel. */
  at(time: number, callback: () => void): () => void;
}

export const systemRoomClock: RoomClock = {
  now: () => Date.now(),
  at: (time, callback) => {
    const timer = setTimeout(callback, Math.max(0, time - Date.now()));
    return () => clearTimeout(timer);
  },
};

/**
 * The gap between frames of one lane that keeps a client under a room's
 * per-second limit however the room's one-second windows fall.
 */
export const spacingForRate = (perSecond: number): number =>
  perSecond <= 1 ? 1000 : Math.ceil(1000 / (perSecond - 1));
