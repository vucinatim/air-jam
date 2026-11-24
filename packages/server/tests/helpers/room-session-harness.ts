import {
  type RoomAcceptor,
  type RoomConnector,
  type RoomLinkHandlers,
  type RoomWireData,
} from "@air-jam/sdk/room-protocol";
import {
  createLoopbackConnector,
  type RoomClock,
} from "@air-jam/sdk/room-session";
import { createOpenRoomGate, type RoomGate } from "../../src/room/gate.js";
import { MemoryRoomHost } from "../../src/room-host/memory-room-host.js";

/** Lets every queued microtask, loopback delivery and gate decision run. */
export const settle = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

/** A clock the test drives: timers run only when it advances. */
export class ManualClock implements RoomClock {
  time = 1_000_000;
  private readonly timers = new Set<{ time: number; callback: () => void }>();

  now(): number {
    return this.time;
  }

  at(time: number, callback: () => void): () => void {
    const timer = { time, callback };
    this.timers.add(timer);
    return () => this.timers.delete(timer);
  }

  /** Runs every timer due within `milliseconds`, in order, settling after each. */
  async advance(milliseconds = 0): Promise<void> {
    const target = this.time + milliseconds;
    await settle();
    for (;;) {
      const due = [...this.timers]
        .filter((timer) => timer.time <= target)
        .sort((left, right) => left.time - right.time)[0];
      if (!due) break;
      this.timers.delete(due);
      this.time = Math.max(this.time, due.time);
      due.callback();
      await settle();
    }
    this.time = target;
    await settle();
  }
}

interface NetworkLink {
  readonly sent: RoomWireData[];
  /** The link is lost without a close frame, as when a network goes away. */
  break(): void;
  /** The room's frames stop arriving, as on a silently dead connection. */
  mute(): void;
}

/**
 * Loopback links the test can watch and break: it records what each client
 * sent and can lose a link or silence it.
 */
export const createNetwork = (acceptor: RoomAcceptor) => {
  const loopback = createLoopbackConnector(acceptor);
  const links: NetworkLink[] = [];
  const connector: RoomConnector = (address, handlers) => {
    let muted = false;
    let broken = false;
    const watched: RoomLinkHandlers = {
      open: () => !broken && handlers.open(),
      message: (data) => !broken && !muted && handlers.message(data),
      close: (code) => !broken && handlers.close(code),
    };
    const link = loopback(address, watched);
    const sent: RoomWireData[] = [];
    links.push({
      sent,
      break: () => {
        broken = true;
        link.close();
        handlers.close(1006);
      },
      mute: () => {
        muted = true;
      },
    });
    return {
      send: (data) => {
        sent.push(data);
        link.send(data);
      },
      close: () => link.close(),
    };
  };
  return { connector, links };
};

export const createRooms = (
  clock: RoomClock,
  gate: RoomGate = createOpenRoomGate(),
) => new MemoryRoomHost({ gate, clock, codesMayBeAsked: true });
