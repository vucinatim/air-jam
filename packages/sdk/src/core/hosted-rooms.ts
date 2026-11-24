import type { RuntimeErrorReporter } from "../protocol/runtime-reporting";

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
 * as the hosted rooms' own reports reach it. Fire and forget: the page is
 * already showing its crash, and the report carries no credential.
 */
export const hostedRuntimeErrorReporter: RuntimeErrorReporter = (report) => {
  void fetch(AIR_JAM_HOSTED_RUNTIME_ERRORS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(report),
    credentials: "omit",
    keepalive: true,
  });
};
