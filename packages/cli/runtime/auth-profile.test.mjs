import { Command } from "commander";
import assert from "node:assert/strict";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import test, { afterEach, beforeEach, mock } from "node:test";
import { registerAuthProfileCommand } from "../dist/auth-profile.js";

const platformUrl = "https://profile.airjam.test";
const user = {
  id: "creator-1",
  name: "New Creator",
  email: "creator@airjam.test",
  role: "creator",
};

beforeEach(() => {
  mock.method(filesystem, "readFile", async (filePath) => {
    assert.match(String(filePath), /[/\\]auth[/\\]platform-session\.json$/);
    return JSON.stringify({
      version: 1,
      platformBaseUrl: platformUrl,
      clientName: "profile-test",
      storedAt: "2026-11-06T12:00:00.000Z",
      user: { ...user, name: "Old Creator" },
      session: {
        id: "session-1",
        token: "fake-profile-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: "2026-11-06T12:00:00.000Z",
        userAgent: "airjam-cli/profile-test",
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
  registerAuthProfileCommand(command.command("auth"));
  return command;
};
const run = (args) =>
  program().parseAsync(["auth", "profile", ...args], { from: "user" });
const captureOutput = () => {
  let output = "";
  mock.method(process.stdout, "write", (chunk) => {
    output += chunk;
    return true;
  });
  return () => output;
};
const endpoint = (payload = user, status = 200) =>
  mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(String(url), `${platformUrl}/api/cli/auth/profile`);
    assert.equal(request.method, "POST");
    assert.equal(request.headers.authorization, "Bearer fake-profile-token");
    assert.equal(request.redirect, "error");
    assert.deepEqual(JSON.parse(request.body), { displayName: "New Creator" });
    return Response.json(payload, { status });
  });

test("sets the trimmed display name using the stored session and prints one JSON document", async () => {
  endpoint();
  const output = captureOutput();
  await run([
    "--display-name",
    "  New Creator  ",
    "--platform-url",
    platformUrl,
    "--json",
  ]);
  assert.deepEqual(JSON.parse(output()), user);
});

test("prints the saved display name for human output", async () => {
  endpoint();
  const output = captureOutput();
  await run(["--display-name", "New Creator"]);
  assert.equal(output(), "Display name: New Creator\n");
});

for (const [name, message] of [
  ["   ", /Display name is required/],
  ["x".repeat(51), /50 characters or fewer/],
]) {
  test(`invalid name fails before authentication: ${name.length} characters`, async () => {
    await assert.rejects(run(["--display-name", name]), message);
    assert.equal(filesystem.readFile.mock.callCount(), 0);
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
}

test("missing required name fails before authentication", async () => {
  await assert.rejects(run([]), /required option/);
  assert.equal(filesystem.readFile.mock.callCount(), 0);
});

test("no session fails before a request", async () => {
  filesystem.readFile.mock.mockImplementation(async () => {
    throw Object.assign(new Error("Missing session"), { code: "ENOENT" });
  });
  await assert.rejects(
    run(["--display-name", "New Creator"]),
    /No stored Air Jam platform session/,
  );
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

for (const [status, error, message] of [
  [401, "unauthorized", "Sign in required"],
  [400, "validation_failed", "Display name must be 50 characters or fewer"],
]) {
  test(`platform ${error} fails without success output`, async () => {
    endpoint({ error, message }, status);
    const output = captureOutput();
    await assert.rejects(run(["--display-name", "New Creator", "--json"]), {
      message,
    });
    assert.equal(output(), "");
  });
}

test("invalid response fails without success output", async () => {
  endpoint({ name: "New Creator" });
  const output = captureOutput();
  await assert.rejects(run(["--display-name", "New Creator", "--json"]));
  assert.equal(output(), "");
});

test("help discovers the command and options without authentication", () => {
  const auth = program().commands[0];
  assert.match(auth.helpInformation(), /profile/);
  for (const option of ["--display-name", "--platform-url", "--json"]) {
    assert.ok(auth.commands[0].helpInformation().includes(option));
  }
  assert.equal(filesystem.readFile.mock.callCount(), 0);
});
