import {
  getAirJamDevProxyOptions,
  getAirJamHttpsServerOptions,
} from "./vite-https.mjs";

export const AIR_JAM_IFRAME_HEADERS = {
  // Air Jam games must be embeddable inside the local Arcade shell.
  "Content-Security-Policy": "frame-ancestors *;",
};

const AIR_JAM_VITE_PROFILES = new Set(["default", "three"]);

const resolveThreeProfileManualChunk = (id) => {
  if (id.includes("/zod/") || id.includes("/packages/sdk/src/")) {
    // Keep SDK runtime dependencies with the SDK chunk so schema evaluation
    // cannot race a separate vendor chunk during embedded production startup.
    return "airjam-sdk";
  }

  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (
    id.includes("@dimforge/rapier3d-compat") ||
    id.includes("@react-three/rapier")
  ) {
    return "rapier-runtime";
  }

  if (
    id.includes("@react-three/drei") ||
    id.includes("three-stdlib") ||
    id.includes("@use-gesture") ||
    id.includes("@react-spring")
  ) {
    return "drei-runtime";
  }

  if (id.includes("@react-three/fiber")) {
    return "fiber-runtime";
  }

  if (id.includes("/three/")) {
    return "three-core";
  }

  if (
    id.includes("/react/") ||
    id.includes("/react-dom/") ||
    id.includes("react-router-dom")
  ) {
    // Keep the core React/app runtime in one chunk for the three profile.
    // Splitting React away from state/router/runtime helpers created a
    // circular startup edge in built embeds.
    return "app-runtime";
  }

  if (
    id.includes("/zustand/") ||
    id.includes("/howler/") ||
    id.includes("/socket.io-client/") ||
    id.includes("/qrcode/")
  ) {
    return "app-runtime";
  }

  return undefined;
};

const resolveBuildConfig = (profile) => {
  if (profile === "three") {
    return {
      rollupOptions: {
        output: {
          manualChunks: resolveThreeProfileManualChunk,
        },
      },
    };
  }

  return undefined;
};

const createSharedDevServerConfig = ({ env, port }) => ({
  host: true,
  allowedHosts: true,
  https: getAirJamHttpsServerOptions(env),
  port,
  strictPort: true,
  headers: AIR_JAM_IFRAME_HEADERS,
  cors: true,
});

export const createAirJamViteConfig = ({
  env = process.env,
  port = Number(env.VITE_PORT || 5173),
  profile = "default",
} = {}) => {
  if (!AIR_JAM_VITE_PROFILES.has(profile)) {
    throw new Error(
      `Unsupported Air Jam Vite profile "${profile}". Use "default" or "three".`,
    );
  }

  const build = resolveBuildConfig(profile);

  return {
    ...(build ? { build } : {}),
    server: {
      ...createSharedDevServerConfig({ env, port }),
      proxy: getAirJamDevProxyOptions(env),
    },
    preview: createSharedDevServerConfig({ env, port }),
  };
};
