import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDisposablePostgresDatabase,
  validateLocalDatabaseUrl,
} from "./helpers/postgres-fixture.js";

// Opt in explicitly: this proof creates and disposes a new local database and
// intentionally disconnects subprocess clients. It never faults the base DB.
const enabled = process.env.AIR_JAM_POSTGRES_DRIVER_RECONNECT === "1";
describe.skipIf(!enabled)(
  "postgres driver reservation ownership after disconnect",
  () => {
    let fixture:
      | Awaited<ReturnType<typeof createDisposablePostgresDatabase>>
      | undefined;
    beforeAll(async () => {
      fixture = await createDisposablePostgresDatabase(
        validateLocalDatabaseUrl(process.env.AIR_JAM_TEST_DATABASE_URL),
        "postgres-reconnect-regression",
      );
    }, 30_000);
    afterAll(async () => {
      await fixture?.cleanup();
    }, 15_000);

    it.each(
      ["esm", "cjs"].flatMap((variant) =>
        [
          "rollback",
          "stale-transaction",
          "reserved-release",
          "queued-transaction",
          "queued-reserved",
          "shutdown-disconnected",
          "shutdown-partial-reuse",
          "shutdown-pending",
          "shutdown-healthy",
        ].map((scenario) => [variant, scenario] as const),
      ),
    )(
      "rejects stale work and recovers: %s / %s",
      async (variant, scenario) => {
        const result = await new Promise<{
          code: number | null;
          signal: string | null;
          timedOut: boolean;
          output: string;
        }>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--import",
              "tsx",
              fileURLToPath(
                new URL(
                  "./fixtures/postgres-reconnect-child.ts",
                  import.meta.url,
                ),
              ),
              scenario,
              variant,
            ],
            {
              env: {
                ...process.env,
                AIR_JAM_TEST_DATABASE_URL: fixture!.url.toString(),
              },
              stdio: ["ignore", "pipe", "pipe"],
            },
          );
          let output = "",
            timedOut = false;
          const timeout = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, 8000);
          const collect = (chunk: Buffer) => {
            output = (output + chunk.toString()).slice(-12_000);
          };
          child.stdout.on("data", collect);
          child.stderr.on("data", collect);
          child.once("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.once("close", (code, signal) => {
            clearTimeout(timeout);
            resolve({
              code,
              signal,
              timedOut,
              output: output.replace(
                /postgres(?:ql)?:\/\/[^\s]+/gi,
                "[redacted]",
              ),
            });
          });
        });
        expect(
          result,
          `Subprocess outcome for ${variant}/${scenario}: ${result.output}`,
        ).toMatchObject({
          code: 0,
          signal: null,
          timedOut: false,
        });
        expect(result.output).toContain("reconnect regression passed");
      },
      10_000,
    );
  },
);
