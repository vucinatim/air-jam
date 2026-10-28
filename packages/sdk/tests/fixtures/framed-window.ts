import { onTestFinished } from "vitest";

/** Frames this test page in a parent of its own until the current test finishes. */
export function frameInParent(): Window {
  const original = window.parent;
  const parent = { postMessage: () => {} } as unknown as Window;
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: parent,
  });
  onTestFinished(() => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: original,
    });
  });
  return parent;
}
