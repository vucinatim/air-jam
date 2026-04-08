import { execFileSync } from "node:child_process";
import path from "node:path";
import { loadEnvFile } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import {
  buildPlatformShellTopology,
  serializeResolvedTopology,
} from "../../../packages/create-airjam/runtime/runtime-topology.mjs";
import {
  defaultWorkspaceGameId,
  findRepoGame,
  toLocalReferenceUrlEnvKey,
} from "./repo-games.mjs";
import {
  createWorkspaceProcessGroup,
  ensureWorkspacePackageBuild,
  reserveWorkspaceResources,
} from "./workspace-stack.mjs";
import { resolveWorkspaceArcadeOrigins } from "./workspace-runtime-origins.mjs";

const BACKEND_PROXY_URL = "http://127.0.0.1:4000";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForUrl = async (url, label, timeoutMs = 120_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore transient startup failures while the stack boots.
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
};

const buildWorkspaceGame = ({ rootDir, activeGame }) => {
  const runCommand = (label, command, commandArgs, cwd = rootDir) => {
    console.log(`[arcade:built] ${label}`);
    execFileSync(command, commandArgs, {
      cwd,
      stdio: "inherit",
    });
  };

  ensureWorkspacePackageBuild({
    rootDir,
    packageDir: "packages/sdk",
    label: "@air-jam/sdk",
    buildArgs: ["--filter", "@air-jam/sdk", "build"],
  });
  runCommand(`Building ${activeGame.id}...`, "pnpm", [
    "--dir",
    activeGame.dir,
    "build",
  ]);
};

export const startWorkspaceArcadeBuiltStack = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  secure = false,
  secureMode = SECURE_MODE_LOCAL,
  build = true,
  browserOrigin = "public",
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
  const browserBuildUrl = `${browserPlatformOrigin}/airjam-local-builds/${activeGame.id}`;
  const publicBuildUrl = `${arcadeOrigins.publicPlatformOrigin}/airjam-local-builds/${activeGame.id}`;
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
    NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY:
      serializeResolvedTopology(platformControllerTopology),
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

  await waitForUrl(`${BACKEND_PROXY_URL}/health`, "Air Jam server");
  await waitForUrl(urls.appOrigin, "platform root");
  await waitForUrl(urls.hostUrl, `${activeGame.id} Arcade surface`);
  await waitForUrl(urls.controllerBaseUrl, "platform controller");

  return {
    activeGame,
    processGroup,
    urls,
    shutdown: () => processGroup.shutdown(0),
  };
};
