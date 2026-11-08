import { z } from "zod";
import type { HostRuntimeFactory } from "../core/host-runtime";
import { airJamInputLogSchema } from "../core/input-log";
import { openAirJamReplay, type AirJamReplay } from "../core/replay-input-log";
import {
  hostObservationRequestSchema,
  hostObservationSchema,
} from "./contracts/observation";

export const AIR_JAM_REPLAY_QUERY = "airjamReplay";
const whole = z.number().int().nonnegative();
export const replayAdvanceSchema = z.union([
  z.object({ steps: whole }).strict(),
  z.object({ ms: z.number().finite().nonnegative() }).strict(),
  z.object({ toTick: whole }).strict(),
]);
export const replayRequestSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("open"),
      log: airJamInputLogSchema,
      observe: hostObservationRequestSchema
        .pick({ scope: true, controllerId: true })
        .optional(),
    })
    .strict(),
  z
    .object({ operation: z.literal("advance"), by: replayAdvanceSchema })
    .strict(),
  z.object({ operation: z.literal("read") }).strict(),
]);
export const replayReadSchema = z
  .object({
    tick: whole,
    ticks: whole,
    done: z.boolean(),
    stepMs: z.number().positive(),
    observation: hostObservationSchema,
  })
  .strict();
export type AirJamReplayRead = z.infer<typeof replayReadSchema>;
export const replayRequestMessageSchema = z
  .object({
    type: z.literal("AIRJAM_REPLAY"),
    requestId: z.string().min(1),
    request: replayRequestSchema,
  })
  .strict();
export const replayMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("AIRJAM_REPLAY_READY") }).strict(),
  z
    .object({
      type: z.literal("AIRJAM_REPLAY_RESULT"),
      requestId: z.string().min(1),
      result: z.discriminatedUnion("ok", [
        z.object({ ok: z.literal(true), response: replayReadSchema }).strict(),
        z.object({ ok: z.literal(false), error: z.string() }).strict(),
      ]),
    })
    .strict(),
]);
export function requestAirJamReplay(
  target: Window,
  origin: string,
  requestId: string,
  request: z.infer<typeof replayRequestSchema>,
) {
  target.postMessage(
    replayRequestMessageSchema.parse({
      type: "AIRJAM_REPLAY",
      requestId,
      request,
    }),
    origin,
  );
}
export function readAirJamReplayMessage(
  event: MessageEvent<unknown>,
  target: Window,
  origin: string,
) {
  if (event.source !== target || event.origin !== origin) return null;
  const parsed = replayMessageSchema.safeParse(event.data);
  return parsed.success ? parsed.data : null;
}

/** One replay per document. Only its explicitly configured parent can drive it. */
export function bindBrowserReplay(options: {
  parent: Window;
  parentOrigin: string;
  createHostRuntime: HostRuntimeFactory;
  mounted: (replay: AirJamReplay) => void | Promise<void>;
  listen: (listener: (event: MessageEvent<unknown>) => void) => () => void;
}) {
  let replay: AirJamReplay | null = null;
  let opened = false;
  let closed = false;
  let observe: { scope: "player" | "diagnostic"; controllerId: string | null } =
    { scope: "diagnostic", controllerId: null };
  let queue = Promise.resolve();
  let remainderMs = 0;
  const read = async (): Promise<AirJamReplayRead> => {
    if (!replay) throw new Error("Open a recording first.");
    const response = await replay.agent({
      operation: "observe",
      roomId: replay.roomId,
      ...observe,
      includeImage: false,
    });
    if (response.operation !== "observe")
      throw new Error("The replay did not return an observation.");
    return {
      tick: replay.tick,
      ticks: replay.ticks,
      done: replay.done,
      stepMs: replay.stepMs,
      observation: response.observation,
    };
  };
  const unlisten = options.listen((event) => {
    if (
      event.source !== options.parent ||
      event.origin !== options.parentOrigin
    )
      return;
    const parsed = replayRequestMessageSchema.safeParse(event.data);
    if (!parsed.success) return;
    const { requestId, request } = parsed.data;
    queue = queue.then(async () => {
      if (closed) return;
      try {
        if (request.operation === "open") {
          if (opened)
            throw new Error(
              "Reopen the game document to start another replay.",
            );
          opened = true;
          replay = await openAirJamReplay(
            options.createHostRuntime,
            request.log,
          );
          if (closed) {
            replay.stop();
            return;
          }
          observe = request.observe ?? observe;
          await options.mounted(replay);
        } else if (request.operation === "advance") {
          if (!replay) throw new Error("Open a recording first.");
          if ("toTick" in request.by) {
            if (request.by.toTick < replay.tick)
              throw new Error("Reopen the game document to go back.");
            remainderMs = 0;
            replay.advance({ steps: request.by.toTick - replay.tick });
          } else if ("ms" in request.by) {
            remainderMs += request.by.ms;
            const steps = Math.floor(remainderMs / replay.stepMs);
            remainderMs -= steps * replay.stepMs;
            replay.advance({ steps });
          } else replay.advance(request.by);
        }
        const response = await read();
        if (!closed)
          options.parent.postMessage(
            {
              type: "AIRJAM_REPLAY_RESULT",
              requestId,
              result: { ok: true, response },
            },
            options.parentOrigin,
          );
      } catch (error) {
        if (!closed)
          options.parent.postMessage(
            {
              type: "AIRJAM_REPLAY_RESULT",
              requestId,
              result: {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              },
            },
            options.parentOrigin,
          );
      }
    });
  });
  options.parent.postMessage(
    { type: "AIRJAM_REPLAY_READY" },
    options.parentOrigin,
  );
  return () => {
    closed = true;
    unlisten();
    replay?.stop();
  };
}
