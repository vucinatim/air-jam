import type { ControllerRuntime } from "../core/controller-runtime";
import type { AirJamControllerEnvironment } from "../core/environment";
import { updateDevBrowserLogContext } from "../dev/browser-log-sink";
import { readPreviewControllerDeviceIdFromLocation } from "../preview/identity";
import {
  AIR_JAM_PREVIEW_CLOSE_RESULT,
  isPreviewCloseRequestMessage,
} from "../preview/messages";
import type { ControllerLeaveAck } from "../protocol";
import { detectRunMode } from "../utils/mode";
import { resolveImplicitReplicatedStoreDomainFromWindow } from "./arcade-runtime-url";
import {
  clearControllerRoomBinding,
  getOrCreateControllerDeviceId,
  readControllerRoomBinding,
  writeControllerRoomBinding,
} from "./controller-identity";
import { getControllerRealtimeClient } from "./controller-realtime-client";
import { emitAirJamDevRuntimeEvent } from "./dev-runtime-events";
import { readEmbeddedControllerChildSession } from "./embedded-runtime-adapters";

/** The controller environment of a browser page: its URL, storage and device. */
export const createBrowserControllerEnvironment =
  (): AirJamControllerEnvironment => {
    const params = new URLSearchParams(window.location.search);
    const embedded = readEmbeddedControllerChildSession();
    const previewDeviceId = readPreviewControllerDeviceIdFromLocation();
    return {
      embedded: embedded
        ? {
            roomId: embedded.roomId,
            controllerId: embedded.controllerId,
            ...(embedded.playerProfile
              ? { playerProfile: embedded.playerProfile }
              : {}),
          }
        : null,
      requestedRoomId: params.get("room")?.toUpperCase() ?? null,
      requestedControllerId: params.get("controllerId"),
      capabilityToken: params.get("aj_controller_cap"),
      deviceId: embedded
        ? null
        : (previewDeviceId ?? getOrCreateControllerDeviceId()),
      leaveOnStop: previewDeviceId !== null,
      runMode: detectRunMode(),
      defaultStoreDomain: resolveImplicitReplicatedStoreDomainFromWindow(),
      readBinding: readControllerRoomBinding,
      writeBinding: writeControllerRoomBinding,
      clearBinding: clearControllerRoomBinding,
      vibrate: (pattern) => {
        if (typeof navigator !== "undefined" && navigator.vibrate)
          navigator.vibrate(pattern);
      },
      transport: (getSocket) => getControllerRealtimeClient(getSocket),
      emitDevEvent: emitAirJamDevRuntimeEvent,
      setDevLogContext: updateDevBrowserLogContext,
    };
  };

/**
 * A preview controller frame leaves its room when the preview workspace asks it
 * to close, then reports the result to its parent.
 */
export const listenForPreviewClose = (
  runtime: ControllerRuntime,
  disconnectSocket: (role: "controller") => void,
): (() => void) => {
  const socket = runtime.socket;
  if (
    !socket ||
    runtime.isEmbedded ||
    readPreviewControllerDeviceIdFromLocation() === null
  )
    return () => {};
  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    if (!isPreviewCloseRequestMessage(event.data)) return;
    void runtime
      .leave()
      .catch(() => ({ ok: false }) satisfies ControllerLeaveAck)
      .then((ack) => {
        window.parent.postMessage(
          { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: ack.ok },
          "*",
        );
        socket.disconnect();
        disconnectSocket("controller");
      });
  };
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
};
