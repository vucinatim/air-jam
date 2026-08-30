#!/usr/bin/env node

import { startReleaseJobWorkerService } from "../src/server/jobs/release-job-worker-service";

const worker = await startReleaseJobWorkerService();
let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(
    JSON.stringify({
      service: "air-jam-platform-worker",
      event: "worker.draining",
      signal,
    }),
  );
  try {
    await worker.close();
    process.exitCode = 0;
  } catch (error) {
    console.error(
      JSON.stringify({
        service: "air-jam-platform-worker",
        event: "worker.shutdown_failed",
        signal,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    process.exitCode = 1;
  }
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
