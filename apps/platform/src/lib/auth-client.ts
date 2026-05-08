import { createAuthClient } from "better-auth/react";
import { resolvePlatformPublicUrl } from "./platform-public-url";

// Use the current browser origin so auth stays same-origin across production,
// Railway domains, and Railway PR environments.
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : resolvePlatformPublicUrl(process.env);

export const authClient = createAuthClient({
  baseURL,
});
