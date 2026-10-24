import { expect, it } from "vitest";
import { HostInput } from "../src/core/host-input";
import { axis, button, defineAirJamInput, stick } from "../src/core/input";

const shipInput = defineAirJamInput({
  move: stick(),
  heading: stick({ keepDirection: true }),
  throttle: axis(),
  fire: button("pressed"),
  boost: button("held"),
});

const create = () => {
  let now = 0;
  const input = new HostInput(shipInput, () => now);
  const step = (controllerId = "p1") => {
    input.sample();
    return input.read(controllerId);
  };
  return { input, step, setNow: (ms: number) => (now = ms) };
};

const phone = (state: Record<string, unknown>) => state;
const pressesOf = (down: boolean, presses: number) => ({ down, presses });

it("reads released and centred controls before any input", () => {
  const { step } = create();
  expect(step()).toEqual({
    move: { x: 0, y: 0 },
    heading: { x: 0, y: 0 },
    throttle: 0,
    fire: false,
    boost: false,
  });
});

it("turns each press into exactly one step, even when presses land between steps", () => {
  const { input, step } = create();
  input.receive("p1", phone({ fire: pressesOf(false, 2) }));
  expect(step().fire).toBe(true);
  expect(step().fire).toBe(true);
  expect(step().fire).toBe(false);
  input.receive("p1", phone({ fire: pressesOf(true, 3) }));
  expect(step().fire).toBe(true);
  expect(step().fire).toBe(false);
});

it("keeps a held button down while held and never loses a tap shorter than a step", () => {
  const { input, step } = create();
  input.receive("p1", phone({ boost: pressesOf(true, 1) }));
  expect(step().boost).toBe(true);
  expect(step().boost).toBe(true);
  input.receive("p1", phone({ boost: pressesOf(false, 2) }));
  expect(step().boost).toBe(true);
  expect(step().boost).toBe(false);
});

it("counts presses again from zero when a source restarts", () => {
  const { input, step } = create();
  input.receive("p1", phone({ fire: pressesOf(false, 5) }));
  for (let index = 0; index < 5; index += 1) step();
  input.receive("p1", phone({ fire: pressesOf(false, 1) }));
  expect(step().fire).toBe(true);
  expect(step().fire).toBe(false);
});

it("keeps a stick's last direction only when it is declared to", () => {
  const { input, step } = create();
  input.receive(
    "p1",
    phone({ move: { x: 1, y: 0 }, heading: { x: 0, y: 1 }, throttle: 0.5 }),
  );
  expect(step()).toMatchObject({
    move: { x: 1, y: 0 },
    heading: { x: 0, y: 1 },
    throttle: 0.5,
  });
  input.receive("p1", phone({}));
  expect(step()).toMatchObject({
    move: { x: 0, y: 0 },
    heading: { x: 0, y: 1 },
    throttle: 0,
  });
});

it("holds a value for the whole step it was sampled for", () => {
  const { input, step } = create();
  input.receive("p1", phone({ throttle: 1 }));
  expect(step().throttle).toBe(1);
  input.receive("p1", phone({ throttle: -1 }));
  expect(input.read("p1").throttle).toBe(1);
  expect(step().throttle).toBe(-1);
});

it("rejects input that does not match the declared controls", () => {
  const { input, step } = create();
  input.receive("p1", phone({ throttle: 3 }));
  input.receive("p1", phone({ unknown: true }));
  expect(step().throttle).toBe(0);
});

it("turns an agent's buttons into presses on each rising edge", () => {
  const { input, step } = create();
  expect(input.setLeasedInput("p1", { fire: true }, 1000)).toBe(true);
  expect(step().fire).toBe(true);
  input.setLeasedInput("p1", { fire: true }, 1000);
  expect(step().fire).toBe(false);
  input.setLeasedInput("p1", { fire: false }, 1000);
  input.setLeasedInput("p1", { fire: true }, 1000);
  expect(step().fire).toBe(true);
});

it("ends an agent's input when its lease lapses on the host clock", () => {
  const { input, step, setNow } = create();
  input.setLeasedInput("p1", { throttle: 1, boost: true }, 250);
  expect(step()).toMatchObject({ throttle: 1, boost: true });
  setNow(250);
  expect(step()).toMatchObject({ throttle: 0, boost: false });
});

it("refuses phone input while an agent owns the seat, until the seat leaves", () => {
  const { input, step } = create();
  input.claimLeasedInput("p1");
  input.receive("p1", phone({ throttle: 1 }));
  expect(step().throttle).toBe(0);
  input.clearInput("p1");
  input.receive("p1", phone({ throttle: 1 }));
  expect(step().throttle).toBe(1);
});

it("rejects an invalid agent decision before taking the seat", () => {
  const { input, step } = create();
  expect(input.setLeasedInput("p1", { throttle: 9 }, 250)).toBe(false);
  input.receive("p1", phone({ throttle: 1 }));
  expect(step().throttle).toBe(1);
});

it("reports a seat's source state once per change, at the step that samples it", () => {
  const { input } = create();
  input.receive("p1", phone({ throttle: 1 }));
  input.receive("p1", phone({ throttle: 0.5 }));
  expect(input.sample()).toEqual([
    {
      controllerId: "p1",
      input: expect.objectContaining({ throttle: 0.5 }),
    },
  ]);
  expect(input.sample()).toEqual([]);
  input.receive("p1", phone({ throttle: 0.5 }));
  expect(input.sample()).toEqual([]);
});

it("describes the agent shape of each control", () => {
  const { input } = create();
  expect(input.describeInputSchema()).toMatchObject({
    status: "available",
    schema: {
      properties: {
        fire: { type: "boolean" },
        throttle: { type: "number", minimum: -1, maximum: 1 },
        move: { type: "object" },
      },
    },
  });
});
