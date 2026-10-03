import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserServer } from "playwright-core";
import { startBrowserEgressProxy } from "./egress-proxy";
import type { BrowserWorkerEnv } from "./env";

export const BROWSER_LIFETIME_MS = 120_000;
const LAUNCH_TIMEOUT_MS = 15_000;
const CLOSE_TIMEOUT_MS = 3_000;

export type IsolatedBrowser = {
  server: BrowserServer;
  close: () => Promise<void>;
};

/** One transport connection owns one browser, namespace and egress budget. */
export const launchIsolatedBrowser = async (
  config: BrowserWorkerEnv,
  signal: AbortSignal,
): Promise<IsolatedBrowser> => {
  if (process.platform !== "linux" || process.getuid?.() === 0) {
    throw new Error(
      "Release capture requires the non-root Linux worker image.",
    );
  }
  signal.throwIfAborted();
  const directory = await mkdtemp(join(tmpdir(), "airjam-capture-"));
  let server: BrowserServer | undefined;
  let egress: Awaited<ReturnType<typeof startBrowserEgressProxy>> | undefined;
  let closePromise: Promise<void> | undefined;
  let launchFinished = false;
  let stopped = false;

  const close = () => {
    stopped = true;
    if (closePromise) return closePromise;
    closePromise = (async () => {
      clearTimeout(deadline);
      signal.removeEventListener("abort", cancel);
      try {
        await egress?.close();
      } finally {
        try {
          if (server) {
            // Graceful closure is preferred, but creator code cannot keep its owned
            // namespace alive indefinitely. Killing namespace PID 1 reaps descendants.
            const killTimer = setTimeout(
              () => void server?.kill().catch(() => {}),
              CLOSE_TIMEOUT_MS,
            );
            try {
              await server.close();
            } finally {
              clearTimeout(killTimer);
            }
          }
        } finally {
          if (launchFinished)
            await rm(directory, { recursive: true, force: true });
        }
      }
    })();
    return closePromise;
  };
  const cancel = () => void close().catch(() => {});
  const deadline = setTimeout(cancel, BROWSER_LIFETIME_MS);
  deadline.unref();
  signal.addEventListener("abort", cancel, { once: true });

  try {
    egress = await startBrowserEgressProxy({
      socketPath: join(directory, "egress.sock"),
      onExhausted: cancel,
    });
    if (stopped || signal.aborted) throw new Error("Capture was cancelled.");
    server = await chromium.launchServer({
      headless: config.headless,
      host: "127.0.0.1",
      port: 0,
      chromiumSandbox: true,
      timeout: LAUNCH_TIMEOUT_MS,
      executablePath: "/usr/local/bin/airjam-chromium-isolated",
      proxy: {
        server: `http://127.0.0.1:${egress.port}`,
        bypass: "<-loopback>",
      },
      env: {
        PATH: "/usr/local/bin:/usr/bin:/bin",
        HOME: directory,
        LANG: "C.UTF-8",
        AIRJAM_CHROMIUM_EXECUTABLE:
          config.executablePath ?? chromium.executablePath(),
        AIRJAM_EGRESS_SOCKET: join(directory, "egress.sock"),
        AIRJAM_EGRESS_PORT: String(egress.port),
      },
    });
    launchFinished = true;
    if (stopped || signal.aborted) throw new Error("Capture was cancelled.");
    server.once("close", cancel);
    return { server, close };
  } catch {
    // A cancellation can arrive during either awaited launch step. Re-own the
    // resulting resources once launch settles rather than losing a late child.
    await closePromise;
    closePromise = undefined;
    launchFinished = true;
    await close();
    throw new Error("Isolated browser launch failed or was cancelled.");
  }
};
