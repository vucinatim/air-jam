import pino, {
  destination,
  multistream,
  type Bindings,
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";
import type { DevLogCollector } from "./dev-log-collector.js";

export type ServerLogger = Logger;

const resolveDefaultLogLevel = (configuredLevel?: string): string =>
  configuredLevel ?? process.env.AIR_JAM_LOG_LEVEL ?? "info";

const createBaseLoggerOptions = (configuredLevel?: string): LoggerOptions => ({
  level: resolveDefaultLogLevel(configuredLevel),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
});

interface CreateServerLoggerOptions {
  level?: string;
}

export const createServerLogger = (
  bindings?: Bindings,
  parent?: ServerLogger,
  devLogCollector?: DevLogCollector | null,
  options?: CreateServerLoggerOptions,
): ServerLogger => {
  const baseLoggerOptions = createBaseLoggerOptions(options?.level);
  const logger =
    parent ??
    (devLogCollector?.enabled
      ? pino(
          baseLoggerOptions,
          multistream([
            { stream: destination(1) },
            {
              stream: {
                write(chunk: string | Uint8Array) {
                  const line =
                    typeof chunk === "string"
                      ? chunk
                      : Buffer.from(chunk).toString("utf8");
                  devLogCollector.enqueueServerLogLine(line);
                  return true;
                },
              } satisfies DestinationStream,
            },
          ]),
        )
      : pino(baseLoggerOptions));
  return bindings ? logger.child(bindings) : logger;
};

export const redactIdentifier = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-4)}`;
};
