import {
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/sdk/runtime-topology";
import { loadServerEnv } from "@air-jam/server";
import { createRoomServer } from "@air-jam/server/room-server";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { gameBuildManifestSchema } from "./game-build-protocol.js";
import { distributionFiles } from "./game-build.js";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".wasm": "application/wasm",
};

const contentTypeOf = (name: string): string =>
  CONTENT_TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";

/** One loopback origin serves the pinned assets and their rooms. */
export async function startBuiltGameRuntime(manifestPath: string) {
  const manifest = gameBuildManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  const root = await realpath(
    path.join(path.dirname(manifestPath), "source/dist"),
  );
  const files = await distributionFiles(root);
  if (
    createHash("sha256").update(JSON.stringify(files)).digest("hex") !==
    manifest.distHash
  )
    throw new Error(
      "build_integrity_changed: The distribution changed before host startup.",
    );
  const allowed = new Set(files.map((file) => file.path));
  const serveFile = (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end();
      return;
    }
    let name: string;
    try {
      name = decodeURIComponent(
        new URL(request.url ?? "/", "http://localhost").pathname,
      ).slice(1);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (
      name === "" ||
      (!allowed.has(name) &&
        request.headers.accept?.includes("text/html") &&
        !name.split("/").some((segment) => segment.includes(".")))
    )
      name = "index.html";
    if (!allowed.has(name)) {
      response.writeHead(404).end();
      return;
    }
    readFile(path.join(root, name)).then(
      (body) => {
        response.writeHead(200, {
          "content-type": contentTypeOf(name),
          "content-length": body.byteLength,
          "x-content-type-options": "nosniff",
          "cache-control": "no-store",
        });
        response.end(request.method === "HEAD" ? undefined : body);
      },
      () => {
        if (!response.headersSent) response.writeHead(404).end();
      },
    );
  };
  const runtime = createRoomServer({
    host: "127.0.0.1",
    port: 0,
    envConfig: loadServerEnv({
      NODE_ENV: "test",
      AIR_JAM_AUTH_MODE: "disabled",
    }),
    otherRequests: serveFile,
  });
  try {
    const origin = `http://127.0.0.1:${await runtime.start()}`;
    const topology = (surfaceRole: "host" | "controller") =>
      resolveRuntimeTopology({
        runtimeMode: "self-hosted-production",
        surfaceRole,
        appOrigin: origin,
        backendOrigin: origin,
        socketOrigin: origin,
        publicHost: origin,
        embedded: false,
        proxyStrategy: "none",
        secureTransport: false,
      });
    const surfaceUrl = (role: "host" | "controller") => {
      const url = new URL(role === "host" ? "/" : "/controller", origin);
      for (const [key, value] of Object.entries(
        runtimeTopologyToQueryParams(topology(role)),
      ))
        url.searchParams.set(key, value);
      return url.toString();
    };
    return {
      topology: topology("host"),
      urls: {
        appOrigin: origin,
        hostUrl: surfaceUrl("host"),
        controllerBaseUrl: surfaceUrl("controller"),
        publicHost: origin,
        localBuildUrl: null,
        browserBuildUrl: null,
      },
      close: () => runtime.stop(),
    };
  } catch (error) {
    await runtime.stop();
    throw error;
  }
}
