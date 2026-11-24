import type {
  RoomAcceptor,
  RoomConnectionHandlers,
  RoomConnector,
  RoomWireData,
} from "../room-protocol";

const copy = (data: RoomWireData): RoomWireData =>
  typeof data === "string" ? data : data.slice();

/**
 * Links straight into rooms served in the same process, for headless runs,
 * replays and tests: a real room with no server. Delivery is asynchronous
 * and ordered, as on a network, and bytes are copied as a network would.
 */
export const createLoopbackConnector =
  (acceptor: RoomAcceptor): RoomConnector =>
  (address, handlers) => {
    let server: RoomConnectionHandlers | null = null;
    let clientClosed = false;
    let serverClosed = false;
    const end = () => server?.closed();
    queueMicrotask(() => {
      if (clientClosed) return;
      server = acceptor.accept(address, null, {
        send: (data) => {
          if (serverClosed) return;
          const delivered = copy(data);
          queueMicrotask(() => {
            if (!clientClosed) handlers.message(delivered);
          });
        },
        close: (code) => {
          if (serverClosed || clientClosed) return;
          serverClosed = true;
          queueMicrotask(() => {
            if (!clientClosed) handlers.close(code);
            end();
          });
        },
      });
      handlers.open();
    });
    return {
      send: (data) => {
        const delivered = copy(data);
        queueMicrotask(() => {
          if (!serverClosed && !clientClosed) server?.receive(delivered);
        });
      },
      close: () => {
        if (clientClosed) return;
        clientClosed = true;
        if (!serverClosed) queueMicrotask(end);
      },
    };
  };
