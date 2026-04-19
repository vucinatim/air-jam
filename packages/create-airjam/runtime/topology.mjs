import { resolveProjectRuntimeTopology } from "@air-jam/runtime-topology";
import path from "node:path";
import {
  detectLocalIpv4,
  getFlagValue,
  hasFlag,
  loadEnvFile,
} from "./dev-utils.mjs";
import { loadCreateAirJamRuntimeEnv } from "./runtime-env.mjs";
import {
  DEFAULT_GAME_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "./secure-dev.mjs";
import { DEFAULT_AIR_JAM_DEV_BACKEND_URL } from "./vite-https.mjs";

const SUPPORTED_MODES = new Set([
  "standalone-dev",
  "self-hosted-production",
  "hosted-release",
]);

const getDefaultStandalonePublicHost = (env) => {
  const explicitPublicHost = env.VITE_AIR_JAM_PUBLIC_HOST?.trim();
  if (explicitPublicHost) {
    return explicitPublicHost;
  }

  const detectedIp = detectLocalIpv4();
  if (!detectedIp) {
    return `http://localhost:${DEFAULT_GAME_PORT}`;
  }

  return `http://${detectedIp}:${DEFAULT_GAME_PORT}`;
};

const requireConfiguredAppOrigin = (env, mode) => {
  const appOrigin =
    env.VITE_AIR_JAM_PUBLIC_HOST?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  if (appOrigin) {
    return appOrigin;
  }

  throw new Error(
    `Mode "${mode}" requires VITE_AIR_JAM_PUBLIC_HOST (or NEXT_PUBLIC_APP_URL) to be set.`,
  );
};

const createProjectSurfaceTopology = ({
  runtimeMode,
  secure,
  env,
  surfaceRole,
  cwd,
}) => {
  if (runtimeMode === "standalone-dev") {
    const secureState = secure
      ? loadSecureDevState({
          cwd,
          mode: SECURE_MODE_LOCAL,
          env,
          gamePort: DEFAULT_GAME_PORT,
        })
      : null;
    const publicHost = secure
      ? secureState.publicHost
      : getDefaultStandalonePublicHost(env);

    return resolveProjectRuntimeTopology({
      runtimeMode: secure ? "standalone-secure" : "standalone-dev",
      surfaceRole,
      appOrigin: publicHost,
      backendOrigin:
        env.VITE_AIR_JAM_SERVER_URL?.trim() || DEFAULT_AIR_JAM_DEV_BACKEND_URL,
      publicHost,
      secureTransport: secure,
    });
  }

  const appOrigin = requireConfiguredAppOrigin(env, runtimeMode);

  return resolveProjectRuntimeTopology({
    runtimeMode,
    surfaceRole,
    appOrigin,
    backendOrigin: env.VITE_AIR_JAM_SERVER_URL?.trim() || appOrigin,
    publicHost: env.VITE_AIR_JAM_PUBLIC_HOST?.trim() || appOrigin,
  });
};

export const runProjectTopologyCli = async ({
  cwd = process.cwd(),
  argv = process.argv.slice(2),
  env = process.env,
} = {}) => {
  if (hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    console.log("Usage: airjam topology --mode=<mode> [--secure]");
    console.log("");
    console.log("Modes:");
    console.log(
      "  standalone-dev          Resolve standalone local game topology",
    );
    console.log(
      "  self-hosted-production  Resolve self-hosted production topology",
    );
    console.log(
      "  hosted-release          Resolve hosted Air Jam release topology",
    );
    return;
  }

  loadEnvFile(path.join(cwd, ".env"), env);
  loadEnvFile(path.join(cwd, ".env.local"), env);
  const runtimeEnv = loadCreateAirJamRuntimeEnv({
    env,
    boundary: "create-airjam.topology",
  });

  const mode = getFlagValue(argv, "--mode")?.trim();
  if (!mode || !SUPPORTED_MODES.has(mode)) {
    throw new Error(
      "Missing or unsupported --mode. Use standalone-dev, self-hosted-production, or hosted-release.",
    );
  }

  const secure = hasFlag(argv, "--secure");
  if (secure && mode !== "standalone-dev") {
    throw new Error(
      `--secure is only supported with --mode=standalone-dev. ${mode} should express transport through its configured URL values.`,
    );
  }

  const surfaces = Object.fromEntries(
    ["host", "controller"].map((surfaceRole) => [
      surfaceRole,
      createProjectSurfaceTopology({
        runtimeMode: mode,
        secure,
        env: runtimeEnv,
        surfaceRole,
        cwd,
      }),
    ]),
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        mode,
        secure,
        surfaces,
      },
      null,
      2,
    )}\n`,
  );
};
