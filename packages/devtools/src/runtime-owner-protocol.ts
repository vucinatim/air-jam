import type { AirJamActionInvocationResult } from "@air-jam/sdk";
import {
  controllerBridgeServerEvents,
  controllerBridgeSnapshotSchema,
} from "@air-jam/sdk/controller-bridge";
import {
  controllerStateSyncRequestSchema,
  hostStateSyncSchema,
} from "@air-jam/sdk/protocol";
import type { HostRuntimeActionRequest } from "@air-jam/sdk/runtime-control";
import path from "node:path";
import { z } from "zod";

export const AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST =
  "air-jam-runtime-owner.invoke-action/v1" as const;
export const AIR_JAM_RUNTIME_OWNER_ACTION_RESULT =
  "air-jam-runtime-owner.invoke-action-result/v1" as const;
export type AirJamRuntimeOwnerActionRequest = {
  type: typeof AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST;
  requestId: string;
  action: HostRuntimeActionRequest;
};
export type AirJamRuntimeOwnerActionResult = {
  type: typeof AIR_JAM_RUNTIME_OWNER_ACTION_RESULT;
  requestId: string;
  acknowledgement: AirJamActionInvocationResult;
};

export const isRuntimeOwnerActionRequest = (
  value: unknown,
): value is AirJamRuntimeOwnerActionRequest =>
  isRecord(value) &&
  value.type === AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST &&
  typeof value.requestId === "string" &&
  value.requestId.length > 0 &&
  isRecord(value.action) &&
  typeof value.action.roomId === "string" &&
  typeof value.action.storeDomain === "string" &&
  typeof value.action.actionName === "string" &&
  (value.action.payload === undefined || isRecord(value.action.payload));

export const isRuntimeOwnerActionResult = (
  value: unknown,
): value is AirJamRuntimeOwnerActionResult =>
  isRecord(value) &&
  value.type === AIR_JAM_RUNTIME_OWNER_ACTION_RESULT &&
  typeof value.requestId === "string" &&
  isRecord(value.acknowledgement) &&
  typeof value.acknowledgement.ok === "boolean" &&
  ["accepted", "rejected"].includes(String(value.acknowledgement.status)) &&
  ["client", "server", "host"].includes(String(value.acknowledgement.source));

export const AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST =
  "air-jam-runtime-owner.capture-visuals/v1" as const;
export const AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT =
  "air-jam-runtime-owner.capture-visuals-result/v1" as const;

const runtimeOwnerCaptureSchema = z.object({
  type: z.literal(AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST),
  requestId: z.uuid(),
  relativeDir: z.string().min(1),
  snapshot: controllerBridgeSnapshotSchema,
  stores: z.array(hostStateSyncSchema),
});
export type AirJamRuntimeOwnerCaptureRequest = z.infer<
  typeof runtimeOwnerCaptureSchema
>;
export const runtimeOwnerCaptureReadSchema = z.object({
  type: z.literal("air-jam-runtime-owner.capture-read/v1"),
  captureRequestId: z.uuid(),
  payload: controllerStateSyncRequestSchema,
});
export const runtimeOwnerCaptureEventSchema = z.object({
  type: z.literal("air-jam-runtime-owner.capture-event/v1"),
  requestId: z.uuid(),
  event: z.enum(controllerBridgeServerEvents),
  args: z.array(z.unknown()),
});

export type AirJamRuntimeOwnerScreenshot = {
  surface: "host" | "controller";
  width: number;
  height: number;
  relativePath: string;
};

export type AirJamRuntimeOwnerCaptureResult = {
  type: typeof AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT;
  requestId: string;
  ok: boolean;
  capturedAt: string;
  screenshots: AirJamRuntimeOwnerScreenshot[];
  error: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRuntimeOwnerScreenshot = (
  value: unknown,
): value is AirJamRuntimeOwnerScreenshot =>
  isRecord(value) &&
  (value.surface === "host" || value.surface === "controller") &&
  typeof value.width === "number" &&
  Number.isInteger(value.width) &&
  value.width > 0 &&
  typeof value.height === "number" &&
  Number.isInteger(value.height) &&
  value.height > 0 &&
  typeof value.relativePath === "string" &&
  value.relativePath.length > 0;

export const isRuntimeOwnerCaptureRequest = (
  value: unknown,
): value is AirJamRuntimeOwnerCaptureRequest =>
  runtimeOwnerCaptureSchema.safeParse(value).success;

export const isRuntimeOwnerCaptureResult = (
  value: unknown,
): value is AirJamRuntimeOwnerCaptureResult =>
  isRecord(value) &&
  value.type === AIR_JAM_RUNTIME_OWNER_CAPTURE_RESULT &&
  typeof value.requestId === "string" &&
  typeof value.ok === "boolean" &&
  typeof value.capturedAt === "string" &&
  Array.isArray(value.screenshots) &&
  value.screenshots.every(isRuntimeOwnerScreenshot) &&
  (typeof value.error === "string" || value.error === null);

export const resolveProjectRelativeRuntimeCaptureDir = ({
  projectDir,
  relativeDir,
}: {
  projectDir: string;
  relativeDir: string;
}): string => {
  if (path.isAbsolute(relativeDir)) {
    throw new Error(
      "Runtime visual capture directory must be project-relative.",
    );
  }
  const resolved = path.resolve(projectDir, relativeDir);
  const relative = path.relative(projectDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      "Runtime visual capture directory must stay in the project.",
    );
  }
  return resolved;
};
