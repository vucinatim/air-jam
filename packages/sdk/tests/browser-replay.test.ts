import { expect, it, vi } from "vitest";
import {
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "../src/agent/agent-contract";
import {
  createAirJamStore,
  HostRuntime,
  type AirJamActionContext,
  type AirJamInputLog,
  type HostRuntimeFactory,
} from "../src/core";
import {
  bindBrowserReplay,
  isAirJamReplayDocument,
  replayMessageSchema,
  replayRequestMessageSchema,
} from "../src/runtime/browser-replay";
import { readHostInputLog } from "../src/runtime/host-input-log-reader";

it("opens only for its parent, advances a Pong-like game without intermediate draws and reads the same observation contract", async () => {
  const values = createAirJamStore<{
    hits: number;
    actions: {
      noop: (context: AirJamActionContext, payload: undefined) => void;
    };
  }>(() => ({ hits: 0, actions: { noop: () => {} } }));
  const create: HostRuntimeFactory = (dependencies, options) =>
    new HostRuntime(
      {
        ...dependencies,
        stores: [values],
        simulation: {
          stepMs: 10,
          create: () => ({ x: 0, velocity: 1 }),
          step(sim) {
            const ball = sim as { x: number; velocity: number };
            ball.x += ball.velocity;
            if (Math.abs(ball.x) === 10) ball.velocity *= -1;
          },
          observe: (sim) => sim as Record<string, unknown>,
        },
        agent: {
          gameId: "pong",
          contract: defineAirJamAgentContract({
            stores: defineAirJamAgentStores({
              default: agentStore<{ hits: number }>(),
            }),
            actions: {},
            projectSnapshot: ({ stores }) => stores.default ?? {},
          }),
        },
      },
      options,
    );
  const factory = vi.fn(create);
  const parent = { postMessage: vi.fn() } as unknown as Window;
  let listener!: (event: MessageEvent<unknown>) => void;
  let replay!: Parameters<
    Parameters<typeof bindBrowserReplay>[0]["mounted"]
  >[0];
  const close = bindBrowserReplay({
    parent,
    parentOrigin: "https://studio.test",
    createHostRuntime: factory,
    mounted: (value) => {
      replay = value;
    },
    listen: (receive) => {
      listener = receive;
      return () => {};
    },
  });
  const log: AirJamInputLog = {
    version: 2,
    seed: 42,
    settings: {},
    stepMs: 10,
    ticks: 200,
    storeDomain: "default",
    entries: [],
  };
  const send = (id: string, request: unknown, origin = "https://studio.test") =>
    listener({
      source: parent,
      origin,
      data: { type: "AIRJAM_REPLAY", requestId: id, request },
    } as MessageEvent<unknown>);
  const answer = async (id: string) => {
    await vi.waitFor(
      () =>
        expect(
          vi
            .mocked(parent.postMessage)
            .mock.calls.some(([data]) => data.requestId === id),
        ).toBe(true),
      { interval: 1 },
    );
    const result = replayMessageSchema.parse(
      vi
        .mocked(parent.postMessage)
        .mock.calls.find(([data]) => data.requestId === id)?.[0],
    );
    if (result.type !== "AIRJAM_REPLAY_RESULT" || !result.result.ok)
      throw new Error(JSON.stringify(result));
    return result.result.response;
  };
  try {
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "AIRJAM_REPLAY_READY" },
      "https://studio.test",
    );
    expect(factory).not.toHaveBeenCalled();
    send("wrong", { operation: "open", log }, "https://other.test");
    await Promise.resolve();
    expect(factory).not.toHaveBeenCalled();
    send("open", { operation: "open", log });
    await answer("open");
    const draw = vi.fn();
    replay.runtime.simulation!.onFrame(draw);
    send("jump", { operation: "advance", by: { toTick: 150 } });
    const at150 = await answer("jump");
    expect(at150.tick).toBe(150);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][0].tick).toBe(150);
    send("end", { operation: "advance", by: { ms: 9999 } });
    const end = await answer("end");
    expect(end).toMatchObject({
      tick: 200,
      ticks: 200,
      done: true,
      stepMs: 10,
    });
    expect(end.observation.ticks.after).toBe(200);
    expect(end.observation.runtime).toEqual({ x: 0, velocity: 1 });
    const original = await readHostInputLog(
      replay.agent,
      end.observation.identity,
      { scope: "diagnostic", controllerId: null },
    );
    expect(original.status).toBe("recorded");
    if (original.status === "recorded") {
      expect(original.observation?.ticks.after).toBe(original.log.ticks);
      expect(original.observation?.runtime).toEqual(end.observation.runtime);
    }
    expect(
      replayRequestMessageSchema.safeParse({
        type: "AIRJAM_REPLAY",
        requestId: "bad",
        request: { operation: "advance", by: { steps: -1 } },
      }).success,
    ).toBe(false);
  } finally {
    close();
  }
});

it("recognizes only the explicit replay query, including embedded topology parameters", () => {
  expect(isAirJamReplayDocument()).toBe(false);
  expect(
    isAirJamReplayDocument(
      "?airjamReplay=1&embedded=1&parentOrigin=https%3A%2F%2Fstudio.test",
    ),
  ).toBe(true);
  expect(isAirJamReplayDocument("?airjamReplay=0")).toBe(false);
  expect(isAirJamReplayDocument("?airjamReplay=true")).toBe(false);
});
