import {
  createAirJamConfig,
  createConnectionStore,
  openAirJamReplay,
  type AirJamInputLog,
} from "@air-jam/sdk/core";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  INPUT_LOG_PAGE_BYTES,
  readHostInputLog,
  type HostRuntimeControl,
} from "@air-jam/sdk/runtime-control";
import { resolveRuntimeTopology } from "@air-jam/sdk/runtime-topology";
import { expect, it, vi } from "vitest";
import {
  createMemoryEnvironment,
  createServerSocket,
} from "../../../../../packages/sdk/tests/fixtures/host-environment";

it("records a browser-style host's real seed and replays a stable live cut in uneven chunks", async () => {
  const loadGame = async () => {
    vi.resetModules();
    return import("../../../src/airjam.config");
  };
  const { airjam } = await loadGame();
  const socket = createServerSocket();
  const { environment } = createMemoryEnvironment(socket);
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const live = airjam.createHostRuntime({
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
    getSocket: () => {
      throw new Error("Memory transport needs no socket.");
    },
    disconnectSocket: () => {},
    environment: { ...environment, seed: () => seed },
  });
  const stop = live.start();
  let log: AirJamInputLog;
  let final: unknown;
  try {
    await live.ready;
    await vi.waitFor(() => expect(live.roomId).toBe("ROOM1"), { interval: 1 });
    const agent = (
      Reflect.get(
        environment.controlTarget,
        AIR_JAM_RUNTIME_CONTROL_KEY,
      ) as HostRuntimeControl
    ).agent;
    const observe = async () => {
      const response = await agent({
        operation: "observe",
        roomId: "ROOM1",
        controllerId: null,
        scope: "diagnostic",
        includeImage: false,
      });
      if (response.operation !== "observe")
        throw new Error("Expected observation.");
      return response.observation;
    };
    socket.fire("server:controllerJoined", {
      controllerId: "ctrl_human_phone_one",
      source: "phone",
      connected: true,
      resumeLeaseExpiresAt: null,
      player: { id: "ctrl_human_phone_one", label: "Human", color: "#ff0000" },
    });
    socket.fire("server:state", {
      roomId: "ROOM1",
      state: { runtimeState: "playing" },
      version: 1,
    });
    const { pongStore } = await import("../../../src/game/stores/pong-store");
    socket.fire("airjam:action_rpc", {
      actionName: "joinTeam",
      payload: { team: "team1" },
      storeDomain: "default",
      actor: { id: "ctrl_human_phone_one", role: "controller" },
    });
    await pongStore.actions.setBotCount({ team: "team2", count: 1 });
    await pongStore.actions.startMatch();
    expect(pongStore.getState().matchPhase).toBe("playing");
    const clock = live.simulation!;
    const step = () => clock.advance(clock.stepMs);
    const identity = (await observe()).identity;
    for (let tick = 0; tick < 5000; tick++) {
      socket.fire("server:input", {
        roomId: "ROOM1",
        controllerId: "ctrl_human_phone_one",
        input: { direction: (tick % 3) - 1 },
      });
      if (tick === 200) {
        await agent({
          operation: "settings-update",
          roomId: "ROOM1",
          runtimeId: identity.runtimeId,
          patch: { ballSpeed: 700 },
          expectedRevision: 0,
        });
      }
      step();
    }
    // This pending event must keep its tick and index when paging flushes it.
    await agent({
      operation: "settings-update",
      roomId: "ROOM1",
      runtimeId: identity.runtimeId,
      patch: { paddleSpeed: 800 },
      expectedRevision: 1,
    });
    let pages = 0;
    const read = await readHostInputLog(async (request) => {
      const response = await agent(request);
      if (response.operation !== "input-log-read")
        throw new Error("Expected log page.");
      expect(JSON.stringify(response.page.entries).length).toBeLessThanOrEqual(
        INPUT_LOG_PAGE_BYTES,
      );
      if (pages++ === 0) {
        const observation = await observe();
        final = {
          snapshot: observation.snapshot,
          runtime: observation.runtime,
        };
        expect(response.page.header.ticks).toBe(clock.ticks);
        expect(response.page.header.seed).toBe(seed);
      }
      step();
      step();
      return response;
    }, identity);
    expect(pages).toBeGreaterThan(1);
    if (read.status !== "recorded") throw new Error(read.message);
    expect(read.full).toBe(false);
    log = read.log;
    expect(log.seed).toBe(seed);
    expect(log.ticks).toBe(5000);
    expect(clock.ticks).toBeGreaterThan(log.ticks);
    expect(live.inputLog().entries.slice(0, log.entries.length)).toEqual(
      log.entries,
    );
    expect(log.entries.at(-1)).toMatchObject({
      tick: 5001,
      event: "airjam:settings",
    });
    expect(log.entries.some(({ event }) => event === "server:input")).toBe(
      true,
    );
  } finally {
    stop();
  }
  const fresh = await loadGame();
  const replay = await openAirJamReplay(fresh.airjam.createHostRuntime, log);
  try {
    const ticks = [replay.tick];
    expect(replay.done).toBe(false);
    const chunks = [
      { ms: replay.stepMs / 3 },
      { steps: 13 },
      { ms: replay.stepMs * 17.75 },
      { steps: 229 },
    ];
    let index = 0;
    while (!replay.done) {
      ticks.push(replay.advance(chunks[index++ % chunks.length]));
    }
    expect(ticks.every((tick, i) => tick >= (ticks[i - 1] ?? 0))).toBe(true);
    expect(replay.tick).toBe(log.ticks);
    const observation = await replay.agent({
      operation: "observe",
      roomId: replay.roomId,
      controllerId: null,
      scope: "diagnostic",
      includeImage: false,
    });
    if (observation.operation !== "observe")
      throw new Error("Expected observation.");
    expect({
      snapshot: observation.observation.snapshot,
      runtime: observation.observation.runtime,
    }).toEqual(final);
  } finally {
    replay.stop();
  }
});
