import type { AirJamInput } from "@air-jam/sdk/core";
import {
  createScopedHostConnector,
  createScopedPhoneConnector,
  HostRoomSession,
  PhoneRoomSession,
} from "@air-jam/sdk/room-session";
import { describe, expect, it } from "vitest";
import {
  createNetwork,
  createRooms,
  ManualClock,
} from "./helpers/room-session-harness.js";

const controls: AirJamInput = {
  move: { kind: "stick", name: "move", keepDirection: false },
  jump: { kind: "button", name: "jump", mode: "pressed" },
};
const gameScope = (channel: string) => !channel.startsWith("arcade.");

/** A launcher's screen with its own channel, serving an embedded game. */
const openLauncher = async () => {
  const clock = new ManualClock();
  const rooms = createRooms(clock);
  const network = createNetwork(rooms);
  const common = {
    clock,
    random: () => 0.5,
    deviceWakeEvents: null,
  };
  const shell = new HostRoomSession({
    ...common,
    connector: network.connector,
    key: "shell-key-0000001",
    seats: 8,
  });
  shell.publish("arcade.surface", { kind: "game", epoch: 1 });
  const scoped = createScopedHostConnector(shell, gameScope);
  const launch = () =>
    new HostRoomSession({
      ...common,
      connector: scoped.connector,
      key: "game-frame-key-01",
      seats: 4,
      input: controls,
    });
  const game = launch();
  await clock.advance();
  const code = shell.code ?? "";
  const join = (key: string) =>
    new PhoneRoomSession({
      ...common,
      connector: network.connector,
      key,
      code,
      input: controls,
    });
  return { clock, rooms, network, shell, scoped, launch, game, join };
};

describe("frames served as a view of the page's session", () => {
  it("gives an embedded game its seats, input and requests, keeping private entries private", async () => {
    const { clock, shell, game, join } = await openLauncher();
    expect(game.status).toEqual({ phase: "open" });
    expect(game.code).toBe(shell.code);
    const inputs: unknown[] = [];
    game.on("input", (input) => inputs.push(input));
    game.on("request", (request) =>
      game.respond(request.seat, request.id, request.payload),
    );
    game.publish(
      "game",
      { round: 1, hands: { p1: "ace", p2: "king" } },
      { fingerprint: "v1", private: "hands" },
    );
    const phone = join("phone-key-000001");
    await clock.advance(20);

    expect(phone.channel("game")).toEqual({ round: 1, hands: { p1: "ace" } });
    expect(game.seats.map((seat) => seat.id)).toEqual(["p1"]);
    phone.sendInput({
      move: { x: 1, y: 0 },
      jump: { down: false, presses: 1 },
    });
    const answer = phone.request("game", "ping", 7);
    await clock.advance(20);
    await expect(answer).resolves.toEqual({ status: "answered", result: 7 });
    expect(inputs).toContainEqual({
      seat: "p1",
      state: { move: { x: 1, y: 0 }, jump: { down: false, presses: 1 } },
    });

    game.setActivity("another-game");
    await clock.advance();
    expect(game.status).toEqual({ phase: "closed", reason: "unauthorised" });
    expect(shell.status).toEqual({ phase: "open" });
  });

  it("gives a relaunched game its documents and every seat's latest controls, and drops them when it ends", async () => {
    const { clock, rooms, scoped, launch, game, join } = await openLauncher();
    game.publish(
      "game",
      { round: 3, hands: { p1: "ace" } },
      { fingerprint: "v1", private: "hands" },
    );
    const phone = join("phone-key-000001");
    await clock.advance(20);
    phone.sendInput({ move: { x: 0, y: 1 }, jump: { down: true, presses: 2 } });
    await clock.advance(20);

    game.close();
    const relaunched = launch();
    const inputs: unknown[] = [];
    relaunched.on("input", (input) => inputs.push(input));
    await clock.advance();
    expect(relaunched.roomCopies).toEqual([
      {
        channel: "game",
        revision: 0,
        document: { round: 3, hands: { p1: "ace" } },
        fingerprint: "v1",
        private: "hands",
      },
    ]);
    expect(inputs).toEqual([
      {
        seat: "p1",
        state: { move: { x: 0, y: 1 }, jump: { down: true, presses: 2 } },
      },
    ]);

    scoped.end();
    await clock.advance(20);
    expect(relaunched.status).toEqual({ phase: "closed", reason: "closed" });
    expect(
      rooms.describe()[0]?.channels.map((channel) => channel.channel),
    ).toEqual(["arcade.surface"]);
  });

  it("re-welcomes an embedded game after the page's own link returns", async () => {
    const { clock, network, shell, game, join } = await openLauncher();
    const phone = join("phone-key-000001");
    await clock.advance();
    network.links[0]?.break();
    await clock.advance();
    expect(game.status.phase).toBe("reconnecting");

    await clock.advance(1_000);
    expect(shell.status).toEqual({ phase: "open" });
    expect(game.status).toEqual({ phase: "open" });
    game.publish("game", { round: 9 });
    await clock.advance(20);
    expect(phone.channel("game")).toEqual({ round: 9 });
  });

  it("gives an embedded controller the page's seat, its channels and requests", async () => {
    const { clock, network, shell, game } = await openLauncher();
    game.on("request", (request) =>
      game.respond(request.seat, request.id, `answer ${request.payload}`),
    );
    const inputs: unknown[] = [];
    game.on("input", (input) => inputs.push(input));
    game.publish("game", { round: 1 });
    const page = new PhoneRoomSession({
      connector: network.connector,
      clock,
      random: () => 0.5,
      deviceWakeEvents: null,
      key: "phone-key-000001",
      code: shell.code ?? "",
    });
    await clock.advance(20);
    const scoped = createScopedPhoneConnector(page, gameScope);
    const controller = new PhoneRoomSession({
      connector: scoped.connector,
      clock,
      random: () => 0.5,
      deviceWakeEvents: null,
      key: "controller-frame-",
      code: page.code,
      input: controls,
    });
    await clock.advance();

    expect(controller.seat).toBe("p1");
    expect(controller.channel("game")).toEqual({ round: 1 });
    expect(controller.channel("arcade.surface")).toBeUndefined();
    game.publish("game", { round: 2 });
    controller.sendInput({
      move: { x: 0, y: 0 },
      jump: { down: true, presses: 1 },
    });
    const answer = controller.request("game", "ping", 1);
    await clock.advance(20);
    expect(controller.channel("game")).toEqual({ round: 2 });
    await expect(answer).resolves.toEqual({
      status: "answered",
      result: "answer 1",
    });
    expect(inputs).toContainEqual({
      seat: "p1",
      state: { move: { x: 0, y: 0 }, jump: { down: true, presses: 1 } },
    });

    void controller.request("arcade.surface", "navigate");
    await clock.advance();
    expect(controller.status).toEqual({
      phase: "closed",
      reason: "unauthorised",
    });
    expect(page.status).toEqual({ phase: "open" });
  });
});
