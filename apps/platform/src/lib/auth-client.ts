import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: `https://${process.env.VERCEL_URL}` || "http://localhost:3000",
});
