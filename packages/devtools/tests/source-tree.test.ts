import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import {
  SOURCE_EXCLUDES,
  SOURCE_TREE_PROGRAM,
} from "../src/source-tree-contract.js";
import { copySourceTree, readSourceTree } from "../src/source-tree.js";

const directories: string[] = [];
async function fixture() {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "airjam-source-tree-"),
  );
  directories.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

test("the portable fingerprint preserves Studio's existing stored hash", async () => {
  const source = await fixture();
  await mkdir(path.join(source, "src/node_modules"), { recursive: true });
  await mkdir(path.join(source, "dist"));
  await mkdir(path.join(source, ".airjam/devtools/build-cache"), {
    recursive: true,
  });
  await writeFile(path.join(source, "src/game.ts"), "export const score = 7;");
  await writeFile(path.join(source, "dist/index.html"), "ignored");
  await writeFile(path.join(source, "src/node_modules/ignored"), "ignored");
  await chmod(path.join(source, "src/game.ts"), 0o744);
  const hash = createHash("sha256");
  const excluded = SOURCE_EXCLUDES.map((value) =>
    value.replace(/^\/|\/$/g, ""),
  );
  async function legacyWalk(directory: string, relative = "") {
    for (const name of (await readdir(directory)).sort()) {
      const filename = relative ? `${relative}/${name}` : name;
      if (
        excluded.some(
          (value) =>
            filename === value ||
            filename.startsWith(`${value}/`) ||
            (value === "node_modules" && name === value),
        )
      )
        continue;
      const absolute = path.join(directory, name),
        stat = await lstat(absolute);
      if (stat.isDirectory()) {
        hash.update(JSON.stringify([filename, stat.mode & 511, "directory"]));
        await legacyWalk(absolute, filename);
        continue;
      }
      hash.update(
        JSON.stringify([
          filename,
          stat.mode & 511,
          stat.isSymbolicLink() ? "link" : "file",
        ]),
      );
      hash.update(
        stat.isSymbolicLink()
          ? await readlink(absolute)
          : createHash("sha256")
              .update(await readFile(absolute))
              .digest(),
      );
    }
  }
  await legacyWalk(source);
  const expected = hash.digest("hex");
  expect((await readSourceTree(source)).hash).toBe(expected);
  expect(
    execFileSync(process.execPath, ["-e", SOURCE_TREE_PROGRAM, source], {
      encoding: "utf8",
    }),
  ).toBe(expected);
  const destination = path.join(await fixture(), "copy");
  expect((await copySourceTree(source, destination)).hash).toBe(expected);
  await writeFile(path.join(source, "src/game.ts"), "changed");
  expect((await readSourceTree(destination)).hash).toBe(expected);
  expect((await readSourceTree(source)).hash).not.toBe(expected);
});

test.skipIf(process.platform === "win32")(
  "a sealed source copy preserves internal links and rejects links outside the project",
  async () => {
    const source = await fixture();
    await writeFile(path.join(source, "game.ts"), "hello");
    await symlink("game.ts", path.join(source, "linked.ts"));
    const copy = path.join(await fixture(), "copy");
    expect((await copySourceTree(source, copy)).hash).toBe(
      (await readSourceTree(source)).hash,
    );
    await symlink("../outside", path.join(source, "outside"));
    await expect(
      copySourceTree(source, path.join(await fixture(), "copy")),
    ).rejects.toThrow("build_external_link");
  },
);
