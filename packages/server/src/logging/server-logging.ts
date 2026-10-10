import type { ServerEnvConfig } from "../env/server-env.js";
import { DevLogCollector } from "./dev-log-collector.js";
import { resolveDefaultDevLogDir } from "./log-paths.js";
import { createServerLogger, type ServerLogger } from "./logger.js";

export interface ServerLoggingOptions {
  logger?: ServerLogger;
  devLogCollector?: DevLogCollector | false;
  devLogDir?: string;
}

export const createServerLogging = (
  options: ServerLoggingOptions,
  envConfig: ServerEnvConfig,
) => {
  const devLogCollector =
    options.devLogCollector === false
      ? null
      : (options.devLogCollector ??
        new DevLogCollector({
          enabled: envConfig.devLogCollectorEnabled,
          logDir:
            options.devLogDir ??
            envConfig.devLogDir ??
            resolveDefaultDevLogDir(),
        }));
  const logger =
    options.logger ??
    createServerLogger(
      { service: "air-jam-server" },
      undefined,
      devLogCollector,
      {
        level: envConfig.logLevel,
      },
    );

  return {
    logger,
    devLogCollector: devLogCollector ?? false,
  } satisfies ServerLoggingOptions;
};
