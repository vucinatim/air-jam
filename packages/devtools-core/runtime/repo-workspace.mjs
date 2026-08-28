import { detectLocalIpv4 } from "../../cli/runtime/dev-utils.mjs";
import {
  buildEmbeddedGameTopology,
  buildPlatformShellTopology,
  buildStandaloneGameTopology,
  serializeResolvedTopology,
} from "../../cli/runtime/runtime-topology.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
} from "../../cli/runtime/secure-dev.mjs";
import { findRepoWorkspaceGame } from "./repo-workspace-games.mjs";

const BACKEND_ORIGIN = "http://127.0.0.1:4000";

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
