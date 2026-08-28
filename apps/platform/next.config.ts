import {
  resolveRuntimeTopology,
  serializeRuntimeTopology,
} from "@air-jam/sdk/runtime-topology";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "node:path";
import { resolvePlatformDeploymentConfig } from "./src/lib/platform-deployment-config";

const repoRoot = path.resolve(process.cwd(), "../..");

const deploymentConfig = resolvePlatformDeploymentConfig(process.env);
const resolvedAppUrl = deploymentConfig.platformPublicUrl;

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
      backendOrigin: deploymentConfig.backendPublicUrl,
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
  const scriptSrcHosts = allowInsecureDevFrames ? " https://unpkg.com" : "";
  const workerSrc = allowInsecureDevFrames
    ? "worker-src 'self' blob:"
    : "worker-src 'self'";

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
  // - first-party product telemetry uses the same-origin ingestion route
  //
  // `'unsafe-inline'` and `'unsafe-eval'` are required for Next.js runtime
  // bootstrap scripts. Keep this as the single authoritative CSP — individual
  // routes should not override it unless there is a concrete product reason.
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'${scriptSrcHosts}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSrc,
    "media-src 'self' blob: https:",
    workerSrc,
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
  output: "standalone",
  outputFileTracingRoot: repoRoot,
  // Force drizzle migration SQL + journal into the standalone trace so
  // scripts/run-platform.mjs can apply migrations against the ephemeral
  // Postgres on Railway PR previews. These files are read from disk at
  // runtime (not statically imported) so Next.js wouldn't include them
  // otherwise.
  outputFileTracingIncludes: {
    "/": ["./drizzle/**/*"],
  },
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  transpilePackages: ["@air-jam/database-contract", "@air-jam/sdk"],
  env: {
    // Publish the resolved public app URL as one canonical client-visible identity.
    NEXT_PUBLIC_APP_URL: resolvedAppUrl,
    // Explicitly bake the App ID rather than relying on Next.js auto-inlining,
    // which is not firing in this Dockerfile + Turbopack build.
    NEXT_PUBLIC_AIR_JAM_APP_ID: deploymentConfig.appId ?? "",
    NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY:
      resolvePlatformShellTopologyEnv("platform-host"),
    NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY:
      resolvePlatformShellTopologyEnv("platform-controller"),
    NEXT_PUBLIC_AUTH_GITHUB_ENABLED: deploymentConfig.githubAuthEnabled
      ? "true"
      : "false",
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
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.airjam.io" }],
        destination: "https://airjam.io/:path*",
        permanent: true,
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
