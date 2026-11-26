import type { AirJamConfig } from "../core/config";
import type { ControllerRuntime } from "../core/controller-runtime";
import type { AirJamControllerEnvironment } from "../core/environment";
import { updateDevBrowserLogContext } from "../dev/browser-log-sink";
import {
  readPreviewControllerDeviceIdFromLocation,
  readPreviewControllerParent,
} from "../preview/identity";
import {
  AIR_JAM_PREVIEW_CLOSE_RESULT,
  AIR_JAM_PREVIEW_SEAT,
  isPreviewCloseRequestMessage,
} from "../preview/messages";
import { browserDeviceWakeEvents } from "../room-session/browser-wake-events";
import { PhoneRoomSession } from "../room-session/phone-room-session";
import { createRoomKey } from "../room-session/room-key";
import { readAirJamSurfaceSettings } from "../settings/surface-settings";
import { detectRunMode } from "../utils/mode";
import { resolveImplicitReplicatedStoreDomainFromWindow } from "./arcade-runtime-url";
import {
  browserRoomConnector,
  devLogRuntimeErrorReporter,
} from "./browser-room";
import { controllerBridgeContext } from "./controller-bridge-context";
import { createControllerRoomBindings } from "./controller-identity";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";
import { readEmbeddedControllerChildSession } from "./embedded-runtime-adapters";
import { readLocalSeatLabel } from "./local-seats";

/** The controller environment of a browser page: its URL, storage and device. */
export const createBrowserControllerEnvironment = (
  config: AirJamConfig,
): AirJamControllerEnvironment => {
  const params = new URLSearchParams(window.location.search);
  const embedded = readEmbeddedControllerChildSession();
  const previewDeviceId = readPreviewControllerDeviceIdFromLocation();
  const connector = browserRoomConnector({
    topology: config.topology,
    role: "controller",
    embedding: embedded ? controllerBridgeContext(embedded) : null,
  });
  return {
    embedded: embedded
      ? {
          roomId: embedded.roomId,
          ...(embedded.playerProfile
            ? { playerProfile: embedded.playerProfile }
            : {}),
        }
      : null,
    requestedRoomId: params.get("room")?.toUpperCase() ?? null,
    seatKind: previewDeviceId ? "preview" : "phone",
    localSeatLabel: readLocalSeatLabel(),
    runMode: detectRunMode(),
    defaultStoreDomain: resolveImplicitReplicatedStoreDomainFromWindow(),
    presentationChannel: config.presentationChannel,
    joinRoom: (options) =>
      new PhoneRoomSession({
        ...options,
        connector,
        deviceWakeEvents: browserDeviceWakeEvents,
      }),
    createKey: createRoomKey,
    ...createControllerRoomBindings(previewDeviceId ?? "phone"),
    vibrate: (pattern) => {
      if (
        readAirJamSurfaceSettings().vibration &&
        typeof navigator !== "undefined" &&
        navigator.vibrate
      )
        navigator.vibrate(pattern);
    },
    requestFrame: (callback) => {
      requestAnimationFrame(() => callback());
    },
    reportError: config.reportError ?? devLogRuntimeErrorReporter,
    emitDevEvent: emitAirJamDevRuntimeEvent,
    setDevLogContext: updateDevBrowserLogContext,
  };
};

/**
 * A preview controller frame tells its declared parent which seat it holds,
 * and leaves its room when that parent asks it to close, then reports that
 * it did.
 */
export const followPreviewParent = (runtime: ControllerRuntime) => {
  const parent = readPreviewControllerParent();
  const deviceId = readPreviewControllerDeviceIdFromLocation();
  if (runtime.isEmbedded || !parent || !deviceId) return () => {};
  let reported: string | null | undefined;
  const reportSeat = () => {
    const seat = runtime.store.getState().controllerId;
    if (seat === reported) return;
    reported = seat;
    parent.window.postMessage(
      { type: AIR_JAM_PREVIEW_SEAT, deviceId, seat },
      parent.origin,
    );
  };
  reportSeat();
  const stopReporting = runtime.store.subscribe(reportSeat);
  const handleMessage = (event: MessageEvent) => {
    if (event.source !== parent.window || event.origin !== parent.origin)
      return;
    if (!isPreviewCloseRequestMessage(event.data)) return;
    void runtime
      .leave()
      .then((ack) =>
        parent.window.postMessage(
          { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: ack.ok },
          parent.origin,
        ),
      );
  };
  window.addEventListener("message", handleMessage);
  return () => {
    stopReporting();
    window.removeEventListener("message", handleMessage);
  };
};
