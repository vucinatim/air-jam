import { parseControllerBridgeEmitMessage } from "@air-jam/sdk/controller-bridge";
import { controllerStateSyncRequestSchema } from "@air-jam/sdk/protocol";
import {
  AIR_JAM_RUNTIME_INSPECTION_KEY,
  readRuntimeInspectionContract,
} from "@air-jam/sdk/runtime-inspection";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  DEFAULT_CONTROLLER_VIEWPORT,
  DEFAULT_HOST_VIEWPORT,
  launchHarnessBrowser,
  openVisualHarnessHostSession,
  type VisualHarnessMode,
} from "../harness/visual.js";
import { openControllerObservation } from "../harness/visual/controller-observation.js";
import {
  AIR_JAM_RUNTIME_OWNER_ACTION_RESULT,
  AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT,
  isRuntimeOwnerActionRequest,
  isRuntimeOwnerCaptureRequest,
  resolveProjectRelativeRuntimeCaptureDir,
  runtimeOwnerCaptureEventSchema,
  type AirJamRuntimeOwnerCaptureResult,
} from "../runtime-owner-protocol.js";
import { invokeOwnedHostAction } from "./runtime-owner-actions.js";

const getFlagValue = (flag: string): string | null => {
  const inline = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (inline) {
    return inline.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
};

const appOrigin = getFlagValue("--app-origin");
const hostUrl = getFlagValue("--host-url");
const controllerBaseUrl = getFlagValue("--controller-base-url");
const publicHost = getFlagValue("--public-host");
const localBuildUrl = getFlagValue("--local-build-url");
const browserBuildUrl = getFlagValue("--browser-build-url");
const requestedMode = getFlagValue("--mode") ?? "standalone-dev";
const timeoutMs = Number(getFlagValue("--timeout-ms") ?? "15000");

if (!appOrigin || !hostUrl || !controllerBaseUrl || !publicHost) {
  throw new Error(
    "Missing required isolated runtime host inputs. Expected resolved topology URLs.",
  );
}

const browser = await launchHarnessBrowser();
const session = await openVisualHarnessHostSession({
  browser,
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
let controllerSession: Awaited<
  ReturnType<typeof openControllerObservation>
> | null = null;
let captureRequestId: string | null = null;
let pendingCaptureEvents: z.infer<typeof runtimeOwnerCaptureEventSchema>[] = [];
let captureDelivery = Promise.resolve();
let captureDeliveryError: unknown = null;

const shutdown = async (exitCode = 0) => {
  await Promise.allSettled([
    controllerSession?.close(),
    session.close(),
    browser.close(),
  ]);
  process.exit(exitCode);
};

process.on("message", (message: unknown) => {
  const captureEvent = runtimeOwnerCaptureEventSchema.safeParse(message);
  if (
    captureEvent.success &&
    captureEvent.data.requestId === captureRequestId
  ) {
    if (controllerSession) {
      const observation = controllerSession;
      captureDelivery = captureDelivery
        .then(() =>
          observation.deliver(captureEvent.data.event, captureEvent.data.args),
        )
        .catch((error) => {
          captureDeliveryError = error;
        });
    } else pendingCaptureEvents.push(captureEvent.data);
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
    try {
      const captureDir = resolveProjectRelativeRuntimeCaptureDir({
        projectDir: process.cwd(),
        relativeDir: message.relativeDir,
      });
      if (!("harnessSessionId" in message.snapshot))
        throw new Error("Capture requires a harness controller context.");
      const inspection = await readInspection();
      if (
        inspection?.role !== "host" ||
        inspection.roomId !== message.snapshot.roomId
      )
        throw new Error("Capture belongs to another host room.");
      controllerSession = await openControllerObservation({
        browser,
        controllerJoinUrl: inspection.joinUrl,
        snapshot: message.snapshot,
        stores: message.stores,
        onMessage(value) {
          const emitted = parseControllerBridgeEmitMessage(value);
          if (!emitted) return;
          if (emitted.payload.event !== "controller:state_sync_request")
            throw new Error("Capture controller mutation denied.");
          const payload = controllerStateSyncRequestSchema.parse(
            emitted.payload.args[0],
          );
          if (payload.roomId !== message.snapshot.roomId)
            throw new Error("Capture read belongs to another room.");
          process.send?.({
            type: "air-jam-runtime-owner.capture-read/v1",
            captureRequestId: message.requestId,
            payload,
          });
        },
      });
      for (const event of pendingCaptureEvents.splice(0))
        await controllerSession.deliver(event.event, event.args);
      await captureDelivery;
      if (captureDeliveryError) throw captureDeliveryError;
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
      const closing = controllerSession;
      controllerSession = null;
      captureRequestId = null;
      pendingCaptureEvents = [];
      await captureDelivery;
      if (captureDeliveryError) {
        response.ok = false;
        response.error =
          captureDeliveryError instanceof Error
            ? captureDeliveryError.message
            : String(captureDeliveryError);
      }
      try {
        await closing?.close();
      } catch (error) {
        response.ok = false;
        response.error = [
          response.error,
          error instanceof Error ? error.message : String(error),
        ]
          .filter(Boolean)
          .join("; ");
      }
      captureDelivery = Promise.resolve();
      captureDeliveryError = null;
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

  return readRuntimeInspectionContract({
    [AIR_JAM_RUNTIME_INSPECTION_KEY]: rawValue,
  });
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

  process.stdout.write(
    `${JSON.stringify(
      {
        roomId: inspection.roomId,
        controllerJoinUrl: inspection.joinUrl,
        inspection,
      },
      null,
      2,
    )}\n`,
  );

  await new Promise(() => {
    // Keep the hidden host runtime alive until the parent process disconnects it.
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
}
