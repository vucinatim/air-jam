import { Command } from "commander";
import assert from "node:assert/strict";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import test, { afterEach, beforeEach, mock } from "node:test";
import { registerGameAnalyticsCommand } from "../dist/game-analytics.js";

const platformUrl = "https://analytics.airjam.test";
const game = { createdAt: "2026-11-06T08:00:00.000Z" };
const totals = {
  sessionCount: 3,
  totalGameActiveSeconds: 300,
  totalControllerSeconds: 900,
  totalRawEligiblePlaytimeSeconds: 240,
  totalEligiblePlaytimeSeconds: 200,
  guardedSessionCount: 1,
  peakConcurrentControllers: 4,
  lastActivityAt: game.createdAt,
};
const overview = {
  days: 14,
  totals,
  daily: [{ ...totals, bucketDate: "2026-11-06" }],
};
const session = {
  id: "metric-1",
  runtimeSessionId: "runtime-1",
  roomId: "room-1",
  appId: null,
  gameId: "game-1",
  startedAt: game.createdAt,
  endedAt: null,
  controllerSeconds: 900,
  rawEligiblePlaytimeSeconds: 240,
  eligiblePlaytimeSeconds: 200,
  trustFlags: ["guarded"],
  peakConcurrentControllers: 4,
  createdAt: game.createdAt,
  updatedAt: game.createdAt,
};
beforeEach(() => {
  mock.method(filesystem, "readFile", async (filePath) => {
    assert.match(String(filePath), /[/\\]auth[/\\]platform-session\.json$/);
    return JSON.stringify({
      version: 1,
      platformBaseUrl: platformUrl,
      clientName: "analytics-test",
      storedAt: game.createdAt,
      user: {
        id: "user_1",
        name: "Creator",
        email: "test@airjam.test",
        role: "creator",
      },
      session: {
        id: "session_1",
        token: "fake-analytics-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: game.createdAt,
        userAgent: "airjam-cli/analytics-test",
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
  registerGameAnalyticsCommand(command.command("game"));
  return command;
};
const run = (args) =>
  program().parseAsync(["game", "analytics", ...args], { from: "user" });
const captureOutput = () => {
  let output = "";
  mock.method(process.stdout, "write", (chunk) => {
    output += chunk;
    return true;
  });
  return () => output;
};
const endpoint = (pathname, payload, status = 200) =>
  mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(String(url), `${platformUrl}${pathname}`);
    assert.equal(request.method, "GET");
    assert.equal(request.headers.authorization, "Bearer fake-analytics-token");
    assert.equal(request.redirect, "error");
    return Response.json(payload, { status });
  });

test("overview is one validated JSON document with the default window", async () => {
  endpoint("/api/cli/games/my%2Fgame/analytics?days=14", overview);
  const output = captureOutput();
  await run(["overview", "--game", "my/game", "--json"]);
  assert.deepEqual(JSON.parse(output()), overview);
});
test("custom window and readable summary", async () => {
  endpoint("/api/cli/games/game-1/analytics?days=90", {
    ...overview,
    days: 90,
  });
  const output = captureOutput();
  await run(["overview", "--game", "game-1", "--days", "90"]);
  assert.match(output(), /Sessions: 3/);
  assert.match(output(), /Controller seconds: 900/);
});
for (const [args, limit] of [
  [[], 8],
  [["--limit", "25"], 25],
]) {
  test(`sessions preserve all fields with limit ${limit}`, async () => {
    endpoint(`/api/cli/games/game-1/analytics/sessions?limit=${limit}`, [
      session,
    ]);
    const output = captureOutput();
    await run(["sessions", "--game", "game-1", ...args, "--json"]);
    assert.deepEqual(JSON.parse(output()), [session]);
  });
}
test("empty sessions remain an empty array", async () => {
  endpoint("/api/cli/games/game-1/analytics/sessions?limit=8", []);
  const output = captureOutput();
  await run(["sessions", "--game", "game-1", "--json"]);
  assert.deepEqual(JSON.parse(output()), []);
});
for (const args of [
  ["overview", "--days", "0"],
  ["overview", "--days", "91"],
  ["overview", "--days", "1.5"],
  ["overview", "--days", "oops"],
  ["sessions", "--limit", "0"],
  ["sessions", "--limit", "26"],
  ["sessions", "--limit", "1.2"],
  ["sessions", "--limit", "oops"],
  ["overview", "--limit", "2"],
  ["sessions", "--days", "14"],
  ["overview"],
  ["sessions"],
]) {
  test(`invalid options never request data: ${args.join(" ")}`, async () => {
    const [view, ...options] = args;
    await assert.rejects(
      run([view, ...(options.length ? ["--game", "game-1"] : []), ...options]),
    );
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}
for (const [status, error] of [
  [401, "unauthorized"],
  [404, "not_found"],
]) {
  test(`platform ${error} fails without success output`, async () => {
    endpoint(
      "/api/cli/games/game-1/analytics?days=14",
      { error, message: "Access refused" },
      status,
    );
    const output = captureOutput();
    await assert.rejects(
      run(["overview", "--game", "game-1", "--json"]),
      /Access refused/,
    );
    assert.equal(output(), "");
  });
}
test("malformed server payload is rejected", async () => {
  endpoint("/api/cli/games/game-1/analytics?days=14", { days: 14, totals: {} });
  await assert.rejects(run(["overview", "--game", "game-1", "--json"]));
});
test("help documents both views and bounds without authentication", async () => {
  const analytics = program().commands[0].commands[0];
  assert.match(analytics.helpInformation(), /overview/);
  assert.match(analytics.helpInformation(), /sessions/);
  assert.match(analytics.commands[0].helpInformation(), /1–90/);
  assert.match(analytics.commands[1].helpInformation(), /1–25/);
  for (const command of analytics.commands) {
    assert.match(command.helpInformation(), /--game <slug-or-id>/);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
