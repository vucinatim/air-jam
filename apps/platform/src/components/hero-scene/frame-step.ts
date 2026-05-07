"use client";

const MAX_FRAME_DELTA_SECONDS = 1 / 30;

export const resolveHeroFrameDelta = (delta: number): number =>
  Math.min(delta, MAX_FRAME_DELTA_SECONDS);
