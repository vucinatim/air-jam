import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  BotController,
  botStrategyDestination,
} from "../src/game/bot-system/bot-controller";
import type { BotWorld } from "../src/game/bot-system/bot-world";
import { GameContext } from "../src/game/bot-system/game-context";
import { airCapturePlayer } from "../src/testing/player";

const ship = (
  controllerId: string,
  teamId: "solaris" | "nebulon",
  position: [number, number, number],
) => ({
  controllerId,
  teamId,
  position,
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  health: 100,
  queuedAbility: null,
});
const world = (overrides: Partial<BotWorld> = {}): BotWorld => ({
  ships: [
    ship("human", "solaris", [-100, 5, 40]),
    ship("bot", "nebulon", [100, 5, -40]),
  ],
  flags: [
    { teamId: "solaris", status: "atBase", position: [-120, 0, 40] },
    { teamId: "nebulon", status: "atBase", position: [120, 0, -40] },
  ],
  basePositions: { solaris: [-120, 0, 40], nebulon: [120, 0, -40] },
  collectibles: [],
  ...overrides,
});
const observe = (arena: BotWorld, matchPhase = "playing") =>
  ({
    controllerId: "human",
    snapshot: {
      matchPhase,
      myAssignment: matchPhase === "lobby" ? null : { teamId: "solaris" },
      teams: [
        { id: "solaris", label: "Solaris", totalCount: 0 },
        { id: "nebulon", label: "Nebulon", totalCount: 1 },
      ],
    },
    runtime: { ...arena, scores: { solaris: 0, nebulon: 0 } },
  }) as unknown as HostObservation;

describe("Air Capture bot world", () => {
  it("lets bot logic read a plain arena snapshot", () => {
    const context = new GameContext(world());
    expect(context.getSelf("human")?.position).toEqual(
      new Vector3(-100, 5, 40),
    );
    expect(
      context.getEnemies("human").map((enemy) => enemy.controllerId),
    ).toEqual(["bot"]);
    expect(context.getBasePosition("nebulon")).toEqual(
      new Vector3(120, 0, -40),
    );
  });

  it("knows where each strategy leads and when it does not apply", () => {
    const arena = world({
      flags: [
        { teamId: "solaris", status: "atBase", position: [-120, 0, 40] },
        {
          teamId: "nebulon",
          status: "carried",
          position: [-100, 5, 40],
          carrierId: "human",
        },
      ],
    });
    const context = new GameContext(arena);
    const self = context.getSelf("human")!;
    const destination = (
      strategy: Parameters<typeof botStrategyDestination>[0],
      chosen: boolean,
    ) => botStrategyDestination(strategy, "human", context, self, chosen);
    expect(destination("return", false)?.position).toEqual(
      new Vector3(-120, 0, 40),
    );
    expect(destination("capture", true)).toBeNull();
    expect(destination("attack", false)).toBeNull();
    expect(destination("attack", true)?.targetPlayerId).toBe("bot");
  });

  it("flies a chosen strategy and the default brain over the same snapshot", () => {
    const pilot = new BotController("human");
    for (const strategy of [undefined, "attack", "capture"] as const) {
      const input = pilot.update(1, world(), strategy);
      expect(Math.abs(input.vector.x)).toBeLessThanOrEqual(1);
      expect(typeof input.action).toBe("boolean");
    }
  });
});

describe("Air Capture player contract", () => {
  it("offers only strategies that apply, as flown inputs", () => {
    const turn = airCapturePlayer.turn({
      observation: observe(world()),
      seatId: "player",
    });
    expect(Object.keys(turn?.options ?? {})).toEqual(["capture", "attack"]);
    expect(turn?.options.capture?.control).toMatchObject({ kind: "input" });
    expect(turn?.state[0]).toBe("The score is Solaris (my team) 0, Nebulon 0.");
  });

  it("asks which team to join from the lobby", () => {
    const turn = airCapturePlayer.turn({
      observation: observe(world(), "lobby"),
      seatId: "player",
    });
    expect(turn?.options.solaris?.control).toEqual({
      kind: "action",
      actionId: "join_team",
      input: "solaris",
    });
  });

  it("keeps flying the chosen strategy between questions", () => {
    const control = airCapturePlayer.act.control({
      observation: observe(world()),
      seatId: "player",
      choice: "capture",
    });
    expect(control).toMatchObject({
      kind: "input",
      input: { action: expect.any(Boolean) },
    });
    expect(
      airCapturePlayer.act.control({
        observation: observe(world()),
        seatId: "player",
        choice: "solaris",
      }),
    ).toBeNull();
  });
});
