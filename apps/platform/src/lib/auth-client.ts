import { createAuthClient } from "better-auth/react";

// Use current origin in the browser to ensure we use the correct domain (alias or deployment URL)
// This prevents CORS issues when VERCEL_URL points to the specific deployment but user is on the alias
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL,
});
