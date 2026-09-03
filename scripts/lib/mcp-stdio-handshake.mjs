import crossSpawn from "cross-spawn";
import { stopChild } from "./process-child.mjs";

export const verifyMcpStdioHandshake = async ({
  cwd,
  env,
  command = "pnpm",
  args = ["exec", "airjam-mcp"],
  clientInfo,
  label = "MCP server",
  requiredToolNames = [],
  expectedToolNames,
  requestTimeoutMs = 10_000,
  shutdownTimeoutMs = 5_000,
}) => {
  const child = crossSpawn(command, args, {
    cwd,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdoutBuffer = "";
  let stderr = "";
  let fatalError = null;
  let shuttingDown = false;
  const pending = new Map();

  const fail = (error) => {
    if (fatalError) return;
    fatalError = error;
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
    pending.clear();
  };

  child.once("error", (error) => {
    fail(
      new Error(`${label} failed to start: ${error.message}`, { cause: error }),
    );
  });
  child.once("close", (code, signal) => {
    if (shuttingDown) return;
    const details = stderr.trim();
    fail(
      new Error(
        `${
          signal
            ? `${label} exited unexpectedly from signal ${signal}.`
            : `${label} exited unexpectedly with code ${code}.`
        }${details ? `\n${details}` : ""}`,
      ),
    );
  });
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    while (stdoutBuffer.includes("\n")) {
      const newline = stdoutBuffer.indexOf("\n");
      const line = stdoutBuffer.slice(0, newline).trim();
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch (error) {
        fail(
          new Error(
            `${label} emitted non-JSON stdout: ${JSON.stringify(line.slice(0, 500))}`,
            { cause: error },
          ),
        );
        continue;
      }

      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      clearTimeout(waiter.timeout);
      waiter.resolve(message);
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk.toString()}`.slice(-8_000);
  });

  const request = (id, method, params = {}) =>
    new Promise((resolve, reject) => {
      if (fatalError) {
        reject(fatalError);
        return;
      }
      if (child.exitCode !== null || child.signalCode !== null) {
        reject(new Error(`${label} is not running for MCP ${method}.`));
        return;
      }

      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for ${label} MCP ${method}.${stderr ? `\n${stderr}` : ""}`,
          ),
        );
      }, requestTimeoutMs);
      pending.set(id, { resolve, reject, timeout });

      const payload = `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`;
      child.stdin.write(payload, (error) => {
        if (!error) return;
        const waiter = pending.get(id);
        if (!waiter) return;
        pending.delete(id);
        clearTimeout(waiter.timeout);
        waiter.reject(
          new Error(`${label} rejected MCP ${method}: ${error.message}`, {
            cause: error,
          }),
        );
      });
    });

  try {
    const initialized = await request(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo,
    });
    if (initialized.error || !initialized.result?.serverInfo) {
      throw new Error(`${label} rejected protocol initialization.`);
    }
    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      })}\n`,
    );

    const listed = await request(2, "tools/list");
    if (listed.error || !Array.isArray(listed.result?.tools)) {
      throw new Error(`${label} rejected tools/list.`);
    }
    const toolNames = listed.result.tools.map((tool) => tool.name).sort();
    for (const required of requiredToolNames) {
      if (!toolNames.includes(required)) {
        throw new Error(`${label} did not expose ${required}.`);
      }
    }
    if (
      expectedToolNames &&
      JSON.stringify(toolNames) !==
        JSON.stringify([...expectedToolNames].sort())
    ) {
      throw new Error(
        `${label} tool contract drifted. Expected ${expectedToolNames.length} canonical tools and received ${toolNames.length}.`,
      );
    }

    return {
      serverInfo: initialized.result.serverInfo,
      tools: toolNames,
    };
  } finally {
    shuttingDown = true;
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timeout);
    }
    pending.clear();
    if (!child.stdin.destroyed) child.stdin.end();
    await stopChild(child, { timeoutMs: shutdownTimeoutMs });
  }
};
