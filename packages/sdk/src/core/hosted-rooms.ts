/** Where Air Jam's hosted rooms live. */
export const AIR_JAM_HOSTED_ROOMS_ORIGIN = "https://rooms.airjam.io";

/**
 * The platform route that signs a host grant for a game's App ID, for the
 * page origin that asks. Hosted rooms open only with such a grant, so a game
 * on its own site needs its App ID and nothing else.
 */
export const AIR_JAM_HOSTED_HOST_GRANT_ENDPOINT =
  "https://airjam.io/api/airjam/host-grant";
