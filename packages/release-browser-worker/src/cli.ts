const HELP = `Usage: air-jam-release-browser-worker [start|health] [options]

Dedicated, authenticated release-capture worker. Run start in the non-root Linux
worker image; local platform capture connects to this same isolated service.

Commands:
  start                   Run the worker (default). Shutdown: SIGINT or SIGTERM.
  health --url <origin>   Read browser health as JSON; exits nonzero if unhealthy.

Options:
  --help, -h             Show this help without loading credentials.

Configuration: see packages/release-browser-worker/README.md.
Health never creates a release or changes moderation state.
`;

const run = async () => {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    console.log(HELP);
    return;
  }
  if (args.length === 0 || (args.length === 1 && args[0] === "start")) {
    const { runReleaseBrowserWorker } = await import("./main");
    await runReleaseBrowserWorker();
    return;
  }
  if (args.length === 3 && args[0] === "health" && args[1] === "--url") {
    const origin = new URL(args[2]);
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.username ||
      origin.password
    ) {
      throw new Error(
        "Health URL must be an HTTP(S) origin without credentials.",
      );
    }
    const response = await fetch(new URL("/health", origin), {
      signal: AbortSignal.timeout(25_000),
      redirect: "error",
    });
    const result: unknown = await response.json();
    console.log(JSON.stringify(result));
    if (
      !response.ok ||
      !result ||
      typeof result !== "object" ||
      !("ok" in result) ||
      result.ok !== true
    ) {
      process.exitCode = 1;
    }
    return;
  }
  throw new Error("Unknown command. Run with --help for supported operations.");
};

void run().catch((error: unknown) => {
  // Never serialize launch/HTTP errors: they can contain provider or caller data.
  console.error(
    JSON.stringify({
      ok: false,
      error: "browser_worker_command_failed",
      hint: "Inspect worker configuration and --help.",
      ...(isEnvValidationError(error)
        ? {
            issues: error.issues.map(({ envKey, message, fix }) => ({
              envKey,
              message,
              fix,
            })),
          }
        : {}),
    }),
  );
  process.exitCode = 1;
});
import { isEnvValidationError } from "@air-jam/env";
