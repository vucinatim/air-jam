import { z } from "zod";
import { prefabCatalogMetadataSchema } from "../prefabs/types";
import { prefabViewSchema } from "../prefabs/view";

export const AIR_JAM_INSPECT_QUERY = "airjamInspect";
export function isAirJamInspectionDocument(
  search = typeof window === "undefined" ? "" : window.location.search,
) {
  return new URLSearchParams(search).get(AIR_JAM_INSPECT_QUERY) === "1";
}
export const prefabSelectionSchema = z
  .object({
    prefabId: z.string().min(1),
    stateId: z.string().min(1),
    time: z.number().nonnegative().finite(),
    playing: z.boolean(),
    view: prefabViewSchema,
  })
  .strict();
export type PrefabSelection = z.infer<typeof prefabSelectionSchema>;
export const prefabCaptureViewSchema = prefabSelectionSchema.pick({
  stateId: true,
  time: true,
  view: true,
});
export type PrefabCaptureView = z.infer<typeof prefabCaptureViewSchema>;
export const prefabInspectionRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("AIRJAM_PREFAB_READ") }).strict(),
  z
    .object({
      type: z.literal("AIRJAM_PREFAB_SELECT"),
      selection: prefabSelectionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("AIRJAM_PREFAB_CAPTURE"),
      requestId: z.string().min(1),
      views: z.array(prefabCaptureViewSchema).min(1).max(8),
    })
    .strict(),
]);
export const prefabCapturedImageSchema = prefabCaptureViewSchema
  .extend({
    imageUrl: z
      .string()
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
      .max(3_000_000),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
export type PrefabCapturedImage = z.infer<typeof prefabCapturedImageSchema>;
export const prefabInspectionMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("AIRJAM_PREFAB_READY"),
      catalog: prefabCatalogMetadataSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("AIRJAM_PREFAB_UNAVAILABLE"),
      reason: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal("AIRJAM_PREFAB_SELECTION"),
      selection: prefabSelectionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("AIRJAM_PREFAB_ERROR"),
      reason: z.string(),
      requestId: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("AIRJAM_PREFAB_CAPTURED"),
      requestId: z.string(),
      images: z.array(prefabCapturedImageSchema).min(1).max(8),
    })
    .strict(),
]);
export type PrefabInspectionMessage = z.infer<
  typeof prefabInspectionMessageSchema
>;

/** A view waits two rendered frames; a throttled hidden page renders slowly. */
const CAPTURE_SECONDS_PER_VIEW = 5;

/** Binds exactly one document window and origin. Dispose before replacing it. */
export function createPrefabInspectionClient(options: {
  target: Window;
  origin: string;
  onMessage: (message: PrefabInspectionMessage) => void;
}) {
  const pending = new Map<
    string,
    {
      resolve: (images: PrefabCapturedImage[]) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  let closed = false;
  const send = (value: z.infer<typeof prefabInspectionRequestSchema>) => {
    if (closed) throw new Error("The asset inspection document was closed.");
    options.target.postMessage(
      prefabInspectionRequestSchema.parse(value),
      options.origin,
    );
  };
  const receive = (event: MessageEvent<unknown>) => {
    if (event.source !== options.target || event.origin !== options.origin)
      return;
    const parsed = prefabInspectionMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    const message = parsed.data;
    if (
      message.type === "AIRJAM_PREFAB_CAPTURED" ||
      message.type === "AIRJAM_PREFAB_ERROR"
    ) {
      const entry = message.requestId
        ? pending.get(message.requestId)
        : undefined;
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(message.requestId!);
        if (message.type === "AIRJAM_PREFAB_CAPTURED")
          entry.resolve(message.images);
        else entry.reject(new Error(message.reason));
      }
    }
    options.onMessage(message);
  };
  window.addEventListener("message", receive);
  return {
    read: () => send({ type: "AIRJAM_PREFAB_READ" }),
    select: (selection: PrefabSelection) =>
      send({ type: "AIRJAM_PREFAB_SELECT", selection }),
    capture: (views: PrefabCaptureView[]) =>
      new Promise<PrefabCapturedImage[]>((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = setTimeout(
          () => {
            pending.delete(requestId);
            reject(new Error("The asset renderer did not answer capture."));
          },
          CAPTURE_SECONDS_PER_VIEW * 1000 * (views.length + 1),
        );
        pending.set(requestId, { resolve, reject, timer });
        try {
          send({ type: "AIRJAM_PREFAB_CAPTURE", requestId, views });
        } catch (error) {
          clearTimeout(timer);
          pending.delete(requestId);
          reject(error);
        }
      }),
    dispose: () => {
      closed = true;
      window.removeEventListener("message", receive);
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error("The asset document was replaced."));
      }
      pending.clear();
    },
  };
}
