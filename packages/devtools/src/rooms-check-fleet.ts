import { spawn, type ChildProcess } from "node:child_process";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
} from "./helper-scripts.js";
import {
  deviceEventSchema,
  type DeviceCommand,
  type DeviceEvent,
} from "./rooms-check-protocol.js";

/** A scenario found the room server breaking a rule; its message says which. */
export class ScenarioFailure extends Error {}

export type Status = Extract<DeviceEvent, { type: "status" }>;

export const isOpen = (event: DeviceEvent): event is Status =>
  event.type === "status" && event.status.phase === "open";

/** One device process the check can freeze, thaw, kill and read. */
export class Device {
  readonly events: DeviceEvent[] = [];
  private readonly waiters = new Set<() => void>();
  private exited = false;

  constructor(
    readonly name: string,
    private readonly child: ChildProcess,
  ) {
    child.on("message", (message: unknown) => {
      const event = deviceEventSchema.parse(message);
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

  /** The first event since `since` that `find` accepts, or a failure naming `what`. */
  until<Found>(
    find: (event: DeviceEvent) => Found | undefined,
    what: string,
    deadlineMs: number,
    since = 0,
  ): Promise<Found> {
    const search = () => {
      for (const event of this.events)
        if (event.at >= since) {
          const found = find(event);
          if (found !== undefined) return found;
        }
      return undefined;
    };
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = search();
        if (found === undefined) return;
        clearTimeout(timer);
        this.waiters.delete(check);
        resolve(found);
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

  constructor(readonly url: string) {}

  device(name: string): Device {
    const child = spawn(
      process.execPath,
      resolveDevtoolsHelperArgs(this.script),
      {
        stdio: ["ignore", "ignore", "inherit", "ipc"],
      },
    );
    const device = new Device(name, child);
    this.devices.push(device);
    return device;
  }

  close(): void {
    for (const device of this.devices) device.kill();
  }
}
