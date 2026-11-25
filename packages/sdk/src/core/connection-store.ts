import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  AirJamPlayer,
  ConnectionRole,
  ConnectionStatus,
  RunMode,
} from "../protocol";
import type { ControllerOrientation, RuntimeState } from "../room-protocol";

/** Whether a host's controller join link can be shown yet. */
export type JoinUrlStatus = "loading" | "ready" | "unavailable";

/** What a surface's bindings read about its room: who is in it and how it is going. */
export interface AirJamConnectionState {
  role: ConnectionRole | null;
  roomId: string | null;
  /** This phone's seat; null on a host. */
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  /** This host's place in the server's queue while its room waits to open. */
  queuePosition: number | null;
  mode: RunMode;
  runtimeState: RuntimeState;
  controllerOrientation: ControllerOrientation;
  players: AirJamPlayer[];
  lastError?: string;
  joinUrl: string;
  /** Host only: controller link for this computer, never for a phone QR. */
  localControllerUrl: string;
  joinUrlStatus: JoinUrlStatus;
  setRole: (role: ConnectionRole | null) => void;
  setRoomId: (roomId: string | null) => void;
  setControllerId: (controllerId: string | null) => void;
  setStatus: (status: ConnectionStatus) => void;
  setQueuePosition: (position: number | null) => void;
  setMode: (mode: RunMode) => void;
  setRuntimeState: (state: RuntimeState) => void;
  setControllerOrientation: (orientation: ControllerOrientation) => void;
  setError: (message?: string) => void;
  setPlayers: (players: readonly AirJamPlayer[]) => void;
  resetRuntimeState: () => void;
  setJoinUrls: (
    joinUrl: string,
    localControllerUrl: string,
    joinUrlStatus: JoinUrlStatus,
  ) => void;
}

/** Players whose phone dropped and whose seat the room still holds. */
export const getReconnectingPlayerIds = (
  players: readonly AirJamPlayer[],
): string[] =>
  players.filter((player) => !player.connected).map((player) => player.id);

export const createConnectionStore = (): StoreApi<AirJamConnectionState> =>
  createStore<AirJamConnectionState>((set) => ({
    role: null,
    roomId: null,
    controllerId: null,
    connectionStatus: "idle",
    queuePosition: null,
    mode: "standalone",
    runtimeState: "playing",
    controllerOrientation: "portrait",
    players: [],
    lastError: undefined,
    joinUrl: "",
    localControllerUrl: "",
    joinUrlStatus: "loading",
    setRole: (role) => set({ role }),
    setRoomId: (roomId) => set({ roomId }),
    setControllerId: (controllerId) => set({ controllerId }),
    setStatus: (connectionStatus) => set({ connectionStatus }),
    setQueuePosition: (queuePosition) => set({ queuePosition }),
    setMode: (mode) => set({ mode }),
    setRuntimeState: (runtimeState) => set({ runtimeState }),
    setControllerOrientation: (controllerOrientation) =>
      set({ controllerOrientation }),
    setError: (message) => set({ lastError: message }),
    setPlayers: (players) => set({ players: [...players] }),
    resetRuntimeState: () =>
      set({ runtimeState: "playing", controllerOrientation: "portrait" }),
    setJoinUrls: (joinUrl, localControllerUrl, joinUrlStatus) =>
      set({ joinUrl, localControllerUrl, joinUrlStatus }),
  }));
