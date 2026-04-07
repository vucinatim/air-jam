import type { NextConfig } from "next";
import {
  resolveRuntimeTopology,
  serializeRuntimeTopology,
} from "@air-jam/runtime-topology";

const resolvedAppUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const resolvePlatformShellTopologyEnv = (
  surfaceRole: "platform-host" | "platform-controller",
) => {
  const envKey =
    surfaceRole === "platform-host"
      ? "NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY"
      : "NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY";
  const existing = process.env[envKey];
  if (existing?.trim()) {
    return existing;
  }

  return serializeRuntimeTopology(
    resolveRuntimeTopology({
      runtimeMode: "hosted-release",
      surfaceRole,
      appOrigin: resolvedAppUrl,
      backendOrigin:
        process.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL?.trim() || resolvedAppUrl,
      publicHost: resolvedAppUrl,
      secureTransport: resolvedAppUrl.startsWith("https://"),
      proxyStrategy: "none",
    }),
  );
};

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  transpilePackages: ["@air-jam/sdk"],
  env: {
    // Expose VERCEL_URL to the client as NEXT_PUBLIC_APP_URL so we can auto-detect the domain
    // VERCEL_URL is automatically set by Vercel (includes custom domains like air-jam.app)
    NEXT_PUBLIC_APP_URL: resolvedAppUrl,
    NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY:
      resolvePlatformShellTopologyEnv("platform-host"),
    NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY:
      resolvePlatformShellTopologyEnv("platform-controller"),
    NEXT_PUBLIC_AUTH_GITHUB_ENABLED:
      process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED ||
      (process.env.GITHUB_CLIENT_ID ? "true" : "false"),
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self';",
          },
        ],
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.AIR_JAM_DEV_PROXY_BACKEND_URL?.trim();
    if (!backendUrl) {
      return [];
    }

    return [
      {
        source: "/socket.io",
        destination: `${backendUrl}/socket.io/`,
      },
      {
        source: "/socket.io/",
        destination: `${backendUrl}/socket.io/`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${backendUrl}/socket.io/:path*`,
      },
      {
        source: "/__airjam/:path*",
        destination: `${backendUrl}/__airjam/:path*`,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.mdx": {
        loaders: ["turbopack-mdx-loader"],
        as: "*.tsx",
      },
    },
  },
};

export default nextConfig;
