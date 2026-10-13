import { z } from "zod";
import type { HostRuntimeInspectionContract } from "./contracts/inspection";

const snapshotType = "AIRJAM_HOST_PREVIEW_SNAPSHOT";
const requestType = "AIRJAM_HOST_PREVIEW_INSPECT";

const snapshotSchema = z.object({
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
) {
  if (
    typeof window === "undefined" ||
    window.parent === window ||
    !document.referrer
  )
    return () => {};
  const parentOrigin = new URL(document.referrer).origin;
  const snapshot: HostPreviewSnapshot = {
    roomId: inspection.roomId,
    joinUrl: inspection.joinUrl,
    joinUrlStatus: inspection.joinUrlStatus,
    connectionStatus: inspection.connectionStatus,
    controllers: inspection.controllers.map(({ controllerId, connected }) => ({
      controllerId,
      connected,
    })),
  };
  const publish = () =>
    window.parent.postMessage({ type: snapshotType, snapshot }, parentOrigin);
  const inspect = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    if (
      z
        .object({ type: z.literal(requestType) })
        .strict()
        .safeParse(event.data).success
    )
      publish();
  };
  window.addEventListener("message", inspect);
  publish();
  return () => window.removeEventListener("message", inspect);
}
