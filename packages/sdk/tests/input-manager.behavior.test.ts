import { describe, expect, it } from "vitest";
import { z } from "zod";
import { InputManager } from "../src/internal/input-manager";

const ROOM_ID = "ROOM1";
const CONTROLLER_ID = "ctrl_1";

describe("InputManager behavior semantics", () => {
  it("uses tap-safe pulse behavior for booleans by default", () => {
    const inputSchema = z.object({
      action: z.boolean(),
    });
    const manager = new InputManager({ schema: inputSchema });

    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { action: true },
    });
    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { action: false },
    });

    expect(manager.getInput(CONTROLLER_ID)).toEqual({ action: true });
    expect(manager.getInput(CONTROLLER_ID)).toEqual({ action: false });
  });

  it("uses latest behavior for vectors by default", () => {
    const inputSchema = z.object({
      vector: z.object({
        x: z.number(),
        y: z.number(),
      }),
    });
    const manager = new InputManager({ schema: inputSchema });

    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { vector: { x: 0.75, y: -0.25 } },
    });
    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { vector: { x: 0, y: 0 } },
    });

    expect(manager.getInput(CONTROLLER_ID)).toEqual({ vector: { x: 0, y: 0 } });
  });

  it("supports pulse overrides for vectors", () => {
    const inputSchema = z.object({
      vector: z.object({
        x: z.number(),
        y: z.number(),
      }),
    });
    const manager = new InputManager({
      schema: inputSchema,
      behavior: { pulse: ["vector"] },
    });

    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { vector: { x: 1, y: 0 } },
    });
    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { vector: { x: 0, y: 0 } },
    });

    expect(manager.getInput(CONTROLLER_ID)).toEqual({ vector: { x: 1, y: 0 } });
    expect(manager.getInput(CONTROLLER_ID)).toEqual({ vector: { x: 0, y: 0 } });
  });

  it("supports latest overrides for booleans", () => {
    const inputSchema = z.object({
      action: z.boolean(),
    });
    const manager = new InputManager({
      schema: inputSchema,
      behavior: { latest: ["action"] },
    });

    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { action: true },
    });
    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { action: false },
    });

    expect(manager.getInput(CONTROLLER_ID)).toEqual({ action: false });
  });

  it("supports hold behavior for vectors", () => {
    const inputSchema = z.object({
      vector: z.object({
        x: z.number(),
        y: z.number(),
      }),
    });
    const manager = new InputManager({
      schema: inputSchema,
      behavior: { hold: ["vector"] },
    });

    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { vector: { x: 0.5, y: 0 } },
    });
    expect(manager.getInput(CONTROLLER_ID)).toEqual({ vector: { x: 0.5, y: 0 } });

    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { vector: { x: 0, y: 0 } },
    });
    expect(manager.getInput(CONTROLLER_ID)).toEqual({ vector: { x: 0.5, y: 0 } });

    manager.handleInput({
      roomId: ROOM_ID,
      controllerId: CONTROLLER_ID,
      input: { vector: { x: -1, y: 0 } },
    });
    expect(manager.getInput(CONTROLLER_ID)).toEqual({ vector: { x: -1, y: 0 } });
  });
});
