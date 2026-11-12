import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { sourceFencePlugin } from "./source-fence.mjs";

// Resolve Vite exactly as the dev launcher does: from a game, not the CLI.
const require = createRequire(
  new URL("../../../games/minimal/package.json", import.meta.url),
);
const { createServer } = await import(
  pathToFileURL(require.resolve("vite")).href
);

for (const game of ["minimal", "air-capture"]) {
  test(`new public media serves its first bytes before watcher registration (${game})`, async () => {
    const gameRequire = createRequire(
      new URL(`../../../games/${game}/package.json`, import.meta.url),
    );
    const { createServer } = await import(
      pathToFileURL(gameRequire.resolve("vite")).href
    );
    const root = await mkdtemp(join(tmpdir(), "airjam-new-public-"));
    let server;
    try {
      await mkdir(join(root, "public"));
      await writeFile(join(root, "index.html"), "<html>game page</html>");
      server = await createServer({
        root,
        base: "/studio/",
        configFile: false,
        plugins: [sourceFencePlugin()],
        server: {
          host: "127.0.0.1",
          port: 0,
          headers: { "X-Game": "preview" },
        },
        logLevel: "error",
      });
      await server.listen();
      const address = `http://127.0.0.1:${server.httpServer.address().port}/studio`;
      const emit = server.watcher.emit;
      server.watcher.emit = function (event, ...argumentsList) {
        if (event === "add") return false;
        return emit.call(this, event, ...argumentsList);
      };
      await mkdir(join(root, "public/new/media"), { recursive: true });
      const files = [
        {
          name: "voice.wav",
          type: "audio/wav",
          content: Buffer.from("RIFFnew WAV bytes"),
        },
        {
          name: "portrait.png",
          type: "image/png",
          content: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        },
        {
          name: "icon.svg",
          type: "image/svg+xml",
          content: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
        },
      ];
      for (const file of files) {
        await writeFile(
          join(root, "public/new/media", file.name),
          file.content,
        );
        const response = await fetch(
          `${address}/new/media/${file.name}?v=first`,
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), file.type);
        assert.equal(response.headers.get("x-game"), "preview");
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          file.content,
        );
      }
      const range = await fetch(`${address}/new/media/voice.wav`, {
        headers: { Range: "bytes=0-3" },
      });
      assert.equal(range.status, 206);
      assert.equal(await range.text(), "RIFF");
      const head = await fetch(`${address}/new/media/voice.wav`, {
        method: "HEAD",
      });
      assert.equal(head.status, 200);
      assert.equal(
        head.headers.get("content-length"),
        String(files[0].content.length),
      );
      assert.equal(await head.text(), "");
      const conditional = await fetch(`${address}/new/media/voice.wav`, {
        headers: { "If-None-Match": head.headers.get("etag") },
      });
      assert.equal(conditional.status, 304);
      await writeFile(
        join(root, "public/new/media/voice.wav"),
        "new voice bytes",
      );
      const replacement = await fetch(`${address}/new/media/voice.wav`);
      assert.equal(await replacement.text(), "new voice bytes");
      await writeFile(join(root, "private.wav"), "private bytes");
      await symlink(
        join(root, "private.wav"),
        join(root, "public/new/media/private.wav"),
      );
      const escaped = await fetch(`${address}/new/media/private.wav`);
      assert.doesNotMatch(await escaped.text(), /private bytes/);
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("grouped public asset and module creation is available after one browser reload", async () => {
  const root = await mkdtemp(join(tmpdir(), "airjam-fence-public-"));
  let server;
  let socket;
  try {
    await mkdir(join(root, "public"));
    await mkdir(join(root, ".airjam/devtools"), { recursive: true });
    await writeFile(
      join(root, "index.html"),
      '<script type="module" src="/game.js"></script>',
    );
    server = await createServer({
      root,
      configFile: false,
      plugins: [sourceFencePlugin()],
      server: {
        host: "127.0.0.1",
        port: 0,
        watch: { ignored: ["**/.airjam/**"] },
      },
      logLevel: "error",
    });
    await server.listen();
    const address = `http://127.0.0.1:${server.httpServer.address().port}`;
    socket = new WebSocket(
      `${address.replace("http:", "ws:")}/?token=${server.config.webSocketToken}`,
      "vite-hmr",
    );
    await once(socket, "open");
    const messages = [];
    const reload = new Promise((resolvePromise) => {
      socket.addEventListener("message", ({ data }) => {
        const message = JSON.parse(data);
        if (["update", "full-reload", "error"].includes(message.type))
          messages.push(message);
        if (message.type === "full-reload") resolvePromise();
      });
    });
    const marker = join(root, ".airjam/devtools/source-change.json");
    const fence = async (state) => {
      await writeFile(`${marker}.tmp`, JSON.stringify(state));
      await rename(`${marker}.tmp`, marker);
    };
    await fence({
      id: "creation",
      phase: "applying",
      expiresAt: Date.now() + 60_000,
    });
    const files = [
      { path: "public/grouped.svg", content: "<svg>grouped</svg>" },
      {
        path: "game.js",
        content: "document.body.innerHTML = '<img src=\"/grouped.svg\">';",
      },
    ];
    for (const file of files)
      await writeFile(join(root, file.path), file.content);
    await fence({
      id: "creation",
      phase: "settled",
      committed: true,
      files: files.map(({ path, content }) => ({
        path,
        event: "add",
        hash: createHash("sha256").update(content).digest("hex"),
      })),
    });
    await reload;
    const asset = await fetch(`${address}/grouped.svg`);
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), files[0].content);
    const module = await fetch(`${address}/game.js`);
    assert.equal(module.status, 200);
    assert.match(await module.text(), /grouped.svg/);
    assert.deepEqual(
      messages.map((message) => message.type),
      ["full-reload"],
    );
  } finally {
    socket?.close();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
