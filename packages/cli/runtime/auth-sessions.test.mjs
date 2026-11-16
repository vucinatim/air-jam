import { Command } from "commander";
import assert from "node:assert/strict";
import filesystem from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";
import { registerAuthSessionsCommand } from "../dist/auth-sessions.js";

for (const revoke of [false, true]) {
  test(`auth sessions ${revoke ? "revoke" : "list"} prints JSON with inherited options`, async () => {
    const previousStateDirectory = process.env.AIRJAM_STATE_DIR;
    const stateDirectory = await filesystem.mkdtemp(
      path.join(os.tmpdir(), "airjam-sessions-"),
    );
    process.env.AIRJAM_STATE_DIR = stateDirectory;
    const platformUrl = "https://sessions.airjam.test";
    const result = revoke ? { ok: true } : { sessions: [] };
    try {
      await filesystem.mkdir(path.join(stateDirectory, "auth"));
      await filesystem.writeFile(
        path.join(stateDirectory, "auth/platform-session.json"),
        JSON.stringify({
          version: 2,
          platformBaseUrl: platformUrl,
          clientName: null,
          storedAt: "2026-11-16T00:00:00Z",
          user: {
            id: "creator",
            name: "Creator",
            email: "creator@airjam.test",
            role: "creator",
          },
          session: {
            id: "current",
            token: "access",
            refreshToken: "refresh",
            expiresAt: "2099-01-01T00:00:00Z",
            refreshExpiresAt: "2099-02-01T00:00:00Z",
            createdAt: "2026-11-16T00:00:00Z",
            userAgent: "airjam-cli",
          },
        }),
      );
      mock.method(globalThis, "fetch", async (url, request) => {
        assert.equal(
          String(url),
          `${platformUrl}/api/cli/auth/sessions${revoke ? "/revoke" : ""}`,
        );
        assert.equal(request.headers.authorization, "Bearer access");
        if (revoke)
          assert.deepEqual(JSON.parse(request.body), { id: "target" });
        return Response.json(result);
      });
      let output = "";
      mock.method(process.stdout, "write", (chunk) => {
        output += chunk;
        return true;
      });
      const program = new Command("airjam").exitOverride();
      registerAuthSessionsCommand(program.command("auth"));
      await program.parseAsync(
        [
          "auth",
          "sessions",
          ...(revoke ? ["revoke", "target"] : []),
          "--json",
          "--platform-url",
          platformUrl,
        ],
        { from: "user" },
      );
      assert.deepEqual(JSON.parse(output), result);
    } finally {
      mock.restoreAll();
      if (previousStateDirectory === undefined)
        delete process.env.AIRJAM_STATE_DIR;
      else process.env.AIRJAM_STATE_DIR = previousStateDirectory;
      await filesystem.rm(stateDirectory, { recursive: true, force: true });
    }
  });
}
