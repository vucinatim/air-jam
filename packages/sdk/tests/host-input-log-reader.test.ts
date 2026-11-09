import { expect, it, vi } from "vitest";
import {
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "../src/agent/agent-contract";
import {
  createAirJamConfig,
  createAirJamStore,
  createConnectionStore,
  defineAirJamSimulation,
  HostRuntime,
  type AirJamActionContext,
  type AirJamSimulationDeclaration,
} from "../src/core";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import {
  hostAgentResponseSchema,
  type HostAgentResponse,
} from "../src/runtime/contracts/agent-control";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "../src/runtime/contracts/control";
import { hostObservationIdentitySchema } from "../src/runtime/contracts/runtime-identity";
import { readHostInputLog } from "../src/runtime/host-input-log-reader";
import {
  createMemoryEnvironment,
  createServerSocket,
} from "./fixtures/host-environment";

const identity = hostObservationIdentitySchema.parse({
  documentId: "doc",
  roomId: "ROOM1",
  contractId: "contract",
  runtimeId: "runtime",
  surfaceId: null,
  participantId: null,
});
const page = (overrides = {}) =>
  hostAgentResponseSchema.parse({
    operation: "input-log-read",
    page: {
      identity,
      header: {
        version: 2,
        seed: 1,
        settings: {},
        stepMs: 10,
        ticks: 2,
        storeDomain: "default",
      },
      entryCount: 2,
      full: false,
      entries: [{ tick: 1, event: "server:state", payload: {} }],
      nextEntry: 1,
      ...overrides,
    },
  }) as Extract<HostAgentResponse, { operation: "input-log-read" }>;

it.each([
  [
    "replay_unsupported: This game has no simulation, so its matches cannot be replayed; record a clip instead.",
    "no-simulation",
  ],
  ["replay_loading: The simulation is loading.", "loading"],
  ["runtime_replaced: The host was replaced.", "runtime-replaced"],
  ["Host timed out.", "host-unavailable"],
])("maps %s to %s", async (message, reason) => {
  expect(
    await readHostInputLog(async () => {
      throw new Error(message);
    }, identity),
  ).toMatchObject({ status: "not-replayable", reason });
});

it("fixes the cut, follows its cursor and validates the assembled v2 log", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(page())
    .mockResolvedValueOnce(
      page({
        entries: [{ tick: 3, event: "server:state", payload: {} }],
        nextEntry: null,
      }),
    );
  expect(await readHostInputLog(request, identity)).toMatchObject({
    status: "recorded",
    full: false,
    log: { ticks: 2, entries: [{ tick: 1 }, { tick: 3 }] },
  });
  expect(request.mock.calls.map(([input]) => input)).toEqual([
    {
      operation: "input-log-read",
      roomId: "ROOM1",
      runtimeId: "runtime",
      cut: null,
      fromEntry: 0,
    },
    {
      operation: "input-log-read",
      roomId: "ROOM1",
      runtimeId: "runtime",
      cut: { ticks: 2, entryCount: 2 },
      fromEntry: 1,
    },
  ]);
});

it.each([
  { nextEntry: 0 },
  { nextEntry: 2 },
  { entries: [], nextEntry: 1 },
  { nextEntry: null },
])("rejects invalid cursors and truncated pages: %j", async (overrides) => {
  await expect(
    readHostInputLog(async () => page(overrides), identity),
  ).rejects.toThrow(/(advance|count)/);
});

it("rejects header changes and replacement between pages", async () => {
  const changed = page();
  changed.page.header.seed = 9;
  await expect(
    readHostInputLog(
      vi.fn().mockResolvedValueOnce(page()).mockResolvedValueOnce(changed),
      identity,
    ),
  ).rejects.toThrow("changed while paging");
  const replaced = page({
    identity: { ...identity, participantId: "another" },
  });
  expect(
    await readHostInputLog(
      vi.fn().mockResolvedValueOnce(page()).mockResolvedValueOnce(replaced),
      identity,
    ),
  ).toMatchObject({ status: "not-replayable", reason: "runtime-replaced" });
});

it.each([false, true])(
  "answers from the owning host when simulation is absent or loading (%s)",
  async (loading) => {
    const socket = createServerSocket();
    const { environment } = createMemoryEnvironment(socket);
    let release = () => {};
    const loaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    const simulation: AirJamSimulationDeclaration | undefined = loading
      ? () =>
          loaded.then(() =>
            defineAirJamSimulation({
              stepMs: 10,
              create: () => ({}),
              step: () => {},
            }),
          )
      : undefined;
    const values = createAirJamStore<{
      value: number;
      actions: {
        noop: (context: AirJamActionContext, payload: undefined) => void;
      };
    }>(() => ({ value: 0, actions: { noop: () => {} } }));
    const runtime = new HostRuntime({
      config: createAirJamConfig({
        topology: resolveRuntimeTopology({
          runtimeMode: "self-hosted-production",
          surfaceRole: "host",
          appOrigin: "https://play.test",
          backendOrigin: "https://play.test",
          publicHost: "https://play.test",
        }),
      }),
      store: createConnectionStore(),
      environment,
      stores: [values],
      simulation,
      getSocket: () => {
        throw new Error("No socket.");
      },
      disconnectSocket: () => {},
      agent: {
        gameId: "test",
        contract: defineAirJamAgentContract({
          stores: defineAirJamAgentStores({
            default: agentStore<{ value: number }>(),
          }),
          projectSnapshot: () => ({}),
          actions: {},
        }),
      },
    });
    const stop = runtime.start();
    try {
      await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"), {
        interval: 1,
      });
      const agent = (
        Reflect.get(
          environment.controlTarget,
          AIR_JAM_RUNTIME_CONTROL_KEY,
        ) as HostRuntimeControl
      ).agent;
      const observed = await agent({
        operation: "observe",
        roomId: "ROOM1",
        controllerId: null,
        scope: "diagnostic",
        includeImage: false,
      });
      if (observed.operation !== "observe")
        throw new Error("Expected observation.");
      expect(
        await readHostInputLog(agent, observed.observation.identity),
      ).toMatchObject({
        status: "not-replayable",
        reason: loading ? "loading" : "no-simulation",
        message: loading
          ? "This game's simulation is still loading."
          : "This game has no simulation, so its matches cannot be replayed; record a clip instead.",
      });
      expect(
        await readHostInputLog(agent, {
          ...observed.observation.identity,
          runtimeId: "replaced",
        }),
      ).toMatchObject({ status: "not-replayable", reason: "runtime-replaced" });
      if (loading) {
        release();
        await runtime.ready;
        const loaded = await agent({
          operation: "observe",
          roomId: "ROOM1",
          controllerId: null,
          scope: "diagnostic",
          includeImage: false,
        });
        if (loaded.operation !== "observe")
          throw new Error("Expected loaded observation.");
        const recorded = await readHostInputLog(
          agent,
          loaded.observation.identity,
          { scope: "diagnostic", controllerId: null },
        );
        expect(recorded.status).toBe("recorded");
        if (recorded.status === "recorded") {
          expect(recorded.observation?.ticks.after).toBe(recorded.log.ticks);
          expect(recorded.observation?.runtime).toEqual({});
        }
      }
    } finally {
      release();
      stop();
    }
  },
);
