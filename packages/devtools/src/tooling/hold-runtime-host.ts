import {
  AIR_JAM_RUNTIME_INSPECTION_KEY,
  readRuntimeInspectionContract,
} from "@air-jam/sdk/runtime-inspection";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { startBuiltGameRuntime } from "../built-game-runtime.js";
import type { GameRunWatchEvent } from "../game-run-watch.js";
import {
  DEFAULT_CONTROLLER_VIEWPORT,
  DEFAULT_HOST_VIEWPORT,
  openVisualHarnessHostSession,
  type VisualHarnessMode,
} from "../harness/visual.js";
import { launchScopedHarnessBrowser } from "../harness/visual/browser.js";
import { RuntimeControllerObservations } from "../harness/visual/runtime-controller-observations.js";
import { startGameScreencast } from "../harness/visual/screencast.js";
import { bindHarnessControllerUrl } from "../harness/visual/session.js";
import {
  AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
  AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT,
  isRuntimeOwnerActionRequest,
  isRuntimeOwnerCaptureRequest,
  resolveProjectRelativeRuntimeCaptureDir,
  runtimeOwnerAgentRequestSchema,
  runtimeOwnerCaptureEventSchema,
  runtimeOwnerWatchRequestSchema,
  runtimeOwnerWatchStopSchema,
  type AirJamRuntimeOwnerCaptureResult,
} from "../runtime-owner-protocol.js";
import {
  evaluateOwnedGameContract,
  invokeOwnedHostAction,
} from "./runtime-owner-actions.js";

const getFlagValue = (flag: string): string | null => {
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const pinnedManifest = getFlagValue("--pinned-build");
const built = pinnedManifest
  ? await startBuiltGameRuntime(pinnedManifest)
  : null;
const appOrigin = built?.urls.appOrigin ?? getFlagValue("--app-origin");
const hostUrl = built?.urls.hostUrl ?? getFlagValue("--host-url");
const controllerBaseUrl =
  built?.urls.controllerBaseUrl ?? getFlagValue("--controller-base-url");
const publicHost = built?.urls.publicHost ?? getFlagValue("--public-host");
const localBuildUrl = getFlagValue("--local-build-url");
const browserBuildUrl = getFlagValue("--browser-build-url");
const requestedMode = getFlagValue("--mode") ?? "standalone-dev";
const timeoutMs = Number(getFlagValue("--timeout-ms") ?? "15000");

if (!appOrigin || !hostUrl || !controllerBaseUrl || !publicHost) {
  throw new Error(
    "Missing required isolated runtime host inputs. Expected resolved topology URLs.",
  );
}

const runtimeBrowser = await launchScopedHarnessBrowser();
const { browser } = runtimeBrowser;
let startupDiagnostics = true;
const session = await openVisualHarnessHostSession({
  browser,
  runtimeTopology: built?.topology,
  onDiagnostic: (message) => {
    if (startupDiagnostics) console.error(message.slice(0, 4000));
  },
  mode: requestedMode as VisualHarnessMode,
  urls: {
    appOrigin,
    hostUrl,
    controllerBaseUrl,
    publicHost,
    localBuildUrl,
    browserBuildUrl,
  },
});
let captureRequestId: string | null = null;
const observations = new RuntimeControllerObservations({
  browser,
  readInspection: () => readInspection(),
  send: (message) => {
    process.send?.(message as Parameters<NonNullable<typeof process.send>>[0]);
  },
});
type RuntimeWatch = {
  opening: Promise<void>;
  stopping: boolean;
  cast?: Awaited<ReturnType<typeof startGameScreencast>>;
  closing?: Promise<void>;
};
const watches = new Map<string, RuntimeWatch>();
const stopWatch = (watchId: string) => {
  const watch = watches.get(watchId);
  if (!watch) return Promise.resolve();
  watch.stopping = true;
  return (watch.closing ??= (async () => {
    const results = await Promise.allSettled([
      observations.close(watchId),
      (async () => {
        await watch.opening.catch(() => undefined);
        await watch.cast?.close();
      })(),
    ]);
    const failures = results.filter((result) => result.status === "rejected");
    watches.delete(watchId);
    if (failures.length)
      throw new AggregateError(
        failures.map((result) => result.reason),
        [
          "Run watch cleanup failed.",
          ...failures.map(({ reason }) =>
            reason instanceof Error ? reason.message : String(reason),
          ),
        ]
          .join(" ")
          .slice(0, 4000),
      );
  })());
};
const shutdown = async (exitCode = 0) => {
  await Promise.allSettled([
    ...[...watches.keys()].map(stopWatch),
    observations.closeAll(),
    session.close(),
    runtimeBrowser.close(),
    built?.close(),
  ]);
  process.exit(exitCode);
};

process.on("message", (message: unknown) => {
  const agentRequest = runtimeOwnerAgentRequestSchema.safeParse(message);
  if (agentRequest.success) {
    const { requestId, request } = agentRequest.data;
    void (async () => {
      try {
        const result = await evaluateOwnedGameContract(session.host, request);
        process.send?.({
          type: "air-jam-runtime-owner.agent-result/v1",
          requestId,
          ok: true,
          result,
        });
      } catch (error) {
        process.send?.({
          type: "air-jam-runtime-owner.agent-result/v1",
          requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return;
  }
  const captureEvent = runtimeOwnerCaptureEventSchema.safeParse(message);
  if (captureEvent.success) {
    observations.deliver(captureEvent.data);
    return;
  }
  const watchStop = runtimeOwnerWatchStopSchema.safeParse(message);
  if (watchStop.success) {
    void stopWatch(watchStop.data.watchId)
      .then(() => {
        process.send?.({
          type: "air-jam-runtime-owner.watch-event/v1",
          watchId: watchStop.data.watchId,
          event: { type: "closed" },
        });
      })
      .catch((error: unknown) => {
        process.send?.({
          type: "air-jam-runtime-owner.watch-event/v1",
          watchId: watchStop.data.watchId,
          event: { type: "error", message: String(error).slice(0, 4000) },
        });
      });
    return;
  }
  const watchRequest = runtimeOwnerWatchRequestSchema.safeParse(message);
  if (watchRequest.success) {
    const request = watchRequest.data;
    if (watches.has(request.watchId)) return;
    const send = (
      event:
        | GameRunWatchEvent
        | { type: "ready"; width: number; height: number },
      sent?: (error: Error | null) => void,
    ) => {
      const message = {
        type: "air-jam-runtime-owner.watch-event/v1",
        watchId: request.watchId,
        event,
      };
      if (sent) process.send?.(message, undefined, undefined, sent);
      else process.send?.(message);
    };
    const fail = (error: Error) => {
      if (watches.get(request.watchId)?.stopping) return;
      send({ type: "error", message: error.message.slice(0, 4000) });
      void stopWatch(request.watchId).catch((cleanupError: unknown) =>
        console.error("Run watch cleanup failed:", cleanupError),
      );
    };
    if (watches.size >= 2) {
      send({ type: "error", message: "Run watch producer limit reached." });
      return;
    }
    const watch: RuntimeWatch = { opening: Promise.resolve(), stopping: false };
    watches.set(request.watchId, watch);
    watch.opening = (async () => {
      const page =
        request.surface === "host"
          ? session.host.page
          : (await observations.open(request.watchId, request, fail)).page;
      watch.cast = await startGameScreencast({
        page,
        send,
        onError: fail,
        onReady: (dimensions) => send({ type: "ready", ...dimensions }),
      });
    })();
    void watch.opening.catch((error: unknown) =>
      fail(error instanceof Error ? error : new Error(String(error))),
    );
    return;
  }
  if (isRuntimeOwnerActionRequest(message)) {
    void (async () => {
      const acknowledgement = await invokeOwnedHostAction(
        session.host,
        message.action,
      );
      process.send?.({
        type: AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
        requestId: message.requestId,
        acknowledgement,
      });
    })();
    return;
  }
  if (!isRuntimeOwnerCaptureRequest(message)) return;
  if (captureRequestId) {
    process.send?.({
      type: AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT,
      requestId: message.requestId,
      ok: false,
      capturedAt: new Date().toISOString(),
      screenshots: [],
      error: "A runtime visual capture is already active.",
    });
    return;
  }
  captureRequestId = message.requestId;
  void (async () => {
    const capturedAt = new Date().toISOString();
    const response: AirJamRuntimeOwnerCaptureResult = {
      type: AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT,
      requestId: message.requestId,
      ok: false,
      capturedAt,
      screenshots: [],
      error: null,
    };
    let observationError: Error | undefined;
    try {
      const captureDir = resolveProjectRelativeRuntimeCaptureDir({
        projectDir: process.cwd(),
        relativeDir: message.relativeDir,
      });
      const controllerSession = await observations.open(
        message.requestId,
        message,
        (error) => {
          observationError = error;
        },
      );
      if (observationError) throw observationError;
      await mkdir(captureDir, { recursive: true });
      const captures = [
        {
          surface: "host" as const,
          fileName: "host-desktop.png",
          viewport: DEFAULT_HOST_VIEWPORT,
          page: session.host.page,
        },
        {
          surface: "controller" as const,
          fileName: "controller-phone.png",
          viewport: DEFAULT_CONTROLLER_VIEWPORT,
          page: controllerSession.page,
        },
      ];
      for (const capture of captures) {
        await capture.page.waitForTimeout(300);
        const filePath = path.join(captureDir, capture.fileName);
        await capture.page.screenshot({ path: filePath });
        response.screenshots.push({
          surface: capture.surface,
          width: capture.viewport.width,
          height: capture.viewport.height,
          relativePath: path.relative(process.cwd(), filePath),
        });
      }
      response.ok = true;
    } catch (error) {
      response.error = error instanceof Error ? error.message : String(error);
    } finally {
      captureRequestId = null;
      if (observationError) {
        response.ok = false;
        response.error = observationError.message;
      }
      try {
        await observations.close(message.requestId);
      } catch (error) {
        response.ok = false;
        response.error = [
          response.error,
          error instanceof Error ? error.message : String(error),
        ]
          .filter(Boolean)
          .join("; ");
      }
    }
    process.send?.(response);
  })();
});

process.on("SIGTERM", () => {
  void shutdown(0);
});

process.on("SIGINT", () => {
  void shutdown(0);
});

process.once("disconnect", () => {
  void shutdown(0);
});

const readInspection = async () => {
  const rawValue = session.host.embedded
    ? await session.host.game
        .locator("body")
        .evaluate(
          (_, key) =>
            (window as unknown as Record<string, unknown>)[key] ?? null,
          AIR_JAM_RUNTIME_INSPECTION_KEY,
        )
    : await session.host.page.evaluate(
        (key) => (window as unknown as Record<string, unknown>)[key] ?? null,
        AIR_JAM_RUNTIME_INSPECTION_KEY,
      );

  const inspection = readRuntimeInspectionContract({
    [AIR_JAM_RUNTIME_INSPECTION_KEY]: rawValue,
  });
  return built &&
    inspection?.role === "host" &&
    inspection.joinUrlStatus === "ready"
    ? {
        ...inspection,
        joinUrl: bindHarnessControllerUrl(
          inspection.joinUrl,
          built.urls.controllerBaseUrl,
        ),
      }
    : inspection;
};

try {
  const startedAt = Date.now();
  let inspection = null;

  while (Date.now() - startedAt < timeoutMs) {
    const nextInspection = await readInspection();
    if (
      nextInspection?.role === "host" &&
      nextInspection.joinUrlStatus === "ready"
    ) {
      inspection = nextInspection;
      break;
    }

    await session.host.page.waitForTimeout(250);
  }

  if (!inspection || inspection.role !== "host") {
    throw new Error(
      "Timed out waiting for a published host runtime inspection contract.",
    );
  }

  if (built) {
    const origin = new URL(session.host.page.url()).origin;
    if (
      origin !== appOrigin ||
      (await session.host.page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => new URL(entry.name).pathname === "/@vite/client"),
      ))
    )
      throw new Error(
        "build_runtime_invalid: The owned browser is not running the pinned production origin.",
      );
  }
  startupDiagnostics = false;
  process.send?.({
    type: "air-jam-runtime-owner.ready/v1",
    roomId: inspection.roomId,
    controllerJoinUrl: inspection.joinUrl,
    inspection,
  });

  await new Promise(() => {
    // Keep the hidden host runtime alive until the parent process disconnects it.
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
}
