import type { Socket } from "socket.io-client";

type GenericEventMap = Record<string, (...args: unknown[]) => void>;
type GenericSocket = Socket<GenericEventMap, GenericEventMap>;

export const waitForSocketConnect = async (
  socket: GenericSocket,
  timeoutMs = 1_000,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      reject(new Error("Timed out waiting for socket connection"));
    }, timeoutMs);

    const onConnect = () => {
      clearTimeout(timeout);
      socket.off("connect_error", onConnectError);
      resolve();
    };

    const onConnectError = (error: Error) => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      reject(error);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });
};

export const emitWithAck = async <TAck>(
  socket: GenericSocket,
  event: string,
  payload: unknown,
  timeoutMs = 1_000,
): Promise<TAck> => {
  return await new Promise<TAck>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ack: ${event}`));
    }, timeoutMs);

    socket.emit(event, payload, (ack: TAck) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });
};
