import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Test files share one process, so Testing Library's own automatic cleanup is
// registered only by the first file that loads it.
afterEach(() => {
  cleanup();
});
