import { createAuthClient } from "better-auth/react";
import { resolvePlatformPublicUrl } from "./platform-public-url";

// Use current origin in the browser to ensure we use the correct domain (alias or deployment URL)
// This prevents CORS issues when VERCEL_URL points to the specific deployment but user is on the alias
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : resolvePlatformPublicUrl(process.env);

export const authClient = createAuthClient({
  baseURL,
});
