import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectLocalIpv4 } from "../../create-airjam/runtime/dev-utils.mjs";
import {
  buildEmbeddedGameTopology,
  buildPlatformShellTopology,
  buildStandaloneGameTopology,
  serializeResolvedTopology,
} from "../../create-airjam/runtime/runtime-topology.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
} from "../../create-airjam/runtime/secure-dev.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestFileName = "airjam-template.json";
const BACKEND_ORIGIN = "http://127.0.0.1:4000";

export const defaultWorkspaceGameId = "air-capture";

export const toLocalReferenceUrlEnvKey = (gameId) =>
  `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_${gameId.replace(/-/g, "_").toUpperCase()}_URL`;

export const toLocalReferenceControllerUrlEnvKey = (gameId) =>
  `NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_${gameId.replace(/-/g, "_").toUpperCase()}_CONTROLLER_URL`;

const isRepoGameManifest = (value) =>
  value &&
  typeof value === "object" &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.description === "string" &&
  typeof value.category === "string" &&
  typeof value.scaffold === "boolean";

const resolveGamesRoot = (rootDir) =>
  path.resolve(rootDir ?? path.resolve(__dirname, "../../.."), "games");

export const loadRepoWorkspaceGames = ({ rootDir } = {}) => {
  const gamesRoot = resolveGamesRoot(rootDir);
  if (!fs.existsSync(gamesRoot)) {
    return [];
  }

  return fs
    .readdirSync(gamesRoot)
    .map((entry) => path.join(gamesRoot, entry))
    .filter((entryPath) => fs.statSync(entryPath).isDirectory())
    .flatMap((dir) => {
      const manifestPath = path.join(dir, manifestFileName);
      if (!fs.existsSync(manifestPath)) {
        return [];
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (!isRepoGameManifest(manifest)) {
        throw new Error(`Invalid repo game manifest at ${manifestPath}`);
      }

      return [
        {
          ...manifest,
          dir,
          manifestPath,
        },
      ];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const findRepoWorkspaceGame = ({ rootDir, gameId }) =>
  loadRepoWorkspaceGames({ rootDir }).find((game) => game.id === gameId);

const toHttpOrigin = (hostname, port) => `http://${hostname}:${port}`;
const toHttpsOrigin = (hostname, port) => `https://${hostname}:${port}`;

export const resolveWorkspaceArcadeOrigins = ({
  secure = false,
  secureState = null,
  gamePort = DEFAULT_GAME_PORT,
  platformPort = DEFAULT_PLATFORM_PORT,
} = {}) => {
  if (secure) {
    if (!secureState) {
      throw new Error(
        "Secure Arcade workspace origin resolution requires a loaded secure dev state.",
      );
    }

    return {
      hostPlatformOrigin: toHttpsOrigin("localhost", platformPort),
      publicPlatformOrigin: secureState.platformHost,
      hostGameOrigin: toHttpsOrigin("localhost", gamePort),
      publicGameOrigin: secureState.publicHost,
    };
  }

  const lanIp = detectLocalIpv4() ?? "localhost";

  return {
    hostPlatformOrigin: toHttpOrigin("localhost", platformPort),
    publicPlatformOrigin: toHttpOrigin(lanIp, platformPort),
    hostGameOrigin: toHttpOrigin("localhost", gamePort),
    publicGameOrigin: toHttpOrigin(lanIp, gamePort),
  };
};

export const createRepoWorkspaceStandaloneTopologies = ({
  publicHost,
  secure = false,
  backendOrigin = BACKEND_ORIGIN,
} = {}) => ({
  host: buildStandaloneGameTopology({
    surfaceRole: "host",
    publicHost,
    secureTransport: secure,
    backendOrigin,
  }),
  controller: buildStandaloneGameTopology({
    surfaceRole: "controller",
    publicHost,
    secureTransport: secure,
    backendOrigin,
  }),
});

export const createRepoWorkspaceArcadeTopologies = ({
  runtimeMode,
  hostPlatformOrigin,
  controllerPlatformOrigin,
  publicPlatformOrigin,
  embeddedHostRuntimeUrl,
  embeddedControllerRuntimeUrl,
  secure = false,
  backendOrigin = BACKEND_ORIGIN,
} = {}) => ({
  platformHost: buildPlatformShellTopology({
    runtimeMode,
    surfaceRole: "platform-host",
    appOrigin: hostPlatformOrigin,
    publicHost: publicPlatformOrigin,
    backendOrigin,
    secureTransport: secure,
  }),
  platformController: buildPlatformShellTopology({
    runtimeMode,
    surfaceRole: "platform-controller",
    appOrigin: controllerPlatformOrigin,
    publicHost: publicPlatformOrigin,
    backendOrigin,
    secureTransport: secure,
  }),
  embeddedHost: buildEmbeddedGameTopology({
    runtimeMode,
    surfaceRole: "host",
    runtimeUrl: embeddedHostRuntimeUrl,
    publicHost: publicPlatformOrigin,
    embedParentOrigin: hostPlatformOrigin,
    backendOrigin,
    secureTransport: secure,
  }),
  embeddedController: buildEmbeddedGameTopology({
    runtimeMode,
    surfaceRole: "controller",
    runtimeUrl: embeddedControllerRuntimeUrl,
    publicHost: publicPlatformOrigin,
    embedParentOrigin: controllerPlatformOrigin,
    backendOrigin,
    secureTransport: secure,
  }),
});

export const resolveRepoWorkspaceTopologySurfaces = ({
  rootDir = process.cwd(),
  gameId,
  mode,
  secure = false,
  secureState = null,
  browserOrigin = "public",
  gamePort = DEFAULT_GAME_PORT,
  platformPort = DEFAULT_PLATFORM_PORT,
} = {}) => {
  if (mode === "standalone-dev") {
    const publicHost = secure
      ? secureState?.publicHost
      : `http://127.0.0.1:${gamePort}`;
    if (!publicHost) {
      throw new Error(
        "Secure standalone topology resolution requires a secure dev public host.",
      );
    }

    return createRepoWorkspaceStandaloneTopologies({
      publicHost,
      secure,
    });
  }

  if (mode !== "arcade-live" && mode !== "arcade-built") {
    throw new Error(
      `Unsupported topology mode "${mode}". Use standalone-dev, arcade-live, or arcade-built.`,
    );
  }

  const activeGame = findRepoWorkspaceGame({ rootDir, gameId });
  if (!activeGame) {
    throw new Error(`Unknown game "${gameId}".`);
  }

  const arcadeOrigins = resolveWorkspaceArcadeOrigins({
    secure,
    secureState,
    gamePort,
    platformPort,
  });
  const controllerPlatformOrigin =
    mode === "arcade-built" && browserOrigin === "host"
      ? arcadeOrigins.hostPlatformOrigin
      : arcadeOrigins.publicPlatformOrigin;
  const embeddedHostRuntimeUrl =
    mode === "arcade-built"
      ? `${arcadeOrigins.publicPlatformOrigin}/airjam-local-builds/${activeGame.id}`
      : arcadeOrigins.hostGameOrigin;
  const embeddedControllerRuntimeUrl =
    mode === "arcade-built"
      ? `${arcadeOrigins.publicPlatformOrigin}/airjam-local-builds/${activeGame.id}/controller`
      : `${arcadeOrigins.publicGameOrigin}/controller`;

  return createRepoWorkspaceArcadeTopologies({
    runtimeMode: mode,
    hostPlatformOrigin: arcadeOrigins.hostPlatformOrigin,
    controllerPlatformOrigin,
    publicPlatformOrigin: arcadeOrigins.publicPlatformOrigin,
    embeddedHostRuntimeUrl,
    embeddedControllerRuntimeUrl,
    secure,
  });
};

export { DEFAULT_GAME_PORT, DEFAULT_PLATFORM_PORT, serializeResolvedTopology };
