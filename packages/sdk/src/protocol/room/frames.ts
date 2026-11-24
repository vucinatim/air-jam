import { z } from "zod";
import { MAXIMUM_ROOM_SEATS, roomLimitsWireSchema } from "./limits";
import { isPlainObject, type StateDocument } from "./patch";
import { seatIdSchema } from "./seat-id";

/**
 * Text frames are JSON objects with a `type`. Within a protocol version change
 * is additive: a receiver ignores frame types and fields it does not know, so
 * no schema here is strict. The literal text frames `ping` and `pong` are the
 * heartbeat.
 */
export const ROOM_PROTOCOL_VERSION = 1;
export const PING_FRAME = "ping";
export const PONG_FRAME = "pong";
/** How deeply a frame's JSON may nest; nothing walks a deeper frame. */
export const MAXIMUM_FRAME_DEPTH = 32;

const keySchema = z.string().min(16).max(128);
const instanceSchema = z.string().min(1).max(64);
const channelSchema = z.string().min(1).max(128);
const revisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const requestIdSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const featuresSchema = z.array(z.string().min(1).max(64)).max(32);
const documentSchema = z.custom<StateDocument>(isPlainObject, {
  message: "A state document is a plain JSON object.",
});
const pathSchema = z.array(z.string()).min(1).max(32);

export const seatKindSchema = z.enum(["phone", "preview", "agent"]);
export type SeatKind = z.infer<typeof seatKindSchema>;

export const seatProfileSchema = z.object({
  label: z.string().trim().min(1).max(24).optional(),
  avatarId: z.string().trim().min(1).max(48).optional(),
  /** Shown instead of the label while a local seat plays through this phone. */
  localSeatLabel: z.string().trim().min(1).max(32).optional(),
});
export type SeatProfile = z.infer<typeof seatProfileSchema>;

/**
 * The first frame from every client. `key` is a secret of 128 random bits the
 * client stored before connecting; the same key always means the same seat or
 * host. `instance` is present on a resume: the room instance the key belongs
 * to, so a resume never walks into a stranger's room that reused the code.
 */
const helloFields = {
  type: z.literal("hello"),
  key: keySchema,
  instance: instanceSchema.optional(),
  sdk: z.string().min(1).max(64),
  features: featuresSchema.optional(),
};

export const hostHelloSchema = z.object({
  ...helloFields,
  /** Opaque to the room; the gate reads it before the room opens. */
  credential: z.string().min(1).max(8_192).optional(),
  /** How many players the game takes; the room admits no more. */
  seats: z.number().int().min(1).max(MAXIMUM_ROOM_SEATS),
});
export type HostHello = z.infer<typeof hostHelloSchema>;

export const phoneHelloSchema = z.object({
  ...helloFields,
  kind: seatKindSchema,
  profile: seatProfileSchema.optional(),
  /**
   * The page this phone runs in, the same across its reconnects. A seat
   * resumed from another page (a reload, or another tab taking it over)
   * starts its controls afresh, so the host takes a new input baseline.
   */
  page: z.string().min(1).max(64).optional(),
});
export type PhoneHello = z.infer<typeof phoneHelloSchema>;

const statePatchFields = {
  type: z.literal("state"),
  channel: channelSchema,
  revision: revisionSchema,
  base: revisionSchema,
  set: z.array(z.tuple([pathSchema, z.unknown()])).default([]),
  unset: z.array(pathSchema).default([]),
};
const stateDocumentFields = {
  type: z.literal("state"),
  channel: channelSchema,
  revision: revisionSchema,
  document: documentSchema,
};

export const hostStateFrameSchema = z.union([
  z.object({
    ...stateDocumentFields,
    /** The store's shape, so a reloading host knows whether to take its state back. */
    fingerprint: z.string().min(1).max(256).optional(),
    /** A top-level field keyed by seat whose entries only their own seat sees. */
    private: z.string().min(1).max(128).optional(),
  }),
  z
    .object(statePatchFields)
    .refine(
      (frame) => frame.revision > frame.base,
      "A patch produces a later revision than its base.",
    ),
]);
export type HostStateFrame = z.infer<typeof hostStateFrameSchema>;

export const hostToRoomFrameSchemas = {
  state: hostStateFrameSchema,
  response: z.object({
    type: z.literal("response"),
    seat: seatIdSchema,
    id: requestIdSchema,
    result: z.unknown(),
  }),
  signal: z.object({
    type: z.literal("signal"),
    seat: seatIdSchema.optional(),
    kind: z.string().min(1).max(64),
    payload: z.unknown(),
  }),
  room: z.object({
    type: z.literal("room"),
    seats: z.number().int().min(1).max(MAXIMUM_ROOM_SEATS).optional(),
    locked: z.boolean().optional(),
  }),
  remove: z.object({ type: z.literal("remove"), seat: seatIdSchema }),
  drop: z.object({ type: z.literal("drop"), channel: channelSchema }),
  activity: z.object({
    type: z.literal("activity"),
    activity: z.string().min(1).max(128).nullable(),
  }),
  end: z.object({ type: z.literal("end") }),
} as const;

export const phoneToRoomFrameSchemas = {
  request: z.object({
    type: z.literal("request"),
    id: requestIdSchema,
    channel: channelSchema,
    name: z.string().min(1).max(128),
    payload: z.unknown(),
  }),
  profile: z
    .object({
      type: z.literal("profile"),
      label: seatProfileSchema.shape.label,
      avatarId: seatProfileSchema.shape.avatarId,
    })
    .refine(
      (frame) => frame.label !== undefined || frame.avatarId !== undefined,
      "A profile change names a label or an avatar.",
    ),
  leave: z.object({ type: z.literal("leave") }),
} as const;

type FramesOf<Schemas extends Record<string, z.ZodType>> = {
  [Type in keyof Schemas]: z.infer<Schemas[Type]>;
}[keyof Schemas];

export type HostToRoomFrame = FramesOf<typeof hostToRoomFrameSchemas>;
export type PhoneToRoomFrame = FramesOf<typeof phoneToRoomFrameSchemas>;

export const seatViewSchema = z.object({
  id: seatIdSchema,
  label: z.string(),
  color: z.string(),
  avatarId: z.string().optional(),
  kind: seatKindSchema,
  connected: z.boolean(),
});
export type SeatView = z.infer<typeof seatViewSchema>;

export const channelCopySchema = z.object({
  channel: channelSchema,
  revision: revisionSchema,
  document: documentSchema,
  fingerprint: z.string().optional(),
  private: z.string().optional(),
});
export type ChannelCopy = z.infer<typeof channelCopySchema>;

const welcomeFields = {
  type: z.literal("welcome"),
  code: z.string(),
  instance: instanceSchema,
  seats: z.array(seatViewSchema),
  channels: z.array(channelCopySchema),
  limits: roomLimitsWireSchema,
  features: featuresSchema,
};

export const roomStateFrameSchema = z.union([
  z.object(stateDocumentFields),
  z.object(statePatchFields),
]);
export type RoomStateFrame = z.infer<typeof roomStateFrameSchema>;

export const roomToHostFrameSchemas = {
  welcome: z.object({
    ...welcomeFields,
    /** Seats the room admits, and whether it admits new players at all. */
    seatsWanted: z.number().int().min(1).max(MAXIMUM_ROOM_SEATS),
    locked: z.boolean(),
    activity: z.string().nullable(),
  }),
  wait: z.object({
    type: z.literal("wait"),
    position: z.number().int().positive(),
  }),
  seat: z.object({
    type: z.literal("seat"),
    seat: seatViewSchema,
    /** The seat's controls restart from a new page: decode them afresh. */
    inputBaseline: z.literal(true).optional(),
  }),
  left: z.object({ type: z.literal("left"), seat: seatIdSchema }),
  need: z.object({ type: z.literal("need"), channel: channelSchema }),
  request: z.object({
    type: z.literal("request"),
    seat: seatIdSchema,
    id: requestIdSchema,
    channel: channelSchema,
    name: z.string(),
    payload: z.unknown(),
  }),
} as const;

export const roomToPhoneFrameSchemas = {
  welcome: z.object({
    ...welcomeFields,
    seat: seatIdSchema,
    host: z.boolean(),
  }),
  seat: roomToHostFrameSchemas.seat,
  left: roomToHostFrameSchemas.left,
  host: z.object({ type: z.literal("host"), present: z.boolean() }),
  state: roomStateFrameSchema,
  drop: hostToRoomFrameSchemas.drop,
  // The refusal comes first: a result may be absent, so the other branch
  // would accept a refusal and strip what it says.
  response: z.union([
    z.object({
      type: z.literal("response"),
      id: requestIdSchema,
      /** The room answered itself because no host could. */
      refused: z.literal("host-away"),
    }),
    z.object({
      type: z.literal("response"),
      id: requestIdSchema,
      result: z.unknown(),
    }),
  ]),
  signal: z.object({
    type: z.literal("signal"),
    kind: z.string(),
    payload: z.unknown(),
  }),
} as const;

export type RoomToHostFrame = FramesOf<typeof roomToHostFrameSchemas>;
export type RoomToPhoneFrame = FramesOf<typeof roomToPhoneFrameSchemas>;

export type ParsedFrame<Frame> =
  | { readonly status: "frame"; readonly frame: Frame }
  /** A newer peer's frame type; ignored, not an error. */
  | { readonly status: "unknown" }
  | { readonly status: "invalid" }
  /** Nested past `MAXIMUM_FRAME_DEPTH`; a limit broken, not a mistake. */
  | { readonly status: "too-deep" };

const nestsWithin = (value: unknown, depth: number): boolean => {
  if (typeof value !== "object" || value === null) return true;
  if (depth === 0) return false;
  for (const child of Object.values(value))
    if (!nestsWithin(child, depth - 1)) return false;
  return true;
};

const TOO_DEEP = Symbol("too deep");

const parseJson = (text: string): unknown => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  return nestsWithin(value, MAXIMUM_FRAME_DEPTH) ? value : TOO_DEEP;
};

const readType = (value: unknown): string | null =>
  isPlainObject(value) && typeof value.type === "string" ? value.type : null;

const createFrameParser =
  <Schemas extends Record<string, z.ZodType>>(schemas: Schemas) =>
  (text: string): ParsedFrame<FramesOf<Schemas>> => {
    const value = parseJson(text);
    if (value === TOO_DEEP) return { status: "too-deep" };
    const type = readType(value);
    if (type === null) return { status: "invalid" };
    if (!Object.hasOwn(schemas, type)) return { status: "unknown" };
    const parsed = (schemas[type] as z.ZodType).safeParse(value);
    return parsed.success
      ? { status: "frame", frame: parsed.data as FramesOf<Schemas> }
      : { status: "invalid" };
  };

export const parseHostToRoomFrame = createFrameParser(hostToRoomFrameSchemas);
export const parsePhoneToRoomFrame = createFrameParser(phoneToRoomFrameSchemas);
export const parseRoomToHostFrame = createFrameParser(roomToHostFrameSchemas);
export const parseRoomToPhoneFrame = createFrameParser(roomToPhoneFrameSchemas);

const createHelloParser =
  <Schema extends z.ZodType>(schema: Schema) =>
  (text: string): z.infer<Schema> | null => {
    const parsed = schema.safeParse(parseJson(text));
    return parsed.success ? parsed.data : null;
  };

export const parseHostHello = createHelloParser(hostHelloSchema);
export const parsePhoneHello = createHelloParser(phoneHelloSchema);

export const encodeFrame = (
  frame:
    | HostHello
    | PhoneHello
    | HostToRoomFrame
    | PhoneToRoomFrame
    | RoomToHostFrame
    | RoomToPhoneFrame,
): string => JSON.stringify(frame);
