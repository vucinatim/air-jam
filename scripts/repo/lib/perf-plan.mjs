export const perfProfiles = Object.freeze({
  ci: {
    durationMs: 15_000,
    warmupMs: 1_000,
    reconnectCycles: 5,
    strict: true,
  },
  release: {
    strict: true,
  },
});

const forwardedFlags = [
  "controllers",
  "hz",
  "durationMs",
  "warmupMs",
  "reconnectControllers",
  "reconnectCycles",
  "reconnectPauseMs",
];

export const buildPerfSanityArgs = (options = {}) => {
  const profile = options.profile
    ? perfProfiles[options.profile]
    : undefined;
  if (options.profile && !profile) {
    throw new Error(
      `Unknown performance profile "${options.profile}". Expected one of: ${Object.keys(perfProfiles).join(", ")}.`,
    );
  }

  const args = ["--filter", "server", "perf:sanity"];
  const forwarded = [];

  for (const flag of forwardedFlags) {
    const value = options[flag] ?? profile?.[flag];
    if (value !== undefined) {
      forwarded.push(`--${flag}=${value}`);
    }
  }

  if (options.strict || profile?.strict) {
    forwarded.push("--strict");
  }
  if (forwarded.length > 0) {
    args.push("--", ...forwarded);
  }

  return args;
};
