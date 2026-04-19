import path from "node:path";
import { loadEnvFile } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  buildPlatformShellTopology,
  serializeResolvedTopology,
} from "../../../packages/create-airjam/runtime/runtime-topology.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import {
  defaultWorkspaceGameId,
  findRepoGame,
  toLocalReferenceUrlEnvKey,
} from "./repo-games.mjs";
import { waitForUrl } from "./url-readiness.mjs";
import { resolveWorkspaceArcadeOrigins } from "./workspace-runtime-origins.mjs";
import {
  createWorkspaceProcessGroup,
  ensureWorkspaceBuildArtifact,
  ensureWorkspacePackageBuild,
  reserveWorkspaceResources,
} from "./workspace-stack.mjs";

const BACKEND_PROXY_URL = "http://127.0.0.1:4000";

const appendVisualHarnessParam = (url) => {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("aj_visual_harness", "enabled");
  return nextUrl.toString();
};

const buildWorkspaceGame = ({ rootDir, activeGame }) => {
  ensureWorkspacePackageBuild({
    rootDir,
    packageDir: "packages/sdk",
    label: "@air-jam/sdk",
    buildArgs: ["--filter", "@air-jam/sdk", "build"],
  });
  ensureWorkspaceBuildArtifact({
    rootDir,
    projectDir: activeGame.dir,
    label: activeGame.id,
    buildArgs: ["--dir", activeGame.dir, "build"],
    sourcePaths: [
      "src",
      "visual",
      "index.html",
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      "vite.config.mjs",
      "vite.config.js",
      "tailwind.config.ts",
      "tailwind.config.js",
      "postcss.config.js",
      "public",
      "../../packages/visual-harness/package.json",
      "../../packages/visual-harness/src",
    ],
    distCheckFile: "dist/index.html",
  });
};

export const startWorkspaceArcadeBuiltStack = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  secure = false,
  secureMode = SECURE_MODE_LOCAL,
  build = true,
  browserOrigin = "public",
  visualHarness = false,
} = {}) => {
  const activeGame = findRepoGame(gameId);
  if (!activeGame) {
    throw new Error(`Unknown game "${gameId}".`);
  }

  if (secure && secureMode !== SECURE_MODE_LOCAL) {
    throw new Error(
      "Tunnel secure mode is not supported for local Arcade integration. Use local secure mode for built Arcade validation.",
    );
  }

  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  if (build) {
    buildWorkspaceGame({ rootDir, activeGame });
  }

  const secureState = secure
    ? loadSecureDevState({
        cwd: rootDir,
        mode: SECURE_MODE_LOCAL,
        env: process.env,
        gamePort: DEFAULT_GAME_PORT,
      })
    : null;

  const arcadeOrigins = resolveWorkspaceArcadeOrigins({
    secure,
    secureState,
    gamePort: DEFAULT_GAME_PORT,
    platformPort: DEFAULT_PLATFORM_PORT,
  });
  const browserPlatformOrigin =
    browserOrigin === "host"
      ? arcadeOrigins.hostPlatformOrigin
      : arcadeOrigins.publicPlatformOrigin;
  const browserBuildUrlBase = `${browserPlatformOrigin}/airjam-local-builds/${activeGame.id}`;
  const publicBuildUrlBase = `${arcadeOrigins.publicPlatformOrigin}/airjam-local-builds/${activeGame.id}`;
  const browserBuildUrl = visualHarness
    ? appendVisualHarnessParam(browserBuildUrlBase)
    : browserBuildUrlBase;
  const publicBuildUrl = visualHarness
    ? appendVisualHarnessParam(publicBuildUrlBase)
    : publicBuildUrlBase;
  const platformHostTopology = buildPlatformShellTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "platform-host",
    appOrigin: arcadeOrigins.hostPlatformOrigin,
    publicHost: arcadeOrigins.publicPlatformOrigin,
    secureTransport: secure,
  });
  const platformControllerTopology = buildPlatformShellTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "platform-controller",
    appOrigin: browserPlatformOrigin,
    publicHost: arcadeOrigins.publicPlatformOrigin,
    secureTransport: secure,
  });

  const platformEnv = {
    AIR_JAM_DEV_PROXY_BACKEND_URL: BACKEND_PROXY_URL,
    AIR_JAM_LOCAL_BUILD_ACTIVE_GAME_ID: activeGame.id,
    AIR_JAM_LOCAL_BUILD_ACTIVE_DIST_DIR: path.join(activeGame.dir, "dist"),
    NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY:
      serializeResolvedTopology(platformHostTopology),
    NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY: serializeResolvedTopology(
      platformControllerTopology,
    ),
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: arcadeOrigins.publicPlatformOrigin,
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT: activeGame.id,
    NEXT_PUBLIC_APP_URL: arcadeOrigins.publicPlatformOrigin,
    BETTER_AUTH_URL: arcadeOrigins.publicPlatformOrigin,
    [toLocalReferenceUrlEnvKey(activeGame.id)]: browserBuildUrl,
    ...(secureState
      ? {
          AIR_JAM_SECURE_MODE: secureState.mode,
          AIR_JAM_DEV_CERT_FILE: secureState.certFile,
          AIR_JAM_DEV_KEY_FILE: secureState.keyFile,
        }
      : {}),
  };

  await reserveWorkspaceResources({
    rootDir,
    ports: [4000, DEFAULT_PLATFORM_PORT],
  });

  const processGroup = createWorkspaceProcessGroup({
    rootDir,
    exitOnShutdown: false,
  });
  processGroup.run("server", "pnpm", ["--filter", "@air-jam/server", "dev"], {
    suppressStructuredServerLogs: true,
  });
  processGroup.run("platform", "pnpm", ["--filter", "platform", "dev:no-db"], {
    env: platformEnv,
  });

  const localReferenceSlug = `local-${activeGame.id}`;
  const urls = {
    appOrigin: browserPlatformOrigin,
    hostUrl: `${browserPlatformOrigin}/arcade/${localReferenceSlug}`,
    controllerBaseUrl: `${browserPlatformOrigin}/controller`,
    localBuildUrl: publicBuildUrl,
    browserBuildUrl,
    publicHost: arcadeOrigins.publicPlatformOrigin,
  };

  try {
    const readinessOptions = { allowInsecureLocalHttps: secure };
    await waitForUrl(`${BACKEND_PROXY_URL}/health`, "Air Jam server");
    await waitForUrl(
      urls.appOrigin,
      "platform root",
      120_000,
      readinessOptions,
    );
    await waitForUrl(
      urls.hostUrl,
      `${activeGame.id} Arcade surface`,
      120_000,
      readinessOptions,
    );
    await waitForUrl(
      urls.controllerBaseUrl,
      "platform controller",
      120_000,
      readinessOptions,
    );
  } catch (error) {
    await processGroup.shutdown(0);
    await reserveWorkspaceResources({
      rootDir,
      ports: [4000, DEFAULT_PLATFORM_PORT],
      clearPlatformCache: false,
    });
    throw error;
  }

  return {
    activeGame,
    processGroup,
    urls,
    shutdown: async () => {
      await processGroup.shutdown(0);
      await reserveWorkspaceResources({
        rootDir,
        ports: [4000, DEFAULT_PLATFORM_PORT],
        clearPlatformCache: false,
      });
    },
  };
};
