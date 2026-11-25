import { createRuntimeErrorReporter } from "../protocol/runtime-reporting";

/** Where Air Jam's hosted rooms live. */
export const AIR_JAM_HOSTED_ROOMS_ORIGIN = "https://rooms.airjam.io";

/**
 * The platform route that signs a host grant for a game's App ID, for the
 * page origin that asks. Hosted rooms open only with such a grant, so a game
 * on its own site needs its App ID and nothing else.
 */
export const AIR_JAM_HOSTED_HOST_GRANT_ENDPOINT =
  "https://airjam.io/api/airjam/host-grant";

/** The platform route that keeps render-crash reports from pages on Air Jam's hosted rooms. */
export const AIR_JAM_HOSTED_RUNTIME_ERRORS_ENDPOINT =
  "https://airjam.io/api/airjam/runtime-errors";

/**
 * Sends a page's render-crash report to the platform that runs its rooms,
 * as the hosted rooms' own reports reach it. The report carries no
 * credential.
 */
export const hostedRuntimeErrorReporter = createRuntimeErrorReporter({
  endpoint: AIR_JAM_HOSTED_RUNTIME_ERRORS_ENDPOINT,
  credentials: "omit",
});
