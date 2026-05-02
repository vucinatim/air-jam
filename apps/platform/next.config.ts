import {
  resolveRuntimeTopology,
  serializeRuntimeTopology,
} from "@air-jam/runtime-topology";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import { resolvePlatformPublicUrl } from "./src/lib/platform-public-url";

const resolvedAppUrl = resolvePlatformPublicUrl(process.env);

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

export const createPlatformSecurityHeaders = ({
  allowInsecureDevFrames,
}: {
  allowInsecureDevFrames: boolean;
}) => {
  const connectSrc = allowInsecureDevFrames
    ? "connect-src 'self' http: https: ws: wss:"
    : "connect-src 'self' https: ws: wss:";
  const frameSrc = allowInsecureDevFrames
    ? "frame-src 'self' http: https:"
    : "frame-src 'self' https:";
  const frameAncestors = allowInsecureDevFrames
    ? "frame-ancestors 'self' http: https:"
    : "frame-ancestors 'self'";

  // Baseline CSP tuned for the real Air Jam embed model:
  // - the platform shell iframes game release content from the same origin
  //   (under /releases/g/... and /airjam-local-builds/...)
  // - local dev and browser smoke also embed repo games from explicit
  //   loopback/LAN http origins, so non-production must allow `http:` frame
  //   ancestors as well as `http:` frame sources
  // - games connect to the realtime server over ws:/wss:/http:/https:
  //   during local smoke/dev, Socket.IO still uses loopback http polling
  // - creator-provided media URLs may live on any https host
  // - Sentry SDK is bundled; DSN traffic is a generic https: connect target
  // - first-party product telemetry loads explicit Umami and Vercel scripts
  //
  // `'unsafe-inline'` and `'unsafe-eval'` are required for Next.js runtime
  // bootstrap scripts. Keep this as the single authoritative CSP — individual
  // routes should not override it unless there is a concrete product reason.
  const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cloud.umami.is https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    "media-src 'self' blob: https:",
    frameSrc,
    frameAncestors,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const permissionsPolicy = [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
  ].join(", ");

  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: permissionsPolicy },
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
  ];

  if (!allowInsecureDevFrames) {
    headers.unshift({ key: "X-Frame-Options", value: "SAMEORIGIN" });
  }

  return headers;
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
    const allowInsecureDevFrames = process.env.NODE_ENV !== "production";
    return [
      {
        source: "/:path*",
        headers: createPlatformSecurityHeaders({ allowInsecureDevFrames }),
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

export default withSentryConfig(nextConfig, {
  org: "timvucina-bo",
  project: "airjam-platform",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
