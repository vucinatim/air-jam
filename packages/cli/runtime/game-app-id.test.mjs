import { regeneratePlatformGameAppId } from "@air-jam/devtools/platform-game-app-id";
import { Command } from "commander";
import assert from "node:assert/strict";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import test, { afterEach, beforeEach, mock } from "node:test";
import { registerGameAppIdCommands } from "../dist/game-app-id.js";

const platformUrl = "https://app-id.airjam.test";
const game = { createdAt: "2026-11-06T08:00:00.000Z" };
const appId = {
  id: "app-1",
  gameId: "game-1",
  key: "aj_app_original",
  allowedOrigins: null,
  isActive: false,
  createdAt: game.createdAt,
  lastUsedAt: null,
};
beforeEach(() => {
  mock.method(filesystem, "readFile", async (filePath) => {
    assert.match(String(filePath), /[/\\]auth[/\\]platform-session\.json$/);
    return JSON.stringify({
      version: 1,
      platformBaseUrl: platformUrl,
      clientName: "app-id-test",
      storedAt: game.createdAt,
      user: {
        id: "user_1",
        name: "Creator",
        email: "test@airjam.test",
        role: "creator",
      },
      session: {
        id: "session_1",
        token: "fake-app-id-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: game.createdAt,
        userAgent: "airjam-cli/app-id-test",
      },
    });
  });
  syncBuiltinESMExports();
  mock.method(globalThis, "fetch", async () => {
    assert.fail("Unexpected platform request");
  });
});

afterEach(() => {
  mock.restoreAll();
  syncBuiltinESMExports();
});

const program = () => {
  const command = new Command("airjam")
    .exitOverride()
    .configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerGameAppIdCommands(command.command("game"));
  return command;
};
const run = (args) => program().parseAsync(["game", ...args], { from: "user" });
const captureOutput = () => {
  let output = "";
  mock.method(process.stdout, "write", (chunk) => {
    output += chunk;
    return true;
  });
  return () => output;
};
const endpoint = (
  pathname,
  payload,
  { method = "GET", body, status = 200 } = {},
) =>
  mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(String(url), `${platformUrl}${pathname}`);
    assert.equal(request.method, method);
    assert.equal(request.headers.authorization, "Bearer fake-app-id-token");
    assert.equal(request.redirect, "error");
    assert.deepEqual(
      request.body === undefined ? undefined : JSON.parse(request.body),
      body,
    );
    return Response.json(payload, { status });
  });

test("inspect returns one validated JSON document, preserving nullable policy and timestamps", async () => {
  endpoint("/api/cli/games/my%2Fgame/app-id", appId);
  const output = captureOutput();
  await run(["app-id", "inspect", "--game", "my/game", "--json"]);
  assert.deepEqual(JSON.parse(output()), appId);
});
test("readable inspection includes key, policy, active state and timestamps", async () => {
  endpoint("/api/cli/games/game-1/app-id", appId);
  const output = captureOutput();
  await run(["app-id", "inspect", "--game", "game-1"]);
  for (const value of [
    "aj_app_original",
    "unrestricted",
    "false",
    game.createdAt,
    "never",
  ])
    assert.ok(output().includes(value));
});
test("repeated --origin flags replace the complete policy", async () => {
  const origins = ["https://one.example/path", "http://localhost:3000"];
  const result = {
    ...appId,
    allowedOrigins: ["https://one.example", "http://localhost:3000"],
  };
  endpoint("/api/cli/games/game-1/app-id/origins", result, {
    method: "POST",
    body: { allowedOrigins: origins },
  });
  const output = captureOutput();
  await run([
    "app-id",
    "origins",
    "--game",
    "game-1",
    "--origin",
    origins[0],
    "--origin",
    origins[1],
    "--json",
  ]);
  assert.deepEqual(JSON.parse(output()), result);
});
test("--clear explicitly removes origin restrictions", async () => {
  endpoint("/api/cli/games/game-1/app-id/origins", appId, {
    method: "POST",
    body: { allowedOrigins: [] },
  });
  const output = captureOutput();
  await run(["app-id", "origins", "--game", "game-1", "--clear", "--json"]);
  assert.equal(JSON.parse(output()).allowedOrigins, null);
});
test("regenerate sends explicit confirmation and prints the replacement", async () => {
  const result = { ...appId, key: "aj_app_replacement", isActive: true };
  endpoint("/api/cli/games/game-1/app-id/regenerate", result, {
    method: "POST",
    body: { yes: true },
  });
  const output = captureOutput();
  await run(["app-id", "regenerate", "--game", "game-1", "--yes", "--json"]);
  assert.deepEqual(JSON.parse(output()), result);
});
test("regeneration without --yes refuses before authentication or network", async () => {
  await assert.rejects(
    run(["app-id", "regenerate", "--game", "game-1"]),
    /breaks deployed games.*--yes/,
  );
  assert.equal(filesystem.readFile.mock.callCount(), 0);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  await assert.rejects(
    regeneratePlatformGameAppId({ slugOrId: "game-1", yes: false }),
    /--yes/,
  );
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
for (const [gameOptions, query] of [
  [[], "slug=renamed"],
  [["--game", "my/game"], "slug=renamed&game=my%2Fgame"],
]) {
  test(`slug availability supports optional exclusion: ${query}`, async () => {
    endpoint(`/api/cli/games/slug-availability?${query}`, { available: false });
    const output = captureOutput();
    await run([
      "slug-available",
      "--slug",
      "renamed",
      ...gameOptions,
      "--json",
    ]);
    assert.deepEqual(JSON.parse(output()), { available: false });
  });
}
for (const args of [
  ["app-id", "inspect"],
  ["app-id", "origins", "--game", "game-1"],
  [
    "app-id",
    "origins",
    "--game",
    "game-1",
    "--clear",
    "--origin",
    "https://a.example",
  ],
  [
    "app-id",
    "origins",
    "--game",
    "game-1",
    "--origin",
    "https://a.example",
    "--clear",
  ],
  ["app-id", "origins", "--game", "game-1", "--origin", "invalid"],
  ["app-id", "regenerate", "--yes"],
  ["slug-available"],
  ["slug-available", "--slug", ""],
])
  test(`invalid command refuses before requests: ${args.join(" ")}`, async () => {
    await assert.rejects(run(args));
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
for (const [status, error] of [
  [401, "unauthorized"],
  [404, "not_found"],
])
  test(`preserves platform ${error}`, async () => {
    endpoint(
      "/api/cli/games/game-1/app-id",
      { error, message: "Access refused" },
      { status },
    );
    const output = captureOutput();
    await assert.rejects(
      run(["app-id", "inspect", "--game", "game-1", "--json"]),
      /Access refused/,
    );
    assert.equal(output(), "");
  });
test("malformed response fails without success output", async () => {
  endpoint("/api/cli/games/game-1/app-id", { ...appId, createdAt: "invalid" });
  const output = captureOutput();
  await assert.rejects(
    run(["app-id", "inspect", "--game", "game-1", "--json"]),
  );
  assert.equal(output(), "");
});
test("help discovers all operations and the rotation warning without authentication", () => {
  const gameCommand = program().commands[0];
  assert.match(gameCommand.helpInformation(), /slug-available/);
  const appIdCommand = gameCommand.commands[0];
  for (const name of ["inspect", "origins", "regenerate"])
    assert.match(appIdCommand.helpInformation(), new RegExp(name));
  const regenerate = appIdCommand.commands.find(
    (command) => command.name() === "regenerate",
  );
  assert.match(regenerate.helpInformation(), /breaks deployed games/);
  assert.match(regenerate.helpInformation(), /--yes/);
  assert.equal(filesystem.readFile.mock.callCount(), 0);
});
