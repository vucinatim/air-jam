import { afterEach, describe, expect, it, vi } from "vitest";
import type { AirJamInputLog } from "../src/core/input-log";
import {
  hostAgentRequestSchema,
  hostAgentResponseSchema,
} from "../src/runtime/contracts/agent-control";
import { HostTimeline } from "../src/runtime/host-timeline";

const log = (entries: AirJamInputLog["entries"]): AirJamInputLog => ({
  version: 2,
  stepMs: 10,
  seed: 1,
  settings: { ballSpeed: 600 },
  storeDomain: "game",
  ticks: 300,
  entries,
});
const entry = (
  tick: number,
  event: AirJamInputLog["entries"][number]["event"],
  payload: Record<string, unknown>,
) => ({ tick, event, payload });

afterEach(() => vi.useRealTimers());

describe("host room timeline", () => {
  it("filters controls, actions, avatar-only player updates and duplicate states, retaining changed settings and names", () => {
    const timeline = new HostTimeline(1000);
    for (let index = 0; index < 11; index++)
      timeline.record(index, index < 2 ? 1000 : 2000);
    timeline.moment("Red scored, 2 to 1", 50, 1500);
    const result = timeline.read(
      log([
        entry(1, "server:controllerJoined", {
          controllerId: "phone",
          player: { id: "phone", label: "Ada" },
        }),
        entry(1, "server:playerUpdated", {
          player: { id: "phone", label: "Ada", avatarId: "new" },
        }),
        entry(101, "server:playerUpdated", {
          player: { id: "phone", label: "Bea" },
        }),
        entry(101, "server:input", {
          controllerId: "phone",
          input: { fire: true },
        }),
        entry(101, "airjam:action_rpc", { action: "hit" }),
        entry(101, "server:state", { state: { runtimeState: "playing" } }),
        entry(101, "server:state", { state: { runtimeState: "playing" } }),
        entry(101, "airjam:settings", { patch: { ballSpeed: 900 } }),
        entry(101, "airjam:settings", { patch: { ballSpeed: 900 } }),
        entry(101, "server:controllerDisconnected", { controllerId: "phone" }),
        entry(101, "server:controllerLeft", { controllerId: "phone" }),
      ]),
      4000,
    );
    expect(result.entries.map((entry) => entry.kind)).toEqual([
      "join",
      "moment",
      "name",
      "state",
      "settings",
      "drop",
      "leave",
    ]);
    expect(result.entries.find((entry) => entry.kind === "name")).toMatchObject(
      { at: 2000, name: "Bea", previousName: "Ada" },
    );
    expect(
      result.entries.find((entry) => entry.kind === "settings"),
    ).toMatchObject({
      values: { ballSpeed: 900 },
      previousValues: { ballSpeed: 600 },
    });
    expect(result.entries.find((entry) => entry.kind === "drop")).toMatchObject(
      { name: "Bea" },
    );
  });
  it("keeps the actual wall times of joins and settings received during a paused tick", () => {
    vi.useFakeTimers();
    const timeline = new HostTimeline(1000);
    const times = [1000, 2000, 5000, 6000, 9000];
    for (const [index, at] of times.entries()) {
      vi.setSystemTime(at);
      timeline.record(index, Date.now());
    }
    const recorded = log([
      entry(1, "server:state", { state: { runtimeState: "playing" } }),
      entry(101, "server:state", { state: { runtimeState: "paused" } }),
      entry(101, "server:controllerJoined", { controllerId: "phone" }),
      entry(101, "airjam:settings", { patch: { ballSpeed: 900 } }),
      entry(101, "server:state", { state: { runtimeState: "playing" } }),
    ]);
    const result = timeline.read(recorded, 11_000);
    expect(result.entries.map(({ kind, at }) => ({ kind, at }))).toEqual([
      { kind: "state", at: 1000 },
      { kind: "state", at: 2000 },
      { kind: "join", at: 5000 },
      { kind: "settings", at: 6000 },
      { kind: "state", at: 9000 },
    ]);
    expect(timeline.read(recorded, 30_000).entries).toEqual(result.entries);
    expect(recorded.version).toBe(2);
    expect(recorded.entries.every((entry) => !Reflect.has(entry, "at"))).toBe(
      true,
    );
  });
  it("retains only 200 declared moments and 30 minutes of five-second pace samples", () => {
    const timeline = new HostTimeline(0);
    timeline.moment(null, 0, 0);
    timeline.moment(undefined, 0, 0);
    for (let count = 1; count <= 400; count++) {
      timeline.moment(`Point ${count}`, count, count * 5000);
      timeline.frame(count * 5000, {
        frames: count * 300,
        wallMs: count * 5000,
        simulatedMs: count * 5000,
      });
    }
    const result = timeline.read(log([]), 2_000_000);
    expect(result.entries).toHaveLength(200);
    expect(result.entries[0]).toMatchObject({
      text: "Point 201",
      tick: 201,
      at: 1_005_000,
    });
    expect(result.pace).toHaveLength(360);
    expect(result.pace.at(-1)).toEqual({ at: 2_000_000, fps: 60, speed: 1 });
    expect(timeline.read(log([]), 4_000_000).pace).toEqual([]);
  });
  it("advertises timeline-read and an explicit no-simulation result", () => {
    expect(
      hostAgentRequestSchema.parse({
        operation: "timeline-read",
        roomId: "ABCD",
      }).operation,
    ).toBe("timeline-read");
    expect(
      hostAgentResponseSchema.parse({
        operation: "timeline-read",
        timeline: {
          status: "unavailable",
          identity: {
            documentId: "doc",
            roomId: "ABCD",
            runtimeId: "runtime",
            contractId: "contract",
            surfaceId: null,
          },
          reason: "no-simulation",
        },
      }),
    ).toMatchObject({ timeline: { reason: "no-simulation" } });
  });
});
