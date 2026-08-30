import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");

const baseEnv = (overrides = {}) => ({
  PATH: process.env.PATH,
  CI: "1",
  NODE_ENV: "development",
  NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://airjam.example",
  BETTER_AUTH_URL: "https://airjam.example",
  AIRJAM_RELEASES_PUBLIC_ORIGIN: "",
  ...overrides,
});

const readHelp = (...args) =>
  execFileSync(process.execPath, [cliPath, ...args, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const inspectLocalReleaseOrigin = (overrides = {}) => {
  const output = execFileSync(
    process.execPath,
    [cliPath, "platform", "release-origin", "inspect", "--json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: baseEnv(overrides),
    },
  );

  return JSON.parse(output);
};

const withHealthServer = async (handler, run) => {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

const inspectRemoteReleaseOrigin = async (platformUrl) => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      cliPath,
      "platform",
      "release-origin",
      "inspect",
      "--platform-url",
      platformUrl,
      "--json",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: baseEnv(),
    },
  );
  return JSON.parse(stdout);
};

test("platform release-origin inspection is a discoverable repo CLI surface", () => {
  const platformHelp = readHelp("platform");
  const releaseOriginHelp = readHelp("platform", "release-origin");
  const inspectHelp = readHelp("platform", "release-origin", "inspect");

  assert.match(platformHelp, /release-origin/);
  assert.match(releaseOriginHelp, /inspect/);
  assert.match(inspectHelp, /AIRJAM_RELEASES_PUBLIC_ORIGIN/);
  assert.match(inspectHelp, /--platform-url/);
  assert.match(inspectHelp, /--json/);
  assert.match(inspectHelp, /without exposing credentials/);
});

test("local inspection returns a stable secret-free ready assessment", () => {
  const result = inspectLocalReleaseOrigin({
    AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://airjamusercontent.example",
    AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY: "must-not-appear",
  });

  assert.deepEqual(result, {
    contractVersion: 1,
    command: "release-origin.inspect",
    environmentKey: "AIRJAM_RELEASES_PUBLIC_ORIGIN",
    source: { type: "local" },
    assessment: {
      status: "ready",
      publicOrigin: "https://airjamusercontent.example",
      platformOrigin: "https://airjam.example",
      cookieSite: "airjamusercontent.example",
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /must-not-appear/);
});

test("local inspection reports disabled and invalid configuration without failing open", () => {
  const disabled = inspectLocalReleaseOrigin();
  assert.equal(disabled.assessment.status, "disabled");
  assert.equal(disabled.assessment.publicOrigin, null);
  assert.match(disabled.assessment.reason, /delivery is disabled/);

  const invalid = inspectLocalReleaseOrigin({
    AIRJAM_RELEASES_PUBLIC_ORIGIN: "https://games.airjam.example",
  });
  assert.equal(invalid.assessment.status, "invalid");
  assert.equal(invalid.assessment.publicOrigin, null);
  assert.match(invalid.assessment.reason, /separate cookie site/);
});

test("remote inspection reads the deployed health boundary through the same stable contract", async () => {
  await withHealthServer(
    (request, response) => {
      assert.equal(request.url, "/api/health");
      assert.equal(request.headers.accept, "application/json");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          service: "platform",
          boundaries: {
            hostedReleaseOrigin: {
              required: true,
              status: "ready",
              publicOrigin: "https://airjamusercontent.example",
              reason: null,
            },
          },
        }),
      );
    },
    async (platformUrl) => {
      const result = await inspectRemoteReleaseOrigin(platformUrl);
      assert.deepEqual(result, {
        contractVersion: 1,
        command: "release-origin.inspect",
        environmentKey: "AIRJAM_RELEASES_PUBLIC_ORIGIN",
        source: { type: "remote", platformOrigin: platformUrl },
        health: { httpStatus: 200, ok: true },
        assessment: {
          required: true,
          status: "ready",
          publicOrigin: "https://airjamusercontent.example",
          reason: null,
        },
      });
    },
  );
});

test("remote inspection returns valid unhealthy 503 disabled and invalid boundaries", async () => {
  for (const status of ["disabled", "invalid"]) {
    await withHealthServer(
      (_request, response) => {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            ok: false,
            service: "platform",
            boundaries: {
              hostedReleaseOrigin: {
                required: true,
                status,
                publicOrigin: null,
                reason: `Hosted release origin is ${status}.`,
              },
            },
          }),
        );
      },
      async (platformUrl) => {
        const result = await inspectRemoteReleaseOrigin(platformUrl);
        assert.deepEqual(result, {
          contractVersion: 1,
          command: "release-origin.inspect",
          environmentKey: "AIRJAM_RELEASES_PUBLIC_ORIGIN",
          source: { type: "remote", platformOrigin: platformUrl },
          health: { httpStatus: 503, ok: false },
          assessment: {
            required: true,
            status,
            publicOrigin: null,
            reason: `Hosted release origin is ${status}.`,
          },
        });
      },
    );
  }
});

test("remote inspection fails on malformed health responses and unsupported non-2xx statuses", async () => {
  await withHealthServer(
    (_request, response) => {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false }));
    },
    async (platformUrl) => {
      await assert.rejects(inspectRemoteReleaseOrigin(platformUrl), (error) => {
        const payload = JSON.parse(error.stdout);
        assert.equal(payload.error.code, "REMOTE_CONTRACT_INVALID");
        assert.match(payload.error.message, /hosted-release origin boundary/);
        return true;
      });
    },
  );

  await withHealthServer(
    (_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, service: "platform" }));
    },
    async (platformUrl) => {
      await assert.rejects(inspectRemoteReleaseOrigin(platformUrl), (error) => {
        const payload = JSON.parse(error.stdout);
        assert.equal(payload.error.code, "REMOTE_CONTRACT_INVALID");
        assert.match(payload.error.message, /hosted-release origin boundary/);
        return true;
      });
    },
  );

  await withHealthServer(
    (_request, response) => {
      response.writeHead(502, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false }));
    },
    async (platformUrl) => {
      await assert.rejects(inspectRemoteReleaseOrigin(platformUrl), (error) => {
        const payload = JSON.parse(error.stdout);
        assert.equal(payload.error.code, "REMOTE_HTTP_ERROR");
        assert.match(payload.error.message, /HTTP 502/);
        return true;
      });
    },
  );
});

test("remote inspection rejects a URL that is not a credential-free origin", async () => {
  await assert.rejects(
    inspectRemoteReleaseOrigin("https://user:secret@airjam.io/private"),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.error.code, "INVALID_PLATFORM_URL");
      assert.doesNotMatch(error.stdout, /user:secret/);
      return true;
    },
  );
});
