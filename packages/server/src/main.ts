import { formatEnvValidationError, isEnvValidationError } from "@air-jam/env";
import { loadWorkspaceEnv } from "./env/load-workspace-env.js";
import { createServerLogger } from "./logging/logger.js";
import type { RoomServerRuntime } from "./room-server/room-server.js";

const main = async (): Promise<void> => {
  let runtime: RoomServerRuntime | null = null;
  try {
    loadWorkspaceEnv();
    const { createRoomServer } = await import("./room-server/room-server.js");
    const { installServerProcessSignalHandlers } =
      await import("./process-lifecycle.js");
    runtime = createRoomServer();
    await runtime.start();
    installServerProcessSignalHandlers({ runtime });
  } catch (error) {
    try {
      await runtime?.stop();
    } catch {
      // The original startup failure remains the actionable error.
    }
    if (isEnvValidationError(error)) {
      console.error(
        formatEnvValidationError(error, {
          docsHint:
            "Fix the listed AIR_JAM_* variables and retry. For local dev, check .env.local or packages/server/.env.",
        }),
      );
      process.exitCode = 1;
      return;
    }

    const logger = createServerLogger({ service: "air-jam-server" });
    logger.error({ err: error }, "Failed to start server");
    process.exitCode = 1;
  }
};

void main();
