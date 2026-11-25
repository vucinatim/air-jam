import {
  createRuntimeErrorReporter,
  type RuntimeErrorReporter,
} from "../protocol/runtime-reporting";

/**
 * Air Jam's hosted environments: where each one's rooms live and the platform
 * that runs them. Beta runs the next release exactly as production will
 * (docs at airjam.io); a game reaches one by pointing its rooms at it.
 */
export const AIR_JAM_HOSTED_ENVIRONMENTS = [
  {
    name: "production",
    roomsOrigin: "https://rooms.airjam.io",
    platformOrigin: "https://airjam.io",
  },
  {
    name: "beta",
    roomsOrigin: "https://rooms.beta.airjam.io",
    platformOrigin: "https://beta.airjam.io",
  },
] as const;

export type AirJamHostedEnvironment =
  (typeof AIR_JAM_HOSTED_ENVIRONMENTS)[number];

/** Where Air Jam's production rooms live. */
export const AIR_JAM_HOSTED_ROOMS_ORIGIN =
  AIR_JAM_HOSTED_ENVIRONMENTS[0].roomsOrigin;

/** The hosted environment whose rooms live at this origin, if any. */
export const findHostedEnvironment = (
  roomsOrigin: string,
): AirJamHostedEnvironment | undefined =>
  AIR_JAM_HOSTED_ENVIRONMENTS.find(
    (environment) => environment.roomsOrigin === roomsOrigin,
  );

/**
 * The platform route that signs a host grant for a game's App ID, for the
 * page origin that asks. Hosted rooms open only with such a grant, so a game
 * on its own site needs its App ID and nothing else.
 */
export const hostedHostGrantEndpoint = (environment: AirJamHostedEnvironment) =>
  `${environment.platformOrigin}/api/airjam/host-grant`;

const reporters = new Map<string, RuntimeErrorReporter>();

/**
 * Sends a page's render-crash report to the platform that runs its rooms,
 * as the hosted rooms' own reports reach it. The report carries no
 * credential.
 */
export const hostedRuntimeErrorReporter = (
  environment: AirJamHostedEnvironment,
): RuntimeErrorReporter => {
  const existing = reporters.get(environment.name);
  if (existing) return existing;
  const reporter = createRuntimeErrorReporter({
    endpoint: `${environment.platformOrigin}/api/airjam/runtime-errors`,
    credentials: "omit",
  });
  reporters.set(environment.name, reporter);
  return reporter;
};
