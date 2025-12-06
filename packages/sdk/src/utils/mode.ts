import type { RunMode } from "../protocol";

export const detectRunMode = (): RunMode => {
  if (typeof window === "undefined") {
    return "standalone";
  }

  try {
    return window.self !== window.top ? "platform" : "standalone";
  } catch {
    return "platform";
  }
};
