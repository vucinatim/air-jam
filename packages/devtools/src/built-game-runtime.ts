import {
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/sdk/runtime-topology";
import { createAirJamServer, loadServerEnv } from "@air-jam/server";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { gameBuildManifestSchema } from "./game-build-protocol.js";
import { distributionFiles } from "./game-build.js";

/** One loopback origin serves the pinned assets and their ordinary Air Jam relay. */
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
  const runtime = createAirJamServer({
    host: "127.0.0.1",
    port: 0,
    envConfig: loadServerEnv({
      NODE_ENV: "test",
      AIR_JAM_AUTH_MODE: "disabled",
    }),
  });
  runtime.app.use((request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.status(405).end();
      return;
    }
    let name: string;
    try {
      name = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      ).slice(1);
    } catch {
      response.status(400).end();
      return;
    }
    if (
      name === "" ||
      (!allowed.has(name) &&
        request.accepts("html") &&
        request.headers.accept?.includes("text/html") &&
        !name.split("/").some((segment) => segment.includes(".")))
    )
      name = "index.html";
    if (!allowed.has(name)) {
      response.status(404).end();
      return;
    }
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    response.sendFile(
      name,
      { root, dotfiles: "deny", cacheControl: false },
      (error) => {
        if (error && !response.headersSent) response.status(404).end();
      },
    );
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
