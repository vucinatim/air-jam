import type { SpriteKey } from "./types";

export const createEmptySpriteMap = (): Record<SpriteKey, HTMLCanvasElement | null> => ({
  team1LeftShort: null,
  team1RightShort: null,
  team1LeftExtended: null,
  team1RightExtended: null,
  team1Defend: null,
  team1End: null,
  team2LeftShort: null,
  team2RightShort: null,
  team2LeftExtended: null,
  team2RightExtended: null,
  team2Defend: null,
  team2End: null,
});

export const tintSprite = (
  image: HTMLImageElement,
  color: string,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return canvas;
  }

  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};

export const tintSpriteCanvas = (
  image: HTMLCanvasElement,
  color: string,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return canvas;
  }

  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
};
