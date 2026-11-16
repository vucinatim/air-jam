import { z } from "zod";

export const SOCKET_PAYLOAD_BOUNDS = {
  controller: {
    bytes: 4096,
    depth: 8,
    keys: 64,
    stringLength: 1024,
    events: 240,
  },
  hostState: {
    bytes: 65_536,
    depth: 12,
    keys: 256,
    stringLength: 4096,
    events: 480,
  },
  lifecycle: {
    bytes: 8192,
    depth: 8,
    keys: 64,
    stringLength: 4096,
    events: 30,
  },
} as const;
export type SocketPayloadLane = keyof typeof SOCKET_PAYLOAD_BOUNDS;
export const SOCKET_INGRESS_WINDOW_MS = 1000;
export const SOCKET_INGRESS_ABUSE_LIMIT = 64;
export const SOCKET_MAX_HTTP_BUFFER_SIZE =
  SOCKET_PAYLOAD_BOUNDS.hostState.bytes;

/** Walk before Zod or serialization, including unknown properties that Zod strips. */
export function isSocketPayloadBounded(
  value: unknown,
  lane: SocketPayloadLane,
): boolean {
  const bounds = SOCKET_PAYLOAD_BOUNDS[lane];
  const pending = [{ value, depth: 0 }];
  const seen = new Set<object>();
  const encoder = new TextEncoder();
  let bytes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (current.depth > bounds.depth) return false;
    const entry = current.value;
    if (entry === null || typeof entry === "boolean") {
      bytes += entry === null || entry === true ? 4 : 5;
    } else if (typeof entry === "number") {
      if (!Number.isFinite(entry)) return false;
      bytes += String(entry).length;
    } else if (typeof entry === "string") {
      if (entry.length > bounds.stringLength) return false;
      bytes += encoder.encode(JSON.stringify(entry)).byteLength;
    } else if (typeof entry === "object") {
      if (seen.has(entry)) return false;
      seen.add(entry);
      const array = Array.isArray(entry);
      if (
        !array &&
        Object.getPrototypeOf(entry) !== Object.prototype &&
        Object.getPrototypeOf(entry) !== null
      )
        return false;
      const keys = Object.keys(entry).filter(
        (key) => array || (entry as Record<string, unknown>)[key] !== undefined,
      );
      if (!array && keys.length > bounds.keys) return false;
      // Each child costs at least one byte, even before its value is inspected.
      if (keys.length + pending.length > bounds.bytes) return false;
      bytes += 2 + Math.max(0, keys.length - 1);
      for (const key of keys) {
        if (!array) {
          if (key.length > bounds.stringLength) return false;
          bytes += encoder.encode(JSON.stringify(key)).byteLength + 1;
        }
        pending.push({
          value: (entry as Record<string, unknown>)[key],
          depth: current.depth + 1,
        });
      }
    } else {
      return false;
    }
    if (bytes > bounds.bytes) return false;
  }
  return true;
}

export const boundedSocketSchema = <Schema extends z.ZodType>(
  schema: Schema,
  lane: SocketPayloadLane,
) =>
  z
    .unknown()
    .refine((value) => isSocketPayloadBounded(value, lane), {
      error: `Socket payload exceeds the ${lane} JSON bounds.`,
      abort: true,
    })
    .pipe(schema);
