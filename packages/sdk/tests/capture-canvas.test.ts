import { expect, it } from "vitest";
import { drawAgentCanvas } from "../src/agent/capture-canvas";

it("replaces opaque pixels with transparency when reusing the capture canvas", () => {
  const sourcePixel = new Uint8ClampedArray([255, 0, 0, 255]);
  const destinationPixel = new Uint8ClampedArray(4);
  const source = { width: 1, height: 1 } as HTMLCanvasElement;
  const destination = {
    width: 1,
    height: 1,
    getContext: () => ({
      clearRect: () => destinationPixel.fill(0),
      drawImage: () => {
        // Model source-over for the opaque and transparent pixels in this test.
        if (sourcePixel[3] === 255) destinationPixel.set(sourcePixel);
      },
    }),
  } as unknown as HTMLCanvasElement;

  expect(drawAgentCanvas(source, destination, { maxEdge: 1 })).toBe(true);
  expect([...destinationPixel]).toEqual([255, 0, 0, 255]);

  sourcePixel.fill(0);
  expect(drawAgentCanvas(source, destination, { maxEdge: 1 })).toBe(true);
  expect([...destinationPixel]).toEqual([0, 0, 0, 0]);
});
