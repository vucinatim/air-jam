import { createServerLogger, type ServerLogger } from "./logging/logger.js";
import type { RoomServerRuntime } from "./room-server/room-server.js";

type ShutdownSignal = "SIGINT" | "SIGTERM";

/**
 * Stops the room server once on SIGINT or SIGTERM: every room closes its
 * devices as "restarting", so they come back to the next server. Returns
 * the call that removes the handlers.
 */
export const installServerProcessSignalHandlers = ({
  runtime,
  logger = createServerLogger({
    service: "air-jam-server",
    component: "process-lifecycle",
  }),
}: {
  runtime: Pick<RoomServerRuntime, "stop">;
  logger?: ServerLogger;
}): (() => void) => {
  let stopping = false;

  const removeHandlers = (): void => {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  };

  const handleSignal = (signal: ShutdownSignal): void => {
    if (stopping) return;
    stopping = true;
    removeHandlers();
    logger.info({ signal }, "Room server stopping");
    runtime.stop().then(
      () => logger.info({ signal }, "Room server stopped"),
      (error: unknown) => {
        process.exitCode = 1;
        logger.error({ err: error, signal }, "Room server stop failed");
      },
    );
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  return removeHandlers;
};
