import type { AirJamInputLog } from "../core/input-log";
import type { SimulationPace } from "../core/simulation";
import type { HostTimelineEntry, HostTimelinePace } from "./contracts/timeline";

type Anchor = { tick: number; at: number; entry: number };
const WINDOW_MS = 5_000;
const RETENTION_MS = 30 * 60_000;

/** Wall-time sensors only. Neither the input log nor replay reads these. */
export class HostTimeline {
  readonly startedAt: number;
  private readonly anchors: Anchor[] = [];
  private readonly moments: HostTimelineEntry[] = [];
  private readonly windows: HostTimelinePace[] = [];
  private momentSequence = 0;
  private sampledAt: number;
  private sampled: SimulationPace = { frames: 0, wallMs: 0, simulatedMs: 0 };

  constructor(
    at: number,
    private readonly stepMs: number,
  ) {
    this.startedAt = at;
    this.sampledAt = at;
  }

  anchor(tick: number, entry: number, at: number, boundary = false) {
    const last = this.anchors.at(-1);
    if (!boundary && last && (tick - last.tick) * this.stepMs < 1000) return;
    this.anchors.push({ tick, entry, at });
    // Preserve the start for long recordings, with bounded boundary overhead.
    if (this.anchors.length > 4096) this.anchors.splice(1, 1);
  }

  moment(text: string | null | undefined, tick: number, at: number) {
    if (!text?.trim()) return;
    this.moments.push({
      id: `moment:${++this.momentSequence}`,
      kind: "moment",
      tick,
      at,
      text: text.trim().slice(0, 240),
    });
    if (this.moments.length > 200) this.moments.shift();
  }

  frame(at: number, pace: SimulationPace) {
    if (at - this.sampledAt < WINDOW_MS) return;
    const wallMs = pace.wallMs - this.sampled.wallMs;
    if (wallMs > 0)
      this.windows.push({
        at,
        fps: ((pace.frames - this.sampled.frames) * 1000) / wallMs,
        speed: (pace.simulatedMs - this.sampled.simulatedMs) / wallMs,
      });
    this.sampled = { ...pace };
    this.sampledAt = at;
    while (
      this.windows.length &&
      (this.windows[0].at < at - RETENTION_MS || this.windows.length > 360)
    )
      this.windows.shift();
  }

  read(log: AirJamInputLog, at: number) {
    const entries: HostTimelineEntry[] = [];
    const names = new Map<string, string>();
    let state: unknown = "paused";
    let settings = { ...log.settings };
    const anchors = [
      ...this.anchors,
      { tick: log.ticks + 1, entry: log.entries.length, at },
    ];
    let cursor = 0;
    for (const [index, entry] of log.entries.entries()) {
      const { tick, event, payload } = entry;
      // Boundary positions distinguish pause and resume at the same future tick.
      while (
        cursor + 1 < anchors.length &&
        (anchors[cursor + 1].tick < tick ||
          (anchors[cursor + 1].tick === tick &&
            anchors[cursor + 1].entry <= index))
      )
        cursor++;
      const left = anchors[cursor];
      const right = anchors[cursor + 1] ?? left;
      const fraction =
        right && left && right.tick > left.tick
          ? Math.max(
              0,
              Math.min(1, (tick - left.tick) / (right.tick - left.tick)),
            )
          : 0;
      const time = left
        ? left.at + ((right?.at ?? left.at) - left.at) * fraction
        : this.startedAt;
      const base = { id: `input:${index}`, tick, at: time };
      const player = payload.player as
        | { id?: string; label?: string }
        | undefined;
      const controllerId =
        typeof payload.controllerId === "string"
          ? payload.controllerId
          : player?.id;
      const runtimeState = (
        payload.state as { runtimeState?: unknown } | undefined
      )?.runtimeState;
      const name =
        player?.label ??
        (typeof payload.nickname === "string" ? payload.nickname : undefined);
      if (event === "server:controllerJoined" && controllerId) {
        if (name) names.set(controllerId, name);
        entries.push({ ...base, kind: "join", controllerId, name });
      } else if (
        (event === "server:controllerLeft" ||
          event === "server:controllerDisconnected") &&
        controllerId
      ) {
        entries.push({
          ...base,
          kind: event === "server:controllerLeft" ? "leave" : "drop",
          controllerId,
          name: names.get(controllerId) ?? name,
        });
        if (event === "server:controllerLeft") names.delete(controllerId);
      } else if (event === "server:playerUpdated" && controllerId && name) {
        const previousName = names.get(controllerId);
        if (previousName !== undefined && previousName !== name)
          entries.push({
            ...base,
            kind: "name",
            controllerId,
            name,
            previousName,
          });
        names.set(controllerId, name);
      } else if (
        event === "server:state" &&
        (runtimeState === "paused" || runtimeState === "playing")
      ) {
        if (state !== runtimeState)
          entries.push({ ...base, kind: "state", state: runtimeState });
        state = runtimeState;
      } else if (event === "airjam:settings") {
        const values = payload.patch as AirJamInputLog["settings"];
        const changed = Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) => settings[key] !== value,
          ),
        );
        if (Object.keys(changed).length)
          entries.push({
            ...base,
            kind: "settings",
            values: changed,
            previousValues: Object.fromEntries(
              Object.keys(changed)
                .filter((key) => key in settings)
                .map((key) => [key, settings[key]]),
            ),
          });
        settings = { ...settings, ...values };
      }
    }
    return {
      startedAt: this.startedAt,
      stepMs: log.stepMs,
      entries: [...entries, ...this.moments].sort(
        (a, b) => a.at - b.at || a.tick - b.tick,
      ),
      pace: this.windows.filter((window) => window.at >= at - RETENTION_MS),
    };
  }
}
