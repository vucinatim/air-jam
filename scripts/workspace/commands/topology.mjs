import path from "node:path";
import { loadEnvFile } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  buildEmbeddedGameTopology,
  buildPlatformShellTopology,
  buildStandaloneGameTopology,
} from "../../../packages/create-airjam/runtime/runtime-topology.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import { resolveWorkspaceArcadeOrigins } from "../lib/workspace-runtime-origins.mjs";

const BACKEND_ORIGIN = "http://127.0.0.1:4000";

const createStandaloneTopologies = ({ publicHost, secure }) => ({
  host: buildStandaloneGameTopology({
    surfaceRole: "host",
    publicHost,
    secureTransport: secure,
    backendOrigin: BACKEND_ORIGIN,
  }),
  controller: buildStandaloneGameTopology({
    surfaceRole: "controller",
    publicHost,
    secureTransport: secure,
    backendOrigin: BACKEND_ORIGIN,
  }),
});

const createArcadeTopologies = ({
  runtimeMode,
  hostPlatformOrigin,
  publicPlatformOrigin,
  embeddedHostRuntimeUrl,
  embeddedControllerRuntimeUrl,
  secure,
}) => {
  const platformHost = buildPlatformShellTopology({
    runtimeMode,
    surfaceRole: "platform-host",
    appOrigin: hostPlatformOrigin,
    publicHost: publicPlatformOrigin,
    backendOrigin: BACKEND_ORIGIN,
    secureTransport: secure,
  });
  const platformController = buildPlatformShellTopology({
    runtimeMode,
    surfaceRole: "platform-controller",
    appOrigin: publicPlatformOrigin,
    publicHost: publicPlatformOrigin,
    backendOrigin: BACKEND_ORIGIN,
    secureTransport: secure,
  });

  return {
    platformHost,
    platformController,
    embeddedHost: buildEmbeddedGameTopology({
      runtimeMode,
      surfaceRole: "host",
      runtimeUrl: embeddedHostRuntimeUrl,
      publicHost: publicPlatformOrigin,
      embedParentOrigin: hostPlatformOrigin,
      backendOrigin: BACKEND_ORIGIN,
      secureTransport: secure,
    }),
    embeddedController: buildEmbeddedGameTopology({
      runtimeMode,
      surfaceRole: "controller",
      runtimeUrl: embeddedControllerRuntimeUrl,
      publicHost: publicPlatformOrigin,
      embedParentOrigin: publicPlatformOrigin,
      backendOrigin: BACKEND_ORIGIN,
      secureTransport: secure,
    }),
  };
};

export const runWorkspaceTopologyCommand = async ({
  rootDir = process.cwd(),
  gameId,
  mode,
  secure = false,
} = {}) => {
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const secureState = secure
    ? loadSecureDevState({
        cwd: rootDir,
        mode: SECURE_MODE_LOCAL,
        env: process.env,
        gamePort: DEFAULT_GAME_PORT,
      })
    : null;

  let surfaces;
  if (mode === "standalone-dev") {
    const publicHost = secure
      ? secureState.publicHost
      : `http://127.0.0.1:${DEFAULT_GAME_PORT}`;
    surfaces = createStandaloneTopologies({
      publicHost,
      secure,
    });
  } else if (mode === "arcade-live" || mode === "arcade-built") {
    const arcadeOrigins = resolveWorkspaceArcadeOrigins({
      secure,
      secureState,
      gamePort: DEFAULT_GAME_PORT,
      platformPort: DEFAULT_PLATFORM_PORT,
    });
    const embeddedHostRuntimeUrl =
      mode === "arcade-built"
        ? `${arcadeOrigins.publicPlatformOrigin}/airjam-local-builds/${gameId}`
        : arcadeOrigins.hostGameOrigin;
    const embeddedControllerRuntimeUrl =
      mode === "arcade-built"
        ? `${arcadeOrigins.publicPlatformOrigin}/airjam-local-builds/${gameId}/controller`
        : `${arcadeOrigins.publicGameOrigin}/controller`;

    surfaces = createArcadeTopologies({
      runtimeMode: mode,
      hostPlatformOrigin: arcadeOrigins.hostPlatformOrigin,
      publicPlatformOrigin: arcadeOrigins.publicPlatformOrigin,
      embeddedHostRuntimeUrl,
      embeddedControllerRuntimeUrl,
      secure,
    });
  } else {
    throw new Error(
      `Unsupported topology mode "${mode}". Use standalone-dev, arcade-live, or arcade-built.`,
    );
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        gameId,
        mode,
        secure,
        surfaces,
      },
      null,
      2,
    )}\n`,
  );
};
