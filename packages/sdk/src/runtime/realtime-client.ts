import type { AirJamSocket } from "../context/socket-manager";

export interface AirJamRealtimeClient {
  readonly connected: boolean;
  readonly id?: string;
  connect(): this;
  disconnect(): this;
  on(event: string, listener: BridgeListener): this;
  off(event: string, listener?: BridgeListener): this;
  emit(event: string, ...args: unknown[]): this;
}

export type BridgeListener = {
  bivarianceHack(...args: unknown[]): void;
}["bivarianceHack"];

export type DirectSocketGetter<T extends "host" | "controller"> = (
  role: T,
) => AirJamSocket;
