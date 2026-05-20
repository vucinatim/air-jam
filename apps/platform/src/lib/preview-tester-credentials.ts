/**
 * Credentials for the seeded preview tester account.
 *
 * Lives in its own module (separate from seed-preview.ts, which pulls
 * in better-auth + drizzle) so the values can be referenced from
 * server components and client UI without dragging the seed runtime
 * into either bundle.
 *
 * Not a secret: previews are by definition disposable, the password
 * appears in the page source when rendered, and the docs say so.
 */
export const PREVIEW_TESTER_CREDENTIALS = {
  email: "preview-tester@airjam.dev",
  password: "preview-tester-password",
  name: "Preview Tester",
} as const;
