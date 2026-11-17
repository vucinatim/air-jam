import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("the Vite launcher overrides a game's bind host only when requested", async () => {
  const root = await mkdtemp(join(tmpdir(), "airjam-vite-launcher-"));
  try {
    await writeFile(join(root, "package.json"), '{"private":true}');
    const vite = join(root, "node_modules/vite");
    await mkdir(vite, { recursive: true });
    await writeFile(
      join(vite, "package.json"),
      '{"type":"module","main":"index.js"}',
    );
    await writeFile(
      join(vite, "index.js"),
      `
      export async function createServer(config) {
        console.log(JSON.stringify(config.server ?? null));
        return { async listen() {}, printUrls() {}, bindCLIShortcuts() {} };
      }
    `,
    );
    for (const [input, expected] of [
      ["", null],
      [" 127.0.0.1 ", { host: "127.0.0.1" }],
    ]) {
      const output = execFileSync(
        process.execPath,
        [fileURLToPath(new URL("./vite-dev.mjs", import.meta.url))],
        {
          cwd: root,
          env: { ...process.env, AIR_JAM_BIND_HOST: input },
          encoding: "utf8",
        },
      );
      assert.deepEqual(JSON.parse(output), expected);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
