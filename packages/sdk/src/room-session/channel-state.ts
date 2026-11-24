import {
  applyStatePatch,
  applyWeighedStatePatch,
  diffState,
  isEmptyStatePatch,
  stateWeight,
  utf8ByteLength,
  type ChannelCopy,
  type HostStateFrame,
  type RoomLimits,
  type RoomStateFrame,
  type StateDocument,
  type StatePatch,
} from "../room-protocol";

export interface PublishOptions {
  /** The store's shape, so a reloading host knows whether to take its state back. */
  readonly fingerprint?: string;
  /** A top-level field keyed by seat whose entries only their own seat sees. */
  readonly private?: string;
}

interface Published {
  /** What the room holds from this host; null when it holds nothing. */
  sent: StateDocument | null;
  sentRevision: number;
  sentOptions: PublishOptions;
  latest: StateDocument;
  latestWeight: number;
  options: PublishOptions;
  needsDocument: boolean;
}

const pathWeight = (path: readonly string[]): number =>
  path.reduce((weight, key) => weight + utf8ByteLength(JSON.stringify(key)), 0);

const patchWeight = (patch: StatePatch): number =>
  patch.set.reduce(
    (weight, [path, value]) => weight + pathWeight(path) + stateWeight(value),
    0,
  ) + patch.unset.reduce((weight, path) => weight + pathWeight(path), 0);

const sameOptions = (left: PublishOptions, right: PublishOptions): boolean =>
  left.fingerprint === right.fingerprint && left.private === right.private;

/**
 * A host's channels on their way to the room. The game publishes whole
 * documents as often as it likes; each frame sent is the patch from what the
 * room holds to the latest document, or the document itself when the room
 * holds nothing, asked for it, or the patch would weigh more.
 */
export class ChannelPublisher {
  private readonly channels = new Map<string, Published>();
  /** Channels with something to send, oldest first. */
  private readonly due = new Set<string>();

  /** What the room held when it last welcomed this host: the base of every later patch. */
  rebase(copies: readonly ChannelCopy[]): void {
    const held = new Map(copies.map((copy) => [copy.channel, copy]));
    for (const [channel, published] of this.channels) {
      const copy = held.get(channel);
      published.sent = copy?.document ?? null;
      published.sentRevision = copy?.revision ?? published.sentRevision;
      published.sentOptions = copy ? optionsOf(copy) : {};
      published.needsDocument = false;
      this.due.add(channel);
    }
    for (const copy of copies) {
      if (this.channels.has(copy.channel)) continue;
      this.channels.set(copy.channel, {
        sent: copy.document,
        sentRevision: copy.revision,
        sentOptions: optionsOf(copy),
        latest: copy.document,
        latestWeight: stateWeight(copy.document),
        options: optionsOf(copy),
        needsDocument: false,
      });
    }
  }

  /** Records the channel's latest document; throws when the room could not hold it. */
  publish(
    channel: string,
    document: StateDocument,
    options: PublishOptions,
    limits: RoomLimits,
  ): void {
    const published = this.channels.get(channel);
    if (!published) {
      if (this.channels.size >= limits.channels)
        throw new Error(
          `A room holds at most ${limits.channels} channels; "${channel}" would be one more.`,
        );
      const weight = stateWeight(document);
      assertFits(channel, weight, limits);
      this.channels.set(channel, {
        sent: null,
        sentRevision: 0,
        sentOptions: {},
        latest: document,
        latestWeight: weight,
        options,
        needsDocument: true,
      });
      this.due.add(channel);
      return;
    }
    if (
      document === published.latest &&
      sameOptions(options, published.options)
    )
      return;
    const weighed = applyWeighedStatePatch(
      published.latest,
      published.latestWeight,
      diffState(published.latest, document),
    );
    if (!weighed)
      throw new Error(
        "A state diff did not apply to the document it came from.",
      );
    assertFits(channel, weighed.weight, limits);
    published.latest = document;
    published.latestWeight = weighed.weight;
    published.options = options;
    this.due.add(channel);
  }

  /** The room could not apply a patch and asks for the whole document. */
  need(channel: string): void {
    const published = this.channels.get(channel);
    if (!published) return;
    published.needsDocument = true;
    this.due.add(channel);
  }

  drop(channel: string): void {
    this.channels.delete(channel);
    this.due.delete(channel);
  }

  hasDue(): boolean {
    return this.due.size > 0;
  }

  /** The next frame worth sending, marking it sent; null when nothing is due. */
  take(): HostStateFrame | null {
    for (const channel of this.due) {
      this.due.delete(channel);
      const published = this.channels.get(channel);
      if (!published) continue;
      const frame = this.frameFor(channel, published);
      if (!frame) continue;
      published.sent = published.latest;
      published.sentRevision = frame.revision;
      published.sentOptions = published.options;
      published.needsDocument = false;
      return frame;
    }
    return null;
  }

  private frameFor(
    channel: string,
    published: Published,
  ): HostStateFrame | null {
    const revision = published.sentRevision + 1;
    const documentFrame: HostStateFrame = {
      type: "state",
      channel,
      revision,
      document: published.latest,
      ...published.options,
    };
    if (
      published.sent === null ||
      published.needsDocument ||
      !sameOptions(published.options, published.sentOptions)
    )
      return documentFrame;
    const patch = diffState(published.sent, published.latest);
    if (isEmptyStatePatch(patch)) return null;
    if (patchWeight(patch) >= published.latestWeight) return documentFrame;
    return {
      type: "state",
      channel,
      revision,
      base: published.sentRevision,
      set: patch.set.map(([path, value]) => [[...path], value]),
      unset: patch.unset.map((path) => [...path]),
    };
  }
}

const optionsOf = (copy: ChannelCopy): PublishOptions => ({
  ...(copy.fingerprint === undefined ? {} : { fingerprint: copy.fingerprint }),
  ...(copy.private === undefined ? {} : { private: copy.private }),
});

const assertFits = (channel: string, weight: number, limits: RoomLimits) => {
  if (weight > limits.stateBytes)
    throw new Error(
      `Channel "${channel}" would weigh ${weight} bytes; the room holds at most ${limits.stateBytes}.`,
    );
};

/**
 * A phone's copy of each channel, as the room relays it. A patch whose base
 * is not the copy's revision means the copy diverged: patches are ignored
 * until the next whole document.
 */
export class ChannelMirror {
  private readonly copies = new Map<
    string,
    { revision: number; document: StateDocument; diverged: boolean }
  >();

  reset(copies: readonly ChannelCopy[]): void {
    this.copies.clear();
    for (const copy of copies)
      this.copies.set(copy.channel, {
        revision: copy.revision,
        document: copy.document,
        diverged: false,
      });
  }

  /** The channel's new document, or null when the frame changed nothing. */
  receive(frame: RoomStateFrame): StateDocument | null {
    if ("document" in frame) {
      this.copies.set(frame.channel, {
        revision: frame.revision,
        document: frame.document,
        diverged: false,
      });
      return frame.document;
    }
    const copy = this.copies.get(frame.channel);
    if (!copy || copy.diverged) return null;
    const next =
      copy.revision === frame.base
        ? applyStatePatch(copy.document, frame)
        : null;
    if (!next) {
      copy.diverged = true;
      return null;
    }
    copy.revision = frame.revision;
    copy.document = next;
    return next;
  }

  drop(channel: string): boolean {
    return this.copies.delete(channel);
  }

  document(channel: string): StateDocument | undefined {
    return this.copies.get(channel)?.document;
  }

  documents(): ReadonlyMap<string, StateDocument> {
    return new Map(
      [...this.copies].map(([channel, copy]) => [channel, copy.document]),
    );
  }
}
