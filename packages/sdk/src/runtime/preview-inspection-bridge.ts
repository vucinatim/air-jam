import { z } from "zod";
import { controllerOrientationSchema } from "../protocol/controller";
import type { ResolvedAirJamRuntimeTopology } from "../runtime-topology";
import {
  hostStateEpochSchema,
  subscribeHostStateOwners,
} from "./contracts/control";
import type { HostRuntimeInspectionContract } from "./contracts/inspection";
import { embeddedRuntimeParent } from "./embedded-parent";

const snapshotType = "AIRJAM_HOST_PREVIEW_SNAPSHOT";
const requestType = "AIRJAM_HOST_PREVIEW_INSPECT";

const snapshotSchema = z.object({
  hostAgentSupported: z.boolean().optional(),
  controllerOrientation: controllerOrientationSchema.optional(),
  documentId: z.string().min(1).max(128).optional(),
  stateEpochs: z
    .array(hostStateEpochSchema)
    .max(64)
    .refine(
      (epochs) =>
        new Set(epochs.map((entry) => entry.storeDomain)).size ===
        epochs.length,
      "State domains must have one reported owner.",
    )
    .optional(),
  roomId: z.string().max(8),
  joinUrl: z.string().max(4096),
  joinUrlStatus: z.enum(["loading", "ready", "unavailable"]),
  connectionStatus: z.enum([
    "idle",
    "connecting",
    "connected",
    "disconnected",
    "reconnecting",
  ]),
  controllers: z
    .array(
      z.object({
        controllerId: z.string().min(1).max(128),
        connected: z.boolean(),
      }),
    )
    .max(256),
});

export type HostPreviewSnapshot = z.infer<typeof snapshotSchema>;

export function readHostPreviewSnapshot(
  event: MessageEvent<unknown>,
  expectedWindow: Window,
  expectedOrigin: string,
): HostPreviewSnapshot | null {
  if (event.source !== expectedWindow || event.origin !== expectedOrigin)
    return null;
  const parsed = z
    .object({
      type: z.literal(snapshotType),
      snapshot: snapshotSchema,
    })
    .safeParse(event.data);
  if (!parsed.success) return null;
  const snapshot = parsed.data.snapshot;
  if (snapshot.joinUrlStatus === "ready") {
    let join: URL;
    try {
      join = new URL(snapshot.joinUrl);
    } catch {
      return null;
    }
    if (
      join.origin !== expectedOrigin ||
      join.searchParams.get("room") !== snapshot.roomId ||
      join.username ||
      join.password
    )
      return null;
  }
  return snapshot;
}

export function requestHostPreviewSnapshot(target: Window, origin: string) {
  target.postMessage({ type: requestType }, origin);
}

// Presentation inspection only: no callable host actions or game state cross this bridge.
export function publishEmbeddedHostPreview(
  inspection: HostRuntimeInspectionContract,
  topology: ResolvedAirJamRuntimeTopology,
  hostAgentSupported = false,
) {
  const parent = embeddedRuntimeParent(topology);
  if (!parent) return () => {};
  const publish = () => {
    const snapshot: HostPreviewSnapshot = {
      hostAgentSupported,
      controllerOrientation: inspection.controllerOrientation,
      documentId: inspection.documentId,
      stateEpochs: inspection.stateEpochs,
      roomId: inspection.roomId,
      joinUrl: inspection.joinUrl,
      joinUrlStatus: inspection.joinUrlStatus,
      connectionStatus: inspection.connectionStatus,
      controllers: inspection.controllers.map(
        ({ controllerId, connected }) => ({
          controllerId,
          connected,
        }),
      ),
    };
    parent.window.postMessage({ type: snapshotType, snapshot }, parent.origin);
  };
  const inspect = (event: MessageEvent<unknown>) => {
    if (event.source !== parent.window || event.origin !== parent.origin)
      return;
    if (
      z
        .object({ type: z.literal(requestType) })
        .strict()
        .safeParse(event.data).success
    )
      publish();
  };
  window.addEventListener("message", inspect);
  const unsubscribe = subscribeHostStateOwners(window, publish);
  publish();
  return () => {
    unsubscribe();
    window.removeEventListener("message", inspect);
  };
}
