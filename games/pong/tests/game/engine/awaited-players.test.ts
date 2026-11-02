import { SimulationClock } from "@air-jam/sdk/core";
import type { PlayerProfile } from "@air-jam/sdk/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { pongSimulation } from "../../../src/game/engine/pong-simulation";
import { pongStore } from "../../../src/game/stores/pong-store";

const human: PlayerProfile = { id: "alpha", label: "Alpha" };
const settings = { paddleSpeed: 720, ballSpeed: 360, countdownSeconds: 3 };
const controller = {
  actorId: human.id,
  role: "controller" as const,
  connectedPlayerIds: [human.id],
  now: 0,
  settings: {},
};

const startMatchAgainstBot = () => {
  const reconnecting: string[] = [];
  const clock = new SimulationClock(
    pongSimulation,
    {
      beginStep: () => {},
      input: () => ({ direction: 0 }),
      players: () => [human],
      reconnectingPlayerIds: () => reconnecting,
      settings: () => settings,
      runtimeState: () => "playing" as const,
    },
    7,
  );
  const actions = pongStore.getState().actions;
  actions.joinTeam(controller, { team: "team1" });
  actions.setBotCount(controller, { team: "team2", count: 1 });
  actions.startMatch(controller, undefined);
  return { clock, reconnecting };
};

const secondsOfPlay = (
  clock: { advance: (ms: number) => void },
  seconds: number,
) => clock.advance(seconds * 1000);

afterEach(() => {
  pongStore.getState().actions.returnToLobby(controller, undefined);
});

describe("Pong waits for a seated player whose phone dropped", () => {
  it("holds the ball, paddles and score until they are back", () => {
    const { clock, reconnecting } = startMatchAgainstBot();
    secondsOfPlay(clock, 4);
    expect(clock.sim.countdown).toBeNull();

    reconnecting.push(human.id);
    clock.advance(clock.stepMs);
    const held = structuredClone(clock.sim.buffers.current);
    const tick = clock.sim.tick;
    secondsOfPlay(clock, 30);

    expect(clock.sim.waitingFor).toEqual([human.id]);
    expect(clock.sim.buffers.current).toEqual(held);
    expect(clock.sim.tick).toBe(tick);
    expect(pongStore.getState().scores).toEqual({ team1: 0, team2: 0 });
  });

  it("re-serves after the countdown once they are back", () => {
    const { clock, reconnecting } = startMatchAgainstBot();
    secondsOfPlay(clock, 4);
    reconnecting.push(human.id);
    secondsOfPlay(clock, 5);

    reconnecting.length = 0;
    clock.advance(clock.stepMs);
    expect(clock.sim.waitingFor).toEqual([]);
    expect(clock.sim.countdown).toBe(settings.countdownSeconds);
    expect(clock.sim.buffers.current).toMatchObject({
      ballX: expect.any(Number),
      awaitingServe: false,
    });
    const servedFrom = clock.sim.buffers.current.ballX;

    secondsOfPlay(clock, 2);
    expect(clock.sim.buffers.current.ballX).toBe(servedFrom);
    secondsOfPlay(clock, 2);
    expect(clock.sim.countdown).toBeNull();
    expect(clock.sim.buffers.current.ballX).not.toBe(servedFrom);
  });

  it("ignores reconnecting players who have no seat", () => {
    const { clock, reconnecting } = startMatchAgainstBot();
    reconnecting.push("spectator");
    secondsOfPlay(clock, 1);
    expect(clock.sim.waitingFor).toEqual([]);
    expect(clock.sim.tick).toBeGreaterThan(0);
  });
});
