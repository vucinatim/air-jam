import type { AirJamHostEnvironment } from "../../src/core/environment";
import { createMemorySocket } from "./memory-socket";

export const createServerSocket = () =>
  createMemorySocket((event) => {
    if (event === "host:bootstrap") return { ok: true, traceId: "trace-1" };
    if (event === "host:createRoom")
      return {
        ok: true,
        roomId: "ROOM1",
        players: [],
        controllers: [],
        hostResumeCapability: { token: "resume-token" },
      };
    throw new Error(`Unexpected ${event}`);
  });

export const createMemoryEnvironment = (
  socket: ReturnType<typeof createServerSocket>,
) => {
  let resume: { roomId: string; token: string } | null = null;
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: "default",
    controlTarget: {},
    readResume: () => resume,
    writeResume: (next) => {
      resume = next;
    },
    requestHostGrant: async () => "grant",
    controllerUrl: async (roomId) =>
      `https://play.test/controller?room=${roomId}`,
    transport: () => socket,
    emitDevEvent: () => {},
    setDevLogContext: () => {},
    seed: () => 1,
    now: () => performance.now(),
  };
  return { environment, readStoredResume: () => resume };
};
