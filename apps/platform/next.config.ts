import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
