import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  transpilePackages: ["@air-jam/sdk"],
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN", // Allow embedding from same origin (for iframes within platform)
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' *;", // Allow this platform to be embedded, and allow embedding games
          },
        ],
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
