import { vi } from "vitest";

type Listener = (...args: unknown[]) => void;

/**
 * A realtime client with no network: tests answer what the runtime emits and
 * fire what the server would send.
 */
export const createMemorySocket = (
  answer: (event: string, payload: unknown) => unknown,
) => {
  const listeners = new Map<string, Set<Listener>>();
  const fire = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) listener(...args);
  };
  const socket = {
    connected: false,
    id: "memory-socket",
    on: (event: string, listener: Listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
      return socket;
    },
    off: (event: string, listener?: Listener) => {
      if (listener) listeners.get(event)?.delete(listener);
      else listeners.delete(event);
      return socket;
    },
    connect: () => {
      socket.connected = true;
      fire("connect");
      return socket;
    },
    disconnect: () => {
      socket.connected = false;
      fire("disconnect", "io client disconnect");
      return socket;
    },
    emit: vi.fn((event: string, ...args: unknown[]) => {
      const acknowledge = args.at(-1);
      if (typeof acknowledge === "function")
        acknowledge(answer(event, args[0]));
      return socket;
    }),
    emitWithAck: async <TAck>(event: string, payload?: unknown) =>
      answer(event, payload) as TAck,
    fire,
    listenerCount: () =>
      [...listeners.values()].reduce((total, set) => total + set.size, 0),
  };
  return socket;
};
