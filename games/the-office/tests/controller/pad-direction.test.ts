import { describe, expect, it } from "vitest";
import { resolvePadDirection } from "../../src/controller/pad-direction";

describe("Office pad-local coordinates", () => {
  it.each([0, 90, -90])(
    "preserves cardinal directions, center and drags after %i degree rotation and scale",
    (degrees) => {
      const angle = (degrees * Math.PI) / 180;
      const point = (x: number, y: number) => ({
        x: 420 + 0.65 * (x * Math.cos(angle) - y * Math.sin(angle)),
        y: 80 + 0.65 * (x * Math.sin(angle) + y * Math.cos(angle)),
      });
      const resolve = (x: number, y: number) =>
        resolvePadDirection(
          point(x, y),
          point(0, 0),
          point(300, 0),
          point(0, 240),
        );
      expect(resolve(150, 20)).toEqual({ x: 0, y: -1 });
      expect(resolve(280, 120)).toEqual({ x: 1, y: 0 });
      expect(resolve(150, 220)).toEqual({ x: 0, y: 1 });
      expect(resolve(20, 120)).toEqual({ x: -1, y: 0 });
      expect(resolve(150, 120)).toEqual({ x: 0, y: 0 });
      expect(resolve(181, 140)).toEqual({ x: 0, y: 0 });
      expect(resolve(185, 120)).toEqual({ x: 1, y: 0 });
      // Captured gestures may travel outside the pad without losing direction.
      expect(resolve(420, 120)).toEqual({ x: 1, y: 0 });
    },
  );

  it("returns neutral before layout or for singular axes", () => {
    const origin = { x: 0, y: 0 };
    expect(resolvePadDirection({ x: 2, y: 3 }, origin, origin, origin)).toEqual(
      origin,
    );
    expect(
      resolvePadDirection(
        { x: 2, y: 3 },
        origin,
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ),
    ).toEqual(origin);
  });
});
