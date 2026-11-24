import {
  applyWeighedStatePatch,
  isPlainObject,
  stateWeight,
  type ChannelCopy,
  type HostStateFrame,
  type RoomLimits,
  type RoomStateFrame,
  type SeatId,
  type StateDocument,
} from "@air-jam/sdk/room-protocol";

interface Copy {
  revision: number;
  document: StateDocument;
  fingerprint?: string;
  private?: string;
  weight: number;
}

export interface SavedChannel {
  readonly channel: string;
  readonly revision: number;
  readonly document: StateDocument;
  readonly fingerprint?: string;
  readonly private?: string;
}

export type StateOutcome =
  /** The copy took the frame; relay what each phone may see. */
  | {
      readonly kind: "applied";
      readonly channel: string;
      readonly frameFor: (seat: SeatId) => RoomStateFrame;
    }
  /** The copy cannot take the patch; ask the host for the document. */
  | { readonly kind: "need"; readonly channel: string }
  /** The copy is already waiting for the document. */
  | { readonly kind: "waiting" }
  | { readonly kind: "too-large" }
  | { readonly kind: "too-many" };

const projectEntries = (entries: unknown, seat: SeatId): StateDocument =>
  isPlainObject(entries) && Object.hasOwn(entries, seat)
    ? { [seat]: entries[seat] }
    : {};

const projectDocument = (copy: Copy, seat: SeatId): StateDocument =>
  copy.private !== undefined && Object.hasOwn(copy.document, copy.private)
    ? {
        ...copy.document,
        [copy.private]: projectEntries(copy.document[copy.private], seat),
      }
    : copy.document;

/**
 * The room's copy of each channel's document. The host is the only writer;
 * the room applies its patches so it can serve a joining or returning device
 * without involving the host, and keeps each seat's private entry from every
 * other seat.
 */
export class ChannelCopies {
  private readonly copies = new Map<string, Copy>();
  private readonly waiting = new Set<string>();

  constructor(private readonly limits: RoomLimits) {}

  receive(frame: HostStateFrame): StateOutcome {
    return "document" in frame
      ? this.receiveDocument(frame)
      : this.receivePatch(frame);
  }

  drop(channel: string): boolean {
    this.waiting.delete(channel);
    return this.copies.delete(channel);
  }

  forHost(): ChannelCopy[] {
    return [...this.copies].map(([channel, copy]) => ({
      channel,
      revision: copy.revision,
      document: copy.document,
      fingerprint: copy.fingerprint,
      private: copy.private,
    }));
  }

  forSeat(seat: SeatId): ChannelCopy[] {
    return [...this.copies].map(([channel, copy]) => ({
      channel,
      revision: copy.revision,
      document: projectDocument(copy, seat),
    }));
  }

  saved(channel: string): SavedChannel | null {
    const copy = this.copies.get(channel);
    return copy
      ? {
          channel,
          revision: copy.revision,
          document: copy.document,
          fingerprint: copy.fingerprint,
          private: copy.private,
        }
      : null;
  }

  restore(channel: SavedChannel): void {
    this.copies.set(channel.channel, {
      revision: channel.revision,
      document: channel.document,
      fingerprint: channel.fingerprint,
      private: channel.private,
      weight: stateWeight(channel.document),
    });
  }

  describe(): Array<{ channel: string; revision: number; weight: number }> {
    return [...this.copies].map(([channel, copy]) => ({
      channel,
      revision: copy.revision,
      weight: copy.weight,
    }));
  }

  private receiveDocument(
    frame: Extract<HostStateFrame, { document: StateDocument }>,
  ): StateOutcome {
    if (
      !this.copies.has(frame.channel) &&
      this.copies.size >= this.limits.channels
    )
      return { kind: "too-many" };
    const weight = stateWeight(frame.document);
    if (weight > this.limits.stateBytes) return { kind: "too-large" };
    const copy: Copy = {
      revision: frame.revision,
      document: frame.document,
      fingerprint: frame.fingerprint,
      private: frame.private,
      weight,
    };
    this.copies.set(frame.channel, copy);
    this.waiting.delete(frame.channel);
    return {
      kind: "applied",
      channel: frame.channel,
      frameFor: (seat) => ({
        type: "state",
        channel: frame.channel,
        revision: frame.revision,
        document: projectDocument(copy, seat),
      }),
    };
  }

  private receivePatch(
    frame: Exclude<HostStateFrame, { document: StateDocument }>,
  ): StateOutcome {
    const copy = this.copies.get(frame.channel);
    const applied =
      copy && copy.revision === frame.base
        ? applyWeighedStatePatch(copy.document, copy.weight, frame)
        : null;
    if (!copy || !applied) {
      if (this.waiting.has(frame.channel)) return { kind: "waiting" };
      this.waiting.add(frame.channel);
      return { kind: "need", channel: frame.channel };
    }
    if (applied.weight > this.limits.stateBytes) return { kind: "too-large" };
    copy.document = applied.document;
    copy.weight = applied.weight;
    copy.revision = frame.revision;
    const privateField = copy.private;
    return {
      kind: "applied",
      channel: frame.channel,
      frameFor: (seat) => ({
        type: "state",
        channel: frame.channel,
        revision: frame.revision,
        base: frame.base,
        set: frame.set.flatMap(([path, value]) =>
          privateField === undefined || path[0] !== privateField
            ? [[path, value] as [string[], unknown]]
            : path.length === 1
              ? [[path, projectEntries(value, seat)] as [string[], unknown]]
              : path[1] === seat
                ? [[path, value] as [string[], unknown]]
                : [],
        ),
        unset: frame.unset.filter(
          (path) =>
            privateField === undefined ||
            path[0] !== privateField ||
            path.length === 1 ||
            path[1] === seat,
        ),
      }),
    };
  }
}
