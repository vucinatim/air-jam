import { defineConfig } from "vitest/config";

const nodeMajor = Number.parseInt(
  process.versions.node.split(".")[0] ?? "",
  10,
);
const workerExecArgv = nodeMajor >= 25 ? ["--no-webstorage"] : [];

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: true,
    setupFiles: ["tests/setup/dom-cleanup.ts"],
    /** Avoid parallel test file pollution of shared jsdom globals (e.g. window.history). */
    fileParallelism: false,
    /** Node 25's process-level Web Storage shadows jsdom unless disabled in workers. */
    poolOptions: {
      forks: {
        execArgv: workerExecArgv,
        /** Every file still gets fresh modules and its own jsdom window; one process saves loading them per file. */
        singleFork: true,
      },
      threads: {
        execArgv: workerExecArgv,
      },
    },
  },
});
