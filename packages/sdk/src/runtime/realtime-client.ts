import type { AirJamSocket } from "../context/socket-manager";

export interface AirJamRealtimeClient {
  readonly connected: boolean;
  /** Connected or reconnecting on its own; false once it has stopped for good, as Socket.IO's `active`. */
  readonly active: boolean;
  readonly id?: string;
  connect(): this;
  disconnect(): this;
  on(event: string, listener: BridgeListener): this;
  off(event: string, listener?: BridgeListener): this;
  emit(event: string, ...args: unknown[]): this;
  emitWithAck<TAck>(event: string, ...args: unknown[]): Promise<TAck>;
}

export type BridgeListener = {
  bivarianceHack(...args: unknown[]): void;
}["bivarianceHack"];

export type DirectSocketGetter<T extends "host" | "controller"> = (
  role: T,
) => AirJamSocket;

/** Socket.IO reconnects on its own after every disconnect except these deliberate ones. */
export const isFinalSocketDisconnect = (reason: string | undefined): boolean =>
  reason === "io server disconnect" || reason === "io client disconnect";
