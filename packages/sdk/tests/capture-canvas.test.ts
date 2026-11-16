// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import {
  captureAgentCanvas,
  drawAgentCanvas,
  encodeAgentCanvas,
} from "../src/agent/capture-canvas";

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

it("passes clip and still dimensions and quality into the canvas encoder", async () => {
  const drawImage = vi.fn();
  const output = {
    width: 0,
    height: 0,
    getContext: () => ({ clearRect: vi.fn(), drawImage }),
    toBlob: vi.fn((callback: BlobCallback) =>
      queueMicrotask(() => callback(new Blob(["abc"], { type: "image/jpeg" }))),
    ),
  };
  const canvas = {
    width: 2560,
    height: 1440,
    ownerDocument: { createElement: () => output },
  } as unknown as HTMLCanvasElement;
  expect(
    await captureAgentCanvas(canvas, { maxEdge: 640, quality: 0.7 }),
  ).toMatchObject({ width: 640, height: 360 });
  expect(output.toBlob).toHaveBeenLastCalledWith(
    expect.any(Function),
    "image/jpeg",
    0.7,
  );
  expect(
    await captureAgentCanvas(canvas, { maxEdge: 1280, quality: 0.8 }),
  ).toMatchObject({ width: 1280, height: 720 });
  expect(output.toBlob).toHaveBeenLastCalledWith(
    expect.any(Function),
    "image/jpeg",
    0.8,
  );
  expect(await captureAgentCanvas(canvas)).toMatchObject({
    width: 1280,
    height: 720,
  });
  expect(output.toBlob).toHaveBeenLastCalledWith(
    expect.any(Function),
    "image/jpeg",
    0.8,
  );
});

it("keeps the encoded snapshot dimensions when the persistent canvas is reused", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  let finish!: BlobCallback;
  vi.spyOn(canvas, "toBlob").mockImplementation((callback) => {
    finish = callback;
  });
  const pending = encodeAgentCanvas(canvas, 0.92);
  canvas.width = 1280;
  canvas.height = 720;
  finish(new Blob(["abc"], { type: "image/jpeg" }));
  await expect(pending).resolves.toEqual({
    mimeType: "image/jpeg",
    data: "YWJj",
    width: 640,
    height: 360,
    coverage: "render-surface",
  });
});

it.each([null, new Blob(["abc"], { type: "image/png" })])(
  "rejects a failed or non-JPEG encode",
  async (blob) => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => callback(blob));
    await expect(encodeAgentCanvas(canvas, 0.92)).rejects.toThrow(
      "The renderer did not produce a JPEG observation.",
    );
  },
);
