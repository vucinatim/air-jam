import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  commandExists,
  detectLocalIpv4,
  getFlagValue,
  hasFlag,
  loadEnvFile,
  upsertEnv,
} from "./dev-utils.mjs";

export const SECURE_MODE_LOCAL = "local";
export const SECURE_MODE_TUNNEL = "tunnel";
export const DEFAULT_GAME_PORT = 5173;
export const DEFAULT_PLATFORM_PORT = 3000;

const SECURE_DEV_VERSION = 1;
const SECURE_MODE_VALUES = new Set([SECURE_MODE_LOCAL, SECURE_MODE_TUNNEL]);

export const resolveRequestedSecureMode = ({
  argv = [],
  env = process.env,
  defaultMode = SECURE_MODE_LOCAL,
} = {}) => {
  const flagValue = getFlagValue(argv, "--secure-mode");
  const envValue = env.AIR_JAM_SECURE_MODE;
  const rawValue = (flagValue ?? envValue ?? defaultMode).trim().toLowerCase();

  if (!SECURE_MODE_VALUES.has(rawValue)) {
    throw new Error(
      `Unsupported secure mode "${rawValue}". Use "local" or "tunnel".`,
    );
  }

  return rawValue;
};

export const parseSecureInitArgs = (argv = []) => ({
  mode: resolveRequestedSecureMode({ argv }),
  hostname: getFlagValue(argv, "--hostname")?.trim() ?? "",
  tunnel: getFlagValue(argv, "--tunnel")?.trim() ?? "",
});

export const parseGameDevArgs = (argv = [], env = process.env) => ({
  secure: hasFlag(argv, "--secure"),
  secureMode: resolveRequestedSecureMode({ argv, env }),
  webOnly: hasFlag(argv, "--web-only"),
  serverOnly: hasFlag(argv, "--server-only"),
  allowExistingGame: hasFlag(argv, "--allow-existing-game"),
  port: Number.parseInt(env.VITE_PORT ?? `${DEFAULT_GAME_PORT}`, 10),
});

export const getSecurePaths = (cwd) => {
  const rootDir = cwd;
  const airJamDir = path.join(rootDir, ".airjam");
  const certDir = path.join(airJamDir, "certs");
  return {
    rootDir,
    airJamDir,
    certDir,
    secureDevStateFile: path.join(airJamDir, "secure-dev.json"),
    certFile: path.join(certDir, "local-dev.pem"),
    keyFile: path.join(certDir, "local-dev-key.pem"),
    cloudflaredDir: path.join(rootDir, ".cloudflared"),
    cloudflaredConfigFile: path.join(rootDir, ".cloudflared", "config.yml"),
  };
};

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.silent ? ["ignore", "pipe", "pipe"] : "inherit",
    cwd: options.cwd,
    env: options.env ?? process.env,
  });

export const buildLocalCertificateHosts = (lanIp) => {
  const hosts = ["localhost", "127.0.0.1", "::1"];
  if (lanIp) {
    hosts.push(lanIp);
  }
  return hosts;
};

export const resolveSecurePublicHost = ({
  mode,
  port,
  lanIp,
  tunnelHost,
}) => {
  if (mode === SECURE_MODE_TUNNEL) {
    return tunnelHost;
  }

  const host = lanIp ?? "localhost";
  return `https://${host}:${port}`;
};

export const resolveSecureLoopbackHost = (port) => `https://127.0.0.1:${port}`;

export const resolveSecurePlatformHost = ({
  mode,
  lanIp,
  tunnelHost,
  port = DEFAULT_PLATFORM_PORT,
}) => {
  if (mode === SECURE_MODE_TUNNEL) {
    return tunnelHost;
  }

  const host = lanIp ?? "localhost";
  return `https://${host}:${port}`;
};

const readSecureDevState = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeSecureDevState = (filePath, state) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
};

const ensureMkcertInstalled = () => {
  if (!commandExists("mkcert", ["-help"])) {
    throw new Error(
      [
        "mkcert is required for local secure dev.",
        "Install it once, then rerun `airjam secure:init`.",
        "macOS: brew install mkcert",
        "Windows: winget install FiloSottile.mkcert or choco install mkcert",
        "Linux: install mkcert from your package manager or https://github.com/FiloSottile/mkcert",
      ].join("\n"),
    );
  }
};

const ensureCloudflaredInstalled = () => {
  if (!commandExists("cloudflared")) {
    throw new Error(
      [
        "cloudflared is required for tunnel secure mode.",
        "Install it once, then rerun `airjam secure:init --mode=tunnel ...`.",
      ].join("\n"),
    );
  }
};

const ensureCloudflareLogin = () => {
  const certPath = path.join(process.env.HOME || "", ".cloudflared", "cert.pem");
  if (!fs.existsSync(certPath)) {
    throw new Error("Cloudflare login not found. Run: cloudflared tunnel login");
  }
};

const ensureLocalCertificate = ({ cwd, certFile, keyFile, lanIp }) => {
  ensureMkcertInstalled();
  fs.mkdirSync(path.dirname(certFile), { recursive: true });
  const trustStores =
    process.env.AIR_JAM_MKCERT_TRUST_STORES?.trim() || "system,nss";
  const mkcertEnv = {
    ...process.env,
    TRUST_STORES: trustStores,
  };
  run("mkcert", ["-install"], {
    cwd,
    env: mkcertEnv,
  });
  run(
    "mkcert",
    [
      "-cert-file",
      certFile,
      "-key-file",
      keyFile,
      ...buildLocalCertificateHosts(lanIp),
    ],
    { cwd, env: mkcertEnv },
  );
};

const configureCloudflareTunnel = ({
  cwd,
  cloudflaredConfigFile,
  hostname,
  tunnel,
  gamePort,
}) => {
  ensureCloudflaredInstalled();
  ensureCloudflareLogin();

  let tunnelExists = false;
  try {
    run("cloudflared", ["tunnel", "info", tunnel], { cwd, silent: true });
    tunnelExists = true;
  } catch {
    tunnelExists = false;
  }

  if (!tunnelExists) {
    console.log(`Creating tunnel ${tunnel}...`);
    run("cloudflared", ["tunnel", "create", tunnel], { cwd });
  } else {
    console.log(`Tunnel ${tunnel} already exists, reusing it.`);
  }

  console.log(`Routing DNS ${hostname} -> ${tunnel}...`);
  run("cloudflared", ["tunnel", "route", "dns", tunnel, hostname], { cwd });

  const tunnelInfoRaw = run("cloudflared", ["tunnel", "info", tunnel], {
    cwd,
    silent: true,
  });
  const idMatch = tunnelInfoRaw.match(/[0-9a-f-]{36}/i);
  if (!idMatch) {
    throw new Error(
      "Could not resolve tunnel UUID from `cloudflared tunnel info`.",
    );
  }

  const tunnelId = idMatch[0];
  const credentialsFile = path.join(
    process.env.HOME || "",
    ".cloudflared",
    `${tunnelId}.json`,
  );

  fs.mkdirSync(path.dirname(cloudflaredConfigFile), { recursive: true });
  fs.writeFileSync(
    cloudflaredConfigFile,
    [
      `tunnel: ${tunnel}`,
      `credentials-file: ${credentialsFile}`,
      "",
      "ingress:",
      `  - hostname: ${hostname}`,
      `    service: https://127.0.0.1:${gamePort}`,
      "    originRequest:",
      "      noTLSVerify: true",
      "  - service: http_status:404",
      "",
    ].join("\n"),
    "utf8",
  );
};

export const initializeSecureDev = ({
  cwd,
  envFilePath,
  mode,
  hostname,
  tunnel,
  gamePort = DEFAULT_GAME_PORT,
  nextStepMessage = "pnpm run dev -- --secure",
} = {}) => {
  const paths = getSecurePaths(cwd);
  const lanIp = detectLocalIpv4();
  const tunnelHost = hostname ? `https://${hostname}` : null;

  ensureLocalCertificate({
    cwd,
    certFile: paths.certFile,
    keyFile: paths.keyFile,
    lanIp,
  });

  if (mode === SECURE_MODE_TUNNEL) {
    if (!hostname || !tunnel) {
      throw new Error(
        "Tunnel mode requires both --hostname <dev.example.com> and --tunnel <tunnel-name>.",
      );
    }

    configureCloudflareTunnel({
      cwd,
      cloudflaredConfigFile: paths.cloudflaredConfigFile,
      hostname,
      tunnel,
      gamePort,
    });
  }

  const nextState = {
    version: SECURE_DEV_VERSION,
    mode,
    generatedAt: new Date().toISOString(),
    lanIp,
    certFile: paths.certFile,
    keyFile: paths.keyFile,
    hosts: buildLocalCertificateHosts(lanIp),
    publicHost: resolveSecurePublicHost({
      mode,
      port: gamePort,
      lanIp,
      tunnelHost,
    }),
    tunnelHost,
    tunnelName: tunnel || null,
  };

  writeSecureDevState(paths.secureDevStateFile, nextState);
  upsertEnv(envFilePath, "AIR_JAM_SECURE_MODE", mode);
  if (mode === SECURE_MODE_TUNNEL) {
    upsertEnv(envFilePath, "AIR_JAM_SECURE_PUBLIC_HOST", nextState.publicHost);
    upsertEnv(envFilePath, "CLOUDFLARE_TUNNEL_NAME", tunnel);
  }

  console.log("\nSecure dev setup complete.");
  console.log(`Mode: ${mode}`);
  console.log(`Public host: ${nextState.publicHost}`);
  console.log(`Certificate: ${paths.certFile}`);

  if (!lanIp) {
    console.log(
      "No LAN IPv4 address was detected. Secure dev will work on localhost, but phone-on-LAN testing is not configured.",
    );
  }

  if (mode === SECURE_MODE_TUNNEL) {
    console.log(`Tunnel: ${tunnel}`);
  }

  console.log(`Next: ${nextStepMessage}`);
  return nextState;
};

export const loadSecureDevState = ({
  cwd,
  mode,
  env = process.env,
  gamePort = DEFAULT_GAME_PORT,
} = {}) => {
  const paths = getSecurePaths(cwd);
  const state = readSecureDevState(paths.secureDevStateFile);
  if (!state) {
    throw new Error("Missing .airjam/secure-dev.json. Run `airjam secure:init` first.");
  }

  if (
    !fs.existsSync(state.certFile ?? "") ||
    !fs.existsSync(state.keyFile ?? "")
  ) {
    throw new Error(
      "Missing local HTTPS certificate files. Run `pnpm secure:init` again.",
    );
  }

  if (mode === SECURE_MODE_LOCAL) {
    const currentLanIp = detectLocalIpv4();
    if ((state.lanIp ?? null) !== (currentLanIp ?? null)) {
      throw new Error(
        "Your LAN IPv4 address changed since secure setup was created. Run `airjam secure:init` again.",
      );
    }
  }

  const publicHost = resolveSecurePublicHost({
    mode,
    port: gamePort,
    lanIp: state.lanIp ?? null,
    tunnelHost:
      env.AIR_JAM_SECURE_PUBLIC_HOST?.trim() || state.tunnelHost || null,
  });

  const tunnelName =
    env.CLOUDFLARE_TUNNEL_NAME?.trim() || state.tunnelName || null;
  if (mode === SECURE_MODE_TUNNEL && !tunnelName) {
    throw new Error(
      "Missing CLOUDFLARE_TUNNEL_NAME for tunnel secure mode. Run `airjam secure:init --mode=tunnel ...` again.",
    );
  }

  return {
    ...state,
    mode,
    publicHost,
    tunnelName,
    certFile: state.certFile,
    keyFile: state.keyFile,
    loopbackHost: resolveSecureLoopbackHost(gamePort),
    platformHost: resolveSecurePlatformHost({
      mode,
      lanIp: state.lanIp ?? null,
      tunnelHost:
        env.AIR_JAM_SECURE_PUBLIC_HOST?.trim() || state.tunnelHost || null,
      port: DEFAULT_PLATFORM_PORT,
    }),
  };
};

export const buildSecureGameEnv = ({
  secureState,
  webOnly,
  serverUrl = "",
} = {}) => ({
  AIR_JAM_SECURE_MODE: secureState.mode,
  AIR_JAM_SECURE_PUBLIC_HOST: secureState.publicHost,
  AIR_JAM_DEV_CERT_FILE: secureState.certFile,
  AIR_JAM_DEV_KEY_FILE: secureState.keyFile,
  AIR_JAM_DEV_PROXY_BACKEND_URL: "http://127.0.0.1:4000",
  VITE_AIR_JAM_PUBLIC_HOST: secureState.publicHost,
  VITE_AIR_JAM_SERVER_URL: webOnly ? process.env.VITE_AIR_JAM_SERVER_URL ?? serverUrl : serverUrl,
});

export const appendNextHttpsArgs = ({
  env = process.env,
  args = [],
} = {}) => {
  const certFile = env.AIR_JAM_DEV_CERT_FILE;
  const keyFile = env.AIR_JAM_DEV_KEY_FILE;
  if (!certFile || !keyFile) {
    return args;
  }

  return [
    ...args,
    "--experimental-https",
    "--experimental-https-key",
    keyFile,
    "--experimental-https-cert",
    certFile,
  ];
};

export const runSecureInitCli = async ({
  cwd = process.cwd(),
  argv = process.argv.slice(2),
  env = process.env,
  nextStepMessage = "pnpm run dev -- --secure",
} = {}) => {
  if (hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    console.log(
      "Usage: airjam secure:init [--mode=local|tunnel] [--hostname <dev.example.com>] [--tunnel <tunnel-name>]",
    );
    console.log("");
    console.log("Modes:");
    console.log("  local  Generate trusted local HTTPS certs with mkcert (default)");
    console.log(
      "  tunnel Generate local HTTPS certs and configure the optional Cloudflare tunnel fallback",
    );
    return;
  }

  loadEnvFile(path.join(cwd, ".env"), env);
  loadEnvFile(path.join(cwd, ".env.local"), env);

  const args = parseSecureInitArgs(argv);
  initializeSecureDev({
    cwd,
    envFilePath: path.join(cwd, ".env.local"),
    mode: args.mode,
    hostname: args.hostname,
    tunnel: args.tunnel,
    gamePort: Number.parseInt(env.VITE_PORT ?? `${DEFAULT_GAME_PORT}`, 10),
    nextStepMessage,
  });
};
