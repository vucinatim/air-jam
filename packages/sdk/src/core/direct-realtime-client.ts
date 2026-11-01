import type { AirJamSocket } from "../context/socket-manager";
import type {
  AirJamRealtimeClient,
  BridgeListener,
} from "../runtime/realtime-client";

const ACK_TIMEOUT_MS = 5_000;

/** A realtime client straight over one socket, for pages and Node alike. */
export class DirectRealtimeClient implements AirJamRealtimeClient {
  constructor(private readonly socket: AirJamSocket) {}

  get connected(): boolean {
    return this.socket.connected;
  }

  get active(): boolean {
    return this.socket.active;
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  connect(): this {
    this.socket.connect();
    return this;
  }

  disconnect(): this {
    this.socket.disconnect();
    return this;
  }

  on(event: string, listener: BridgeListener): this {
    this.socket.on(event as never, listener as never);
    return this;
  }

  off(event: string, listener?: BridgeListener): this {
    if (!listener) {
      this.socket.off(event as never);
      return this;
    }

    this.socket.off(event as never, listener as never);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    (
      this.socket.emit as unknown as (
        this: AirJamSocket,
        event: string,
        ...args: unknown[]
      ) => void
    ).call(this.socket, event, ...args);
    return this;
  }

  emitWithAck<TAck>(event: string, ...args: unknown[]): Promise<TAck> {
    return new Promise<TAck>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Timed out waiting for acknowledgement for realtime event "${event}".`,
          ),
        );
      }, ACK_TIMEOUT_MS);

      (
        this.socket.emit as unknown as (
          this: AirJamSocket,
          event: string,
          ...args: unknown[]
        ) => void
      ).call(this.socket, event, ...args, (ack: TAck) => {
        clearTimeout(timeoutId);
        resolve(ack);
      });
    });
  }
}
