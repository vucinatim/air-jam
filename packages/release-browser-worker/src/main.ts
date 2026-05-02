import { startReleaseBrowserWorker } from "./index";

const main = async () => {
  const worker = await startReleaseBrowserWorker();

  const shutdown = async (signal: string) => {
    console.log(
      JSON.stringify({
        service: "air-jam-release-browser-worker",
        event: "browser_worker.stopping",
        signal,
      }),
    );
    await worker.close();
    process.exit(0);
  };

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
};

void main().catch((error) => {
  console.error(
    JSON.stringify({
      service: "air-jam-release-browser-worker",
      event: "browser_worker.start_failed",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
