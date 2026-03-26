import { createReadStream, existsSync, statSync } from "node:fs";
import { watch } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { AIR_JAM_WORKSPACE_ROOT } from "../src/logging/log-paths";

type DevLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type DevLogSource = "server" | "browser";

interface DevLogEvent {
  time?: string;
  level?: DevLogLevel;
  source?: DevLogSource;
  msg?: string;
  traceId?: string;
  roomId?: string;
  socketId?: string;
  controllerId?: string;
  appIdHint?: string;
  code?: string;
  browserSource?: string;
  data?: unknown;
  err?: unknown;
  [key: string]: unknown;
}

interface CliOptions {
  filePath: string;
  follow: boolean;
  source?: DevLogSource;
  traceId?: string;
  roomId?: string;
  level?: DevLogLevel;
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

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    filePath: process.env.AIR_JAM_DEV_LOG_FILE ?? DEFAULT_FILE_PATH,
    follow: false,
  };

  for (const arg of args) {
    if (arg === "--follow") {
      options.follow = true;
      continue;
    }
    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--file=")) {
      options.filePath = path.resolve(AIR_JAM_WORKSPACE_ROOT, arg.split("=")[1] ?? "");
      continue;
    }
    if (arg.startsWith("--source=")) {
      const value = arg.split("=")[1];
      if (value === "server" || value === "browser") {
        options.source = value;
      }
      continue;
    }
    if (arg.startsWith("--trace=")) {
      options.traceId = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--room=")) {
      options.roomId = arg.split("=")[1];
      continue;
    }
    if (arg.startsWith("--level=")) {
      const value = arg.split("=")[1] as DevLogLevel | undefined;
      if (
        value === "trace" ||
        value === "debug" ||
        value === "info" ||
        value === "warn" ||
        value === "error" ||
        value === "fatal"
      ) {
        options.level = value;
      }
      continue;
    }
  }

  return options;
};

const printHelp = (): void => {
  console.log("Usage: pnpm dev:logs [--follow] [--source=server|browser] [--trace=<id>] [--room=<id>] [--level=<level>] [--file=<path>]");
  console.log("");
  console.log("Reads the canonical Air Jam dev log file and pretty-prints entries.");
  console.log("");
  console.log("Examples:");
  console.log("  pnpm dev:logs");
  console.log("  pnpm dev:logs -- --follow");
  console.log("  pnpm dev:logs -- --trace=host_abc123");
  console.log("  pnpm dev:logs -- --source=browser --level=warn");
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

const passesFilter = (event: DevLogEvent, options: CliOptions): boolean => {
  if (options.source && event.source !== options.source) {
    return false;
  }
  if (options.traceId && event.traceId !== options.traceId) {
    return false;
  }
  if (options.roomId && event.roomId !== options.roomId) {
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

const truncate = (value: string, max = 120): string => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
};

const formatDetails = (event: DevLogEvent): string[] => {
  const details: string[] = [];
  if (event.traceId) details.push(`trace=${event.traceId}`);
  if (event.roomId) details.push(`room=${event.roomId}`);
  if (event.socketId) details.push(`socket=${event.socketId}`);
  if (event.controllerId) details.push(`controller=${event.controllerId}`);
  if (event.code) details.push(`code=${event.code}`);
  if (event.source === "browser" && event.browserSource) {
    details.push(`browser=${event.browserSource}`);
  }
  if (event.appIdHint) details.push(`app=${event.appIdHint}`);
  return details;
};

const printEvent = (event: DevLogEvent): void => {
  const time = event.time ?? new Date().toISOString();
  const level = (event.level ?? "info").toUpperCase().padEnd(5, " ");
  const source = (event.source ?? "server").padEnd(7, " ");
  const details = formatDetails(event);
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

const readFromOffset = async (filePath: string, start: number, options: CliOptions): Promise<number> => {
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
    if (!event || !passesFilter(event, options)) {
      continue;
    }
    printEvent(event);
  }

  return stats.size;
};

async function main(): Promise<void> {
  const options = parseArgs();

  if (!existsSync(options.filePath)) {
    console.error(`Dev log file not found: ${options.filePath}`);
    process.exitCode = 1;
    return;
  }

  let offset = await readFromOffset(options.filePath, 0, options);

  if (!options.follow) {
    return;
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
}

void main();
