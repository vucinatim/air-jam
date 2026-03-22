import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";

export const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(400);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });

export const waitForPort = (port, timeoutMs) =>
  new Promise((resolve, reject) => {
    const start = Date.now();

    const tryConnect = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });

      socket.on("connect", () => {
        socket.end();
        resolve(true);
      });

      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for localhost:${port}`));
          return;
        }
        setTimeout(tryConnect, 300);
      });
    };

    tryConnect();
  });

export const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const isPrivateIpv4 = (ip) =>
  ip.startsWith("10.") ||
  ip.startsWith("192.168.") ||
  /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip);

const isVirtualInterface = (name) =>
  /^(lo|docker|br-|veth|vbox|vmnet|utun|gif|stf|awdl|llw)/i.test(name);

const scoreIp = (ip) => {
  if (ip.startsWith("192.168.")) {
    const parts = ip.split(".");
    const third = Number(parts[2] ?? "0");
    return third < 64 ? 300 - third : 200 - third;
  }
  if (ip.startsWith("10.")) return 150;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return 100;
  return 0;
};

export const detectLocalIpv4 = () => {
  const networks = os.networkInterfaces();
  const candidates = [];

  for (const [name, entries] of Object.entries(networks)) {
    if (!entries || isVirtualInterface(name)) continue;
    for (const entry of entries) {
      if (!entry || entry.internal || entry.family !== "IPv4") continue;
      const ip = entry.address;
      if (!isPrivateIpv4(ip) || ip.startsWith("169.254.")) continue;
      candidates.push({ ip, score: scoreIp(ip) });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.ip ?? null;
};

const log = (prefix, data) => {
  const text = data.toString();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    console.log(`[${prefix}] ${line}`);
  }
};

export const createProcessGroup = () => {
  const children = [];
  let isShuttingDown = false;

  const shutdown = (code = 0) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
    setTimeout(() => process.exit(code), 100);
  };

  const run = (name, command, args, options = {}) => {
    const { fatal = true, ...spawnOptions } = options;
    const child = spawn(command, args, {
      stdio: ["inherit", "pipe", "pipe"],
      ...spawnOptions,
    });

    child.stdout.on("data", (data) => log(name, data));
    child.stderr.on("data", (data) => log(name, data));
    child.on("exit", (code) => {
      if (fatal && code !== 0) {
        console.error(`[${name}] exited with code ${code}`);
        shutdown(code ?? 1);
      }
    });

    children.push(child);
    return child;
  };

  const registerSignalHandlers = () => {
    process.on("SIGINT", () => shutdown(0));
    process.on("SIGTERM", () => shutdown(0));
  };

  return {
    run,
    shutdown,
    registerSignalHandlers,
  };
};
