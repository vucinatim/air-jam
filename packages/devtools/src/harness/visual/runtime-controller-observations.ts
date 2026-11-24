import type { RuntimeInspectionContract } from "@air-jam/sdk/runtime-inspection";
import type { Browser } from "playwright-core";
import type { z } from "zod";
import {
  AIR_JAM_RUNTIME_OWNER_CAPTURE_FRAME,
  type runtimeOwnerCapturePortSchema,
  type runtimeOwnerObservedControllerSchema,
} from "../../runtime-owner-protocol.js";
import { openControllerObservation } from "./controller-observation.js";

type ControllerObservation = Awaited<
  ReturnType<typeof openControllerObservation>
>;
type Entry = {
  opening?: Promise<ControllerObservation>;
  observation?: ControllerObservation;
  queued: number;
  abort: AbortController;
  pending: z.infer<typeof runtimeOwnerCapturePortSchema>[];
  delivery: Promise<void>;
  error?: unknown;
  closing?: Promise<void>;
  onError: (error: Error) => void;
};

/** How many room messages may wait for the page before the observation fails. */
const PENDING_DELIVERIES = 256;

// Both one-shot captures and live watching mirror existing players through this owner.
export class RuntimeControllerObservations {
  private entries = new Map<string, Entry>();
  constructor(
    private readonly options: {
      browser: Browser;
      readInspection: () => Promise<RuntimeInspectionContract | null>;
      send: (message: unknown) => void;
    },
  ) {}
  async open(
    requestId: string,
    context: z.infer<typeof runtimeOwnerObservedControllerSchema>,
    onError: Entry["onError"],
  ) {
    if (this.entries.has(requestId))
      throw new Error("Controller observation already exists.");
    const entry: Entry = {
      queued: 0,
      abort: new AbortController(),
      pending: [],
      delivery: Promise.resolve(),
      onError,
    };
    this.entries.set(requestId, entry);
    entry.opening = (async () => {
      const inspection = await this.options.readInspection();
      if (inspection?.role !== "host" || inspection.roomId !== context.roomId)
        throw new Error("Observation belongs to another host room.");
      const observation = await openControllerObservation({
        browser: this.options.browser,
        signal: entry.abort.signal,
        controllerJoinUrl: inspection.localControllerUrl,
        harnessSessionId: context.harnessSessionId,
        roomId: context.roomId,
        onPortMessage: (message) =>
          this.options.send({
            type: AIR_JAM_RUNTIME_OWNER_CAPTURE_FRAME,
            requestId,
            message,
          }),
      });
      entry.observation = observation;
      for (const event of entry.pending.splice(0)) this.deliver(event);
      await observation.ready;
      await entry.delivery;
      if (entry.error) throw entry.error;
      return observation;
    })();
    try {
      return await entry.opening;
    } catch (error) {
      try {
        await this.close(requestId);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Controller observation failed and cleanup was not confirmed.",
        );
      }
      throw error;
    }
  }
  private fail(entry: Entry, error: unknown) {
    if (entry.error) return;
    entry.error = error;
    entry.onError(error instanceof Error ? error : new Error(String(error)));
  }
  deliver(event: z.infer<typeof runtimeOwnerCapturePortSchema>) {
    const entry = this.entries.get(event.requestId);
    if (!entry || entry.error || entry.closing) return;
    if (entry.pending.length + entry.queued >= PENDING_DELIVERIES) {
      this.fail(
        entry,
        new Error("Controller observation event allowance exceeded."),
      );
      return;
    }
    if (!entry.observation) {
      entry.pending.push(event);
      return;
    }
    const observation = entry.observation;
    entry.queued++;
    entry.delivery = entry.delivery
      .then(() => {
        if (!entry.closing && !entry.error)
          return observation.deliver(event.message);
      })
      .catch((error: unknown) => {
        if (!entry.closing) this.fail(entry, error);
      })
      .finally(() => {
        entry.queued--;
      });
  }
  async close(requestId: string) {
    const entry = this.entries.get(requestId);
    if (!entry) return;
    entry.abort.abort();
    return (entry.closing ??= (async () => {
      try {
        await entry.opening?.catch(() => undefined);
        await entry.observation?.close();
        await entry.delivery;
      } finally {
        this.entries.delete(requestId);
      }
    })());
  }

  async closeAll() {
    const results = await Promise.allSettled(
      [...this.entries.keys()].map((id) => this.close(id)),
    );
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length)
      throw new AggregateError(
        failed.map((result) => result.reason),
        "Controller observation cleanup failed.",
      );
  }
}
