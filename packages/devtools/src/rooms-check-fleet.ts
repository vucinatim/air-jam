import { spawn, type ChildProcess } from "node:child_process";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import {
  deviceEventSchema,
  sharedNow,
  type ConnectionProblem,
  type DeviceCommand,
  type DeviceEvent,
  type DeviceLink,
} from "./rooms-check-protocol.js";

/** A scenario found the room server breaking a rule; its message says which. */
export class ScenarioFailure extends Error {}

export type Status = Extract<DeviceEvent, { type: "status" }>;

export const isOpen = (event: DeviceEvent): event is Status =>
  event.type === "status" && event.status.phase === "open";

/**
 * Spaces connection opens so that no minute holds more than `perMinute`,
 * across every device process of the check, for a server that limits how
 * often one address may connect.
 */
export class ConnectionPacer {
  private readonly spacingMs: number;
  private next = Number.NEGATIVE_INFINITY;

  constructor(
    perMinute: number,
    private readonly now: () => number = sharedNow,
  ) {
    this.spacingMs = Math.floor(60_000 / Math.max(perMinute - 1, 1)) + 1;
  }

  /** Reserves the next open and returns when it may happen. */
  reserve(): number {
    const slot = Math.max(this.now(), this.next);
    this.next = slot + this.spacingMs;
    return slot;
  }
}

/** One device process the check can freeze, thaw, kill and read. */
export class Device {
  readonly events: DeviceEvent[] = [];
  private readonly waiters = new Set<() => void>();
  private exited = false;

  constructor(
    readonly name: string,
    private readonly child: ChildProcess,
    pacer: ConnectionPacer | null,
  ) {
    child.on("message", (message: unknown) => {
      const event = deviceEventSchema.parse(message);
      if (event.type === "dial") {
        const grant = () => {
          if (child.connected) child.send({ type: "dial", id: event.id });
        };
        if (pacer) setTimeout(grant, pacer.reserve() - sharedNow());
        else grant();
        return;
      }
      this.events.push(event);
      for (const waiter of [...this.waiters]) waiter();
    });
    child.on("exit", () => {
      this.exited = true;
    });
  }

  send(command: DeviceCommand): void {
    this.child.send(command);
  }

  freeze(): void {
    this.child.kill("SIGSTOP");
  }

  thaw(): void {
    this.child.kill("SIGCONT");
  }

  kill(): void {
    if (this.exited) return;
    this.child.kill("SIGCONT");
    this.child.kill("SIGKILL");
  }

  /**
   * The first event since `since` that `find` accepts, or a failure naming
   * `what`; a device that reports it failed fails whatever waits on it.
   */
  until<Found>(
    find: (event: DeviceEvent) => Found | undefined,
    what: string,
    deadlineMs: number,
    since = 0,
  ): Promise<Found> {
    const search = (): { found: Found } | { failed: string } | undefined => {
      for (const event of this.events)
        if (event.at >= since) {
          if (event.type === "failed") return { failed: event.message };
          const found = find(event);
          if (found !== undefined) return { found };
        }
      return undefined;
    };
    return new Promise((resolve, reject) => {
      const check = () => {
        const outcome = search();
        if (outcome === undefined) return;
        clearTimeout(timer);
        this.waiters.delete(check);
        if ("found" in outcome) resolve(outcome.found);
        else reject(new ScenarioFailure(`${this.name}: ${outcome.failed}`));
      };
      const timer = setTimeout(() => {
        this.waiters.delete(check);
        reject(
          new ScenarioFailure(
            `${this.name}: ${what} did not happen within ${deadlineMs} ms.`,
          ),
        );
      }, deadlineMs);
      this.waiters.add(check);
      check();
    });
  }

  since<Type extends DeviceEvent["type"]>(
    type: Type,
    from = 0,
    to = Number.POSITIVE_INFINITY,
  ): Array<Extract<DeviceEvent, { type: Type }>> {
    return this.events.filter(
      (event): event is Extract<DeviceEvent, { type: Type }> =>
        event.type === type && event.at >= from && event.at <= to,
    );
  }
}

/** The devices of one scenario; every process ends with it. */
export class Fleet {
  private readonly devices: Device[] = [];
  private readonly script = resolveDevtoolsHelperScript(
    "rooms-check-device.ts",
  );

  readonly link: DeviceLink;
  readonly hostCredentialCommand: string | undefined;

  constructor(
    target: { link: DeviceLink; hostCredentialCommand?: string },
    private readonly pacer: ConnectionPacer | null,
  ) {
    this.link = target.link;
    this.hostCredentialCommand = target.hostCredentialCommand;
  }

  device(name: string): Device {
    const child = spawn(
      process.execPath,
      resolveDevtoolsHelperArgs(this.script),
      {
        stdio: ["ignore", "ignore", "inherit", "ipc"],
      },
    );
    const device = new Device(name, child, this.pacer);
    this.devices.push(device);
    return device;
  }

  /** Every connection problem the devices reported, timed from `startedAt`. */
  problems(startedAt: number): ConnectionProblem[] {
    return this.devices
      .flatMap((device) =>
        device.since("problem").map((event) => ({
          device: device.name,
          atMs: Math.round(event.at - startedAt),
          problem: event.problem,
        })),
      )
      .sort((left, right) => left.atMs - right.atMs);
  }

  close(): void {
    for (const device of this.devices) device.kill();
  }
}
