import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import { readGameRunArtifact } from "../src/game-run-record.js";

const race = vi.hoisted(() => ({
  replace: null as null | { source: string; destination: string },
}));
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    lstat: async (...args: Parameters<typeof actual.lstat>) => {
      if (race.replace?.destination === args[0]) {
        const replacement = race.replace;
        race.replace = null;
        await actual.rename(replacement.source, replacement.destination);
      }
      return actual.lstat(...args);
    },
  };
});
const directories: string[] = [];
afterEach(async () => {
  race.replace = null;
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function createFixture(name: "record.json" | "trace.ndjson") {
  const projectDir = await mkdtemp(
    path.join(os.tmpdir(), "airjam-record-race-"),
  );
  directories.push(projectDir);
  const runId = randomUUID();
  const directory = path.join(projectDir, ".airjam/artifacts/runs", runId);
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, name),
    source = path.join(directory, "replacement");
  await writeFile(destination, "original");
  await writeFile(source, "replacement");
  return { projectDir, runId, destination, source };
}
test("an atomic live-record replacement is not accepted as an offline receipt", async () => {
  const fixture = await createFixture("record.json");
  race.replace = fixture;
  await expect(
    readGameRunArtifact(fixture.projectDir, fixture.runId, "record.json", 1024),
  ).resolves.toBeNull();
});
test("replacing an immutable trace still fails integrity validation", async () => {
  const fixture = await createFixture("trace.ndjson");
  race.replace = fixture;
  await expect(
    readGameRunArtifact(
      fixture.projectDir,
      fixture.runId,
      "trace.ndjson",
      1024,
    ),
  ).rejects.toThrow("path changed");
});
test.skipIf(process.platform === "win32")(
  "a record replaced by a symlink is rejected",
  async () => {
    const fixture = await createFixture("record.json");
    await rm(fixture.source);
    await symlink(fixture.destination, fixture.source);
    race.replace = fixture;
    await expect(
      readGameRunArtifact(
        fixture.projectDir,
        fixture.runId,
        "record.json",
        1024,
      ),
    ).rejects.toThrow();
  },
);
