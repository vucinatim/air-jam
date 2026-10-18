import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { InputManager } from "../src/internal/input-manager";

const inputSchema = z.object({
  vector: z.object({
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
  }),
  action: z.boolean(),
});
const moving = { vector: { x: 1, y: 0 }, action: true };
const zero = { vector: { x: 0, y: 0 }, action: false };
const create = () =>
  new InputManager({ schema: inputSchema, behavior: { hold: ["vector"] } });
afterEach(() => vi.restoreAllMocks());

it("release clears held vectors and unread pulses", () => {
  const manager = create();
  expect(manager.setLeasedInput("player", moving, 250)).toBe(true);
  manager.releaseLeasedInput("player");
  expect(manager.getInput("player")).toBeUndefined();
  manager.setLeasedInput("player", zero, 250);
  expect(manager.getInput("player")).toEqual(zero);
});

it("expires at the next input read without a timer and cannot resurrect a held vector", () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(100);
  const manager = create();
  manager.setLeasedInput("player", moving, 250);
  expect(manager.getInput("player")).toEqual(moving);
  clock.mockReturnValue(350);
  expect(manager.getInput("player")).toBeUndefined();
  manager.setLeasedInput("player", zero, 250);
  expect(manager.getInput("player")).toEqual(zero);
});

it("refuses ordinary input while leased, until controller teardown", () => {
  const manager = create();
  manager.claimLeasedInput("player");
  manager.handleInput({
    roomId: "ROOM",
    controllerId: "player",
    input: moving,
  });
  expect(manager.getInput("player")).toBeUndefined();
  manager.clearInput("player");
  manager.handleInput({ roomId: "ROOM", controllerId: "player", input: zero });
  expect(manager.getInput("player")).toEqual(zero);
});

it("rejects invalid decisions before acquiring input authority", () => {
  const manager = create();
  expect(
    manager.setLeasedInput(
      "player",
      { vector: { x: 9, y: 0 }, action: true },
      250,
    ),
  ).toBe(false);
  manager.handleInput({ roomId: "ROOM", controllerId: "player", input: zero });
  expect(manager.getInput("player")).toEqual(zero);
});

it("clears agent input on replacement, preserving other players and agent ownership", () => {
  const manager = create();
  manager.handleInput({ roomId: "ROOM", controllerId: "human", input: moving });
  manager.setLeasedInput("player", moving, 250);
  manager.clearLeasedInputs();
  expect(manager.getInput("player")).toBeUndefined();
  expect(manager.getInput("human")).toEqual(moving);
  manager.handleInput({
    roomId: "ROOM",
    controllerId: "player",
    input: moving,
  });
  expect(manager.getInput("player")).toBeUndefined();
});

it("claiming control for an action neither renews nor clears an existing input", () => {
  const clock = vi.spyOn(performance, "now").mockReturnValue(100);
  const manager = create();
  manager.setLeasedInput("player", moving, 250);
  clock.mockReturnValue(200);
  manager.claimLeasedInput("player");
  expect(manager.getInput("player")).toEqual(moving);
  clock.mockReturnValue(350);
  expect(manager.getInput("player")).toBeUndefined();
});

it("applies the authored input transform once before buffering a leased decision", () => {
  const manager = new InputManager({
    schema: z.object({ direction: z.number().transform((value) => value / 2) }),
  });
  expect(manager.setLeasedInput("player", { direction: 1 }, 250)).toBe(true);
  expect(manager.getInput("player")).toEqual({ direction: 0.5 });
  expect(manager.getInput("player")).toEqual({ direction: 0.5 });
});

it("describes the wire input before transforms and marks unsupported JSON Schema explicitly", () => {
  const input = new InputManager({
    schema: z.object({ direction: z.number().transform((value) => value / 2) }),
  });
  expect(input.describeInputSchema()).toMatchObject({
    status: "available",
    schema: { properties: { direction: { type: "number" } } },
  });
  const unsupported = new InputManager({ schema: z.custom(() => true) });
  expect(unsupported.supportsLeasedInput).toBe(true);
  expect(unsupported.describeInputSchema()).toEqual({
    status: "unavailable",
    reason: "not-representable",
  });
  expect(new InputManager().describeInputSchema()).toEqual({
    status: "unavailable",
    reason: "not-configured",
  });
});
