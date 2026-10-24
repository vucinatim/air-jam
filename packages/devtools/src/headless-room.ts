import { randomUUID } from "node:crypto";
import type { GameRunClock } from "./game-run-owner.js";
import type { HostRequester } from "./game-session-runtime.js";
import {
  HEADLESS_ROOM_IPC_MAX_BYTES,
  HEADLESS_ROOM_MAX_ADVANCE_MS,
  headlessRoomRequestSchema,
  headlessRoomResponseSchema,
  type HeadlessRoomRequest,
  type HeadlessRoomResponse,
} from "./headless-room-protocol.js";
import { startHelperChannel } from "./helper-channel.js";
import {
  closeAfterProcessFailure,
  type ProcessScopeObserver,
} from "./managed-process-scope.js";

const REQUEST_TIMEOUT_MS = 5_000;

export type HeadlessRoom = {
  gameId: string | null;
  roomId: string;
  controllerJoinUrl: string;
  /** Reaches the room's host directly, as an owned host. */
  requestHost: HostRequester;
  /** Game time: waiting advances the game rather than the wall clock. */
  clock: GameRunClock;
  stop: () => Promise<void>;
};

/**
 * Opens a game's room headless in its own process: no page, no drawing, and
 * a clock that moves only when the run waits on it.
 */
export async function startHeadlessRoom({
  rootDir,
  toolingRootDir,
  configPath,
  seed,
  logPath,
  onScope,
  startupSignal,
}: {
  rootDir: string;
  toolingRootDir?: string;
  configPath: string;
  seed: number;
  logPath: string;
  onScope?: ProcessScopeObserver;
  startupSignal?: AbortSignal;
}): Promise<HeadlessRoom> {
  const channel = await startHelperChannel({
    name: "room",
    helper: "run-headless-room.ts",
    rootDir,
    toolingRootDir,
    onScope,
    startupSignal,
    logPath,
    maxBytes: HEADLESS_ROOM_IPC_MAX_BYTES,
    requestSchema: headlessRoomRequestSchema,
    responseSchema: headlessRoomResponseSchema,
  });
  // One request at a time reaches the room, in the order the run sent them.
  let queue: Promise<unknown> = Promise.resolve();
  const request = <TKind extends HeadlessRoomResponse["kind"]>(
    input: HeadlessRoomRequest,
    expected: TKind,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ) => {
    const result = queue.then(async () => {
      const response = await channel.request(input, timeoutMs);
      if (response.kind === "error") throw new Error(response.message);
      if (response.kind !== expected)
        throw new Error(`room_protocol: Expected ${expected}.`);
      return response as Extract<HeadlessRoomResponse, { kind: TKind }>;
    });
    queue = result.catch(() => undefined);
    return result;
  };
  try {
    const opened = await request(
      { kind: "initialize", id: randomUUID(), configPath, seed },
      "initialized",
      10_000,
    );
    let nowMs = opened.nowMs;
    return {
      gameId: opened.gameId,
      roomId: opened.roomId,
      controllerJoinUrl: opened.controllerJoinUrl,
      requestHost: async (hostRequest, timeoutMs, signal) => {
        signal?.throwIfAborted();
        const answered = await request(
          { kind: "agent", id: randomUUID(), request: hostRequest },
          "agent",
          timeoutMs,
        );
        return answered.response;
      },
      clock: {
        now: () => nowMs,
        wait: async (ms, signal) => {
          let remaining = ms;
          while (remaining > 0) {
            signal?.throwIfAborted();
            const step = Math.min(remaining, HEADLESS_ROOM_MAX_ADVANCE_MS);
            nowMs = (
              await request(
                { kind: "advance", id: randomUUID(), ms: step },
                "advanced",
              )
            ).nowMs;
            remaining -= step;
          }
        },
      },
      stop: channel.stop,
    };
  } catch (error) {
    return closeAfterProcessFailure(channel.stop, error);
  } finally {
    channel.started();
  }
}
