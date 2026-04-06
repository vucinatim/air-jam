import path from "node:path";
import {
  createProcessGroup,
  detectLocalIpv4,
  hasFlag,
  isPortOpen,
  loadEnvFile,
  waitForPort,
} from "./dev-utils.mjs";
import {
  buildSecureGameEnv,
  DEFAULT_GAME_PORT,
  loadSecureDevState,
  parseGameDevArgs,
  SECURE_MODE_TUNNEL,
} from "./secure-dev.mjs";
import {
  buildStandaloneGameTopology,
  serializeResolvedTopology,
} from "./runtime-topology.mjs";
import { loadCreateAirJamRuntimeEnv } from "./runtime-env.mjs";

const START_TIMEOUT_MS = 20_000;

const holdProcessOpen = async () => {
  await new Promise(() => {
    setInterval(() => {}, 1 << 30);
  });
};

const usage = () => {
  console.log(
    "Usage: airjam dev [--secure] [--secure-mode=local|tunnel] [--web-only] [--server-only] [--allow-existing-game]",
  );
  console.log("");
  console.log("Modes:");
  console.log("  default               Start local server + game (recommended)");
  console.log("  --secure              Start secure local game dev");
  console.log("  --secure-mode=tunnel  Use Cloudflare tunnel fallback instead of local-only secure host");
  console.log("  --web-only            Start only the game app");
  console.log("  --server-only         Start only the local Air Jam server");
  console.log(
    "  --allow-existing-game Reuse an already-running Vite server on the game port",
  );
};

const getDefaultPublicHost = (env, gamePort) => {
  const explicitPublicHost = env.VITE_AIR_JAM_PUBLIC_HOST;
  if (explicitPublicHost) {
    return explicitPublicHost;
  }

  const detectedIp = detectLocalIpv4();
  if (!detectedIp) {
    console.warn(
      "[dev] Could not detect LAN IP. Falling back to localhost in QR links.",
    );
    console.warn("[dev] Set VITE_AIR_JAM_PUBLIC_HOST manually for phone testing.");
    return `http://localhost:${gamePort}`;
  }

  return `http://${detectedIp}:${gamePort}`;
};

const startServerIfNeeded = async (processGroup, serverPort) => {
  const hasExistingServer = await isPortOpen(serverPort);
  if (hasExistingServer) {
    console.log(`[dev] Reusing existing server on :${serverPort}`);
    return false;
  }

  processGroup.run("server", "pnpm", ["exec", "air-jam-server"]);
  await waitForPort(serverPort, START_TIMEOUT_MS);
  return true;
};

const startGameIfNeeded = async (
  processGroup,
  {
    gamePort,
    env,
    allowExistingGame,
  },
) => {
  const hasExistingGame = await isPortOpen(gamePort);
  if (hasExistingGame) {
    if (allowExistingGame) {
      console.log(`[dev] Reusing existing game on :${gamePort}`);
      return false;
    }

    throw new Error(
      `Port ${gamePort} is already in use. Stop the existing Vite dev server and retry.`,
    );
  }

  processGroup.run("game", "pnpm", ["exec", "vite"], {
    env: {
      ...process.env,
      ...env,
    },
  });
  await waitForPort(gamePort, START_TIMEOUT_MS);
  return true;
};

export const runGameDevCli = async ({
  cwd = process.cwd(),
  argv = process.argv.slice(2),
  env = process.env,
  serverPort = 4000,
} = {}) => {
  loadEnvFile(path.join(cwd, ".env"), env);
  loadEnvFile(path.join(cwd, ".env.local"), env);
  const runtimeEnv = loadCreateAirJamRuntimeEnv({
    env,
    boundary: "create-airjam.dev",
  });
  const secureRootDir = runtimeEnv.AIR_JAM_SECURE_ROOT
    ? path.resolve(cwd, runtimeEnv.AIR_JAM_SECURE_ROOT)
    : cwd;

  const help = hasFlag(argv, "--help") || hasFlag(argv, "-h");
  if (help) {
    usage();
    return;
  }

  const args = parseGameDevArgs(argv, runtimeEnv);
  if (args.webOnly && args.serverOnly) {
    throw new Error("Cannot combine --web-only and --server-only.");
  }

  const processGroup = createProcessGroup();
  processGroup.registerSignalHandlers();

  try {
    let secureState = null;
    if (args.secure) {
      secureState = loadSecureDevState({
        cwd: secureRootDir,
        mode: args.secureMode,
        env: runtimeEnv,
        gamePort: args.port,
      });
      console.log(`[dev] Secure mode: ${secureState.mode}`);
      console.log(`[dev] Public host: ${secureState.publicHost}`);
    }

    let startedServer = false;
    if (!args.webOnly) {
      startedServer = await startServerIfNeeded(processGroup, serverPort);
    } else {
      console.log("[dev] Web-only mode: skipping local Air Jam server startup.");
    }

    let startedGame = false;
    if (!args.serverOnly) {
      startedGame = await startGameIfNeeded(processGroup, {
        gamePort: args.port || DEFAULT_GAME_PORT,
        env: args.secure
          ? buildSecureGameEnv({
              secureState,
              webOnly: args.webOnly,
              env: runtimeEnv,
            })
          : {
              VITE_AIR_JAM_RUNTIME_TOPOLOGY: serializeResolvedTopology(
                buildStandaloneGameTopology({
                  surfaceRole: "host",
                  publicHost: getDefaultPublicHost(
                    env,
                    args.port || DEFAULT_GAME_PORT,
                  ),
                }),
              ),
              VITE_AIR_JAM_PUBLIC_HOST: getDefaultPublicHost(
                env,
                args.port || DEFAULT_GAME_PORT,
              ),
              ...(args.webOnly && runtimeEnv.VITE_AIR_JAM_SERVER_URL
                ? {
                    VITE_AIR_JAM_SERVER_URL: runtimeEnv.VITE_AIR_JAM_SERVER_URL,
                  }
                : {}),
            },
        allowExistingGame: args.allowExistingGame,
      });
    }

    if (args.secure && secureState.mode === SECURE_MODE_TUNNEL) {
      processGroup.run("cloudflared", "cloudflared", [
        "tunnel",
        "--config",
        path.join(secureRootDir, ".cloudflared/config.yml"),
        "run",
        secureState.tunnelName,
      ]);

      console.log(`Cloudflare tunnel: ${secureState.tunnelName}`);
    }

    if (!startedServer && !startedGame) {
      await holdProcessOpen();
    }
  } catch (error) {
    processGroup.shutdown(1);
    throw error;
  }
};
