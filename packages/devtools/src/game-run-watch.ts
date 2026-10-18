import type { Writable } from "node:stream";
import { z } from "zod";

export const MAXIMUM_GAME_WATCH_FRAME_BASE64 = 512 * 1024;
export const GAME_WATCH_HEARTBEAT_MS = 2000;
export const gameRunWatchSurfaceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("host") }).strict(),
  z
    .object({
      kind: z.literal("controller"),
      seatId: z.string().min(1).max(64),
    })
    .strict(),
]);
export type GameRunWatchSurface = z.infer<typeof gameRunWatchSurfaceSchema>;
export function formatGameRunWatchSurface(surface: GameRunWatchSurface) {
  return surface.kind === "host" ? "host" : `controller:${surface.seatId}`;
}
export function parseGameRunWatchSurface(value: string): GameRunWatchSurface {
  return gameRunWatchSurfaceSchema.parse(
    value === "host"
      ? { kind: "host" }
      : value.startsWith("controller:")
        ? { kind: "controller", seatId: value.slice("controller:".length) }
        : { kind: value },
  );
}
export const gameRunWatchRequestSchema = z
  .object({
    cwd: z.string().min(1).optional(),
    runId: z.uuid(),
    surface: gameRunWatchSurfaceSchema,
  })
  .strict();
export const gameRunWatchEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("ready"),
      runId: z.uuid(),
      surface: gameRunWatchSurfaceSchema,
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("frame"),
      seq: z.number().int().nonnegative(),
      capturedAt: z.number().finite(),
      data: z.string().min(1).max(MAXIMUM_GAME_WATCH_FRAME_BASE64),
    })
    .strict(),
  z
    .object({
      type: z.literal("heartbeat"),
      at: z.number().finite(),
      lastFrameSeq: z.number().int().nonnegative().nullable(),
    })
    .strict(),
  z
    .object({ type: z.literal("error"), message: z.string().min(1).max(4000) })
    .strict(),
]);
export type GameRunWatchEvent = z.infer<typeof gameRunWatchEventSchema>;
export const gameSurfaceWatchEventSchema = z.discriminatedUnion("type", [
  gameRunWatchEventSchema.options[0].omit({ runId: true, surface: true }),
  gameRunWatchEventSchema.options[1],
  gameRunWatchEventSchema.options[2],
  gameRunWatchEventSchema.options[3],
]);
export type GameSurfaceWatchEvent = z.infer<typeof gameSurfaceWatchEventSchema>;
export type GameSurfaceWatcher = (
  onEvent: (event: GameSurfaceWatchEvent) => void,
  signal: AbortSignal,
) => Promise<void>;

// Frame production must never wait for a slow viewer or accumulate old images.
export class GameRunWatchWriter {
  private blocked = false;
  private closed = false;
  private ready?: GameRunWatchEvent & { type: "ready" };
  private frame?: GameRunWatchEvent & { type: "frame" };
  private heartbeat?: GameRunWatchEvent & { type: "heartbeat" };
  private readonly drained = () => {
    this.blocked = false;
    this.flush();
  };
  constructor(private readonly output: Writable) {
    output.on("drain", this.drained);
  }
  send(event: GameRunWatchEvent) {
    if (this.closed) return;
    if (event.type === "error") {
      this.close();
      this.output.end(`${JSON.stringify(event)}\n`);
      return;
    }
    if (event.type === "ready") this.ready = event;
    if (event.type === "frame") this.frame = event;
    if (event.type === "heartbeat") this.heartbeat = event;
    this.flush();
  }
  private flush() {
    while (!this.closed && !this.blocked) {
      const event = this.ready ?? this.heartbeat ?? this.frame;
      if (!event) return;
      if (event.type === "ready") this.ready = undefined;
      if (event.type === "frame") this.frame = undefined;
      if (event.type === "heartbeat") this.heartbeat = undefined;
      this.blocked = !this.output.write(`${JSON.stringify(event)}\n`);
    }
  }
  close() {
    this.closed = true;
    this.ready = undefined;
    this.frame = undefined;
    this.heartbeat = undefined;
    this.output.off("drain", this.drained);
  }
}

export async function readGameRunWatchStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: GameRunWatchEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const part = await reader.read();
      pending += decoder.decode(part.value, { stream: !part.done });
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        if (newline > MAXIMUM_GAME_WATCH_FRAME_BASE64 + 8192)
          throw new Error("Run watch event exceeds its transfer allowance.");
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        const event = gameRunWatchEventSchema.parse(JSON.parse(line));
        onEvent(event);
        if (event.type === "error") throw new Error(event.message);
      }
      if (pending.length > MAXIMUM_GAME_WATCH_FRAME_BASE64 + 8192)
        throw new Error("Run watch event exceeds its transfer allowance.");
      if (part.done) {
        if (pending.length)
          throw new Error("Run watch ended with an incomplete event.");
        return;
      }
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
