import { createReadStream, existsSync, statSync, watch } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Command } from "commander";
import {
  resolveAirJamBrowserConsoleCategory,
  type AirJamDevBrowserConsoleCategory,
} from "@air-jam/sdk/protocol";
import { AIR_JAM_WORKSPACE_ROOT } from "./log-paths.js";

type DevLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type DevLogSource = "server" | "browser" | "workspace";

interface DevLogEvent {
  time?: string;
  occurredAt?: string;
  ingestedAt?: string;
  collectorSeq?: number;
  level?: DevLogLevel;
  source?: DevLogSource;
  msg?: string;
  event?: string;
  sourceSeq?: number;
  role?: "host" | "controller";
  traceId?: string;
  roomId?: string;
  socketId?: string;
  controllerId?: string;
  appIdHint?: string;
  code?: string;
  runtimeEpoch?: number;
  runtimeKind?: string;
  browserSource?: string;
  consoleCategory?: AirJamDevBrowserConsoleCategory;
  repeatCount?: number;
  data?: unknown;
  err?: unknown;
  [key: string]: unknown;
}

export interface DevLogsCliOptions {
  filePath: string;
  follow: boolean;
  view: "full" | "signal";
  source?: DevLogSource;
  traceId?: string;
  roomId?: string;
  controllerId?: string;
  event?: string;
  level?: DevLogLevel;
  runtimeKind?: string;
  runtimeEpoch?: number;
  consoleCategory?: AirJamDevBrowserConsoleCategory;
}

const LEVEL_PRIORITY: Record<DevLogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const DEFAULT_FILE_PATH = path.join(
  AIR_JAM_WORKSPACE_ROOT,
  ".airjam",
  "logs",
  "dev-latest.ndjson",
);

const DEV_LOGS_EXAMPLES = [
  "Examples:",
  "  air-jam-server logs",
  "  air-jam-server logs --follow",
  "  air-jam-server logs --trace=host_abc123",
  "  air-jam-server logs --source=browser --level=warn",
  "  air-jam-server logs --controller=ctrl_123 --event=controller.join.accepted",
  "  air-jam-server logs --runtime=arcade-host-runtime --epoch=2",
  "  air-jam-server logs --view=signal --room=ROOM1",
  "  air-jam-server logs --source=browser --console-category=framework",
].join("\n");

const validateChoice =
  <T extends string>(choices: readonly T[], label: string) =>
  (value: string): T => {
    if (choices.includes(value as T)) {
      return value as T;
    }
    throw new Error(`Expected ${label} to be one of: ${choices.join(", ")}`);
  };

const parseIntegerOption = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error("Expected an integer value.");
  }
  return parsed;
};

const resolveFilePathOption = (value: string): string => {
  return path.resolve(AIR_JAM_WORKSPACE_ROOT, value);
};

export const coerceDevLogsCliOptions = (
  parsed: Record<string, unknown>,
): DevLogsCliOptions => ({
  filePath:
    (typeof parsed.filePath === "string"
      ? parsed.filePath
      : typeof parsed.file === "string"
        ? parsed.file
        : undefined) ??
    process.env.AIR_JAM_DEV_LOG_FILE ??
    DEFAULT_FILE_PATH,
  follow: parsed.follow === true,
  view:
    parsed.view === "signal" || parsed.view === "full"
      ? parsed.view
      : "full",
  source:
    parsed.source === "server" ||
    parsed.source === "browser" ||
    parsed.source === "workspace"
      ? parsed.source
      : undefined,
  traceId:
    typeof parsed.traceId === "string"
      ? parsed.traceId
      : typeof parsed.trace === "string"
        ? parsed.trace
        : undefined,
  roomId:
    typeof parsed.roomId === "string"
      ? parsed.roomId
      : typeof parsed.room === "string"
        ? parsed.room
        : undefined,
  controllerId:
    typeof parsed.controllerId === "string"
      ? parsed.controllerId
      : typeof parsed.controller === "string"
        ? parsed.controller
        : undefined,
  event: typeof parsed.event === "string" ? parsed.event : undefined,
  level:
    parsed.level === "trace" ||
    parsed.level === "debug" ||
    parsed.level === "info" ||
    parsed.level === "warn" ||
    parsed.level === "error" ||
    parsed.level === "fatal"
      ? parsed.level
      : undefined,
  runtimeKind:
    typeof parsed.runtimeKind === "string"
      ? parsed.runtimeKind
      : typeof parsed.runtime === "string"
        ? parsed.runtime
        : undefined,
  runtimeEpoch:
    typeof parsed.runtimeEpoch === "number"
      ? parsed.runtimeEpoch
      : typeof parsed.epoch === "number"
        ? parsed.epoch
        : undefined,
  consoleCategory:
    parsed.consoleCategory === "airjam" ||
    parsed.consoleCategory === "app" ||
    parsed.consoleCategory === "framework" ||
    parsed.consoleCategory === "browser"
      ? parsed.consoleCategory
      : undefined,
});

const addDevLogsHelpText = (command: Command): Command => {
  command.on("--help", () => {
    console.log("");
    console.log(DEV_LOGS_EXAMPLES);
  });
  return command;
};

export const configureDevLogsCommand = (command: Command): Command => {
  command
    .description("Read the canonical unified dev log stream")
    .option("--follow", "Follow the log file for appended entries")
    .option(
      "--view <view>",
      "Choose how much log noise to display",
      validateChoice(["full", "signal"], "view"),
      "full",
    )
    .option(
      "--source <source>",
      "Limit entries by source",
      validateChoice(["server", "browser", "workspace"], "source"),
    )
    .option("--trace <id>", "Limit entries to one host trace id")
    .option("--room <id>", "Limit entries to one room id")
    .option("--controller <id>", "Limit entries to one controller id")
    .option("--event <name>", "Limit entries to one event name")
    .option(
      "--level <level>",
      "Only show entries at or above this level",
      validateChoice(
        ["trace", "debug", "info", "warn", "error", "fatal"],
        "level",
      ),
    )
    .option("--runtime <kind>", "Limit entries to one runtime kind")
    .option("--epoch <n>", "Limit entries to one runtime epoch", parseIntegerOption)
    .option(
      "--console-category <kind>",
      "Limit browser console events by category",
      validateChoice(["airjam", "app", "framework", "browser"], "console category"),
    )
    .option(
      "--file <path>",
      "Read a specific log file instead of the default canonical path",
      resolveFilePathOption,
    );

  return addDevLogsHelpText(command);
};

export const createDevLogsCommand = (): Command =>
  configureDevLogsCommand(new Command("logs"));

export const parseDevLogsCliArgs = (args: string[]): DevLogsCliOptions => {
  const command = createDevLogsCommand();
  command.exitOverride();
  command.parse(["node", "logs", ...args]);
  return coerceDevLogsCliOptions(command.opts() as Record<string, unknown>);
};

export const formatDevLogsHelp = (): string => {
  const command = createDevLogsCommand();
  command.name("air-jam-server logs");
  return `${command.helpInformation()}\n${DEV_LOGS_EXAMPLES}\n`;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const parseLine = (line: string): DevLogEvent | null => {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return isRecord(parsed) ? (parsed as DevLogEvent) : null;
  } catch {
    return null;
  }
};

export const passesDevLogFilter = (
  event: DevLogEvent,
  options: DevLogsCliOptions,
): boolean => {
  if (options.view === "signal" && !passesSignalView(event)) {
    return false;
  }
  if (options.source && event.source !== options.source) {
    return false;
  }
  if (options.traceId && event.traceId !== options.traceId) {
    return false;
  }
  if (options.roomId && event.roomId !== options.roomId) {
    return false;
  }
  if (options.controllerId && event.controllerId !== options.controllerId) {
    return false;
  }
  if (options.event && event.event !== options.event) {
    return false;
  }
  if (options.runtimeKind && event.runtimeKind !== options.runtimeKind) {
    return false;
  }
  if (
    typeof options.runtimeEpoch === "number" &&
    event.runtimeEpoch !== options.runtimeEpoch
  ) {
    return false;
  }
  const resolvedConsoleCategory =
    event.consoleCategory ??
    (event.event === "browser.console" && typeof event.msg === "string"
      ? resolveAirJamBrowserConsoleCategory(event.msg)
      : undefined);
  if (
    options.consoleCategory &&
    resolvedConsoleCategory !== options.consoleCategory
  ) {
    return false;
  }
  if (options.level) {
    const eventLevel = event.level ?? "info";
    if (LEVEL_PRIORITY[eventLevel] < LEVEL_PRIORITY[options.level]) {
      return false;
    }
  }
  return true;
};

const passesSignalView = (event: DevLogEvent): boolean => {
  if (event.source === "workspace") {
    return (
      event.level === "warn" ||
      event.level === "error" ||
      event.level === "fatal"
    );
  }

  if (
    event.event === "browser.log_batch.received" ||
    event.event === "browser.log_session.started"
  ) {
    return false;
  }

  if (event.event !== "browser.console") {
    return true;
  }

  if (event.msg === "Browser log sink started") {
    return false;
  }

  if (event.level === "error" || event.level === "fatal") {
    return true;
  }

  const consoleCategory =
    event.consoleCategory ??
    (typeof event.msg === "string"
      ? resolveAirJamBrowserConsoleCategory(event.msg)
      : undefined);

  if (consoleCategory === "framework" || consoleCategory === "browser") {
    return false;
  }

  return true;
};

const truncate = (value: string, max = 120): string => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
};

const EXTRA_DETAIL_KEYS = [
  "component",
  "focus",
  "controllerCount",
  "maxPlayers",
  "reused",
  "reason",
  "command",
  "gameId",
  "processName",
  "stream",
  "tool",
] as const;

const formatScalarDetailValue = (value: unknown): string | null => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return null;
};

export const formatDevLogDetails = (event: DevLogEvent): string[] => {
  const details: string[] = [];
  if (event.event) details.push(`event=${event.event}`);
  if (typeof event.collectorSeq === "number") {
    details.push(`collector=${event.collectorSeq}`);
  }
  if (typeof event.sourceSeq === "number") {
    details.push(`sourceSeq=${event.sourceSeq}`);
  }
  if (event.role) details.push(`role=${event.role}`);
  if (event.traceId) details.push(`trace=${event.traceId}`);
  if (event.roomId) details.push(`room=${event.roomId}`);
  if (event.socketId) details.push(`socket=${event.socketId}`);
  if (event.controllerId) details.push(`controller=${event.controllerId}`);
  if (event.code) details.push(`code=${event.code}`);
  if (typeof event.runtimeEpoch === "number") {
    details.push(`epoch=${event.runtimeEpoch}`);
  }
  if (event.runtimeKind) details.push(`runtime=${event.runtimeKind}`);
  if (event.source === "browser" && event.browserSource) {
    details.push(`browser=${event.browserSource}`);
  }
  const consoleCategory =
    event.consoleCategory ??
    (event.event === "browser.console" && typeof event.msg === "string"
      ? resolveAirJamBrowserConsoleCategory(event.msg)
      : undefined);
  if (consoleCategory) {
    details.push(`category=${consoleCategory}`);
  }
  if (typeof event.repeatCount === "number" && event.repeatCount > 1) {
    details.push(`repeat=${event.repeatCount}`);
  }
  if (
    event.ingestedAt &&
    event.occurredAt &&
    event.ingestedAt !== event.occurredAt
  ) {
    details.push(`ingested=${event.ingestedAt}`);
  }
  if (event.appIdHint) details.push(`app=${event.appIdHint}`);

  for (const key of EXTRA_DETAIL_KEYS) {
    const value = formatScalarDetailValue(event[key]);
    if (value !== null) {
      details.push(`${key}=${value}`);
    }
  }

  return details;
};

const printEvent = (event: DevLogEvent): void => {
  const time = event.occurredAt ?? event.time ?? new Date().toISOString();
  const level = (event.level ?? "info").toUpperCase().padEnd(5, " ");
  const source = (event.source ?? "server").padEnd(7, " ");
  const details = formatDevLogDetails(event);
  const suffix = details.length > 0 ? ` ${details.join(" ")}` : "";
  const message = truncate(event.msg ?? "(no message)");

  console.log(`[${time}] ${level} ${source} ${message}${suffix}`);

  if (event.err) {
    console.log(`  err: ${truncate(JSON.stringify(event.err))}`);
  }
  if (event.data !== undefined) {
    console.log(`  data: ${truncate(JSON.stringify(event.data))}`);
  }
};

const readFromOffset = async (
  filePath: string,
  start: number,
  options: DevLogsCliOptions,
): Promise<number> => {
  const stats = statSync(filePath);
  if (stats.size <= start) {
    return stats.size;
  }

  const stream = createReadStream(filePath, {
    encoding: "utf8",
    start,
  });

  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const event = parseLine(line);
    if (!event || !passesDevLogFilter(event, options)) {
      continue;
    }
    printEvent(event);
  }

  return stats.size;
};

export const executeDevLogsCliOptions = async (
  options: DevLogsCliOptions,
): Promise<number> => {
  if (!existsSync(options.filePath)) {
    console.error(`Dev log file not found: ${options.filePath}`);
    return 1;
  }

  let offset = await readFromOffset(options.filePath, 0, options);

  if (!options.follow) {
    return 0;
  }

  console.log(`\nFollowing ${options.filePath}\n`);

  watch(options.filePath, async (eventType) => {
    if (eventType !== "change" && eventType !== "rename") {
      return;
    }

    if (!existsSync(options.filePath)) {
      return;
    }

    const currentSize = statSync(options.filePath).size;
    if (currentSize < offset) {
      offset = 0;
    }

    offset = await readFromOffset(options.filePath, offset, options);
  });

  await new Promise(() => undefined);
  return 0;
};

export const executeDevLogsCli = async (args: string[]): Promise<number> => {
  let exitCode = 0;
  const command = createDevLogsCommand().action(async (options) => {
    exitCode = await executeDevLogsCliOptions(
      coerceDevLogsCliOptions(options as Record<string, unknown>),
    );
  });
  await command.parseAsync(["node", "logs", ...args]);
  return exitCode;
};
