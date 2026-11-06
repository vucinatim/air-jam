import { Command } from "commander";
import assert from "node:assert/strict";
import filesystem from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import test, { afterEach, beforeEach, mock } from "node:test";
import { registerGameMediaCommands } from "../dist/game-media.js";

const platformUrl = "https://media.airjam.test";
const game = {
  id: "game_1",
  slug: "minimal",
  name: "Minimal",
  description: null,
  url: null,
  arcadeVisibility: "hidden",
  sourceUrl: null,
  templateId: "minimal",
  createdAt: "2026-11-06T08:00:00.000Z",
  updatedAt: "2026-11-06T08:00:00.000Z",
};
const active = {
  thumbnailMediaAssetId: null,
  coverMediaAssetId: "cover_current",
  previewVideoMediaAssetId: null,
};
const asset = {
  id: "cover_earlier",
  gameId: game.id,
  kind: "cover",
  status: "ready",
  originalFilename: "cover.png",
  mimeType: "image/png",
  sizeBytes: 100,
  checksum: null,
  width: 800,
  height: 600,
  durationSeconds: null,
  createdAt: game.createdAt,
  updatedAt: game.updatedAt,
  activeAssetId: "cover_current",
  isActive: false,
  publicUrl: `${platformUrl}/media/cover.png`,
};

beforeEach(() => {
  mock.method(filesystem, "readFile", async (filePath) => {
    assert.match(String(filePath), /[/\\]auth[/\\]platform-session\.json$/);
    return JSON.stringify({
      version: 1,
      platformBaseUrl: platformUrl,
      clientName: "media-test",
      storedAt: game.createdAt,
      user: {
        id: "user_1",
        name: "Creator",
        email: "test@airjam.test",
        role: "creator",
      },
      session: {
        id: "session_1",
        token: "fake-media-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: game.createdAt,
        userAgent: "airjam-cli/media-test",
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
  const command = new Command("airjam").exitOverride().configureOutput({
    writeOut: () => {},
    writeErr: () => {},
  });
  registerGameMediaCommands(command.command("game"));
  return command;
};

const run = (args) =>
  program().parseAsync(["game", "media", ...args], { from: "user" });

const captureOutput = () => {
  let output = "";
  mock.method(process.stdout, "write", (chunk) => {
    output += chunk;
    return true;
  });
  return () => output;
};

const fakeEndpoint = (pathname, method, payload, status = 200) =>
  mock.method(globalThis, "fetch", async (url, request) => {
    assert.equal(String(url), `${platformUrl}${pathname}`);
    assert.equal(request.method, method);
    assert.deepEqual(request.headers, {
      authorization: "Bearer fake-media-token",
    });
    assert.equal(request.body, undefined);
    assert.equal(request.redirect, "error");
    return Response.json(payload, { status });
  });

for (const operation of ["inspect", "list"]) {
  test(`${operation} returns all media IDs, kinds and selections as clean JSON`, async () => {
    const payload = {
      game,
      active,
      assets: [
        asset,
        { ...asset, id: "cover_current", isActive: true },
        {
          ...asset,
          id: "old_thumbnail",
          kind: "thumbnail",
          activeAssetId: null,
          status: "archived",
        },
        {
          ...asset,
          id: "video",
          kind: "preview_video",
          activeAssetId: null,
          mimeType: "video/mp4",
        },
      ],
    };
    const endpoint = fakeEndpoint(
      "/api/cli/games/minimal/media",
      "GET",
      payload,
    );
    const output = captureOutput();
    await run([
      operation,
      "--game",
      game.slug,
      "--platform-url",
      platformUrl,
      "--json",
    ]);
    assert.deepEqual(JSON.parse(output()), payload);
    assert.equal(endpoint.mock.callCount(), 1);
  });
}

test("an empty media catalog is a valid JSON result", async () => {
  const payload = {
    game,
    active: { ...active, coverMediaAssetId: null },
    assets: [],
  };
  fakeEndpoint("/api/cli/games/game_1/media", "GET", payload);
  const output = captureOutput();
  await run(["list", "--game", game.id, "--json"]);
  assert.deepEqual(JSON.parse(output()), payload);
});

for (const operation of ["assign", "archive"]) {
  for (const kind of ["thumbnail", "cover", "preview_video"]) {
    test(`${operation} sends one POST by asset ID for ${kind} and prints its result`, async () => {
      const payload = {
        game,
        active: {
          ...active,
          [`${kind === "preview_video" ? "previewVideo" : kind}MediaAssetId`]:
            operation === "assign" ? "asset/id #" : null,
        },
        asset: {
          ...asset,
          id: "asset/id #",
          kind,
          activeAssetId: operation === "assign" ? "asset/id #" : null,
          isActive: operation === "assign",
          status: operation === "archive" ? "archived" : "ready",
        },
      };
      const endpoint = fakeEndpoint(
        `/api/cli/games/game%2Fid%20%3F/media/asset%2Fid%20%23/${operation}`,
        "POST",
        payload,
      );
      const output = captureOutput();
      await run([
        operation,
        "--game",
        "game/id ?",
        "--asset-id",
        "asset/id #",
        "--json",
      ]);
      assert.deepEqual(JSON.parse(output()), payload);
      assert.equal(endpoint.mock.callCount(), 1);
    });
  }
}

test("assign and archive remain readable without --json", async () => {
  const output = captureOutput();
  for (const operation of ["assign", "archive"]) {
    fakeEndpoint(
      `/api/cli/games/minimal/media/cover_earlier/${operation}`,
      "POST",
      { game, active, asset },
    );
    await run([operation, "--game", game.slug, "--asset-id", asset.id]);
  }
  assert.match(output(), /Assigned Cover cover_earlier for Minimal/);
  assert.match(output(), /Archived Cover cover_earlier for Minimal/);
});

test("inspect retains its human-readable catalog", async () => {
  fakeEndpoint("/api/cli/games/minimal/media", "GET", {
    game,
    active,
    assets: [asset],
  });
  const output = captureOutput();
  await run(["inspect", "--game", game.slug]);
  assert.match(output(), /cover_earlier/);
  assert.match(output(), /Cover/);
});

for (const operation of ["inspect", "list", "assign", "archive"]) {
  test(`${operation} rejects missing arguments before a request`, async () => {
    await assert.rejects(
      run([operation]),
      /required option '--game <slug-or-id>' not specified/,
    );
    if (["assign", "archive"].includes(operation)) {
      await assert.rejects(
        run([operation, "--game", game.slug]),
        /required option '--asset-id <id>' not specified/,
      );
    }
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });

  test(`${operation} help documents its supported arguments`, () => {
    const command = program().commands[0].commands[0].commands.find(
      (entry) =>
        entry.name() === operation || entry.aliases().includes(operation),
    );
    assert.match(command.helpInformation(), /--game <slug-or-id>/);
    assert.match(command.helpInformation(), /--platform-url <url>/);
    assert.match(command.helpInformation(), /--json/);
    if (["assign", "archive"].includes(operation)) {
      assert.match(command.helpInformation(), /--asset-id <id>/);
    }
  });

  test(`${operation} preserves a clear platform not-found error without success output`, async () => {
    const isRead = ["inspect", "list"].includes(operation);
    const message = isRead ? "Game not found." : "Media asset not found.";
    fakeEndpoint(
      `/api/cli/games/minimal/media${isRead ? "" : `/missing/${operation}`}`,
      isRead ? "GET" : "POST",
      { error: "not_found", message },
      404,
    );
    const output = captureOutput();
    await assert.rejects(
      run([
        operation,
        "--game",
        game.slug,
        ...(isRead ? [] : ["--asset-id", "missing"]),
        "--json",
      ]),
      {
        name: "AirJamPlatformApiError",
        code: "not_found",
        status: 404,
        message,
      },
    );
    assert.equal(output(), "");
  });
}

test("clear still archives the current asset for its requested kind", async () => {
  let archived = false;
  const endpoint = mock.method(globalThis, "fetch", async (url, request) => {
    if (request.method === "GET") {
      assert.equal(String(url), `${platformUrl}/api/cli/games/minimal/media`);
      return Response.json({
        game,
        active,
        assets: archived ? [] : [{ ...asset, isActive: true }],
      });
    }
    assert.equal(
      String(url),
      `${platformUrl}/api/cli/games/minimal/media/cover_earlier/archive`,
    );
    assert.equal(request.method, "POST");
    archived = true;
    return Response.json({
      game,
      active,
      asset: { ...asset, status: "archived" },
    });
  });
  const output = captureOutput();
  await run(["clear", "--game", game.slug, "--kind", "cover"]);
  assert.equal(archived, true);
  assert.equal(endpoint.mock.callCount(), 3);
  assert.match(output(), /Cover cleared/);
});

test("upload still requires at least one media file", async () => {
  await assert.rejects(
    run(["upload", "--game", game.slug]),
    /No media files were provided/,
  );
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});
