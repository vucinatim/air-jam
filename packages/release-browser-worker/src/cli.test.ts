import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";

const run = (args: string[]) =>
  new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith("AIRJAM_BROWSER_WORKER_"),
      ),
    );
    execFile(
      process.execPath,
      [
        "--import",
        "tsx",
        fileURLToPath(new URL("./cli.ts", import.meta.url)),
        ...args,
      ],
      {
        env,
        timeout: 5_000,
        maxBuffer: 64 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          code: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stdout,
          stderr,
        });
      },
    );
  });

test("CLI help is available without credentials or a Linux browser", async () => {
  const result = await run(["--help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /health --url <origin>/);
  assert.equal(result.stderr, "");
});

test("CLI misuse and missing credentials fail without echoing caller data", async () => {
  for (const args of [
    ["start"],
    ["unknown-secret-value"],
    ["health", "--url", "https://user:secret@example.invalid"],
  ]) {
    const result = await run(args);
    assert.equal(result.code, 1);
    assert.equal(result.stdout, "");
    assert.equal(
      JSON.parse(result.stderr).error,
      "browser_worker_command_failed",
    );
    assert.doesNotMatch(result.stderr, /unknown-secret-value|user:secret/);
  }
});

test("CLI health uses the owned health endpoint and exits nonzero when unhealthy", async () => {
  let healthy = true;
  const server = createServer((request, response) => {
    assert.equal(request.url, "/health");
    assert.equal(request.headers.authorization, undefined);
    response.writeHead(healthy ? 200 : 503, {
      "content-type": "application/json",
    });
    response.end(
      JSON.stringify({
        ok: healthy,
        service: "air-jam-release-browser-worker",
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const args = ["health", "--url", `http://127.0.0.1:${address.port}`];
    const success = await run(args);
    assert.equal(success.code, 0);
    assert.equal(JSON.parse(success.stdout).ok, true);
    healthy = false;
    const failure = await run(args);
    assert.equal(failure.code, 1);
    assert.equal(JSON.parse(failure.stdout).ok, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
