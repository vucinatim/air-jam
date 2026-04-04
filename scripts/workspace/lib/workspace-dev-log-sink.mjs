import fs from "node:fs";
import path from "node:path";

const ERROR_PATTERN =
  /\b(error|failed|exception|ERR_[A-Z_]+)\b|internal server error|cannot find module/i;
const WARN_PATTERN = /\bwarn(ing)?\b/i;

const toLine = (value) => `${JSON.stringify(value)}\n`;

const ensureLogFile = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf8");
  }
};

const resolveLevel = (line, stream) => {
  if (ERROR_PATTERN.test(line)) {
    return "error";
  }

  if (WARN_PATTERN.test(line)) {
    return "warn";
  }

  return stream === "stderr" ? "warn" : "info";
};

const isStructuredServerLogLine = (line) => {
  if (!line.startsWith("{") || !line.endsWith("}")) {
    return false;
  }

  try {
    const parsed = JSON.parse(line);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.level === "string" &&
      typeof parsed.msg === "string"
    );
  } catch {
    return false;
  }
};

export const createWorkspaceDevLogSink = (options = {}) => {
  const logFilePath =
    options.logFilePath ??
    path.join(process.cwd(), ".airjam", "logs", "dev-latest.ndjson");
  const service = options.service ?? "air-jam-workspace";
  const component = options.component ?? "dev-runner";
  const partials = new Map();

  const appendLine = (event) => {
    ensureLogFile(logFilePath);
    fs.appendFileSync(logFilePath, toLine(event), "utf8");
  };

  const createBaseEvent = ({ occurredAt, level, event, processName, tool, command, cwd }) => ({
    time: occurredAt,
    occurredAt,
    ingestedAt: occurredAt,
    level,
    source: "workspace",
    service,
    component,
    scope: "workspace",
    event,
    processName,
    tool,
    command,
    cwd,
  });

  const emitOutput = ({ processName, stream, line, tool, command, cwd }) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    const occurredAt = new Date().toISOString();
    appendLine({
      ...createBaseEvent({
        occurredAt,
        level: resolveLevel(trimmed, stream),
        event: "workspace.process.output",
        processName,
        tool,
        command,
        cwd,
      }),
      stream,
      msg: trimmed,
    });
  };

  const flushKey = (key, metadata) => {
    const line = partials.get(key);
    if (!line?.trim()) {
      partials.delete(key);
      return;
    }

    emitOutput({
      ...metadata,
      line,
    });
    partials.delete(key);
  };

  return {
    captureChunk(metadata) {
      const key = `${metadata.processName}:${metadata.stream}`;
      const previous = partials.get(key) ?? "";
      const chunkText =
        typeof metadata.chunk === "string"
          ? metadata.chunk
          : Buffer.from(metadata.chunk).toString("utf8");
      const text = previous + chunkText;
      const parts = text.split(/\r?\n/);
      const trailing = parts.pop() ?? "";

      for (const line of parts) {
        if (
          metadata.suppressStructuredServerLogs === true &&
          isStructuredServerLogLine(line.trim())
        ) {
          continue;
        }

        emitOutput({
          ...metadata,
          line,
        });
      }

      partials.set(key, trailing);
    },

    recordStart(metadata) {
      const occurredAt = new Date().toISOString();
      appendLine({
        ...createBaseEvent({
          occurredAt,
          level: "info",
          event: "workspace.process.started",
          processName: metadata.processName,
          tool: metadata.tool,
          command: metadata.command,
          cwd: metadata.cwd,
        }),
        data: {
          pid:
            Number.isInteger(metadata.pid) && metadata.pid > 0 ? metadata.pid : null,
        },
        msg: `Process ${metadata.processName} started`,
      });
    },

    flush(metadata) {
      flushKey(`${metadata.processName}:stdout`, {
        ...metadata,
        stream: "stdout",
      });
      flushKey(`${metadata.processName}:stderr`, {
        ...metadata,
        stream: "stderr",
      });
    },

    recordExit(metadata) {
      const occurredAt = new Date().toISOString();
      appendLine({
        ...createBaseEvent({
          occurredAt,
          level:
            typeof metadata.code === "number" && metadata.code !== 0 ? "error" : "info",
          event: "workspace.process.exit",
          processName: metadata.processName,
          tool: metadata.tool,
          command: metadata.command,
          cwd: metadata.cwd,
        }),
        data: {
          pid:
            Number.isInteger(metadata.pid) && metadata.pid > 0 ? metadata.pid : null,
          code: metadata.code ?? null,
          signal: metadata.signal ?? null,
        },
        msg:
          typeof metadata.code === "number" && metadata.code !== 0
            ? `Process ${metadata.processName} exited with code ${metadata.code}`
            : `Process ${metadata.processName} exited`,
      });
    },
  };
};
